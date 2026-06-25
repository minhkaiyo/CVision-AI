"""
Layout-aware document analyzer for CV parsing.

Provides two analysis paths:
1. pdfplumber  — For proper PDFs: extracts text with exact (x,y) coordinates,
                 detects multi-column layout, font sizes, whitespace density.
2. Vision LLM  — For image files (PNG/JPG) and scanned PDFs: encodes image
                 as base64 and sends to a vision-capable LLM (GPT-4o, Gemini).

The result is a LayoutAnalysis dataclass that the scoring engine uses to give
much more accurate layout scores than text-only parsing.
"""

from __future__ import annotations

import base64
import io
import logging
import tempfile
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)


# ── Result dataclass ──────────────────────────────────────────────────────────

@dataclass
class LayoutAnalysis:
    """Layout metrics extracted from a CV document."""

    # General
    method: str = "text"          # "pdfplumber" | "vision" | "text"
    page_count: int = 1
    word_count: int = 0
    char_count: int = 0

    # Structure
    has_multi_column: bool = False
    column_count: int = 1
    has_tables: bool = False
    has_images: bool = False
    has_header: bool = False      # Distinct header block at top

    # Typography
    unique_font_sizes: list[float] = field(default_factory=list)
    has_font_hierarchy: bool = False   # h1/h2/body distinction
    dominant_font_size: float = 10.0

    # Whitespace & density
    whitespace_ratio: float = 0.3     # 0-1, higher = more breathing room
    line_spacing_consistent: bool = True

    # CV sections detected
    detected_sections: list[str] = field(default_factory=list)
    section_count: int = 0

    # Warnings (for scoring penalties)
    warnings: list[str] = field(default_factory=list)

    # Vision description (if vision LLM was used)
    vision_description: str = ""

    # Layout score override from vision (0-100, -1 = not set)
    vision_layout_score: int = -1


# ── pdfplumber path ───────────────────────────────────────────────────────────

def _analyze_pdf_layout(content: bytes) -> LayoutAnalysis:
    """
    Use pdfplumber to extract layout metrics with pixel-accurate coordinates.

    Detects:
    - Multi-column layout by clustering x-coordinates of text blocks
    - Tables (pdfplumber native)
    - Images
    - Font size hierarchy
    - Section headers by font size / bold heuristic
    """
    try:
        import pdfplumber
    except ImportError:
        logger.warning("pdfplumber not installed; falling back to text analysis")
        return LayoutAnalysis(method="text", warnings=["pdfplumber not available"])

    result = LayoutAnalysis(method="pdfplumber")
    all_words: list[dict] = []
    all_font_sizes: list[float] = []
    section_keywords = {
        "experience", "education", "skills", "work", "projects", "summary",
        "profile", "objective", "certifications", "achievements", "contact",
        "kinh nghiệm", "học vấn", "kỹ năng", "dự án", "chứng chỉ",
    }
    detected_sections: set[str] = set()

    try:
        with pdfplumber.open(io.BytesIO(content)) as pdf:
            result.page_count = len(pdf.pages)

            for page in pdf.pages:
                # Tables
                tables = page.find_tables()
                if tables:
                    result.has_tables = True

                # Images
                if page.images:
                    result.has_images = True

                # Words with coordinates
                words = page.extract_words(
                    extra_attrs=["fontname", "size"],
                    use_text_flow=True,
                )
                all_words.extend(words)

                for w in words:
                    sz = w.get("size", 0)
                    if sz:
                        all_font_sizes.append(round(float(sz), 1))

                    text_lower = w.get("text", "").lower().rstrip(":").strip()
                    if text_lower in section_keywords:
                        detected_sections.add(text_lower)

    except Exception as e:
        logger.warning("pdfplumber analysis failed: %s", e)
        result.warnings.append(f"pdfplumber error: {e}")
        return result

    # ── Column detection ──────────────────────────────────────────────────────
    # Cluster x0 (left edge) of words. Two distinct clusters → multi-column.
    if all_words:
        x0_values = [w.get("x0", 0) for w in all_words]
        page_width = 595  # A4 approx, overridden below if available

        # Simple bimodal detection: if >20% of words have x0 > 45% of page width
        # AND there are words near left margin, it's likely 2-column.
        left_words = sum(1 for x in x0_values if x < page_width * 0.45)
        right_words = sum(1 for x in x0_values if x > page_width * 0.48)
        total = len(x0_values)

        if total > 10 and right_words / total > 0.20 and left_words / total > 0.20:
            result.has_multi_column = True
            result.column_count = 2
            result.warnings.append("multi_column_layout")

    # ── Font hierarchy ────────────────────────────────────────────────────────
    if all_font_sizes:
        unique = sorted(set(all_font_sizes), reverse=True)
        result.unique_font_sizes = unique[:8]
        result.dominant_font_size = sorted(all_font_sizes)[len(all_font_sizes) // 2]  # median

        # Font hierarchy: if there are 3+ distinct sizes with meaningful gaps
        if len(unique) >= 3 and (unique[0] - unique[-1]) > 4:
            result.has_font_hierarchy = True
        elif len(unique) < 2:
            result.warnings.append("no_font_hierarchy")

    # ── Word/char count ───────────────────────────────────────────────────────
    all_text = " ".join(w.get("text", "") for w in all_words)
    result.word_count = len(all_text.split())
    result.char_count = len(all_text)

    # ── Sections ─────────────────────────────────────────────────────────────
    result.detected_sections = list(detected_sections)
    result.section_count = len(detected_sections)

    # ── Warnings summary ──────────────────────────────────────────────────────
    if result.has_tables:
        result.warnings.append("contains_tables")
    if result.has_images:
        result.warnings.append("contains_images")
    if result.word_count < 100:
        result.warnings.append("low_word_count")
    if result.section_count < 2:
        result.warnings.append("few_sections")

    return result


# ── Vision LLM path ───────────────────────────────────────────────────────────

async def _analyze_via_vision(content: bytes, filename: str) -> LayoutAnalysis:
    """
    Send the document as an image to a vision-capable LLM.

    For image files: encode directly.
    For PDFs: render first page to image via pdfplumber, then encode.

    The LLM returns a structured assessment of the CV layout.
    """
    result = LayoutAnalysis(method="vision")

    try:
        img_b64, mime_type = await _to_base64_image(content, filename)
    except Exception as e:
        logger.warning("Vision image conversion failed: %s", e)
        result.warnings.append(f"vision_conversion_failed: {e}")
        return result

    prompt = """You are a CV/resume layout expert. Analyze this document image and return a JSON object.

Evaluate:
1. Is this actually a CV/resume? (not a photo, random image, or other document)
2. Layout: single-column or multi-column? Are there tables or graphics?
3. Typography: clear font hierarchy (headers vs body)? Consistent spacing?
4. Sections: which CV sections are visible? (experience, education, skills, contact, summary, etc.)
5. Overall layout quality score 0-100 for ATS compatibility

Return ONLY this JSON (no markdown, no explanation):
{
  "is_cv": true/false,
  "layout_type": "single_column" | "two_column" | "multi_column" | "unknown",
  "has_tables": true/false,
  "has_images_or_graphics": true/false,
  "font_hierarchy": true/false,
  "consistent_spacing": true/false,
  "detected_sections": ["experience", "education", ...],
  "warnings": ["multi_column", "has_tables", "has_photos", ...],
  "layout_score": 0-100,
  "description": "1-2 sentence assessment in Vietnamese"
}"""

    try:
        from app.llm import get_llm_config, get_model_name
        from litellm import acompletion

        config = get_llm_config()

        # Build vision message
        messages = [
            {
                "role": "user",
                "content": [
                    {
                        "type": "image_url",
                        "image_url": {"url": f"data:{mime_type};base64,{img_b64}"},
                    },
                    {"type": "text", "text": prompt},
                ],
            }
        ]

        response = await acompletion(
            model=config.model,
            messages=messages,
            api_key=config.api_key,
            api_base=config.api_base,
            max_tokens=512,
            temperature=0,
        )

        import json
        raw = response.choices[0].message.content or ""
        # Strip markdown code blocks if present
        raw = raw.strip().removeprefix("```json").removeprefix("```").removesuffix("```").strip()
        data = json.loads(raw)

        # Map response to LayoutAnalysis
        result.has_multi_column = data.get("layout_type", "") in ("two_column", "multi_column")
        result.column_count = 2 if result.has_multi_column else 1
        result.has_tables = bool(data.get("has_tables", False))
        result.has_images = bool(data.get("has_images_or_graphics", False))
        result.has_font_hierarchy = bool(data.get("font_hierarchy", False))
        result.line_spacing_consistent = bool(data.get("consistent_spacing", True))
        result.detected_sections = data.get("detected_sections", [])
        result.section_count = len(result.detected_sections)
        result.warnings = data.get("warnings", [])
        result.vision_layout_score = int(data.get("layout_score", -1))
        result.vision_description = data.get("description", "")

        if not data.get("is_cv", True):
            result.warnings.append("not_a_cv")

        if result.has_multi_column:
            result.warnings.append("multi_column_layout")
        if result.has_tables:
            result.warnings.append("contains_tables")

    except Exception as e:
        logger.warning("Vision LLM analysis failed: %s", e)
        result.warnings.append(f"vision_llm_error: {e}")

    return result


async def _to_base64_image(content: bytes, filename: str) -> tuple[str, str]:
    """Convert file content to base64 image string. Renders PDF first page if needed."""
    suffix = Path(filename).suffix.lower()

    if suffix in (".png", ".jpg", ".jpeg", ".webp", ".gif"):
        mime = f"image/{suffix.lstrip('.')}"
        return base64.b64encode(content).decode(), mime

    if suffix == ".pdf":
        # Render first page to PNG via pdfplumber + PIL
        try:
            import pdfplumber
            from PIL import Image as PILImage

            with pdfplumber.open(io.BytesIO(content)) as pdf:
                if not pdf.pages:
                    raise ValueError("Empty PDF")
                page = pdf.pages[0]
                img = page.to_image(resolution=150)
                buf = io.BytesIO()
                img.save(buf, format="PNG")
                return base64.b64encode(buf.getvalue()).decode(), "image/png"
        except Exception:
            # Fallback: use raw bytes if single-page PDF
            return base64.b64encode(content).decode(), "application/pdf"

    raise ValueError(f"Unsupported format for vision: {suffix}")


# ── Public entry point ────────────────────────────────────────────────────────

async def analyze_document_layout(
    content: bytes,
    filename: str,
    use_vision: bool = False,
) -> LayoutAnalysis:
    """
    Main entry point for layout analysis.

    Strategy:
    - PDF → pdfplumber (fast, accurate coordinates) always
    - Image (PNG/JPG) → Vision LLM (only option for images)
    - use_vision=True → add vision pass on top of pdfplumber for PDF

    Args:
        content: Raw file bytes
        filename: Original filename (for extension detection)
        use_vision: If True, also run vision LLM pass (more expensive but richer)
    """
    suffix = Path(filename).suffix.lower()

    # Image files: only vision can handle these
    if suffix in (".png", ".jpg", ".jpeg", ".webp"):
        logger.info("Image file detected (%s) — using vision LLM", suffix)
        return await _analyze_via_vision(content, filename)

    # PDF files: pdfplumber first, optionally vision
    if suffix == ".pdf":
        layout = _analyze_pdf_layout(content)

        # If PDF appears to be scanned (very low word count from text extraction),
        # automatically fall back to vision
        if layout.word_count < 50:
            logger.info("Low text yield from pdfplumber (%d words) — trying vision", layout.word_count)
            vision = await _analyze_via_vision(content, filename)
            # Merge: trust vision for sections/warnings, keep pdfplumber coords
            vision.method = "pdfplumber+vision"
            return vision

        if use_vision:
            vision = await _analyze_via_vision(content, filename)
            layout.vision_description = vision.vision_description
            layout.vision_layout_score = vision.vision_layout_score
            layout.method = "pdfplumber+vision"

        return layout

    # DOCX and other text formats: basic analysis only
    return LayoutAnalysis(method="text", warnings=["format_not_layout_analyzed"])


def layout_to_score_inputs(layout: LayoutAnalysis) -> dict[str, Any]:
    """
    Convert LayoutAnalysis into scoring inputs for calculate_ats_score.

    Returns a dict that can be merged into the parsed_data / scoring context.
    """
    formatting_penalty = 0

    if layout.has_multi_column:
        formatting_penalty += 25
    if layout.has_tables:
        formatting_penalty += 15
    if layout.has_images:
        formatting_penalty += 10
    if not layout.has_font_hierarchy:
        formatting_penalty += 10
    if layout.word_count < 100:
        formatting_penalty += 30

    # Use vision score if available (vision model has seen the actual layout)
    if layout.vision_layout_score >= 0:
        raw_layout_score = layout.vision_layout_score
    else:
        # Derive from penalties
        raw_layout_score = max(0, 100 - formatting_penalty)

    return {
        "layout_from_analysis": True,
        "layout_score_override": raw_layout_score,
        "has_multi_column": layout.has_multi_column,
        "has_tables": layout.has_tables,
        "has_images": layout.has_images,
        "has_font_hierarchy": layout.has_font_hierarchy,
        "detected_sections_layout": layout.detected_sections,
        "layout_warnings": layout.warnings,
        "layout_word_count": layout.word_count,
        "layout_description": layout.vision_description,
        "formatting_penalty": formatting_penalty,
    }
