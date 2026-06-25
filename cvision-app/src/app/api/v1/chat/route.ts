import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 60;
export const runtime = "nodejs";

type ChatHistoryMessage = { role: "user" | "model"; text: string };
type ChatRequestBody = {
  message: string;
  history?: ChatHistoryMessage[];
  imageBase64?: string;
  provider?: string;
  model?: string;
  autoRotate?: boolean;
};

type GlobalLlmConfig = {
  provider?: string;
  model?: string;
  auto_rotate?: boolean;
};

type ChatProvider = "openai" | "groq" | "gemini" | "openrouter";
type OpenAIStyleMessage = {
  role: "system" | "user" | "assistant";
  content: string | Array<{ type: "text"; text: string } | { type: "image_url"; image_url: { url: string } }>;
};

const SYSTEM_PROMPT =
  "Bạn là CVision AI, một chuyên gia CV và định hướng nghề nghiệp cấp senior. " +
  "Hãy trả lời bằng tiếng Việt rõ ràng, chuyên nghiệp, có chiều sâu nhưng không lan man. " +
  "Khi người dùng gửi CV, JD, ảnh hoặc tài liệu, hãy phân tích theo góc nhìn thực dụng: ATS, nội dung, mức độ phù hợp, điểm mạnh, điểm yếu và bước cải thiện tiếp theo.";

const BACKEND_BASE = process.env.NEXT_PUBLIC_API_URL;

const DEFAULT_MODELS: Record<ChatProvider, string> = {
  openai: "gpt-4o-mini",
  groq: "llama-3.3-70b-versatile",
  gemini: "gemini-2.0-flash",
  openrouter: "meta-llama/llama-3.3-70b-instruct:free",
};

function normalizeHistory(history: unknown): ChatHistoryMessage[] {
  if (!Array.isArray(history)) return [];
  return history.filter((item): item is ChatHistoryMessage => {
    if (!item || typeof item !== "object") return false;
    const value = item as Partial<ChatHistoryMessage>;
    return (value.role === "user" || value.role === "model") && typeof value.text === "string" && value.text.trim().length > 0;
  });
}

function parseDataUrl(url: string): { mimeType: string; data: string } | null {
  const match = url.match(/^data:([^;]+);base64,(.+)$/);
  return match ? { mimeType: match[1], data: match[2] } : null;
}

async function fetchGlobalConfig(): Promise<GlobalLlmConfig> {
  if (!BACKEND_BASE) return {};
  try {
    const res = await fetch(`${BACKEND_BASE}/config/llm-api-key`, { cache: "no-store" });
    if (!res.ok) return {};
    return (await res.json()) as GlobalLlmConfig;
  } catch {
    return {};
  }
}

function getAvailableProviders(): ChatProvider[] {
  const providers: ChatProvider[] = [];
  if (process.env.OPENAI_API_KEY) providers.push("openai");
  if (process.env.GROQ_API_KEY) providers.push("groq");
  if (process.env.CVISION_GEMINI_KEY || process.env.CVISION_GEMINI_KEY_2 || process.env.GEMINI_API_KEY) {
    providers.push("gemini");
  }
  if (process.env.OPENROUTER_API_KEY) providers.push("openrouter");
  return providers;
}

function buildProviderOrder(
  requestedProvider: string | undefined,
  autoRotate: boolean,
  availableProviders: ChatProvider[]
): ChatProvider[] {
  const preferred = (requestedProvider && availableProviders.includes(requestedProvider as ChatProvider))
    ? [requestedProvider as ChatProvider]
    : [];

  if (!autoRotate) {
    return preferred.length > 0 ? preferred : availableProviders.slice(0, 1);
  }

  const order: ChatProvider[] = [];
  for (const provider of [...preferred, ...availableProviders]) {
    if (!order.includes(provider)) order.push(provider);
  }
  return order;
}

async function callOpenAI(
  model: string,
  apiKey: string,
  history: ChatHistoryMessage[],
  message: string,
  imageBase64?: string
): Promise<string> {
  const messages: OpenAIStyleMessage[] = [
    { role: "system", content: SYSTEM_PROMPT },
    ...history.map((item) => ({
      role: item.role === "model" ? ("assistant" as const) : ("user" as const),
      content: item.text.trim(),
    })),
  ];

  if (imageBase64) {
    messages.push({
      role: "user",
      content: [
        { type: "text", text: message || "Hãy phân tích ảnh/CV này thật kỹ và đưa ra nhận xét thực tế, chuyên nghiệp." },
        { type: "image_url", image_url: { url: imageBase64 } },
      ],
    });
  } else {
    messages.push({ role: "user", content: message });
  }

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.6,
      max_tokens: imageBase64 ? 1800 : 900,
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error?.message || `OpenAI HTTP ${res.status}`);
  }
  return data?.choices?.[0]?.message?.content?.trim() || "";
}

async function callGroq(
  model: string,
  apiKey: string,
  history: ChatHistoryMessage[],
  message: string
): Promise<string> {
  const messages = [
    { role: "system", content: SYSTEM_PROMPT },
    ...history.map((item) => ({
      role: item.role === "model" ? ("assistant" as const) : ("user" as const),
      content: item.text.trim(),
    })),
    { role: "user", content: message },
  ];

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.6,
      max_tokens: 900,
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error?.message || `Groq HTTP ${res.status}`);
  }
  return data?.choices?.[0]?.message?.content?.trim() || "";
}

async function callOpenRouter(
  model: string,
  apiKey: string,
  history: ChatHistoryMessage[],
  message: string,
  imageBase64?: string
): Promise<string> {
  const messages: OpenAIStyleMessage[] = [
    { role: "system", content: SYSTEM_PROMPT },
    ...history.map((item) => ({
      role: item.role === "model" ? ("assistant" as const) : ("user" as const),
      content: item.text.trim(),
    })),
  ];

  if (imageBase64) {
    messages.push({
      role: "user",
      content: [
        { type: "text", text: message || "Hãy phân tích ảnh/CV này và đưa ra góp ý cụ thể." },
        { type: "image_url", image_url: { url: imageBase64 } },
      ],
    });
  } else {
    messages.push({ role: "user", content: message });
  }

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://cvision.local",
      "X-Title": "CVision AI",
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.6,
      max_tokens: imageBase64 ? 1800 : 900,
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error?.message || `OpenRouter HTTP ${res.status}`);
  }
  return data?.choices?.[0]?.message?.content?.trim() || "";
}

async function callGemini(
  model: string,
  apiKey: string,
  history: ChatHistoryMessage[],
  message: string,
  imageBase64?: string
): Promise<string> {
  const contents: unknown[] = history.map((item) => ({
    role: item.role === "model" ? "model" : "user",
    parts: [{ text: item.text.trim() }],
  }));

  if (imageBase64) {
    const parsed = parseDataUrl(imageBase64);
    const parts: unknown[] = [];
    if (parsed) {
      parts.push({ inline_data: { mime_type: parsed.mimeType, data: parsed.data } });
    }
    parts.push({ text: message || "Hãy phân tích ảnh/CV này và cho nhận xét thực tế." });
    contents.push({ role: "user", parts });
  } else {
    contents.push({ role: "user", parts: [{ text: message }] });
  }

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents,
        generationConfig: {
          temperature: 0.6,
          maxOutputTokens: imageBase64 ? 1800 : 900,
        },
      }),
    }
  );

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error?.message || `Gemini HTTP ${res.status}`);
  }
  return data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";
}

async function runProvider(
  provider: ChatProvider,
  model: string,
  history: ChatHistoryMessage[],
  message: string,
  imageBase64?: string
): Promise<string> {
  if (provider === "openai") {
    const key = process.env.OPENAI_API_KEY;
    if (!key) throw new Error("Thiếu OPENAI_API_KEY.");
    return callOpenAI(model, key, history, message, imageBase64);
  }

  if (provider === "groq") {
    const key = process.env.GROQ_API_KEY;
    if (!key) throw new Error("Thiếu GROQ_API_KEY.");
    if (imageBase64) throw new Error("Groq hiện chưa hỗ trợ ảnh trong chat này.");
    return callGroq(model, key, history, message);
  }

  if (provider === "openrouter") {
    const key = process.env.OPENROUTER_API_KEY;
    if (!key) throw new Error("Thiếu OPENROUTER_API_KEY.");
    return callOpenRouter(model, key, history, message, imageBase64);
  }

  const geminiKeys = [
    process.env.CVISION_GEMINI_KEY,
    process.env.CVISION_GEMINI_KEY_2,
    process.env.GEMINI_API_KEY,
  ].filter(Boolean) as string[];
  if (geminiKeys.length === 0) throw new Error("Thiếu GEMINI_API_KEY.");

  let lastError = "Không thể kết nối Gemini.";
  for (const key of geminiKeys) {
    try {
      return await callGemini(model, key, history, message, imageBase64);
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
  }
  throw new Error(lastError);
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => null)) as ChatRequestBody | null;
    const message = typeof body?.message === "string" ? body.message.trim() : "";
    const imageBase64 = typeof body?.imageBase64 === "string" ? body.imageBase64 : undefined;
    const history = normalizeHistory(body?.history);

    if (!message && !imageBase64) {
      return NextResponse.json({ error: "Thiếu nội dung tin nhắn." }, { status: 400 });
    }

    const globalConfig = await fetchGlobalConfig();
    const availableProviders = getAvailableProviders();
    if (availableProviders.length === 0) {
      return NextResponse.json({ error: "Chưa cấu hình AI provider nào khả dụng." }, { status: 500 });
    }

    const provider = body?.provider || globalConfig.provider || "openai";
    const autoRotate = typeof body?.autoRotate === "boolean"
      ? body.autoRotate
      : Boolean(globalConfig.auto_rotate);

    const providerOrder = buildProviderOrder(provider, autoRotate, availableProviders);
    let lastError = "Không thể kết nối AI.";

    for (const activeProvider of providerOrder) {
      const model = body?.model?.trim()
        || (activeProvider === provider ? globalConfig.model?.trim() : "")
        || DEFAULT_MODELS[activeProvider];

      try {
        const text = await runProvider(activeProvider, model, history, message, imageBase64);
        if (!text) throw new Error("AI trả về phản hồi rỗng.");
        return NextResponse.json({
          success: true,
          text,
          provider: activeProvider,
          model,
          autoRotatedFrom: activeProvider !== provider ? provider : null,
        });
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error);
      }
    }

    return NextResponse.json({ error: lastError }, { status: 500 });
  } catch (error) {
    return NextResponse.json(
      { error: `Lỗi server: ${error instanceof Error ? error.message : String(error)}` },
      { status: 500 }
    );
  }
}
