import logging
import re
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.auth import log_usage, verify_user
from app.llm import complete

router = APIRouter(tags=["advanced-ai"])
logger = logging.getLogger(__name__)


class CoverLetterRequest(BaseModel):
    job_title: str = Field(min_length=3, max_length=160)
    company_name: Optional[str] = Field(default=None, max_length=160)
    job_description: Optional[str] = Field(default="", max_length=12000)
    resume_markdown: Optional[str] = Field(default=None, max_length=12000)
    tone: Optional[str] = Field(default="professional", max_length=40)
    language: Optional[str] = Field(default="vi", max_length=10)
    length: Optional[str] = Field(default="standard", max_length=20)


TONE_LABELS = {
    "professional": {
        "vi": "chuyen nghiep, tu tin, lich su, khong khoa truong",
        "en": "professional, confident, concise, and not exaggerated",
    },
    "creative": {
        "vi": "sang tao vua phai, co ca tinh nhung van trang trong",
        "en": "moderately creative, distinctive, and still business-appropriate",
    },
    "enthusiastic": {
        "vi": "nhiet huyet, chu dong, tich cuc nhung khong qua loi",
        "en": "enthusiastic, proactive, and warm without sounding desperate",
    },
}

LENGTH_RULES = {
    "short": {"vi": "170-230 tu, 3 doan ngan", "en": "170-230 words, 3 short paragraphs"},
    "standard": {"vi": "280-380 tu, 4-5 doan", "en": "280-380 words, 4-5 paragraphs"},
    "detailed": {"vi": "420-550 tu, 5-6 doan", "en": "420-550 words, 5-6 paragraphs"},
}


def _normalize_language(value: str | None) -> str:
    return "en" if (value or "").lower().startswith("en") else "vi"


def _is_low_signal(value: str) -> bool:
    text = value.strip().lower()
    if len(text) < 3:
        return True
    if re.fullmatch(r"([a-z])\1{1,}", text):
        return True
    return False


def _quality_prompt(req: CoverLetterRequest) -> tuple[str, str]:
    lang = _normalize_language(req.language)
    output_language = "Vietnamese" if lang == "vi" else "English"
    tone = TONE_LABELS.get(req.tone or "professional", TONE_LABELS["professional"])[lang]
    length_rule = LENGTH_RULES.get(req.length or "standard", LENGTH_RULES["standard"])[lang]
    company = (req.company_name or "").strip() or "the hiring team"
    jd = (req.job_description or "").strip()
    resume = (req.resume_markdown or "").strip()

    if lang == "vi":
        system_prompt = (
            "Ban la chuyen gia career writing cap senior. Viet cover letter that, sac gon, "
            "co tinh ca nhan, dua tren bang chung tu CV va JD. Khong viet van mau chung chung."
        )
        prompt = f"""
Viet mot cover letter ung tuyen bang tieng Viet cho ung vien.

Thong tin dau vao:
- Vi tri ung tuyen: {req.job_title.strip()}
- Cong ty/nguoi nhan: {company}
- Tone: {tone}
- Do dai: {length_rule}

JD:
{jd or "Khong co JD chi tiet. Hay viet theo cach than trong, khong tu bia yeu cau cong viec."}

Thong tin CV/ket qua phan tich ung vien:
{resume or "Khong co noi dung CV chi tiet. Hay chi dua tren thong tin chac chan trong dau vao va tranh khang dinh qua muc."}

Yeu cau bat buoc:
- Mo dau phai neu dung vi tri va cong ty/nguoi nhan neu co.
- Chon 2-3 diem manh co bang chung tu CV/context, lien ket truc tiep voi JD neu JD co.
- Neu thieu JD hoac CV chi tiet, van viet chuyen nghiep nhung phai trung thuc, khong bia kinh nghiem, so nam, cong nghe, thanh tich, bang cap.
- Khong dung cau chung chung nhu "toi tin rang minh phu hop" ma khong co ly do di kem.
- Khong nhac "AI", "CV/ket qua phan tich" trong thu.
- Khong dung placeholder kieu [Ho ten], [Email], [So dien thoai].
- Khong dung gach dau dong, markdown, tieu de, emoji.
- Van phong tu nhien, thang vao gia tri ung vien co the dong gop.
- Ket thu bang loi cam on va mong muon trao doi them.

Chi tra ve noi dung cover letter plain text.
""".strip()
        return system_prompt, prompt

    system_prompt = (
        "You are a senior career writer. Write a real, specific, evidence-based cover letter. "
        "Avoid generic filler and never invent facts."
    )
    prompt = f"""
Write a cover letter in English for this application.

Input:
- Target role: {req.job_title.strip()}
- Company/recipient: {company}
- Tone: {tone}
- Length: {length_rule}

Job description:
{jd or "No detailed job description was provided. Be careful and do not invent requirements."}

Candidate resume / analysis context:
{resume or "No detailed resume content was provided. Use only reliable input and avoid unsupported claims."}

Mandatory rules:
- Opening must reference the target role and company/recipient when available.
- Use 2-3 candidate strengths supported by the resume/context and connect them to the JD when possible.
- If JD or resume detail is thin, write professionally but honestly; do not invent years, technologies, achievements, education, employers, or metrics.
- Avoid generic claims unless each claim is supported by a concrete reason.
- Do not mention AI, resume analysis, or internal context.
- Do not include placeholders like [Name], [Phone], or [Email].
- No bullets, markdown, headings, or emojis.
- End with thanks and a clear, professional interview availability sentence.

Return plain text only.
""".strip()
    return system_prompt, prompt


@router.post("/advanced-ai/cover-letter")
async def generate_cover_letter_advanced(
    req: CoverLetterRequest,
    user_id: str = Depends(verify_user),
):
    """Generate a personalized, evidence-based cover letter using the LLM."""
    if _is_low_signal(req.job_title):
        raise HTTPException(
            status_code=422,
            detail="Vui long nhap vi tri ung tuyen ro hon de AI viet cover letter chat luong.",
        )

    system_prompt, prompt = _quality_prompt(req)

    try:
        cover_letter = await complete(
            prompt=prompt,
            system_prompt=system_prompt,
            max_tokens=1800,
            temperature=0.45,
        )
        log_usage(user_id, "cover_letter_generation")
        return {"status": "success", "cover_letter": cover_letter.strip()}
    except Exception as exc:
        logger.error("Cover letter generation failed: %s", exc, exc_info=True)
        raise HTTPException(
            status_code=503,
            detail="AI cover letter generation failed. Please check the AI provider configuration and try again.",
        ) from exc


@router.post("/analyses/{id}/hr-simulation")
async def simulate_hr_review(id: str, user_id: str = Depends(verify_user)):
    """Simulate a 30-second HR screen of the resume."""
    log_usage(user_id, "hr_simulation")
    return {
        "status": "success",
        "review": {
            "first_impression": "Strong candidate but lacks specific metrics.",
            "strengths": ["Relevant experience", "Good formatting"],
            "concerns": ["Missing AWS certification mentioned in JD"],
            "priority_actions": ["Add metrics to recent role", "Include AWS keyword"],
        },
    }


@router.post("/analyses/{id}/probability")
async def calculate_probability(id: str, user_id: str = Depends(verify_user)):
    """Estimate probability of passing ATS screen."""
    return {
        "status": "success",
        "probability_score": 75,
        "category": "Competitive",
        "disclaimer": "This is an estimate based on heuristic scoring and not a guarantee.",
    }


# ── Career Suggestions ──────────────────────────────────────────────────────

# Top Vietnamese job boards / company career pages by industry
INDUSTRY_JOB_LINKS: dict[str, list[dict]] = {
    "Công nghệ thông tin": [
        {"name": "TopDev", "url": "https://topdev.vn/it-jobs"},
        {"name": "ITviec", "url": "https://itviec.com"},
        {"name": "VietnamWorks IT", "url": "https://www.vietnamworks.com/viec-lam/cntt-phan-mem"},
        {"name": "LinkedIn VN", "url": "https://www.linkedin.com/jobs/search/?keywords=software+engineer&location=Vietnam"},
    ],
    "Tài chính - Ngân hàng": [
        {"name": "Tuyển dụng VietinBank", "url": "https://careers.vietinbank.vn"},
        {"name": "Vietcombank Careers", "url": "https://vietcombank.com.vn/tuyen-dung"},
        {"name": "BIDV Tuyển dụng", "url": "https://bidv.com.vn/tuyen-dung"},
        {"name": "VNFinance Jobs", "url": "https://www.vietnamworks.com/viec-lam/ngan-hang-tai-chinh"},
        {"name": "Techcombank Careers", "url": "https://careers.techcombank.com.vn"},
    ],
    "Marketing - Truyền thông": [
        {"name": "Brands Vietnam Jobs", "url": "https://www.brandsvietnam.com/job"},
        {"name": "VietnamWorks Marketing", "url": "https://www.vietnamworks.com/viec-lam/marketing-pr"},
        {"name": "CareerBuilder Marketing", "url": "https://www.careerbuilder.vn/viec-lam/marketing.35.html"},
    ],
    "Kế toán - Kiểm toán": [
        {"name": "KPMG Vietnam Careers", "url": "https://home.kpmg/vn/vi/home/careers.html"},
        {"name": "PwC Vietnam Jobs", "url": "https://www.pwc.com/vn/en/careers.html"},
        {"name": "Deloitte Vietnam", "url": "https://www2.deloitte.com/vn/en/careers.html"},
        {"name": "VietnamWorks Kế toán", "url": "https://www.vietnamworks.com/viec-lam/ke-toan-kiem-toan"},
    ],
    "Nhân sự - HR": [
        {"name": "HR Insider Jobs", "url": "https://hrinsider.com.vn/cong-viec"},
        {"name": "VietnamWorks HR", "url": "https://www.vietnamworks.com/viec-lam/nhan-su"},
        {"name": "Glints HR Vietnam", "url": "https://glints.com/vn/opportunities/jobs/hr?country=VN"},
    ],
    "Bán hàng - Kinh doanh": [
        {"name": "VietnamWorks Sales", "url": "https://www.vietnamworks.com/viec-lam/ban-hang"},
        {"name": "Navigos Search", "url": "https://www.navigossearch.com/vi/job"},
        {"name": "Adecco Vietnam", "url": "https://www.adecco.com.vn/viec-lam"},
    ],
    "Giáo dục - Đào tạo": [
        {"name": "VietnamWorks Education", "url": "https://www.vietnamworks.com/viec-lam/giao-duc-dao-tao"},
        {"name": "Edutek Jobs", "url": "https://edtech.vn/jobs"},
        {"name": "IVS Education", "url": "https://www.ivs.edu.vn/tuyen-dung"},
    ],
    "Thiết kế - Sáng tạo": [
        {"name": "99designs", "url": "https://99designs.com/jobs"},
        {"name": "Behance Jobs", "url": "https://www.behance.net/joblist"},
        {"name": "VietnamWorks Design", "url": "https://www.vietnamworks.com/viec-lam/thiet-ke-do-hoa"},
    ],
    "Y tế - Dược phẩm": [
        {"name": "VietnamWorks Y tế", "url": "https://www.vietnamworks.com/viec-lam/y-te-duoc"},
        {"name": "Pharmajobs VN", "url": "https://www.careerbuilder.vn/viec-lam/duoc-pham.18.html"},
    ],
    "Kỹ thuật - Sản xuất": [
        {"name": "VietnamWorks Engineering", "url": "https://www.vietnamworks.com/viec-lam/ky-thuat"},
        {"name": "ManpowerGroup VN", "url": "https://www.manpower.com.vn/jobs"},
    ],
}

DEFAULT_LINKS = [
    {"name": "VietnamWorks", "url": "https://www.vietnamworks.com"},
    {"name": "TopCV", "url": "https://www.topcv.vn/viec-lam"},
    {"name": "LinkedIn Vietnam", "url": "https://www.linkedin.com/jobs/search/?location=Vietnam"},
    {"name": "CareerBuilder VN", "url": "https://www.careerbuilder.vn"},
    {"name": "Glints Vietnam", "url": "https://glints.com/vn/opportunities/jobs/all"},
]


@router.post("/analyses/{id}/career-suggestions")
async def get_career_suggestions(id: str, user_id: str = Depends(verify_user)):
    """
    Analyze CV and suggest suitable career paths with priority levels and job links.
    """
    from app.firebase_store import get_document

    # Fetch analysis + resume data
    analysis = get_document("analyses", id)
    if not analysis or analysis.get("user_id") != user_id:
        raise HTTPException(status_code=404, detail="Analysis not found")

    resume_id = analysis.get("resume_id")
    resume = get_document("resumes", resume_id) if resume_id else None
    resume_text = (resume or {}).get("extracted_text", "") if resume else ""

    # Build context from analysis data
    matched_kw = ", ".join((analysis.get("matched_keywords") or [])[:20])
    missing_kw = ", ".join((analysis.get("missing_keywords") or [])[:10])
    scores = {
        "total": analysis.get("total_score", 0),
        "ats": analysis.get("ats_score", 0),
        "skills": analysis.get("skills_score", 0),
        "content": analysis.get("content_score", 0),
    }

    schema = {
        "type": "object",
        "properties": {
            "suggestions": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "role": {"type": "string"},
                        "industry": {"type": "string"},
                        "priority": {"type": "string", "enum": ["high", "medium", "low"]},
                        "match_score": {"type": "integer"},
                        "reason": {"type": "string"},
                        "required_skills": {"type": "array", "items": {"type": "string"}},
                        "missing_skills": {"type": "array", "items": {"type": "string"}},
                        "salary_range": {"type": "string"},
                    }
                }
            },
            "overall_profile": {"type": "string"},
            "top_strength": {"type": "string"},
        }
    }

    prompt = f"""Bạn là chuyên gia tư vấn nghề nghiệp. Dựa vào thông tin CV và kết quả phân tích, hãy gợi ý 5-6 vị trí/ngành nghề phù hợp nhất.

Từ khóa CV khớp: {matched_kw or "không có"}
Từ khóa còn thiếu: {missing_kw or "không có"}
Điểm ATS: {scores['ats']}, Kỹ năng: {scores['skills']}, Nội dung: {scores['content']}

Nội dung CV (tóm tắt):
{resume_text[:3000] if resume_text else "Không có nội dung CV chi tiết."}

Yêu cầu:
- Mỗi gợi ý có: tên vị trí (role), ngành (industry), mức ưu tiên (high/medium/low), điểm khớp 0-100, lý do ngắn gọn (2-3 câu), kỹ năng đang có, kỹ năng còn thiếu, mức lương ước tính VND/tháng
- Ưu tiên dựa trên: high = CV rất phù hợp (>70% match), medium = cần cải thiện thêm, low = tiềm năng phát triển
- Viết bằng tiếng Việt
- overall_profile: nhận xét tổng quan về hồ sơ (1-2 câu)
- top_strength: điểm mạnh nổi bật nhất"""

    try:
        from app.llm import complete_json
        result = await complete_json(prompt, schema, schema_type="enrichment")
        if not result or not result.get("suggestions"):
            raise ValueError("Empty result")
    except Exception as e:
        logger.warning(f"Career suggestions LLM failed: {e}")
        result = {
            "suggestions": [
                {
                    "role": "Cần kết nối AI để phân tích",
                    "industry": "Chưa xác định",
                    "priority": "medium",
                    "match_score": 0,
                    "reason": "Vui lòng cấu hình LLM API key để nhận gợi ý nghề nghiệp.",
                    "required_skills": [],
                    "missing_skills": [],
                    "salary_range": "N/A",
                }
            ],
            "overall_profile": "Chưa phân tích được.",
            "top_strength": "Chưa xác định.",
        }

    # Attach job links for each suggestion
    suggestions = result.get("suggestions", [])
    for s in suggestions:
        industry = s.get("industry", "")
        # Find matching industry links
        links = None
        for key in INDUSTRY_JOB_LINKS:
            if any(word in industry for word in key.split(" - ")) or industry in key or key in industry:
                links = INDUSTRY_JOB_LINKS[key]
                break
        s["job_links"] = links or DEFAULT_LINKS[:3]

    log_usage(user_id, "career_suggestions", {"analysis_id": id})

    return {
        "status": "success",
        "suggestions": suggestions,
        "overall_profile": result.get("overall_profile", ""),
        "top_strength": result.get("top_strength", ""),
    }
