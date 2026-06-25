"""Rule-based fallback processing for resume analysis and CV generation.

This module keeps the product responsive when external AI providers are
unavailable. It provides:
1. Lightweight resume parsing from markdown/text
2. Scenario-driven analysis summaries and suggestions
3. Structured CV payload generation for template export
"""

from __future__ import annotations

import re
from typing import Any


SCENARIO_LIBRARY: dict[str, dict[str, Any]] = {
    "software": {
        "keywords": {
            "python", "java", "javascript", "typescript", "react", "node", "sql",
            "api", "backend", "frontend", "docker", "aws", "git", "testing",
        },
        "strength_templates": [
            "Co nen tang ky thuat phu hop voi vai tro cong nghe.",
            "Co dau hieu da tiep xuc voi quy trinh phat trien san pham hoac he thong.",
            "Tu khoa ky thuat co kha nang toi uu them cho ATS.",
        ],
        "weakness_templates": [
            "Can viet ro impact ky thuat va ket qua dau ra cua tung du an.",
            "Nen bo sung cong nghe, framework, va pham vi trach nhiem cu the hon.",
            "Can them chi so hieu nang, quy mo nguoi dung, hoac do phuc tap he thong.",
        ],
        "suggestions": [
            ("content", "high", "Mo ta kinh nghiem con chung chung.", "Chuyen bullet sang cau truc hanh dong + cong nghe + ket qua.", "It thay chi tiet ve stack, quy mo, hoac ket qua ky thuat."),
            ("keyword", "high", "CV thieu nhieu tu khoa ATS cho nganh cong nghe.", "Bo sung ky nang, cong cu, framework, cloud, database lien quan JD.", "Danh sach keyword match con mong."),
            ("achievement", "medium", "Thanh tich chua duoc dinh luong.", "Them so lieu ve hieu nang, thoi gian, chi phi, quy mo hoac quality improvement.", "Bullet chua co metric ro rang."),
        ],
    },
    "electrical": {
        "keywords": {
            "electrical", "plc", "autocad", "maintenance", "testing", "wiring",
            "power", "automation", "commissioning", "schematic", "hvac",
        },
        "strength_templates": [
            "Nen tang chuyen mon ky thuat dien co the hien dien trong CV.",
            "Noi dung phu hop voi cac vai tro van hanh, bao tri, hoac ky su hien truong.",
            "Co kha nang mo rong CV theo huong an toan, quy trinh, va do kiem.",
        ],
        "weakness_templates": [
            "Can neu ro thiet bi, he thong, va muc do trach nhiem ky thuat.",
            "Nen bo sung ket qua van hanh, uptime, su co xu ly, hoac cai tien quy trinh.",
            "Can them keyword phan mem ky thuat va tieu chuan an toan neu co.",
        ],
        "suggestions": [
            ("content", "high", "Mo ta cong viec ky thuat chua du cu the.", "Neu ro he thong da van hanh, bao tri, lap dat, do kiem hoac khac phuc su co.", "Noi dung hien tai it cho thay pham vi cong viec ky thuat."),
            ("skill", "high", "Ky nang ky thuat chua duoc gom thanh cum ATS.", "Tach rieng PLC, AutoCAD, electrical testing, preventive maintenance, safety compliance neu co.", "ATS can nhin thay ky nang ro rang."),
            ("achievement", "medium", "Chua co minh chung ket qua.", "Them so lieu nhu giam downtime, tang on dinh he thong, rut ngan thoi gian xu ly su co.", "CV thieu metric van hanh."),
        ],
    },
    "business": {
        "keywords": {
            "marketing", "sales", "finance", "accounting", "analysis", "excel",
            "campaign", "seo", "crm", "budget", "forecast", "customer",
        },
        "strength_templates": [
            "CV co the dinh huong tot cho nhom vai tro business.",
            "Noi dung de toi uu theo nang luc van hanh, phoi hop va phan tich.",
            "Co khong gian de day manh tu khoa cong cu va ket qua kinh doanh.",
        ],
        "weakness_templates": [
            "Can them KPI, doanh so, chi phi, conversion hoac hieu qua chien dich.",
            "Nen lam ro cong cu va quy trinh da su dung.",
            "Can tach thanh tuu ra khoi mo ta nhiem vu thong thuong.",
        ],
        "suggestions": [
            ("achievement", "high", "Ket qua kinh doanh chua ro.", "Bo sung KPI, doanh thu, conversion, ROI, chi phi tiet kiem, hoac toc do xu ly.", "Nha tuyen dung business can thay tac dong den ket qua."),
            ("keyword", "medium", "Tu khoa cong cu va quy trinh con thieu.", "Them Excel, CRM, reporting, dashboard, budgeting, campaign optimization neu phu hop.", "ATS business rat nhạy voi tu khoa cong cu."),
            ("content", "medium", "Bullet chua tach duoc nhiem vu va thanh tich.", "Moi bullet nen neu hanh dong, pham vi, va ket qua cuoi.", "Noi dung hien tai de bi xem la mo ta viec chung."),
        ],
    },
    "general": {
        "keywords": set(),
        "strength_templates": [
            "CV co mot so thanh phan co ban de tiep tuc toi uu.",
            "He thong van co the phan tich ATS va goi y cai thien du AI ngoai dang loi.",
            "Noi dung co the duoc chinh lai de ro rang va chuyen nghiep hon.",
        ],
        "weakness_templates": [
            "Can bo sung them chi tiet ve vai tro muc tieu va kinh nghiem lien quan.",
            "Nen tach ky nang, hoc van, kinh nghiem thanh cac phan ro rang hon.",
            "Can them thanh tich cu the thay vi mo ta chung.",
        ],
        "suggestions": [
            ("content", "high", "Noi dung CV chua du cu the.", "Moi phan kinh nghiem nen neu ro viec da lam, cong cu su dung, va ket qua.", "ATS va recruiter can bang chung ro hon."),
            ("layout", "medium", "Bo cuc co the chua toi uu cho ATS.", "Giữ cau truc don cot, tieu de section ro, han che bang va hinh trang tri.", "Mau CV ATS uu tien tinh de doc cua he thong."),
            ("skill", "medium", "Ky nang chua duoc nhom ro rang.", "Tach technical skills, tools, languages, va certifications neu co.", "Nhom ky nang ro giup recruiter scan nhanh hon."),
        ],
    },
}

SECTION_ALIASES: dict[str, str] = {
    "kinh nghiem": "experience",
    "work experience": "experience",
    "experience": "experience",
    "employment": "experience",
    "hoc van": "education",
    "education": "education",
    "skills": "skills",
    "ky nang": "skills",
    "projects": "projects",
    "du an": "projects",
    "summary": "summary",
    "profile": "summary",
    "objective": "summary",
}


def _normalize_text(value: Any) -> str:
    return re.sub(r"\s+", " ", str(value or "")).strip()


def _slug(text: str) -> str:
    text = _normalize_text(text).lower()
    replacements = {
        "đ": "d", "á": "a", "à": "a", "ả": "a", "ã": "a", "ạ": "a",
        "ă": "a", "ắ": "a", "ằ": "a", "ẳ": "a", "ẵ": "a", "ặ": "a",
        "â": "a", "ấ": "a", "ầ": "a", "ẩ": "a", "ẫ": "a", "ậ": "a",
        "é": "e", "è": "e", "ẻ": "e", "ẽ": "e", "ẹ": "e", "ê": "e",
        "ế": "e", "ề": "e", "ể": "e", "ễ": "e", "ệ": "e",
        "í": "i", "ì": "i", "ỉ": "i", "ĩ": "i", "ị": "i",
        "ó": "o", "ò": "o", "ỏ": "o", "õ": "o", "ọ": "o", "ô": "o",
        "ố": "o", "ồ": "o", "ổ": "o", "ỗ": "o", "ộ": "o", "ơ": "o",
        "ớ": "o", "ờ": "o", "ở": "o", "ỡ": "o", "ợ": "o",
        "ú": "u", "ù": "u", "ủ": "u", "ũ": "u", "ụ": "u", "ư": "u",
        "ứ": "u", "ừ": "u", "ử": "u", "ữ": "u", "ự": "u",
        "ý": "y", "ỳ": "y", "ỷ": "y", "ỹ": "y", "ỵ": "y",
    }
    for src, dst in replacements.items():
        text = text.replace(src, dst)
    return text


def infer_scenario(role: str, jd: str, resume_text: str) -> str:
    haystack = f"{role} {jd} {resume_text}".lower()
    scores: dict[str, int] = {}
    for name, config in SCENARIO_LIBRARY.items():
        if name == "general":
            continue
        scores[name] = sum(1 for kw in config["keywords"] if kw in haystack)
    best = max(scores.items(), key=lambda item: item[1], default=("general", 0))
    return best[0] if best[1] >= 2 else "general"


def _extract_contact(markdown_text: str) -> dict[str, str]:
    email_match = re.search(r"[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}", markdown_text)
    phone_match = re.search(r"(\+?\d[\d\-\s().]{7,}\d)", markdown_text)
    linkedin_match = re.search(r"(https?://(?:www\.)?linkedin\.com/[^\s)]+)", markdown_text, re.I)
    github_match = re.search(r"(https?://(?:www\.)?github\.com/[^\s)]+)", markdown_text, re.I)
    return {
        "email": email_match.group(0).strip() if email_match else "",
        "phone": phone_match.group(1).strip() if phone_match else "",
        "linkedin": linkedin_match.group(1).strip() if linkedin_match else None,
        "github": github_match.group(1).strip() if github_match else None,
    }


def _guess_name_and_title(markdown_text: str) -> tuple[str, str]:
    lines = [line.strip(" #-*\t") for line in markdown_text.splitlines() if line.strip()]
    name = ""
    title = ""
    for line in lines[:8]:
        if "@" in line or re.search(r"\d{7,}", line):
            continue
        if len(line.split()) in range(2, 6) and len(line) <= 60:
            if not name:
                name = line
                continue
            if not title and len(line) <= 80:
                title = line
                break
    return name, title


def _split_sections(markdown_text: str) -> dict[str, list[str]]:
    sections: dict[str, list[str]] = {}
    current = "header"
    sections[current] = []
    for raw_line in markdown_text.splitlines():
        line = raw_line.strip()
        if not line:
            continue
        normalized = _slug(line.strip("#: ").lower())
        matched = None
        for alias, section_name in SECTION_ALIASES.items():
            if alias in normalized:
                matched = section_name
                break
        if matched:
            current = matched
            sections.setdefault(current, [])
            continue
        sections.setdefault(current, []).append(line)
    return sections


def _collect_bullets(lines: list[str]) -> list[str]:
    bullets = []
    for line in lines:
        cleaned = re.sub(r"^[\-*•]+\s*", "", line).strip()
        if len(cleaned) >= 6:
            bullets.append(cleaned)
    return bullets


def _extract_skills(skills_lines: list[str], resume_text: str) -> list[str]:
    bucket = " ".join(skills_lines) if skills_lines else resume_text
    parts = re.split(r"[,\n|/]|·", bucket)
    skills = []
    for part in parts:
        cleaned = re.sub(r"^[\-*•]+\s*", "", part).strip()
        if 1 < len(cleaned) <= 40 and cleaned.lower() not in {"skills", "ky nang"}:
            skills.append(cleaned)
    seen = set()
    unique = []
    for skill in skills:
        key = skill.lower()
        if key not in seen:
            seen.add(key)
            unique.append(skill)
    return unique[:18]


def _extract_experience(section_lines: list[str]) -> list[dict[str, Any]]:
    if not section_lines:
        return []
    bullets = _collect_bullets(section_lines)
    headline = next((line for line in section_lines if not line.startswith(("-", "*", "•"))), "")
    years_match = re.search(r"(19|20)\d{2}.*?(19|20)\d{2}|(19|20)\d{2}.*?(present|current|nay)", headline, re.I)
    company = headline
    title = ""
    if " - " in headline:
        title, company = [part.strip() for part in headline.split(" - ", 1)]
    elif " | " in headline:
        title, company = [part.strip() for part in headline.split(" | ", 1)]
    return [{
        "id": 1,
        "title": title or "Kinh nghiem lien quan",
        "company": company or "",
        "years": years_match.group(0) if years_match else "",
        "description": bullets[:6] or section_lines[:3],
    }]


def _extract_education(section_lines: list[str]) -> list[dict[str, Any]]:
    if not section_lines:
        return []
    first = section_lines[0]
    years_match = re.search(r"(19|20)\d{2}.*?(19|20)\d{2}|(19|20)\d{2}", first)
    degree = section_lines[1] if len(section_lines) > 1 else ""
    return [{
        "id": 1,
        "institution": first,
        "degree": degree,
        "years": years_match.group(0) if years_match else "",
    }]


def parse_resume_fallback(markdown_text: str) -> dict[str, Any]:
    sections = _split_sections(markdown_text)
    contact = _extract_contact(markdown_text)
    name, title = _guess_name_and_title(markdown_text)
    summary_lines = sections.get("summary") or sections.get("header", [])
    summary = " ".join(summary_lines[:3]).strip()
    skills = _extract_skills(sections.get("skills", []), markdown_text)

    return {
        "personalInfo": {
            "name": name,
            "title": title,
            "email": contact["email"],
            "phone": contact["phone"],
            "location": "",
            "website": None,
            "linkedin": contact["linkedin"],
            "github": contact["github"],
        },
        "summary": summary[:500],
        "workExperience": _extract_experience(sections.get("experience", [])),
        "education": _extract_education(sections.get("education", [])),
        "personalProjects": [{
            "id": 1,
            "name": sections.get("projects", [""])[0] if sections.get("projects") else "",
            "role": "",
            "years": "",
            "github": contact["github"],
            "website": None,
            "description": _collect_bullets(sections.get("projects", []))[:4],
        }] if sections.get("projects") else [],
        "additional": {
            "technicalSkills": skills,
            "languages": [],
            "certificationsTraining": [],
            "awards": [],
        },
        "sectionMeta": [],
        "customSections": {},
    }


def _top_strengths_from_scores(score_result: dict[str, Any]) -> list[str]:
    candidates = [
        (score_result.get("layout_score", 0), "Bo cuc va kha nang doc ATS o muc on."),
        (score_result.get("keyword_score", 0), "CV da co mot phan tu khoa lien quan den vi tri muc tieu."),
        (score_result.get("skills_score", 0), "Ky nang duoc liet ke va co the tiep tuc toi uu theo JD."),
        (score_result.get("achievement_score", 0), "Noi dung da co dau hieu thanh tich hoac tac dong cong viec."),
    ]
    positives = [text for score, text in sorted(candidates, reverse=True) if score >= 40]
    return positives[:3]


def analyze_resume_fallback(
    *,
    score_result: dict[str, Any],
    resume_text: str,
    role: str,
    jd: str,
) -> dict[str, Any]:
    scenario_key = infer_scenario(role, jd, resume_text)
    scenario = SCENARIO_LIBRARY[scenario_key]
    quality = score_result.get("_cv_quality", {}) or {}

    strengths = _top_strengths_from_scores(score_result)
    strengths.extend(item for item in scenario["strength_templates"] if item not in strengths)
    strengths = strengths[:3]

    weaknesses = list(scenario["weakness_templates"])[:3]
    if quality.get("issues"):
        issues = ", ".join(str(issue) for issue in quality["issues"][:3])
        weaknesses[0] = f"Tai lieu hien co dau hieu can chinh lai cau truc CV: {issues}."

    suggestions = [
        {
            "category": category,
            "priority": priority,
            "problem": problem,
            "recommendation": recommendation,
            "evidence": evidence,
        }
        for category, priority, problem, recommendation, evidence in scenario["suggestions"]
    ]

    matched = ", ".join(score_result.get("matched_keywords", [])[:6]) or "chua co nhieu tu khoa khop"
    missing = ", ".join(score_result.get("missing_keywords", [])[:6]) or "khong co JD hoac da khop o muc co ban"
    summary = (
        f"Phan tich fallback cho vai tro {role or 'muc tieu chua ro'}: CV hien co diem tong "
        f"{score_result.get('total_score', 0)}/100. He thong nhan thay {matched}; "
        f"can uu tien bo sung {missing} va viet bullet cu the hon de tang ATS."
    )

    score_result.update({
        "summary": summary,
        "strengths": strengths,
        "weaknesses": weaknesses,
        "suggestions": suggestions,
        "hr_review": {
            "first_impression": "Ho so co the su dung duoc cho demo va screening so bo, nhung can viet lai ro hon de thuyet phuc recruiter.",
            "strengths": strengths,
            "concerns": weaknesses,
            "priority_actions": [item["recommendation"] for item in suggestions[:3]],
        },
        "fallback_mode": "rule_based",
        "fallback_scenario": scenario_key,
    })
    return score_result


def _extract_title_from_job(job: dict[str, Any] | None, analysis: dict[str, Any] | None) -> str:
    if job:
        return _normalize_text(job.get("job_title") or job.get("job_description", "")[:80])
    if analysis:
        return _normalize_text(analysis.get("role") or analysis.get("fileName") or analysis.get("file_name"))
    return ""


def generate_cv_fallback(
    *,
    resume: dict[str, Any] | None,
    job: dict[str, Any] | None,
    analysis: dict[str, Any] | None,
    version: dict[str, Any] | None,
) -> dict[str, Any]:
    parsed = ((resume or {}).get("parsed_data") or (resume or {}).get("processed_data") or {}) if resume else {}
    personal = parsed.get("personalInfo", {}) if isinstance(parsed, dict) else {}
    additional = parsed.get("additional", {}) if isinstance(parsed, dict) else {}
    title = _extract_title_from_job(job, analysis) or _normalize_text(personal.get("title"))
    summary = _normalize_text((analysis or {}).get("summary") or parsed.get("summary") or "")
    suggestions = (analysis or {}).get("suggestions") or (version or {}).get("diff_items") or []

    if not summary and suggestions:
        suggestion_text = suggestions[0].get("recommendation") if isinstance(suggestions[0], dict) else str(suggestions[0])
        summary = f"Ho so duoc tong hop tu che do fallback. Uu tien cai thien: {suggestion_text}"
    if not summary:
        summary = "Ho so duoc tao tu du lieu co san khi AI ben ngoai tam thoi khong kha dung."

    experiences = []
    for item in parsed.get("workExperience", [])[:3]:
        experiences.append({
            "company": item.get("company", ""),
            "role": item.get("title", ""),
            "period": item.get("years", ""),
            "bullets": (item.get("description") or [])[:4],
        })

    education = []
    for item in parsed.get("education", [])[:2]:
        education.append({
            "school": item.get("institution", ""),
            "degree": item.get("degree", ""),
            "period": item.get("years", ""),
        })

    projects = []
    for item in parsed.get("personalProjects", [])[:2]:
        desc = " ".join((item.get("description") or [])[:2]).strip()
        projects.append({
            "name": item.get("name", ""),
            "description": desc,
        })

    skills = list((additional.get("technicalSkills") or [])[:12]) if isinstance(additional, dict) else []
    if not skills and analysis:
        skills = list((analysis.get("matched_keywords") or [])[:10])

    return {
        "full_name": _normalize_text(personal.get("name")) or "Ung vien",
        "headline": title,
        "email": _normalize_text(personal.get("email")),
        "phone": _normalize_text(personal.get("phone")),
        "location": _normalize_text(personal.get("location")),
        "summary": summary,
        "experience": experiences,
        "projects": projects,
        "education": education,
        "skills": skills,
        "fallback_mode": "rule_based",
    }
