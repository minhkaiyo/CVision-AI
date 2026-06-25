import { NextResponse } from "next/server";
import OpenAI from "openai";
import { GoogleGenAI } from "@google/genai";
import { z } from "zod";

export const maxDuration = 60;

const analysisSchema = z.object({
  total_score: z.number(),
  layout_score: z.number(),
  content_score: z.number(),
  ats_score: z.number(),
  keyword_score: z.number(),
  skills_score: z.number(),
  achievement_score: z.number(),
  matched_keywords: z.array(z.string()),
  missing_keywords: z.array(z.string()),
  ats_platform_scores: z.object({
    workday: z.number(),
    taleo: z.number(),
    icims: z.number(),
    greenhouse: z.number(),
    lever: z.number(),
    successfactors: z.number(),
  }),
  suggestions: z.array(
    z.object({
      category: z.string(),
      priority: z.enum(["high", "medium", "low"]),
      problem: z.string(),
      recommendation: z.string(),
      evidence: z.string(),
    })
  ),
  hr_review: z.object({
    first_impression: z.string(),
    strengths: z.array(z.string()),
    concerns: z.array(z.string()),
    priority_actions: z.array(z.string()),
  }),
  summary: z.string(),
  strengths: z.array(z.string()),
  weaknesses: z.array(z.string()),
});

function buildFallbackAnalysis(cvText: string, role: string, jd: string) {
  const text = cvText.toLowerCase();
  const jdTokens = Array.from(
    new Set(
      (jd.toLowerCase().match(/[a-z][a-z0-9.+#_-]{2,}/g) ?? []).filter(
        (token) => !["the", "and", "for", "with", "your", "you", "are"].includes(token)
      )
    )
  );
  const matched = jdTokens.filter((token) => text.includes(token)).slice(0, 20);
  const missing = jdTokens.filter((token) => !text.includes(token)).slice(0, 12);
  const words = cvText.trim().split(/\s+/).filter(Boolean).length;
  const hasEmail = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i.test(cvText);
  const hasPhone = /\+?\d[\d\s().-]{7,}\d/.test(cvText);
  const hasMetrics = /\d+\s*(%|k|years?|thang|nam|\$|vnd|trieu|ty)/i.test(cvText);
  const sections = [
    /experience|kinh nghi/i.test(cvText),
    /education|hoc van/i.test(cvText),
    /skills|ky nang/i.test(cvText),
    /projects|du an/i.test(cvText),
  ].filter(Boolean).length;

  const layout = Math.min(100, 35 + sections * 12 + (hasEmail ? 8 : 0) + (hasPhone ? 8 : 0));
  const keyword = jdTokens.length > 0 ? Math.round((matched.length / jdTokens.length) * 100) : Math.min(70, 25 + sections * 8);
  const content = Math.min(100, 25 + Math.min(words / 8, 45) + sections * 6);
  const skills = Math.min(100, 20 + matched.length * 4);
  const achievement = hasMetrics ? 68 : 42;
  const ats = Math.round(layout * 0.35 + keyword * 0.4 + content * 0.25);
  const total = Math.round((layout + content + ats + keyword + skills + achievement) / 6);

  return {
    total_score: total,
    layout_score: layout,
    content_score: content,
    ats_score: ats,
    keyword_score: keyword,
    skills_score: skills,
    achievement_score: achievement,
    matched_keywords: matched,
    missing_keywords: missing,
    ats_platform_scores: {
      workday: Math.min(100, ats + 3),
      taleo: Math.max(0, ats - 4),
      icims: ats,
      greenhouse: Math.min(100, ats + 2),
      lever: Math.min(100, ats + 1),
      successfactors: Math.max(0, ats - 6),
    },
    suggestions: [
      {
        category: "content",
        priority: "high" as const,
        problem: "Mo ta kinh nghiem chua du cu the hoac chua tach ro thanh tich.",
        recommendation: "Viet lai tung bullet theo cau truc hanh dong, cong cu, pham vi va ket qua.",
        evidence: `CV co khoang ${words} tu va ${sections} nhom section ro rang.`,
      },
      {
        category: "keyword",
        priority: "high" as const,
        problem: "CV chua phu het tu khoa lien quan den vi tri muc tieu.",
        recommendation: "Bo sung cac tu khoa va ky nang tu JD vao phan kinh nghiem, ky nang va tom tat.",
        evidence: `Da match ${matched.length} keyword, con thieu ${missing.length}.`,
      },
      {
        category: "achievement",
        priority: hasMetrics ? "medium" as const : "high" as const,
        problem: hasMetrics ? "Co mot it metric nhung chua phan bo deu." : "CV chua co nhieu metric de thuyet phuc recruiter.",
        recommendation: "Them so lieu ve ket qua, hieu suat, doanh so, uptime, chi phi hoac quy mo du an neu co.",
        evidence: hasMetrics ? "Da phat hien mot so metric trong CV." : "Khong tim thay nhieu dau hieu dinh luong.",
      },
    ],
    hr_review: {
      first_impression: `Che do fallback van danh gia duoc CV cho vai tro ${role}, phu hop de demo va screening so bo.`,
      strengths: [
        "He thong van tra ket qua duoc ngay ca khi AI ngoai tam thoi khong kha dung.",
        hasEmail && hasPhone ? "CV co thong tin lien he co ban." : "Can bo sung day du thong tin lien he de tang do tin cay.",
        matched.length > 0 ? "Da co mot phan tu khoa lien quan den JD." : "Can bo sung them tu khoa lien quan den vai tro.",
      ],
      concerns: [
        "Ket qua nay duoc tao tu rule-based fallback, nen phu hop cho demo va xu ly khan cap.",
        "Can AI full de viet lai noi dung sau hon va ca nhan hoa manh hon.",
        missing.length > 0 ? `Con thieu cac cum tu quan trong nhu: ${missing.slice(0, 4).join(", ")}.` : "Can kiem tra lai muc do khop voi JD cu the.",
      ],
      priority_actions: [
        "Lam ro kinh nghiem va thanh tich bang bullet cu the.",
        "Bo sung tu khoa ATS theo vai tro ung tuyen.",
        "Tach rieng phan ky nang, du an, hoc van neu bo cuc dang con gon qua.",
      ],
    },
    summary: `Fallback analysis cho ${role}: CV dat muc ${total}/100 va van co the dung de demo, screening so bo, va huong dan toi uu ATS ngay khi AI ngoai tam thoi loi.`,
    strengths: [
      "Van phan tich duoc tu text CV that, khong phai mock co dinh.",
      matched.length > 0 ? "Da nhan dien duoc mot phan keyword lien quan vi tri." : "Co the tiep tuc bo sung keyword tu JD.",
      sections >= 2 ? "CV co cau truc co ban de tiep tuc toi uu." : "Can bo sung them section ro rang de ATS doc tot hon.",
    ],
    weaknesses: [
      "Rule-based fallback khong sau bang AI day du cho cac truong hop phuc tap.",
      "Can them thanh tich dinh luong de tang suc thuyet phuc.",
      missing.length > 0 ? "Van con nhieu keyword chua khop voi JD." : "Can toi uu them noi dung cho vai tro muc tieu.",
    ],
  };
}

async function runExternalAnalysis(cvText: string, role: string, jd: string) {
  const openaiKey = process.env.OPENAI_API_KEY;
  const geminiKey =
    process.env.CVISION_GEMINI_KEY_2 ||
    process.env.GEMINI_API_KEY ||
    process.env.CVISION_GEMINI_KEY;

  if (!openaiKey && !geminiKey) {
    return null;
  }

  const prompt = `Ban la chuyen gia tuyen dung va he thong phan tich ATS chuyen nghiep.
Phan tich CV duoi day cho vi tri: ${role}
${jd ? `\nJob Description:\n${jd.substring(0, 3000)}\n` : ""}

NOI DUNG CV:
${cvText.substring(0, 15000)}

Tra ve JSON hop le theo schema sau, khong co markdown va khong giai thich them:
{
  "total_score": <0-100>,
  "layout_score": <0-100>,
  "content_score": <0-100>,
  "ats_score": <0-100>,
  "keyword_score": <0-100>,
  "skills_score": <0-100>,
  "achievement_score": <0-100>,
  "matched_keywords": ["..."],
  "missing_keywords": ["..."],
  "ats_platform_scores": { "workday": 0, "taleo": 0, "icims": 0, "greenhouse": 0, "lever": 0, "successfactors": 0 },
  "suggestions": [{ "category": "keyword|content|ats|achievement|skill|layout", "priority": "high|medium|low", "problem": "...", "recommendation": "...", "evidence": "..." }],
  "hr_review": { "first_impression": "...", "strengths": ["..."], "concerns": ["..."], "priority_actions": ["..."] },
  "summary": "...",
  "strengths": ["..."],
  "weaknesses": ["..."]
}
Tra loi hoan toan bang Tieng Viet. Diem so phai thuc te.`;

  let raw = "{}";

  if (geminiKey) {
    const ai = new GoogleGenAI({ apiKey: geminiKey });
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        temperature: 0.2,
      },
    });
    raw = response.text || "{}";
  } else if (openaiKey) {
    const client = new OpenAI({ apiKey: openaiKey });
    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      temperature: 0.3,
    });
    raw = completion.choices[0]?.message?.content ?? "{}";
  }

  return analysisSchema.parse(JSON.parse(raw));
}

export async function POST(req: Request) {
  const formData = await req.formData();
  const role = (formData.get("role") as string) ?? "";
  const jd = (formData.get("jd") as string) ?? "";
  const cvText = (formData.get("cvText") as string) || "";

  if (cvText.length < 50) {
    return NextResponse.json(
      { error: "cvText is required (min 50 chars). Extract text on client before calling this route." },
      { status: 400 }
    );
  }
  if (!role) {
    return NextResponse.json({ error: "role is required" }, { status: 400 });
  }

  try {
    const result = await runExternalAnalysis(cvText, role, jd);
    if (result) {
      return NextResponse.json({
        success: true,
        analysis_id: `ai_${Date.now()}`,
        result,
      });
    }
  } catch (error: unknown) {
    console.error("AI Analysis Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({
      success: true,
      analysis_id: `fallback_${Date.now()}`,
      fallback_mode: "rule_based",
      fallback_reason: message,
      result: buildFallbackAnalysis(cvText, role, jd),
    });
  }

  return NextResponse.json({
    success: true,
    analysis_id: `fallback_${Date.now()}`,
    fallback_mode: "rule_based",
    result: buildFallbackAnalysis(cvText, role, jd),
  });
}
