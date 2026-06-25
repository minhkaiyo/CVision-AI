import { NextResponse } from "next/server";

export const maxDuration = 60;

type CoverLetterInput = {
  job_title: string;
  company_name?: string;
  job_description?: string;
  resume_markdown?: string;
  tone?: string;
  language?: string;
  length?: string;
};

function buildFallbackCoverLetter(input: CoverLetterInput) {
  const company = input.company_name?.trim() || (input.language === "en" ? "your company" : "Quy cong ty");
  const role = input.job_title.trim();
  const source = `${input.resume_markdown ?? ""}\n${input.job_description ?? ""}`;
  const skills = Array.from(
    new Set(
      source
        .match(/[A-Za-z][A-Za-z0-9.+#/-]{2,}/g)
        ?.filter((word) => !["and", "the", "for", "with", "from", "this", "that"].includes(word.toLowerCase()))
        .slice(0, 8) ?? []
    )
  );
  const skillText = skills.length
    ? skills.join(", ")
    : input.language === "en"
      ? "requirement analysis, collaboration, problem solving and measurable execution"
      : "phan tich yeu cau, phoi hop nhom, giai quyet van de va tao ket qua co the do luong";

  if (input.language === "en") {
    return `Dear Hiring Team,

I am writing to express my interest in the ${role} position at ${company}. After reviewing the role requirements, I believe my background and working style align well with what your team is looking for.

My experience has helped me build a practical foundation in ${skillText}. I focus on understanding business goals, translating requirements into clear execution, and delivering work that is measurable, reliable, and useful for the team.

What I can bring to ${company} is a careful, learning-oriented approach, strong ownership, and the ability to connect details with user and business needs. I would welcome the opportunity to discuss how my experience can support your hiring goals for this role.

Thank you for your time and consideration.

Sincerely,
[Your Name]`;
  }

  return `Kinh gui Bo phan Tuyen dung ${company},

Toi viet thu nay de bay to su quan tam den vi tri ${role}. Sau khi xem yeu cau cong viec, toi nhan thay kinh nghiem va dinh huong phat trien cua minh phu hop voi nhung gia tri ma vi tri nay can co.

Trong qua trinh lam viec va hoc tap, toi da xay dung nen nen tang ve ${skillText}. Toi chu trong viec hieu dung van de, bien yeu cau thanh hanh dong cu the va tao ra ket qua co the do luong. Voi vai tro ${role}, toi mong muon duoc dong gop bang tinh than chu dong, kha nang hoc nhanh va cach lam viec co trach nhiem.

Toi tin rang su can than trong phan tich, kha nang phoi hop va mong muon cai tien lien tuc se giup toi nhanh chong hoa nhap voi doi ngu cua ${company}. Toi rat mong co co hoi trao doi them ve cach kinh nghiem cua minh co the dong gop cho muc tieu tuyen dung va phat trien cua cong ty.

Xin cam on Anh/Chi da danh thoi gian xem xet ho so cua toi.

Tran trong,
[Ten cua ban]`;
}

function buildPrompt(input: CoverLetterInput) {
  const toneMap: Record<string, string> = {
    professional: "chuyen nghiep, lich su va trang trong",
    concise: "ngan gon, suc tich va di thang vao van de",
    creative: "tu nhien, thong minh va co diem nhan rieng",
    enthusiastic: "nhiet huyet, chu dong va the hien dong luc ro rang",
  };
  const lengthMap: Record<string, string> = {
    short: "180-250 tu",
    standard: "300-400 tu",
    detailed: "450-550 tu",
  };
  const language = input.language === "en" ? "English" : "Tieng Viet";
  const tone = toneMap[input.tone ?? "professional"] ?? toneMap.professional;
  const length = lengthMap[input.length ?? "standard"] ?? lengthMap.standard;

  return `Ban la chuyen gia viet cover letter cho ung vien.

Hay viet cover letter bang ${language}, giong van ${tone}, do dai ${length}.

Vi tri ung tuyen: ${input.job_title}
${input.company_name ? `Cong ty / nguoi nhan: ${input.company_name}` : ""}

Job Description:
${(input.job_description || "Khong co JD chi tiet. Hay viet dua tren vai tro va thong tin CV.").substring(0, 2500)}

Thong tin tu CV:
${(input.resume_markdown || "Khong co CV nguon. Khong bia thong tin cu the.").substring(0, 3500)}

Yeu cau:
- Khong bia dat ten cong ty, so lieu, thanh tich neu khong co du lieu.
- Neu thieu ten ung vien, dung placeholder [Ten cua ban] hoac [Your Name].
- Noi dung phai cu the theo vai tro, tranh van mau chung chung.
- Chi tra ve noi dung cover letter, khong markdown, khong giai thich.`;
}

export async function POST(req: Request) {
  let body: CoverLetterInput | null = null;

  try {
    body = await req.json();
    if (!body?.job_title?.trim()) {
      return NextResponse.json({ error: "job_title is required" }, { status: 400 });
    }

    const geminiKey = process.env.GEMINI_API_KEY || process.env.CVISION_GEMINI_KEY;
    const openaiKey = process.env.OPENAI_API_KEY;

    if (!geminiKey && !openaiKey) {
      return NextResponse.json({
        status: "fallback",
        cover_letter: buildFallbackCoverLetter(body),
      });
    }

    const prompt = buildPrompt(body);
    let coverLetter = "";

    if (geminiKey) {
      const { GoogleGenAI } = await import("@google/genai");
      const ai = new GoogleGenAI({ apiKey: geminiKey });
      const response = await ai.models.generateContent({
        model: process.env.CVISION_GEMINI_MODEL || "gemini-2.5-flash",
        contents: prompt,
        config: { temperature: 0.65 },
      });
      coverLetter = response.text ?? "";
    } else if (openaiKey) {
      const OpenAI = (await import("openai")).default;
      const client = new OpenAI({ apiKey: openaiKey });
      const completion = await client.chat.completions.create({
        model: process.env.CVISION_OPENAI_TEXT_MODEL || "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.65,
        max_tokens: 1200,
      });
      coverLetter = completion.choices[0]?.message?.content ?? "";
    }

    return NextResponse.json({
      status: coverLetter.trim() ? "success" : "fallback",
      cover_letter: coverLetter.trim() || buildFallbackCoverLetter(body),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Cover letter generation error:", error);

    if (body?.job_title) {
      return NextResponse.json({
        status: "fallback",
        warning: message,
        cover_letter: buildFallbackCoverLetter(body),
      });
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
