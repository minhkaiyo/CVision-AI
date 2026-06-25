// admin/settings/page.tsx — CVision Admin: Cài đặt hệ thống
"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Settings, Key, Cpu, Globe, Zap, FlaskConical,
  CheckCircle2, XCircle, Loader2, Save, Eye, EyeOff, RefreshCw, Trash2,
} from "lucide-react";
import { toast } from "@/components/ui/toast";
import { getAccessToken } from "@/lib/auth";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1";

async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  let token = "";
  try { token = (await getAccessToken()) ?? ""; } catch { /* dev mode */ }
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail ?? `HTTP ${res.status}`);
  }
  return res.json();
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface LLMConfig {
  provider: string;
  model: string;
  api_key: string;
  api_base?: string | null;
  reasoning_effort?: string | null;
}

interface FeatureConfig {
  enable_cover_letter: boolean;
  enable_outreach_message: boolean;
}

interface LanguageConfig {
  ui_language: string;
  content_language: string;
  supported_languages: string[];
}

interface ApiKeyProvider {
  provider: string;
  configured: boolean;
  masked_key: string | null;
}

interface PromptConfig {
  default_prompt_id: string;
  prompt_options: { id: string; label: string; description: string }[];
}

// ── Constants ─────────────────────────────────────────────────────────────────

const PROVIDERS = [
  { value: "openai", label: "OpenAI" },
  { value: "anthropic", label: "Anthropic" },
  { value: "gemini", label: "Google Gemini" },
  { value: "openrouter", label: "OpenRouter" },
  { value: "deepseek", label: "DeepSeek" },
  { value: "groq", label: "Groq" },
  { value: "ollama", label: "Ollama (Local)" },
  { value: "openai_compatible", label: "OpenAI Compatible" },
];

const PROVIDER_KEY_MAP: Record<string, string> = {
  openai: "openai",
  anthropic: "anthropic",
  gemini: "google",
  openrouter: "openrouter",
  deepseek: "deepseek",
  groq: "groq",
  ollama: "ollama",
  openai_compatible: "openai_compatible",
};

const LANGUAGE_LABELS: Record<string, string> = {
  en: "English", es: "Español", zh: "中文", ja: "日本語", pt: "Português",
};

const REASONING_EFFORTS = [
  { value: "", label: "Mặc định (không gửi)" },
  { value: "minimal", label: "Minimal" },
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
];

// ── Section wrapper ───────────────────────────────────────────────────────────

function Section({ icon: Icon, title, children }: {
  icon: React.ElementType; title: string; children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-50 bg-gray-50/50">
        <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center">
          <Icon className="w-4 h-4 text-blue-500" />
        </div>
        <h2 className="font-bold text-gray-800 text-[15px]">{title}</h2>
      </div>
      <div className="p-6">{children}</div>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-[13px] font-semibold text-gray-700">{label}</label>
      {children}
      {hint && <p className="text-[11px] text-gray-400">{hint}</p>}
    </div>
  );
}

function Input({ className = "", ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={`w-full px-3 py-2 text-[13px] border border-gray-200 rounded-xl focus:outline-none focus:border-blue-400 bg-white transition ${className}`}
      {...props}
    />
  );
}

function Select({ className = "", ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={`w-full px-3 py-2 text-[13px] border border-gray-200 rounded-xl focus:outline-none focus:border-blue-400 bg-white transition appearance-none ${className}`}
      {...props}
    />
  );
}

function SaveBtn({ loading, onClick }: { loading: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className="flex items-center gap-2 px-4 py-2 text-[13px] font-semibold bg-blue-500 text-white rounded-xl hover:bg-blue-600 transition disabled:opacity-60"
    >
      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
      Lưu thay đổi
    </button>
  );
}

// ── LLM Config Section ────────────────────────────────────────────────────────

function LLMSection() {
  const [cfg, setCfg] = useState<LLMConfig>({ provider: "openai", model: "", api_key: "", api_base: "", reasoning_effort: "" });
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null);

  useEffect(() => {
    apiFetch<LLMConfig>("/config/llm-api-key")
      .then(d => { setCfg(d); })
      .catch(() => {});
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      // Save API key separately if provided
      if (apiKey.trim()) {
        const keyProvider = PROVIDER_KEY_MAP[cfg.provider] ?? cfg.provider;
        await apiFetch("/config/api-keys", {
          method: "POST",
          body: JSON.stringify({ [keyProvider]: apiKey.trim() }),
        });
      }
      // Save LLM config
      await apiFetch("/config/llm-api-key", {
        method: "PUT",
        body: JSON.stringify({
          provider: cfg.provider,
          model: cfg.model,
          api_base: cfg.api_base || null,
          reasoning_effort: cfg.reasoning_effort || null,
        }),
      });
      toast("success", "Đã lưu cấu hình LLM.");
      setApiKey("");
    } catch (e: unknown) {
      toast("error", e instanceof Error ? e.message : "Lưu thất bại.");
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await apiFetch<{ healthy: boolean; model?: string; error?: string }>("/config/llm-test", {
        method: "POST",
        body: JSON.stringify({
          provider: cfg.provider,
          model: cfg.model,
          api_key: apiKey || undefined,
          api_base: cfg.api_base || undefined,
        }),
      });
      setTestResult({ ok: res.healthy, msg: res.healthy ? `Kết nối thành công (${res.model ?? cfg.model})` : (res.error ?? "Kết nối thất bại") });
    } catch (e: unknown) {
      setTestResult({ ok: false, msg: e instanceof Error ? e.message : "Kết nối thất bại" });
    } finally {
      setTesting(false);
    }
  };

  return (
    <Section icon={Cpu} title="Cấu hình LLM Provider">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <Field label="Provider">
          <Select value={cfg.provider} onChange={e => setCfg(p => ({ ...p, provider: e.target.value }))}>
            {PROVIDERS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
          </Select>
        </Field>

        <Field label="Model" hint="Ví dụ: gpt-4o, claude-3-5-sonnet, gemini-2.0-flash">
          <Input
            value={cfg.model}
            onChange={e => setCfg(p => ({ ...p, model: e.target.value }))}
            placeholder="gpt-4o-mini"
          />
        </Field>

        <Field label="API Key" hint={cfg.api_key ? `Hiện tại: ${cfg.api_key}` : "Chưa cấu hình"}>
          <div className="relative">
            <Input
              type={showKey ? "text" : "password"}
              value={apiKey}
              onChange={e => setApiKey(e.target.value)}
              placeholder="Nhập key mới để thay đổi..."
              className="pr-10"
            />
            <button
              onClick={() => setShowKey(v => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </Field>

        <Field label="API Base URL" hint="Để trống nếu dùng endpoint mặc định (Ollama: http://localhost:11434)">
          <Input
            value={cfg.api_base ?? ""}
            onChange={e => setCfg(p => ({ ...p, api_base: e.target.value }))}
            placeholder="http://localhost:11434"
          />
        </Field>

        <Field label="Reasoning Effort" hint="Chỉ áp dụng cho model hỗ trợ (GPT-o series, Claude 3.7+, DeepSeek R1)">
          <Select value={cfg.reasoning_effort ?? ""} onChange={e => setCfg(p => ({ ...p, reasoning_effort: e.target.value }))}>
            {REASONING_EFFORTS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
          </Select>
        </Field>
      </div>

      {testResult && (
        <div className={`mt-4 flex items-center gap-2 px-4 py-2.5 rounded-xl text-[13px] font-medium border ${testResult.ok ? "bg-emerald-50 border-emerald-200 text-emerald-700" : "bg-red-50 border-red-200 text-red-700"}`}>
          {testResult.ok ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <XCircle className="w-4 h-4 shrink-0" />}
          {testResult.msg}
        </div>
      )}

      <div className="flex gap-3 mt-5">
        <SaveBtn loading={saving} onClick={handleSave} />
        <button
          onClick={handleTest}
          disabled={testing}
          className="flex items-center gap-2 px-4 py-2 text-[13px] font-semibold border border-gray-200 text-gray-600 rounded-xl hover:bg-gray-50 transition disabled:opacity-60"
        >
          {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <FlaskConical className="w-4 h-4" />}
          Test kết nối
        </button>
      </div>
    </Section>
  );
}

// ── API Keys Section ──────────────────────────────────────────────────────────

function ApiKeysSection() {
  const [providers, setProviders] = useState<ApiKeyProvider[]>([]);
  const [keys, setKeys] = useState<Record<string, string>>({});
  const [show, setShow] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const fetchKeys = useCallback(async () => {
    try {
      const res = await apiFetch<{ providers: ApiKeyProvider[] }>("/config/api-keys");
      setProviders(res.providers);
    } catch { /* silent */ }
  }, []);

  useEffect(() => { fetchKeys(); }, [fetchKeys]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload: Record<string, string> = {};
      Object.entries(keys).forEach(([k, v]) => { if (v.trim()) payload[k] = v.trim(); });
      if (!Object.keys(payload).length) { toast("error", "Chưa nhập key nào."); return; }
      await apiFetch("/config/api-keys", { method: "POST", body: JSON.stringify(payload) });
      toast("success", "Đã cập nhật API keys.");
      setKeys({});
      fetchKeys();
    } catch (e: unknown) {
      toast("error", e instanceof Error ? e.message : "Lưu thất bại.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (provider: string) => {
    if (!confirm(`Xóa API key của ${provider}?`)) return;
    setDeleting(provider);
    try {
      await apiFetch(`/config/api-keys/${provider}`, { method: "DELETE" });
      toast("success", `Đã xóa key ${provider}.`);
      fetchKeys();
    } catch (e: unknown) {
      toast("error", e instanceof Error ? e.message : "Xóa thất bại.");
    } finally {
      setDeleting(null);
    }
  };

  return (
    <Section icon={Key} title="API Keys">
      <div className="space-y-3">
        {providers.map(p => (
          <div key={p.provider} className="flex items-center gap-3 p-3 border border-gray-100 rounded-xl hover:border-gray-200 transition">
            <div className="w-28 shrink-0">
              <span className="text-[13px] font-semibold text-gray-700">{p.provider}</span>
              <div className="mt-0.5">
                {p.configured
                  ? <span className="text-[10px] text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-full font-medium">✓ {p.masked_key}</span>
                  : <span className="text-[10px] text-gray-400">Chưa cấu hình</span>
                }
              </div>
            </div>
            <div className="flex-1 relative">
              <input
                type={show[p.provider] ? "text" : "password"}
                value={keys[p.provider] ?? ""}
                onChange={e => setKeys(prev => ({ ...prev, [p.provider]: e.target.value }))}
                placeholder={p.configured ? "Nhập key mới để cập nhật..." : "Nhập API key..."}
                className="w-full px-3 py-2 pr-10 text-[13px] border border-gray-200 rounded-xl focus:outline-none focus:border-blue-400 bg-white transition"
              />
              <button
                onClick={() => setShow(s => ({ ...s, [p.provider]: !s[p.provider] }))}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {show[p.provider] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
            {p.configured && (
              <button
                onClick={() => handleDelete(p.provider)}
                disabled={deleting === p.provider}
                className="p-2 text-gray-300 hover:text-red-400 transition"
                title="Xóa key"
              >
                {deleting === p.provider ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              </button>
            )}
          </div>
        ))}
      </div>
      <div className="mt-4">
        <SaveBtn loading={saving} onClick={handleSave} />
      </div>
    </Section>
  );
}

// ── Features Section ──────────────────────────────────────────────────────────

function FeaturesSection() {
  const [cfg, setCfg] = useState<FeatureConfig>({ enable_cover_letter: false, enable_outreach_message: false });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    apiFetch<FeatureConfig>("/config/features").then(setCfg).catch(() => {});
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await apiFetch("/config/features", { method: "PUT", body: JSON.stringify(cfg) });
      toast("success", "Đã lưu cấu hình tính năng.");
    } catch (e: unknown) {
      toast("error", e instanceof Error ? e.message : "Lưu thất bại.");
    } finally {
      setSaving(false);
    }
  };

  const Toggle = ({ label, hint, checked, onChange }: { label: string; hint: string; checked: boolean; onChange: (v: boolean) => void }) => (
    <div className="flex items-center justify-between py-3 border-b border-gray-50 last:border-0">
      <div>
        <div className="text-[13px] font-semibold text-gray-700">{label}</div>
        <div className="text-[11px] text-gray-400 mt-0.5">{hint}</div>
      </div>
      <button
        onClick={() => onChange(!checked)}
        className={`relative w-11 h-6 rounded-full transition-colors ${checked ? "bg-blue-500" : "bg-gray-200"}`}
      >
        <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform ${checked ? "translate-x-5" : ""}`} />
      </button>
    </div>
  );

  return (
    <Section icon={Zap} title="Tính năng">
      <Toggle
        label="Cover Letter Generator"
        hint="Cho phép user tạo cover letter từ CV + JD"
        checked={cfg.enable_cover_letter}
        onChange={v => setCfg(p => ({ ...p, enable_cover_letter: v }))}
      />
      <Toggle
        label="Outreach Message Generator"
        hint="Tạo email/tin nhắn tiếp cận nhà tuyển dụng"
        checked={cfg.enable_outreach_message}
        onChange={v => setCfg(p => ({ ...p, enable_outreach_message: v }))}
      />
      <div className="mt-4">
        <SaveBtn loading={saving} onClick={handleSave} />
      </div>
    </Section>
  );
}

// ── Language Section ──────────────────────────────────────────────────────────

function LanguageSection() {
  const [cfg, setCfg] = useState<LanguageConfig>({ ui_language: "en", content_language: "en", supported_languages: [] });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    apiFetch<LanguageConfig>("/config/language").then(setCfg).catch(() => {});
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await apiFetch("/config/language", { method: "PUT", body: JSON.stringify({ ui_language: cfg.ui_language, content_language: cfg.content_language }) });
      toast("success", "Đã lưu cấu hình ngôn ngữ.");
    } catch (e: unknown) {
      toast("error", e instanceof Error ? e.message : "Lưu thất bại.");
    } finally {
      setSaving(false);
    }
  };

  const langs = cfg.supported_languages.length ? cfg.supported_languages : ["en", "es", "zh", "ja", "pt"];

  return (
    <Section icon={Globe} title="Ngôn ngữ">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <Field label="Ngôn ngữ giao diện" hint="Ngôn ngữ hiển thị trên UI">
          <Select value={cfg.ui_language} onChange={e => setCfg(p => ({ ...p, ui_language: e.target.value }))}>
            {langs.map(l => <option key={l} value={l}>{LANGUAGE_LABELS[l] ?? l}</option>)}
          </Select>
        </Field>
        <Field label="Ngôn ngữ nội dung AI" hint="Ngôn ngữ AI trả lời (gợi ý, phân tích)">
          <Select value={cfg.content_language} onChange={e => setCfg(p => ({ ...p, content_language: e.target.value }))}>
            {langs.map(l => <option key={l} value={l}>{LANGUAGE_LABELS[l] ?? l}</option>)}
          </Select>
        </Field>
      </div>
      <div className="mt-4">
        <SaveBtn loading={saving} onClick={handleSave} />
      </div>
    </Section>
  );
}

// ── Prompt Section ────────────────────────────────────────────────────────────

function PromptSection() {
  const [cfg, setCfg] = useState<PromptConfig>({ default_prompt_id: "", prompt_options: [] });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    apiFetch<PromptConfig>("/config/prompts").then(setCfg).catch(() => {});
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await apiFetch("/config/prompts", { method: "PUT", body: JSON.stringify({ default_prompt_id: cfg.default_prompt_id }) });
      toast("success", "Đã lưu cấu hình prompt.");
    } catch (e: unknown) {
      toast("error", e instanceof Error ? e.message : "Lưu thất bại.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Section icon={Settings} title="Chiến lược Prompt CV">
      <Field label="Prompt mặc định khi cải thiện CV" hint="Chiến lược AI dùng để tailored CV theo JD">
        <div className="space-y-2 mt-1">
          {cfg.prompt_options.map(opt => (
            <label key={opt.id} className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition ${cfg.default_prompt_id === opt.id ? "border-blue-300 bg-blue-50/50" : "border-gray-100 hover:border-gray-200"}`}>
              <input
                type="radio"
                name="prompt"
                value={opt.id}
                checked={cfg.default_prompt_id === opt.id}
                onChange={() => setCfg(p => ({ ...p, default_prompt_id: opt.id }))}
                className="mt-0.5 accent-blue-500"
              />
              <div>
                <div className="text-[13px] font-semibold text-gray-700">{opt.label}</div>
                <div className="text-[11px] text-gray-400 mt-0.5">{opt.description}</div>
              </div>
            </label>
          ))}
        </div>
      </Field>
      <div className="mt-4">
        <SaveBtn loading={saving} onClick={handleSave} />
      </div>
    </Section>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Cài đặt hệ thống</h1>
          <p className="text-sm text-gray-500 mt-0.5">Cấu hình LLM, API keys, tính năng và ngôn ngữ</p>
        </div>
        <button
          onClick={() => setRefreshKey(k => k + 1)}
          className="flex items-center gap-2 px-3 py-1.5 text-sm bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition text-gray-600"
        >
          <RefreshCw className="w-4 h-4" />
          Làm mới
        </button>
      </div>

      <div key={refreshKey} className="space-y-6">
        <LLMSection />
        <ApiKeysSection />
        <FeaturesSection />
        <LanguageSection />
        <PromptSection />
      </div>
    </div>
  );
}
