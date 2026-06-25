"""CV Analysis endpoints — parse, score (deterministic + LLM), persist."""

from fastapi import APIRouter, File, UploadFile, Form, HTTPException, Depends
from typing import Optional
import logging

from app.services.parser import parse_document, parse_resume_to_json
from app.services.improver import extract_job_keywords
from app.services.layout_analyzer import analyze_document_layout, layout_to_score_inputs
from app.services.fallback_processing import analyze_resume_fallback
from app.auth import verify_user, check_usage_limit, log_usage
from app.firebase_store import add_document, delete_document, get_document, query_documents
from app.llm import complete_json

router = APIRouter(tags=["analyses"])
logger = logging.getLogger(__name__)


# ── Deterministic ATS scorer ─────────────────────────────────────────────────

def _keyword_overlap(resume_text: str, jd: str) -> tuple[list[str], list[str]]:
    """Return (matched, missing) keyword lists from JD vs resume text."""
    import re
    # Extract 2+ letter alphanum tokens from JD as candidate keywords
    jd_tokens = set(
        w.lower() for w in re.findall(r"[A-Za-z][A-Za-z0-9.+#_-]{1,30}", jd or "")
        if w.lower() not in {
            "the", "and", "for", "with", "you", "are", "that", "this",
            "will", "have", "from", "they", "been", "your", "our", "we",
            "can", "all", "not", "but", "its", "has", "who", "what"
        }
    )
    resume_lower = resume_text.lower()
    matched = sorted(kw for kw in jd_tokens if kw in resume_lower)
    missing = sorted(kw for kw in jd_tokens if kw not in resume_lower)
    # Cap lists to keep payload reasonable
    return matched[:30], missing[:20]


def _detect_cv_quality(parsed_data: dict, resume_text: str) -> dict:
    """
    Detect whether the uploaded content is actually a CV/resume.
    Returns a quality assessment with penalty multiplier.

    A real CV should have:
    - Sufficient text length (> 150 words)
    - At least one of: work experience, education, skills
    - Personal contact info (email or phone)
    - Recognizable CV structure keywords
    """
    import re

    issues = []
    penalty = 0

    # 1. Text length check — penalty tiers but not too harsh for short structured CVs
    word_count = len(resume_text.split()) if resume_text else 0
    if word_count < 30:
        issues.append("not_enough_text")
        penalty += 60  # Very likely not a CV (image, blank page, etc.)
    elif word_count < 60:
        issues.append("very_short")
        penalty += 30
    elif word_count < 100:
        issues.append("short_content")
        penalty += 10

    # 2. Structural section detection
    text_lower = resume_text.lower() if resume_text else ""
    cv_section_keywords = [
        "experience", "education", "skills", "work", "employment",
        "kinh nghiệm", "học vấn", "kỹ năng", "làm việc", "summary",
        "objective", "profile", "projects", "dự án", "certification",
        "chứng chỉ", "achievement", "thành tích", "contact", "liên hệ",
    ]
    found_sections = sum(1 for kw in cv_section_keywords if kw in text_lower)

    if found_sections == 0:
        issues.append("no_cv_sections")
        penalty += 40
    elif found_sections < 2:
        issues.append("few_cv_sections")
        penalty += 20

    # 3. Structured data check
    has_work = bool(parsed_data.get("workExperience"))
    has_edu = bool(parsed_data.get("education"))
    has_skills = bool(
        parsed_data.get("additional", {}).get("technicalSkills")
        if isinstance(parsed_data.get("additional"), dict) else False
    )
    has_contact = bool(
        parsed_data.get("personalInfo", {}).get("email")
        or parsed_data.get("personalInfo", {}).get("phone")
        if isinstance(parsed_data.get("personalInfo"), dict) else False
    )

    structured_sections = sum([has_work, has_edu, has_skills, has_contact])
    if structured_sections == 0:
        issues.append("no_structured_data")
        penalty += 25

    # 4. Contact info check (email pattern)
    has_email = bool(re.search(r"[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}", resume_text or ""))
    if not has_email and word_count > 50:
        issues.append("no_email")
        penalty += 10

    # 5. Detect if it's clearly not a resume (random text, pure image, etc.)
    # Real CVs tend to have name-like patterns, dates, and structured content
    has_date = bool(re.search(r"\b(19|20)\d{2}\b", resume_text or ""))
    if not has_date and word_count > 100:
        issues.append("no_dates")
        penalty += 10

    is_valid_cv = penalty < 50
    penalty = min(penalty, 90)  # Cap at 90 so score never goes to 0 for borderline cases

    return {
        "is_valid_cv": is_valid_cv,
        "word_count": word_count,
        "found_sections": found_sections,
        "structured_sections": structured_sections,
        "issues": issues,
        "penalty_pct": penalty,  # 0-90, applied as multiplier to all scores
    }


def calculate_ats_score(parsed_data: dict, resume_text: str, jd: str, layout_inputs: dict | None = None) -> dict:
    """
    Deterministic ATS scoring with CV validation.

    Scoring is penalty-first: starts from earned points, not a generous baseline.
    Non-CV content (images, random text) gets heavily penalized.
    """
    import re

    # Step 0: Validate CV quality
    quality = _detect_cv_quality(parsed_data, resume_text)
    penalty_multiplier = 1.0 - (quality["penalty_pct"] / 100.0)

    matched, missing = _keyword_overlap(resume_text, jd)

    # ── Section completeness (0-based, no freebie) ───────────────────────────
    has_work = bool(parsed_data.get("workExperience"))
    has_edu = bool(parsed_data.get("education"))
    has_skills = bool(
        parsed_data.get("additional", {}).get("technicalSkills")
        if isinstance(parsed_data.get("additional"), dict) else False
    )
    has_email = bool(
        parsed_data.get("personalInfo", {}).get("email")
        if isinstance(parsed_data.get("personalInfo"), dict) else False
    )
    has_phone = bool(
        parsed_data.get("personalInfo", {}).get("phone")
        if isinstance(parsed_data.get("personalInfo"), dict) else False
    )

    sections_present = sum([has_work, has_edu, has_skills, has_email, has_phone])

    # ── Layout score ─────────────────────────────────────────────────────────
    # Use layout analyzer result if available (much more accurate than heuristics)
    if layout_inputs and layout_inputs.get("layout_from_analysis"):
        layout_score = layout_inputs["layout_score_override"]
        # Merge detected sections from layout analyzer
        layout_sections = set(layout_inputs.get("detected_sections_layout", []))
        if layout_sections:
            sections_present = max(sections_present, len(layout_sections))
        # Add layout warnings to quality issues
        layout_warnings = layout_inputs.get("layout_warnings", [])
        if "multi_column_layout" in layout_warnings:
            quality["issues"].append("multi_column_detected")
            quality["penalty_pct"] = min(quality["penalty_pct"] + 10, 90)
            penalty_multiplier = 1.0 - (quality["penalty_pct"] / 100.0)
        if "not_a_cv" in layout_warnings:
            quality["is_valid_cv"] = False
            quality["penalty_pct"] = min(quality["penalty_pct"] + 40, 90)
            penalty_multiplier = 1.0 - (quality["penalty_pct"] / 100.0)
    else:
        # Fallback: section-based layout score (original heuristic)
        word_count = quality["word_count"]
        format_bonus = min(20, max(0, (word_count - 100) // 20))
        layout_score = min(sections_present * 16 + format_bonus, 100)

    # ── Keyword score (0-based) ──────────────────────────────────────────────
    total_jd_kw = len(matched) + len(missing)
    if total_jd_kw > 0:
        keyword_score = int((len(matched) / total_jd_kw) * 100)
    else:
        # No JD provided: score based purely on CV content richness
        # More sections + longer text = more likely to contain relevant keywords
        keyword_score = min(sections_present * 10 + min(word_count // 30, 20), 60)

    # ── Experience quantification ────────────────────────────────────────────
    work_text = " ".join(
        str(b) for exp in (parsed_data.get("workExperience") or [])
        for b in (exp.get("description") or [])
    )
    has_metrics = bool(re.search(
        r"\d+\s*(%|x|times|hours?|people|team|million|k\b|,\d{3}|\$|vnd|tỷ|triệu)",
        work_text, re.I | re.UNICODE
    ))
    num_bullets = len([b for exp in (parsed_data.get("workExperience") or [])
                       for b in (exp.get("description") or []) if b])

    # Achievement: 0-based, requires actual work experience
    if not has_work:
        achievement_score = 0
    elif has_metrics:
        achievement_score = min(60 + min(num_bullets * 3, 25), 90)
    else:
        achievement_score = min(20 + min(num_bullets * 4, 30), 55)

    # ── Content score ────────────────────────────────────────────────────────
    # Requires multiple sections; penalize sparse content
    if sections_present == 0:
        content_score = 0
    else:
        content_base = sections_present * 12  # max 60 from sections
        content_length_bonus = min(word_count // 25, 25)  # up to 25 pts for length
        content_score = min(content_base + content_length_bonus, 100)

    # ── Skills score ────────────────────────────────────────────────────────
    skills = []
    if isinstance(parsed_data.get("additional"), dict):
        skills = parsed_data["additional"].get("technicalSkills", []) or []
    # 0-based: need actual skills listed
    skills_score = min(len(skills) * 8, 95) if skills else 0

    # ── ATS base ──────────────────────────────────────────────────────────────
    # Derived from keyword + format, not a freebie baseline
    ats_base = min(int(keyword_score * 0.6 + layout_score * 0.4), 95)

    # ── Platform scores ──────────────────────────────────────────────────────
    platform_scores = {
        "workday":        min(max(ats_base + 5, 0), 100),
        "taleo":          min(max(ats_base - 5, 0), 100),
        "icims":          min(max(ats_base,     0), 100),
        "greenhouse":     min(max(ats_base + 3, 0), 100),
        "lever":          min(max(ats_base + 2, 0), 100),
        "successfactors": min(max(ats_base - 8, 0), 100),
    }

    # ── Total score with quality penalty ────────────────────────────────────
    raw_total = int(
        layout_score      * 0.15 +
        content_score     * 0.25 +
        ats_base          * 0.30 +
        keyword_score     * 0.15 +
        skills_score      * 0.10 +
        achievement_score * 0.05
    )

    # Apply CV quality penalty — non-CV content gets crushed
    total = max(1, int(raw_total * penalty_multiplier))

    # Also apply penalty to sub-scores for consistency
    def penalize(score: int) -> int:
        return max(0, int(score * penalty_multiplier))

    return {
        "total_score":         total,
        "layout_score":        penalize(layout_score),
        "content_score":       penalize(content_score),
        "ats_score":           penalize(ats_base),
        "keyword_score":       penalize(keyword_score),
        "skills_score":        penalize(skills_score),
        "achievement_score":   penalize(achievement_score),
        "ats_platform_scores": {k: penalize(v) for k, v in platform_scores.items()},
        "matched_keywords":    matched,
        "missing_keywords":    missing,
        "suggestions":         [],
        "hr_review":           None,
        "summary":             "",
        "strengths":           [],
        "weaknesses":          [],
        # Quality metadata (used by LLM enrichment prompt)
        "_cv_quality":         quality,
    }


async def _enrich_with_llm(score_result: dict, resume_text: str, role: str, jd: str) -> dict:
    """Call LLM to add suggestions, HR review, summary. Non-blocking — falls back silently."""
    # Don't bother calling LLM if content is clearly not a CV
    quality = score_result.get("_cv_quality", {})
    if not quality.get("is_valid_cv", True) and quality.get("penalty_pct", 0) >= 60:
        score_result["summary"] = "Tài liệu này có vẻ không phải CV. Vui lòng upload file CV đúng định dạng."
        score_result["weaknesses"] = ["Không phát hiện cấu trúc CV hợp lệ", "Thiếu thông tin liên hệ, kinh nghiệm và học vấn"]
        return score_result

    try:
        schema = {
            "type": "object",
            "properties": {
                "summary": {"type": "string"},
                "strengths": {"type": "array", "items": {"type": "string"}},
                "weaknesses": {"type": "array", "items": {"type": "string"}},
                "suggestions": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "category": {"type": "string"},
                            "priority": {"type": "string"},
                            "problem": {"type": "string"},
                            "recommendation": {"type": "string"},
                            "evidence": {"type": "string"}
                        }
                    }
                },
                "hr_review": {
                    "type": "object",
                    "properties": {
                        "first_impression": {"type": "string"},
                        "strengths": {"type": "array", "items": {"type": "string"}},
                        "concerns": {"type": "array", "items": {"type": "string"}},
                        "priority_actions": {"type": "array", "items": {"type": "string"}}
                    }
                }
            }
        }

        prompt = f"""Bạn là chuyên gia tuyển dụng và hệ thống ATS. Phân tích CV dưới đây cho vị trí: {role}
{"JD: " + jd[:2000] if jd else ""}

CV (rút gọn):
{resume_text[:6000]}

Chất lượng tài liệu: {quality.get('word_count', 0)} từ, {quality.get('found_sections', 0)} section CV, {quality.get('structured_sections', 0)} section có cấu trúc.
{"Layout AI: " + score_result.get("_layout_description", "") if score_result.get("_layout_description") else ""}
{"⚠️ Tài liệu có dấu hiệu không phải CV chuẩn: " + ", ".join(quality.get("issues", [])) if quality.get("issues") else ""}

Điểm số đã tính: total={score_result['total_score']}, ats={score_result['ats_score']}, keywords={score_result['keyword_score']}
Từ khóa khớp: {', '.join(score_result['matched_keywords'][:10])}
Từ khóa thiếu: {', '.join(score_result['missing_keywords'][:10])}

Trả về JSON với: summary (1-2 câu thực tế, nếu không phải CV thì nói rõ), strengths (3 điểm, để rỗng nếu không phải CV), weaknesses (3 điểm),
suggestions (3-5 gợi ý với category/priority/problem/recommendation/evidence),
hr_review (first_impression, strengths, concerns, priority_actions).
Tất cả bằng tiếng Việt. Không bịa đặt thông tin không có trong CV."""

        result = await complete_json(prompt, schema, schema_type="enrichment")
        if result:
            score_result.update({
                "summary": result.get("summary", ""),
                "strengths": result.get("strengths", []),
                "weaknesses": result.get("weaknesses", []),
                "suggestions": result.get("suggestions", []),
                "hr_review": result.get("hr_review"),
            })
    except Exception as e:
        logger.warning(f"LLM enrichment failed (non-blocking): {e}")
        score_result = analyze_resume_fallback(
            score_result=score_result,
            resume_text=resume_text,
            role=role,
            jd=jd,
        )
    if not score_result.get("summary"):
        score_result = analyze_resume_fallback(
            score_result=score_result,
            resume_text=resume_text,
            role=role,
            jd=jd,
        )
    return score_result


# ── POST /analyses ────────────────────────────────────────────────────────────

@router.post("/analyses", dependencies=[Depends(check_usage_limit)])
async def analyze_resume(
    cv: UploadFile = File(...),
    role: str = Form(...),
    jd: Optional[str] = Form(""),
    user_id: str = Depends(verify_user)
):
    """Parse CV, score deterministically, enrich with LLM, persist to Firestore."""
    try:
        # 1. Parse file to markdown + structured JSON
        content = await cv.read()
        markdown_text = await parse_document(content, cv.filename or "resume.pdf")

        parsed_json: dict = {}
        try:
            parsed_json = await parse_resume_to_json(markdown_text)
        except Exception as e:
            logger.warning(f"Structured parse failed, continuing with markdown only: {e}")

        # 1b. Layout analysis (parallel with text parse)
        layout_inputs: dict = {}
        try:
            layout = await analyze_document_layout(content, cv.filename or "resume.pdf")
            layout_inputs = layout_to_score_inputs(layout)
            logger.info(f"Layout analysis: method={layout.method}, score={layout_inputs.get('layout_score_override')}, warnings={layout.warnings}")
        except Exception as e:
            logger.warning(f"Layout analysis failed (non-blocking): {e}")

        # 2. Deterministic ATS scoring (now with layout inputs)
        score_result = calculate_ats_score(parsed_json, markdown_text, jd or "", layout_inputs)

        # 3. LLM enrichment (non-blocking fallback)
        # Pass layout description to enrich prompt context
        if layout_inputs.get("layout_description"):
            score_result["_layout_description"] = layout_inputs["layout_description"]
        score_result = await _enrich_with_llm(score_result, markdown_text, role, jd or "")

        # Strip internal metadata before persisting
        score_result.pop("_cv_quality", None)
        score_result.pop("_layout_description", None)

        # 4. Persist to Firestore
        job_res = add_document("jobs", {
            "user_id": user_id,
            "job_title": role,
            "job_description": jd or "",
        })
        job_id = job_res["id"]

        resume_res = add_document("resumes", {
            "user_id": user_id,
            "name": cv.filename or "resume",
            "source_file_type": "pdf" if (cv.filename or "").endswith(".pdf") else "docx",
            "extracted_text": markdown_text,
            "parsed_data": parsed_json,
            "processing_status": "ready",
        })
        resume_id = resume_res["id"]

        analysis_res = add_document("analyses", {
            "user_id": user_id,
            "resume_id": resume_id,
            "job_id": job_id,
            "total_score": score_result["total_score"],
            "layout_score": score_result["layout_score"],
            "content_score": score_result["content_score"],
            "ats_score": score_result["ats_score"],
            "keyword_score": score_result["keyword_score"],
            "skills_score": score_result["skills_score"],
            "achievement_score": score_result["achievement_score"],
            "ats_platform_scores": score_result["ats_platform_scores"],
            "matched_keywords": score_result["matched_keywords"],
            "missing_keywords": score_result["missing_keywords"],
            "suggestions": score_result["suggestions"],
            "hr_review": score_result.get("hr_review"),
            "summary": score_result.get("summary", ""),
        })
        analysis_id = analysis_res["id"]

        log_usage(user_id, "analysis", {"resume_id": resume_id, "job_id": job_id})

        return {
            "status": "success",
            "analysis_id": analysis_id,
            "resume_id": resume_id,
            "job_id": job_id,
            "result": score_result,
        }

    except Exception as e:
        logger.error(f"Analysis failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Analysis failed. Please try again.")


# ── GET /analyses ─────────────────────────────────────────────────────────────

@router.get("/analyses")
async def list_analyses(user_id: str = Depends(verify_user)):
    """List all analyses for the current user, newest first."""
    rows = query_documents(
        "analyses",
        filters=[("user_id", "==", user_id)],
        order_by="created_at",
        descending=True,
        limit=50,
    )
    # Enrich with resume name and job title
    items = []
    for row in rows:
        item = dict(row)
        # Fetch resume name
        if row.get("resume_id"):
            r = get_document("resumes", row["resume_id"])
            item["file_name"] = r.get("name", "") if r else ""
        # Fetch job title
        if row.get("job_id"):
            j = get_document("jobs", row["job_id"])
            item["role"] = j.get("job_title", "") if j else ""
        items.append(item)
    return {"analyses": items}


@router.get("/analyses/{id}")
async def get_analysis(id: str, user_id: str = Depends(verify_user)):
    """Get full analysis detail by ID."""
    data = get_document("analyses", id)
    if not data or data.get("user_id") != user_id:
        raise HTTPException(status_code=404, detail="Analysis not found")
    return data


@router.delete("/analyses/{id}")
async def delete_analysis(id: str, user_id: str = Depends(verify_user)):
    """Delete an analysis owned by the current user."""
    data = get_document("analyses", id)
    if not data or data.get("user_id") != user_id:
        raise HTTPException(status_code=404, detail="Analysis not found")
    delete_document("analyses", id)
    return {"status": "deleted"}
