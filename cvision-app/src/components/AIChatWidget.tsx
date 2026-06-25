"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Bot,
  FileText,
  Image as ImageIcon,
  Loader2,
  Minimize2,
  Paperclip,
  Send,
  Settings2,
  Sparkles,
  User,
  X,
  XCircle,
} from "lucide-react";

type Message = {
  id: string;
  role: "user" | "ai";
  text: string;
  timestamp: Date;
  attachment?: { name: string; type: "image" | "document"; preview?: string };
};

type ChatApiMessage = {
  role: "user" | "model";
  text: string;
};

type ChatApiResponse = {
  text?: string;
  error?: string;
  provider?: string;
  model?: string;
};

type LlmSettings = {
  provider: string;
  model: string;
  auto_rotate: boolean;
};

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "/api/v1";

const PROVIDERS = [
  { value: "openai", label: "OpenAI" },
  { value: "groq", label: "Groq" },
  { value: "gemini", label: "Gemini" },
  { value: "openrouter", label: "OpenRouter" },
] as const;

const MODEL_PRESETS: Record<string, string[]> = {
  openai: ["gpt-4o-mini", "gpt-4.1-mini", "gpt-4o"],
  groq: ["llama-3.3-70b-versatile", "llama-3.1-8b-instant"],
  gemini: ["gemini-2.0-flash", "gemini-2.5-flash", "gemini-1.5-flash"],
  openrouter: [
    "meta-llama/llama-3.3-70b-instruct:free",
    "qwen/qwen3-next-80b-a3b-instruct:free",
    "meta-llama/llama-3.2-11b-vision-instruct:free",
  ],
};

async function extractFileContent(file: File): Promise<string> {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  const isImage = ["png", "jpg", "jpeg", "webp", "gif"].includes(ext);

  if (isImage) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (event) => resolve((event.target?.result as string) ?? "");
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  try {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", "studyportal_unsigned");
    formData.append("folder", "cvision_chat_attachments");

    const resourceType = ["pdf", "doc", "docx"].includes(ext) ? "raw" : "image";
    const uploadRes = await fetch(
      `https://api.cloudinary.com/v1_1/dyjgtjc4l/${resourceType}/upload`,
      { method: "POST", body: formData }
    );
    const uploadData = await uploadRes.json();
    if (!uploadData?.secure_url) throw new Error("Upload failed");

    const extractRes = await fetch("/api/v1/extract", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: uploadData.secure_url, fileName: file.name }),
    });
    if (!extractRes.ok) throw new Error("Extract failed");
    const extractData = await extractRes.json();
    return extractData?.text ?? "";
  } catch {
    return "";
  }
}

export function AIChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "ai",
      text: "Xin chào, mình là CVision AI. Bạn có thể hỏi về CV, JD, phỏng vấn hoặc đính kèm file để mình phân tích.",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [settings, setSettings] = useState<LlmSettings>({
    provider: "openai",
    model: "gpt-4o-mini",
    auto_rotate: true,
  });
  const [savingSettings, setSavingSettings] = useState(false);
  const [attachment, setAttachment] = useState<{
    file: File;
    name: string;
    type: "image" | "document";
    preview?: string;
    content?: string;
    processing: boolean;
  } | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const modelOptions = useMemo(
    () => MODEL_PRESETS[settings.provider] ?? [],
    [settings.provider]
  );

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [isOpen, messages]);

  useEffect(() => {
    void loadSettings();
  }, []);

  async function loadSettings() {
    try {
      const res = await fetch(`${API_BASE}/config/llm-api-key`, { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as Partial<LlmSettings>;
      setSettings((prev) => ({
        provider: data.provider || prev.provider,
        model: data.model || prev.model,
        auto_rotate: Boolean(data.auto_rotate),
      }));
    } catch {
      // non-blocking
    }
  }

  async function saveSettings() {
    setSavingSettings(true);
    try {
      await fetch(`${API_BASE}/config/llm-api-key`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: settings.provider,
          model: settings.model,
          auto_rotate: settings.auto_rotate,
        }),
      });
    } finally {
      setSavingSettings(false);
    }
  }

  const handleAttachClick = () => fileInputRef.current?.click();

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
    const isImage = ["png", "jpg", "jpeg", "webp", "gif"].includes(ext);
    const isDoc = ["pdf", "doc", "docx", "txt"].includes(ext);

    if (!isImage && !isDoc) {
      alert("Chỉ hỗ trợ PDF, DOCX, TXT và ảnh PNG/JPG.");
      return;
    }

    if (file.size > 15 * 1024 * 1024) {
      alert("File tối đa 15MB.");
      return;
    }

    let preview: string | undefined;
    if (isImage) {
      preview = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve((e.target?.result as string) ?? "");
        reader.readAsDataURL(file);
      });
    }

    setAttachment({
      file,
      name: file.name,
      type: isImage ? "image" : "document",
      preview,
      processing: true,
    });

    const content = await extractFileContent(file);
    setAttachment((prev) => (prev ? { ...prev, content, processing: false } : null));

    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSend = async (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = input.trim();
    if (!trimmed && !attachment) return;
    if (attachment?.processing) return;

    const currentAttachment = attachment;
    let userText = trimmed;
    let contextForAI = trimmed;

    if (currentAttachment) {
      const fileLabel = `[Đính kèm: ${currentAttachment.name}]`;
      userText = trimmed ? `${trimmed}\n${fileLabel}` : fileLabel;

      if (currentAttachment.type === "image" && currentAttachment.content) {
        contextForAI = trimmed
          ? `${trimmed}\n\n[Người dùng gửi ảnh: ${currentAttachment.name}]`
          : `Hãy phân tích ảnh/CV này: ${currentAttachment.name}`;
      } else if (currentAttachment.content) {
        const truncated = currentAttachment.content.slice(0, 5000);
        contextForAI = trimmed
          ? `${trimmed}\n\nNội dung file "${currentAttachment.name}":\n${truncated}`
          : `Hãy phân tích tài liệu sau:\n\nTên file: ${currentAttachment.name}\n\n${truncated}`;
      }
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      text: userText,
      timestamp: new Date(),
      attachment: currentAttachment
        ? { name: currentAttachment.name, type: currentAttachment.type, preview: currentAttachment.preview }
        : undefined,
    };

    const currentHistory: ChatApiMessage[] = messages.map((msg) => ({
      role: msg.role === "user" ? "user" : "model",
      text: msg.text,
    }));

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setAttachment(null);
    setIsLoading(true);

    try {
      const body: {
        message: string;
        history: ChatApiMessage[];
        imageBase64?: string;
        provider: string;
        model: string;
        autoRotate: boolean;
      } = {
        message: contextForAI,
        history: currentHistory,
        provider: settings.provider,
        model: settings.model,
        autoRotate: settings.auto_rotate,
      };

      if (currentAttachment?.type === "image" && currentAttachment.content) {
        body.imageBase64 = currentAttachment.content;
      }

      const res = await fetch("/api/v1/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = (await res.json()) as ChatApiResponse;
      if (!res.ok) throw new Error(data.error || "Lỗi server");

      const modelInfo = data.provider && data.model ? `\n\n[AI: ${data.provider} · ${data.model}]` : "";
      setMessages((prev) => [
        ...prev,
        {
          id: `${Date.now()}-ai`,
          role: "ai",
          text: `${data.text ?? "Xin lỗi, mình chưa tạo được phản hồi lúc này."}${modelInfo}`,
          timestamp: new Date(),
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: `${Date.now()}-error`,
          role: "ai",
          text: "Xin lỗi, đang có sự cố kết nối AI. Bạn thử lại sau một chút nhé.",
          timestamp: new Date(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end">
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        accept=".pdf,.doc,.docx,.txt,.png,.jpg,.jpeg,.webp"
        onChange={handleFileChange}
      />

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.96, transition: { duration: 0.18 } }}
            className="mb-4 flex h-[640px] max-h-[84vh] w-[390px] flex-col overflow-hidden rounded-[24px] border border-black/5 bg-white/95 shadow-[0_24px_60px_-16px_rgba(0,0,0,0.18)] backdrop-blur-xl sm:w-[430px]"
          >
            <div className="flex items-center justify-between border-b border-gray-100 bg-white/70 px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-tr from-blue-600 to-indigo-500 shadow-md">
                    <Sparkles className="h-5 w-5 text-white" />
                  </div>
                  <div className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white bg-green-500" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-gray-800">CVision AI Assistant</h3>
                  <p className="flex items-center gap-1 text-xs font-medium text-green-600">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-green-500" />
                    Online
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowSettings((prev) => !prev)}
                  className="flex h-8 w-8 items-center justify-center rounded-full text-gray-500 transition hover:bg-gray-100"
                  title="Cài đặt AI"
                >
                  <Settings2 className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setIsOpen(false)}
                  className="flex h-8 w-8 items-center justify-center rounded-full text-gray-500 transition hover:bg-gray-100"
                >
                  <Minimize2 className="h-4 w-4" />
                </button>
              </div>
            </div>

            <AnimatePresence>
              {showSettings && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden border-b border-gray-100 bg-slate-50/80"
                >
                  <div className="grid grid-cols-1 gap-3 px-4 py-4">
                    <div className="grid grid-cols-2 gap-3">
                      <label className="space-y-1">
                        <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-500">Provider</span>
                        <select
                          value={settings.provider}
                          onChange={(e) => {
                            const provider = e.target.value;
                            setSettings((prev) => ({
                              ...prev,
                              provider,
                              model: MODEL_PRESETS[provider]?.[0] ?? prev.model,
                            }));
                          }}
                          className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 outline-none transition focus:border-blue-400"
                        >
                          {PROVIDERS.map((provider) => (
                            <option key={provider.value} value={provider.value}>
                              {provider.label}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="space-y-1">
                        <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-500">Model</span>
                        <select
                          value={settings.model}
                          onChange={(e) => setSettings((prev) => ({ ...prev, model: e.target.value }))}
                          className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 outline-none transition focus:border-blue-400"
                        >
                          {modelOptions.map((model) => (
                            <option key={model} value={model}>
                              {model}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>

                    <label className="space-y-1">
                      <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-500">Model tuỳ chỉnh</span>
                      <input
                        value={settings.model}
                        onChange={(e) => setSettings((prev) => ({ ...prev, model: e.target.value }))}
                        placeholder="Nhập model riêng nếu cần"
                        className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 outline-none transition focus:border-blue-400"
                      />
                    </label>

                    <div className="flex items-center justify-between rounded-2xl border border-blue-100 bg-blue-50/70 px-3 py-3">
                      <div>
                        <p className="text-sm font-semibold text-gray-800">Tự động xoay AI</p>
                        <p className="text-[12px] text-gray-500">
                          Nếu provider hiện tại lỗi hoặc hết quota, chat sẽ tự thử provider khác.
                        </p>
                      </div>
                      <button
                        onClick={() => setSettings((prev) => ({ ...prev, auto_rotate: !prev.auto_rotate }))}
                        className={`relative h-6 w-11 rounded-full transition ${settings.auto_rotate ? "bg-blue-500" : "bg-gray-300"}`}
                      >
                        <span
                          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition ${settings.auto_rotate ? "left-[22px]" : "left-0.5"}`}
                        />
                      </button>
                    </div>

                    <button
                      onClick={() => void saveSettings()}
                      disabled={savingSettings}
                      className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
                    >
                      {savingSettings ? <Loader2 className="h-4 w-4 animate-spin" /> : <Settings2 className="h-4 w-4" />}
                      Lưu cấu hình AI
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="flex-1 space-y-6 overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-gray-200">
              {messages.map((msg) => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}
                >
                  <div
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full shadow-sm ${
                      msg.role === "user"
                        ? "bg-gray-800 text-white"
                        : "bg-gradient-to-tr from-blue-100 to-indigo-50 text-blue-600"
                    }`}
                  >
                    {msg.role === "user" ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
                  </div>
                  <div className={`flex max-w-[78%] flex-col ${msg.role === "user" ? "items-end" : "items-start"}`}>
                    {msg.attachment && (
                      <div
                        className={`mb-1.5 overflow-hidden rounded-xl border border-gray-100 ${
                          msg.attachment.type === "image"
                            ? "w-40"
                            : "flex items-center gap-2 bg-gray-50 px-3 py-2"
                        }`}
                      >
                        {msg.attachment.type === "image" && msg.attachment.preview ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={msg.attachment.preview} alt={msg.attachment.name} className="h-28 w-full object-cover" />
                        ) : (
                          <>
                            <FileText className="h-4 w-4 shrink-0 text-blue-500" />
                            <span className="max-w-[120px] truncate text-[11px] text-gray-600">{msg.attachment.name}</span>
                          </>
                        )}
                      </div>
                    )}
                    <div
                      className={`whitespace-pre-wrap rounded-2xl px-4 py-3 text-[14px] leading-relaxed shadow-sm ${
                        msg.role === "user"
                          ? "rounded-tr-sm bg-gray-900 text-white"
                          : "rounded-tl-sm border border-gray-100 bg-white text-gray-800"
                      }`}
                    >
                      {msg.text.replace(/\[Đính kèm:.*?\]/, "").trim() || (msg.attachment ? "" : msg.text)}
                    </div>
                    <span className="mt-1.5 px-1 text-[10px] text-gray-400">
                      {msg.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                </motion.div>
              ))}

              {isLoading && (
                <div className="flex gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-tr from-blue-100 to-indigo-50 text-blue-600 shadow-sm">
                    <Bot className="h-4 w-4" />
                  </div>
                  <div className="flex items-center gap-1 rounded-2xl rounded-tl-sm border border-gray-100 bg-white px-4 py-4 shadow-sm">
                    {[0, 150, 300].map((delay) => (
                      <span
                        key={delay}
                        className="h-1.5 w-1.5 animate-bounce rounded-full bg-blue-500"
                        style={{ animationDelay: `${delay}ms` }}
                      />
                    ))}
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {attachment && (
              <div className="flex items-center gap-3 border-t border-gray-100 bg-blue-50/60 px-4 py-2">
                {attachment.type === "image" && attachment.preview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={attachment.preview} alt="" className="h-10 w-10 rounded-lg border border-gray-200 object-cover" />
                ) : (
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-gray-200 bg-white">
                    <FileText className="h-5 w-5 text-blue-500" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[12px] font-semibold text-gray-700">{attachment.name}</p>
                  <p className="text-[11px] text-gray-400">
                    {attachment.processing ? (
                      <span className="flex items-center gap-1">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Đang đọc nội dung...
                      </span>
                    ) : (
                      <span className="text-emerald-600">Sẵn sàng gửi</span>
                    )}
                  </p>
                </div>
                <button
                  onClick={() => setAttachment(null)}
                  className="shrink-0 text-gray-400 transition hover:text-red-400"
                >
                  <XCircle className="h-4 w-4" />
                </button>
              </div>
            )}

            <div className="border-t border-gray-100 bg-white/80 p-4">
              <form onSubmit={handleSend} className="relative flex items-end gap-2">
                <button
                  type="button"
                  onClick={handleAttachClick}
                  className={`shrink-0 rounded-xl p-3 transition hover:bg-blue-50 ${
                    attachment ? "text-blue-500" : "text-gray-400 hover:text-blue-500"
                  }`}
                  title="Đính kèm file PDF, DOCX hoặc ảnh"
                >
                  {attachment?.processing ? (
                    <Loader2 className="h-5 w-5 animate-spin text-blue-400" />
                  ) : attachment?.type === "image" ? (
                    <ImageIcon className="h-5 w-5 text-blue-500" />
                  ) : (
                    <Paperclip className="h-5 w-5" />
                  )}
                </button>

                <div className="flex flex-1 items-center overflow-hidden rounded-2xl border border-gray-200 bg-gray-50 pr-2 transition-all focus-within:border-blue-300 focus-within:ring-2 focus-within:ring-blue-100">
                  <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder={attachment ? "Thêm câu hỏi về file (tuỳ chọn)..." : "Hỏi AI về CV của bạn..."}
                    className="w-full bg-transparent px-4 py-3.5 text-[14px] text-gray-800 outline-none placeholder:text-gray-400"
                  />
                  <button
                    type="submit"
                    disabled={(!input.trim() && !attachment) || isLoading || attachment?.processing}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white transition hover:bg-blue-700 disabled:bg-gray-300 disabled:opacity-50"
                  >
                    <Send className="ml-0.5 h-4 w-4" />
                  </button>
                </div>
              </form>

              <div className="mt-2 flex items-center justify-center gap-1 text-center">
                <Paperclip className="h-3 w-3 text-gray-300" />
                <span className="text-[10px] font-medium text-gray-400">
                  Hỗ trợ PDF, DOCX, PNG, JPG · Có thể đổi model ngay trong chat
                </span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsOpen((prev) => !prev)}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className="group relative flex h-14 w-14 items-center justify-center rounded-full shadow-2xl focus:outline-none"
        style={{ background: "linear-gradient(135deg, #2563eb, #4f46e5)" }}
      >
        <div className="absolute inset-0 rounded-full bg-white opacity-0 transition-opacity group-hover:opacity-20" />
        <div className="absolute inset-0 rounded-full bg-blue-500 opacity-40 blur-xl transition-opacity group-hover:opacity-60" />
        {isOpen ? <X className="relative z-10 h-6 w-6 text-white" /> : <Sparkles className="relative z-10 h-6 w-6 text-white" />}
        {!isOpen && isHovered && (
          <motion.div
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            className="absolute right-[calc(100%+16px)] whitespace-nowrap rounded-xl bg-gray-900 px-3 py-2 text-xs font-bold text-white shadow-lg"
          >
            Hỏi AI CVision
            <div className="absolute right-[-4px] top-1/2 h-2 w-2 -translate-y-1/2 rotate-45 bg-gray-900" />
          </motion.div>
        )}
      </motion.button>
    </div>
  );
}
