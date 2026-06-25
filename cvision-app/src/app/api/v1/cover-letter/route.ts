/**
 * POST /api/v1/cover-letter
 * Generates a personalized cover letter using Gemini or OpenAI.
 * Acts as a Next.js-side fallback when the FastAPI backend is offline.
 */

import { NextResponse } from "next/server";

export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { job_title, company_name, job_description, resume_markdown, tone } = body;

    if (!job_title) {
      return NextResponse.json({ error: "job_title is required" }, { status: 400 });
    }

    const geminiKey = process.env.GEMINI_API_KEY || process.env.CVISION_GEMINI_KEY;
    const openaiKey = process.env.OPENAI_API_KEY;

    if (!geminiKey && !openaiKey) {
      return NextResponse.json(
        { error: "Chưa cấu hình API Key (GEMINI_API_KEY hoặc OPENAI_API_KEY)." },
        { status: 503 }
      );
    }

    const toneMap: Record<string, string> = {
      professional: "chuyên nghiệp, lịch sự và trang trọng",
      concise: "ngắn gọn, súc tích và đi thẳng vào vấn đề",
      enthusiastic: "nhiệt huyết, sáng tạo và thể hiện đam mê",
    };
    const toneLabel = toneMap[tone] ?? toneMap.professional;

    const prompt = `Bạn là chuyên gia viết thư xin việc tiếng Việt chuyên nghiệp.

Hãy viết một cover letter ${toneLabel} cho vị trí: ${job_title}${company_name ? ` tại ${company_name}` : ""}.

${job_description ? `Mô tả công việc:\n${job_description.substring(0, 2000)}\n` : ""}
${resume_markdown ? `Thông tin từ CV:\n${resume_markdown.substring(0, 2000)}\n` : ""}

Yêu cầu:
- Viết bằng tiếng Việt, giọng văn ${toneLabel}
- Độ dài khoảng 300-400 từ
- Có đầy đủ: mở đầu, thân bài (lý do phù hợp + kinh nghiệm), kết thúc
- KHÔNG bịa đặt thông tin cụ thể không có trong CV (tên, công ty, số liệu)
- Dùng placeholder [Tên của bạn] nếu không biết tên

Chỉ trả về nội dung cover letter, không có giải thích hay markdown.`;

    let coverLetter = "";

    if (geminiKey) {
      const { GoogleGenAI } = await import("@google/genai");
      const ai = new GoogleGenAI({ apiKey: geminiKey });
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: { temperature: 0.7 },
      });
      coverLetter = response.text ?? "";
    } else if (openaiKey) {
      const OpenAI = (await import("openai")).default;
      const client = new OpenAI({ apiKey: openaiKey });
      const completion = await client.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.7,
        max_tokens: 1000,
      });
      coverLetter = completion.choices[0]?.message?.content ?? "";
    }

    if (!coverLetter) {
      return NextResponse.json({ error: "AI không trả về kết quả" }, { status: 500 });
    }

    return NextResponse.json({ status: "success", cover_letter: coverLetter });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Cover letter generation error:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
