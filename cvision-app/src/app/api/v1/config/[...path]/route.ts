import { NextResponse } from "next/server";

const defaultLlmConfig = {
  provider: process.env.OPENAI_API_KEY ? "openai" : process.env.GEMINI_API_KEY ? "gemini" : "fallback",
  model: process.env.CVISION_OPENAI_TEXT_MODEL || process.env.CVISION_GEMINI_MODEL || "auto",
  api_key: "",
  api_base: null,
  reasoning_effort: null,
  auto_rotate: true,
};

function getPath(params: { path?: string[] }) {
  return (params.path ?? []).join("/");
}

function responseFor(path: string) {
  if (path === "llm-api-key") return defaultLlmConfig;
  if (path === "api-keys") {
    return {
      providers: [
        { provider: "openai", configured: Boolean(process.env.OPENAI_API_KEY), masked_key: process.env.OPENAI_API_KEY ? "sk-***" : null },
        { provider: "gemini", configured: Boolean(process.env.GEMINI_API_KEY || process.env.CVISION_GEMINI_KEY), masked_key: process.env.GEMINI_API_KEY || process.env.CVISION_GEMINI_KEY ? "AIza***" : null },
        { provider: "groq", configured: Boolean(process.env.GROQ_API_KEY), masked_key: process.env.GROQ_API_KEY ? "gsk_***" : null },
        { provider: "openrouter", configured: Boolean(process.env.OPENROUTER_API_KEY), masked_key: process.env.OPENROUTER_API_KEY ? "sk-or-***" : null },
      ],
    };
  }
  if (path === "features") {
    return { enable_cover_letter: true, enable_outreach_message: true };
  }
  if (path === "language") {
    return { ui_language: "vi", content_language: "vi", supported_languages: ["vi", "en"] };
  }
  if (path === "prompts") {
    return {
      default_prompt_id: "ats_pro",
      prompt_options: [
        { id: "ats_pro", label: "ATS Pro", description: "Phan tich CV theo ATS va nha tuyen dung." },
        { id: "career_coach", label: "Career Coach", description: "Tap trung vao lo trinh nghe nghiep." },
      ],
    };
  }
  return { status: "ok" };
}

export async function GET(_req: Request, context: { params: Promise<{ path?: string[] }> }) {
  const params = await context.params;
  return NextResponse.json(responseFor(getPath(params)));
}

export async function POST(req: Request, context: { params: Promise<{ path?: string[] }> }) {
  const params = await context.params;
  const path = getPath(params);
  if (path === "llm-test") {
    return NextResponse.json({
      healthy: Boolean(process.env.OPENAI_API_KEY || process.env.GEMINI_API_KEY || process.env.CVISION_GEMINI_KEY),
      model: defaultLlmConfig.model,
      error: process.env.OPENAI_API_KEY || process.env.GEMINI_API_KEY || process.env.CVISION_GEMINI_KEY ? undefined : "No provider key configured; local fallback is active.",
    });
  }
  const body = await req.json().catch(() => ({}));
  return NextResponse.json({ status: "success", saved: body, mode: "local-fallback" });
}

export async function PUT(req: Request) {
  const body = await req.json().catch(() => ({}));
  return NextResponse.json({ status: "success", saved: body, mode: "local-fallback" });
}

export async function DELETE() {
  return NextResponse.json({ status: "success", mode: "local-fallback" });
}
