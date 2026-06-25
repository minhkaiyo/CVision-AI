"""CV Version generation endpoints — diff-based tailoring via Resume-Matcher pipeline."""

from fastapi import APIRouter, Depends, HTTPException, Body
from typing import Any, Literal, Optional
from pydantic import BaseModel
from html import escape
import logging

from app.auth import verify_user, log_usage
from app.database import db as local_db
from app.firebase_store import add_document, delete_document, get_document, get_plan, query_documents
from app.llm import complete_json
from app.services.fallback_processing import generate_cv_fallback

router = APIRouter(tags=["cv-versions"])
logger = logging.getLogger(__name__)


# ── Helpers ──────────────────────────────────────────────────────────────────

def _check_premium(user_id: str) -> bool:
    """Return True if user has premium/b2b plan, False for free."""
    try:
        plan = get_plan(user_id)
        return plan in ("premium", "b2b")
    except Exception:
        return False


def _is_owner(data: dict[str, Any] | None, user_id: str) -> bool:
    return bool(data and data.get("user_id") == user_id)


def _clip(value: Any, limit: int = 6000) -> str:
    text = str(value or "").strip()
    return text[:limit]


def _jsonish(value: Any, limit: int = 6000) -> str:
    if value is None:
        return ""
    try:
        import json

        return json.dumps(value, ensure_ascii=False, indent=2)[:limit]
    except Exception:
        return _clip(value, limit)


def _template_color(template_id: str) -> str:
    return {
        "modern-professional": "#2563eb",
        "minimalist-clean": "#1e293b",
        "creative-bold": "#7c3aed",
        "executive-standard": "#047857",
        "tech-modern": "#4338ca",
        "banking-finance": "#b45309",
    }.get(template_id, "#2563eb")


def _render_cv_html(cv: dict[str, Any], template_id: str, title: str) -> str:
    color = _template_color(template_id)

    def text(key: str, default: str = "") -> str:
        return escape(str(cv.get(key) or default).strip())

    def list_items(items: Any) -> str:
        if not isinstance(items, list):
            return ""
        clean = [escape(str(item).strip()) for item in items if str(item or "").strip()]
        return "".join(f"<li>{item}</li>" for item in clean)

    name = text("full_name", "Ứng viên")
    headline = text("headline")
    contact_parts = [text("email"), text("phone"), text("location")]
    contact = " · ".join(part for part in contact_parts if part)
    summary = text("summary")

    exp_html = ""
    for item in cv.get("experience") or []:
        if not isinstance(item, dict):
            continue
        role = escape(str(item.get("role") or "").strip())
        company = escape(str(item.get("company") or "").strip())
        period = escape(str(item.get("period") or "").strip())
        header = " — ".join(part for part in [company, role] if part)
        if period:
            header = f"{header} <span>{period}</span>" if header else period
        bullets = list_items(item.get("bullets"))
        if header or bullets:
            exp_html += f"<div class='entry'><p><strong>{header}</strong></p><ul>{bullets}</ul></div>"

    edu_html = ""
    for item in cv.get("education") or []:
        if not isinstance(item, dict):
            continue
        school = escape(str(item.get("school") or "").strip())
        degree = escape(str(item.get("degree") or "").strip())
        period = escape(str(item.get("period") or "").strip())
        line = " — ".join(part for part in [school, degree] if part)
        if period:
            line = f"{line} <span>{period}</span>" if line else period
        if line:
            edu_html += f"<p><strong>{line}</strong></p>"

    skills = [escape(str(skill).strip()) for skill in (cv.get("skills") or []) if str(skill or "").strip()]
    skills_html = "".join(f"<span class='pill'>{skill}</span>" for skill in skills)
    projects_html = ""
    for item in cv.get("projects") or []:
        if not isinstance(item, dict):
            continue
        name_text = escape(str(item.get("name") or "").strip())
        desc = escape(str(item.get("description") or "").strip())
        if name_text or desc:
            projects_html += f"<p><strong>{name_text}</strong>{': ' if name_text and desc else ''}{desc}</p>"

    sections = []
    if summary:
        sections.append(f"<section><h2>Tóm tắt chuyên môn</h2><p>{summary}</p></section>")
    if exp_html:
        sections.append(f"<section><h2>Kinh nghiệm làm việc</h2>{exp_html}</section>")
    if projects_html:
        sections.append(f"<section><h2>Dự án nổi bật</h2>{projects_html}</section>")
    if edu_html:
        sections.append(f"<section><h2>Học vấn</h2>{edu_html}</section>")
    if skills_html:
        sections.append(f"<section><h2>Kỹ năng</h2><div class='skills'>{skills_html}</div></section>")

    body = "\n".join(sections) or "<section><p>Chưa đủ dữ liệu CV để tạo bản hoàn chỉnh.</p></section>"

    return f"""<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>{escape(title)}</title>
<style>
  @page {{ size: A4; margin: 15mm; }}
  * {{ box-sizing: border-box; }}
  body {{
    margin: 0;
    background: #f3f4f6;
    color: #111827;
    font-family: Arial, Helvetica, sans-serif;
    font-size: 10.5pt;
    line-height: 1.45;
  }}
  .page {{
    width: 210mm;
    min-height: 297mm;
    margin: 0 auto;
    padding: 18mm;
    background: white;
  }}
  h1 {{ color: {color}; font-size: 26pt; line-height: 1.08; margin: 0 0 5px; }}
  .headline {{ font-size: 12pt; font-weight: 700; color: #374151; margin: 0 0 4px; }}
  .contact {{ color: #4b5563; margin: 0 0 18px; }}
  h2 {{
    color: {color};
    font-size: 13pt;
    margin: 17px 0 8px;
    padding-bottom: 5px;
    border-bottom: 2px solid {color};
    text-transform: uppercase;
    letter-spacing: .04em;
  }}
  p {{ margin: 0 0 7px; }}
  ul {{ margin: 5px 0 10px; padding-left: 18px; }}
  li {{ margin-bottom: 4px; }}
  span {{ color: #6b7280; font-weight: 400; }}
  .entry {{ break-inside: avoid; }}
  .skills {{ display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }}
  .pill {{ border: 1px solid #d1d5db; border-radius: 999px; padding: 4px 9px; color: #1f2937; background: #f9fafb; }}
  @media print {{
    body {{ background: white; }}
    .page {{ width: auto; min-height: auto; padding: 0; }}
  }}
</style>
</head>
<body>
  <main class="page">
    <header>
      <h1>{name}</h1>
      {f'<p class="headline">{headline}</p>' if headline else ''}
      {f'<p class="contact">{contact}</p>' if contact else ''}
    </header>
    {body}
  </main>
</body>
</html>"""


async def _generate_ai_cv(
    *,
    resume: dict[str, Any] | None,
    job: dict[str, Any] | None,
    analysis: dict[str, Any] | None,
    version: dict[str, Any] | None,
) -> dict[str, Any]:
    resume_text = _clip((resume or {}).get("extracted_text") or (resume or {}).get("content"), 9000)
    parsed_resume = _jsonish((resume or {}).get("parsed_data") or (resume or {}).get("processed_data"), 7000)
    job_text = _clip((job or {}).get("job_description") or (job or {}).get("content"), 6000)
    suggestions = _jsonish((analysis or {}).get("suggestions") or (version or {}).get("diff_items"), 5000)
    optimized_data = _jsonish((version or {}).get("optimized_data"), 7000)
    analysis_context = _jsonish(analysis, 7000)

    if not any([resume_text, parsed_resume, optimized_data, analysis_context]):
        raise HTTPException(status_code=422, detail="Không tìm thấy dữ liệu CV thật để tạo template.")

    prompt = f"""
Bạn là chuyên gia viết CV ATS cao cấp cho thị trường Việt Nam.
Hãy tạo một CV hoàn chỉnh, chuyên nghiệp, trung thực và sẵn sàng xuất PDF.

NGUYÊN TẮC:
- Viết bằng tiếng Việt chuyên nghiệp, tự nhiên, không máy móc.
- Tối ưu theo vị trí/JD nếu có, nhưng không bịa công ty, bằng cấp, số liệu hoặc kinh nghiệm không có trong dữ liệu.
- Nếu thiếu tên/email/số điện thoại thì để chuỗi rỗng, không dùng placeholder như "Họ và Tên".
- Bullet kinh nghiệm phải cụ thể, có động từ mạnh, ưu tiên thành tích và kỹ năng liên quan ATS.
- Kết quả vừa đủ cho CV 1 trang nếu dữ liệu không quá dài.

TRẢ VỀ JSON ĐÚNG SCHEMA:
{{
  "full_name": "string",
  "headline": "string",
  "email": "string",
  "phone": "string",
  "location": "string",
  "summary": "string",
  "experience": [{{"company": "string", "role": "string", "period": "string", "bullets": ["string"]}}],
  "projects": [{{"name": "string", "description": "string"}}],
  "education": [{{"school": "string", "degree": "string", "period": "string"}}],
  "skills": ["string"]
}}

DỮ LIỆU CV ĐÃ TỐI ƯU NẾU CÓ:
{optimized_data}

CV GỐC / NỘI DUNG TRÍCH XUẤT:
{resume_text}

CV GỐC / DỮ LIỆU CÓ CẤU TRÚC:
{parsed_resume}

JOB DESCRIPTION / VỊ TRÍ MỤC TIÊU:
{job_text}

GỢI Ý ATS / PHÂN TÍCH:
{suggestions}

NGỮ CẢNH PHÂN TÍCH ĐẦY ĐỦ NẾU CÓ:
{analysis_context}
""".strip()

    try:
        data = await complete_json(
            prompt,
            system_prompt="Bạn chỉ trả JSON hợp lệ cho một CV chuyên nghiệp, không markdown.",
            max_tokens=4500,
            schema_type="resume",
        )
    except Exception as exc:
        logger.error("AI CV template generation failed: %s", exc, exc_info=True)
        raise HTTPException(status_code=503, detail="AI chưa tạo được CV lúc này. Kiểm tra API key/model rồi thử lại.")

    if not isinstance(data, dict):
        raise HTTPException(status_code=503, detail="AI trả về dữ liệu CV không hợp lệ.")
    return data


# ── Schemas ──────────────────────────────────────────────────────────────────

class GenerateCVVersionRequest(BaseModel):
    resume_id: str
    job_id: str
    analysis_id: Optional[str] = None
    prompt_id: Optional[str] = None


class ExportPDFRequest(BaseModel):
    cv_version_id: str


class TemplateHTMLRequest(BaseModel):
    source_id: str
    source_type: Literal["version", "analysis"]
    template_id: str = "modern-professional"
    source_context: Optional[dict[str, Any]] = None


# ── POST /cv-versions ────────────────────────────────────────────────────────

@router.post("/cv-versions")
async def generate_cv_version(
    req: GenerateCVVersionRequest,
    user_id: str = Depends(verify_user),
):
    """
    Generate a diff-based optimized CV version.

    For premium users: calls the Resume-Matcher improve/preview pipeline which
    extracts job keywords, generates targeted diffs, and verifies them.

    For free users: returns the analysis suggestions as lightweight diff items
    (no LLM improvement, no export).
    """
    is_premium = _check_premium(user_id)

    # ── Premium path: full Resume-Matcher pipeline ────────────────────────────
    if is_premium:
        try:
            from app.services.improver import (
                extract_job_keywords,
                generate_resume_diffs,
                apply_diffs,
                verify_diff_result,
                calculate_resume_diff,
            )
            from app.services.refiner import refine_resume
            from app.services.cover_letter import generate_resume_title
            from app.config_cache import get_content_language

            # Fetch resume + job from local SQLite (Resume-Matcher store)
            resume = await local_db.get_resume(req.resume_id)
            job = await local_db.get_job(req.job_id)
            if not resume:
                raise HTTPException(status_code=404, detail="Resume not found in local store. Upload via /resumes/upload first.")
            if not job:
                raise HTTPException(status_code=404, detail="Job not found in local store. Upload via /jobs/upload first.")

            language = get_content_language()

            # Extract job keywords (cached by content hash)
            import hashlib
            content_hash = hashlib.sha256(job["content"].encode()).hexdigest()
            job_keywords = job.get("job_keywords")
            if not job_keywords or job.get("job_keywords_hash") != content_hash:
                job_keywords = await extract_job_keywords(job["content"])
                await local_db.update_job(req.job_id, {
                    "job_keywords": job_keywords,
                    "job_keywords_hash": content_hash,
                })

            original_data = resume.get("processed_data")
            if not original_data:
                raise HTTPException(status_code=422, detail="Resume has no structured data. Ensure processing_status=ready.")

            # Generate targeted diffs
            improved_data, diff_items_raw = await generate_resume_diffs(
                original_data=original_data,
                job_keywords=job_keywords,
                language=language,
                prompt_id=req.prompt_id,
            )

            # Apply + verify diffs
            improved_data = apply_diffs(original_data, diff_items_raw)
            verify_diff_result(original_data, improved_data)

            # Refine (keyword injection + AI phrase cleanup)
            improved_data, _ = await refine_resume(improved_data, job["content"], language)

            # Generate title
            title = await generate_resume_title(job["content"], language)

            # Calculate human-readable diff summary
            diff_summary, diff_changes = calculate_resume_diff(original_data, improved_data)

            # Persist CV version to Firestore
            version_data = {
                "user_id": user_id,
                "resume_id": req.resume_id,
                "analysis_id": req.analysis_id,
                "job_id": req.job_id,
                "title": title or f"CV tối ưu — {job_keywords.get('role', 'Vị trí mới')}",
                "target_role": job_keywords.get("role", ""),
                "target_company": job_keywords.get("company", ""),
                "optimized_data": improved_data,
                "diff_items": [c.model_dump() if hasattr(c, "model_dump") else dict(c) for c in (diff_changes or [])],
                "status": "ready",
            }
            res = add_document("cv_versions", version_data)
            cv_version_id = res["id"]

            log_usage(user_id, "generate_version", {"resume_id": req.resume_id, "job_id": req.job_id})

            return {
                "status": "success",
                "cv_version_id": cv_version_id,
                "title": version_data["title"],
                "diff_count": len(diff_changes or []),
            }

        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"CV version generation failed: {e}", exc_info=True)
            raise HTTPException(status_code=500, detail="CV version generation failed. Please try again.")

    # ── Free path: suggestions as diff items ─────────────────────────────────
    else:
        # Fetch analysis to get suggestions
        analysis_data = {}
        if req.analysis_id:
            try:
                analysis_data = get_document("analyses", req.analysis_id) or {}
            except Exception:
                pass

        suggestions = analysis_data.get("suggestions") or []
        diff_items = [
            {
                "path": f"suggestion_{i}",
                "action": "replace",
                "original": s.get("problem", ""),
                "value": s.get("recommendation", ""),
                "reason": s.get("recommendation", ""),
                "confidence": "high" if s.get("priority") == "high" else "medium",
            }
            for i, s in enumerate(suggestions)
        ]

        version_data = {
            "user_id": user_id,
            "resume_id": req.resume_id,
            "analysis_id": req.analysis_id,
            "job_id": req.job_id,
            "title": "Gợi ý tối ưu (Free)",
            "diff_items": diff_items,
            "status": "draft",
        }
        res = add_document("cv_versions", version_data)
        cv_version_id = res["id"]

        return {
            "status": "success",
            "cv_version_id": cv_version_id,
            "title": version_data["title"],
            "diff_count": len(diff_items),
            "note": "Upgrade to Premium for full AI-powered CV tailoring and PDF export.",
        }


# ── GET /cv-versions ─────────────────────────────────────────────────────────

@router.get("/cv-versions")
async def list_cv_versions(user_id: str = Depends(verify_user)):
    """List all CV versions for current user."""
    rows = query_documents(
        "cv_versions",
        filters=[("user_id", "==", user_id)],
        order_by="created_at",
        descending=True,
        limit=30,
    )
    return {"cv_versions": rows}


@router.get("/cv-versions/{id}")
async def get_cv_version(id: str, user_id: str = Depends(verify_user)):
    """Get full CV version by ID."""
    data = get_document("cv_versions", id)
    if not data or data.get("user_id") != user_id:
        raise HTTPException(status_code=404, detail="CV version not found")
    return data


@router.delete("/cv-versions/{id}")
async def delete_cv_version(id: str, user_id: str = Depends(verify_user)):
    """Delete a CV version."""
    data = get_document("cv_versions", id)
    if not data or data.get("user_id") != user_id:
        raise HTTPException(status_code=404, detail="CV version not found")
    delete_document("cv_versions", id)
    return {"status": "deleted"}


@router.post("/cv-versions/template-html")
async def generate_template_html(req: TemplateHTMLRequest, user_id: str = Depends(verify_user)):
    """
    Generate a real AI-written CV HTML document for a selected template.

    The template page can pass either a CV version id or an analysis id. This
    endpoint resolves the linked resume/job documents, asks the configured LLM
    to write a structured CV, then renders print-ready HTML. It deliberately
    does not return demo placeholder content.
    """
    analysis: dict[str, Any] | None = None
    version: dict[str, Any] | None = None
    resume: dict[str, Any] | None = None
    job: dict[str, Any] | None = None

    if req.source_type == "version":
        version = get_document("cv_versions", req.source_id)
        if not _is_owner(version, user_id) and req.source_context:
            version = {
                "id": req.source_id,
                "user_id": user_id,
                **(req.source_context.get("version") or req.source_context),
            }
        if not _is_owner(version, user_id):
            raise HTTPException(status_code=404, detail="CV version not found")

        analysis_id = version.get("analysis_id")
        if analysis_id:
            analysis = get_document("analyses", analysis_id)
            if not analysis and req.source_context:
                analysis = req.source_context.get("analysis")
        resume_id = version.get("resume_id") or (analysis or {}).get("resume_id")
        job_id = version.get("job_id") or (analysis or {}).get("job_id")
        title = version.get("title") or "CV tối ưu"
    else:
        analysis = get_document("analyses", req.source_id)
        if not _is_owner(analysis, user_id) and req.source_context:
            analysis = {
                "id": req.source_id,
                "analysis_id": req.source_id,
                "user_id": user_id,
                **(req.source_context.get("analysis") or req.source_context),
            }
        if not _is_owner(analysis, user_id):
            raise HTTPException(status_code=404, detail="Analysis not found")

        resume_id = analysis.get("resume_id")
        job_id = analysis.get("job_id")
        title = f"CV tối ưu - {analysis.get('role') or analysis.get('file_name') or 'CVision'}"

    if analysis and analysis.get("user_id") != user_id:
        analysis = None

    if resume_id:
        resume = get_document("resumes", resume_id)
        if resume and resume.get("user_id") != user_id:
            resume = None
    if job_id:
        job = get_document("jobs", job_id)
        if job and job.get("user_id") != user_id:
            job = None

    try:
        cv_payload = await _generate_ai_cv(resume=resume, job=job, analysis=analysis, version=version)
    except HTTPException as exc:
        if exc.status_code not in {422, 503}:
            raise
        cv_payload = generate_cv_fallback(resume=resume, job=job, analysis=analysis, version=version)
    html = _render_cv_html(cv_payload, req.template_id, title)

    log_usage(user_id, "generate_template_cv", {"source_id": req.source_id, "source_type": req.source_type})
    return {"status": "success", "title": title, "html": html}


# ── POST /cv-versions/{id}/export-pdf ────────────────────────────────────────

@router.post("/cv-versions/{id}/export-pdf")
async def export_cv_pdf(id: str, user_id: str = Depends(verify_user)):
    """
    Export CV version to PDF using Playwright renderer.
    Requires FRONTEND_BASE_URL to be set and the frontend to be running.
    """
    if not _check_premium(user_id):
        raise HTTPException(status_code=403, detail="PDF export requires Premium plan.")

    data = get_document("cv_versions", id)
    if not data or data.get("user_id") != user_id:
        raise HTTPException(status_code=404, detail="CV version not found")

    # Use Resume-Matcher PDF renderer (Playwright renders /print/resumes/{resume_id})
    try:
        from app.pdf import render_resume_pdf
        resume_id = data.get("resume_id")
        if not resume_id:
            raise HTTPException(status_code=422, detail="No resume_id linked to this CV version.")

        pdf_bytes = await render_resume_pdf(resume_id)

        log_usage(user_id, "export_pdf", {"cv_version_id": id})

        from fastapi.responses import Response
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={"Content-Disposition": f'attachment; filename="cv_{id[:8]}.pdf"'},
        )
    except Exception as e:
        logger.error(f"PDF export failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="PDF export failed. Ensure frontend is running.")
