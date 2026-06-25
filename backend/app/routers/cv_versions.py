"""CV Version generation endpoints — diff-based tailoring via Resume-Matcher pipeline."""

from fastapi import APIRouter, Depends, HTTPException, Body
from typing import Optional
from pydantic import BaseModel
import logging

from app.auth import verify_user, log_usage
from app.database import db as local_db
from app.firebase_store import add_document, delete_document, get_document, get_plan, query_documents

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


# ── Schemas ──────────────────────────────────────────────────────────────────

class GenerateCVVersionRequest(BaseModel):
    resume_id: str
    job_id: str
    analysis_id: Optional[str] = None
    prompt_id: Optional[str] = None


class ExportPDFRequest(BaseModel):
    cv_version_id: str


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
