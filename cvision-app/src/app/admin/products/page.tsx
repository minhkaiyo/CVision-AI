// admin/products/page.tsx — CVision Admin: Danh sách AI Models
"use client";

import { useState } from "react";
import { Bot, Zap, Brain, Star, CheckCircle, Edit2, ToggleLeft, ToggleRight } from "lucide-react";

interface AIModel {
  id: string;
  name: string;
  provider: string;
  description: string;
  use_case: string;
  status: "active" | "inactive" | "beta";
  speed: "Fast" | "Medium" | "Slow";
  context_window: string;
  price_per_1k: string;
}

const MODELS: AIModel[] = [
  {
    id: "gemini-2.0-flash",
    name: "Gemini 2.0 Flash",
    provider: "Google",
    description: "Model phân tích CV chính — cân bằng tốc độ và chất lượng.",
    use_case: "CV Analysis, ATS Scoring",
    status: "active",
    speed: "Fast",
    context_window: "1M tokens",
    price_per_1k: "$0.10",
  },
  {
    id: "gemini-2.0-flash-lite",
    name: "Gemini 2.0 Flash Lite",
    provider: "Google",
    description: "Model AI Chat real-time — phản hồi cực nhanh, chi phí thấp.",
    use_case: "AI Chat Widget",
    status: "active",
    speed: "Fast",
    context_window: "1M tokens",
    price_per_1k: "$0.04",
  },
  {
    id: "gemini-1.5-pro",
    name: "Gemini 1.5 Pro",
    provider: "Google",
    description: "Model độ chính xác cao cho phân tích chuyên sâu.",
    use_case: "Deep Analysis (Enterprise)",
    status: "inactive",
    speed: "Slow",
    context_window: "2M tokens",
    price_per_1k: "$1.25",
  },
  {
    id: "gpt-4o-mini",
    name: "GPT-4o Mini",
    provider: "OpenAI",
    description: "Backup model từ OpenAI — có thể tích hợp như fallback.",
    use_case: "Fallback / A-B Testing",
    status: "inactive",
    speed: "Fast",
    context_window: "128K tokens",
    price_per_1k: "$0.15",
  },
  {
    id: "claude-3-haiku",
    name: "Claude 3 Haiku",
    provider: "Anthropic",
    description: "Xuất sắc cho Cover Letter viết dạng văn bản tự nhiên.",
    use_case: "Cover Letter Generation",
    status: "beta",
    speed: "Fast",
    context_window: "200K tokens",
    price_per_1k: "$0.25",
  },
];

const STATUS_STYLE: Record<string, string> = {
  active: "bg-emerald-100 text-emerald-700",
  inactive: "bg-gray-100 text-gray-500",
  beta: "bg-blue-100 text-blue-600",
};

const PROVIDER_COLOR: Record<string, string> = {
  Google: "bg-red-50 text-red-600 border-red-100",
  OpenAI: "bg-teal-50 text-teal-600 border-teal-100",
  Anthropic: "bg-orange-50 text-orange-600 border-orange-100",
};

export default function ProductsAdminPage() {
  const [models, setModels] = useState<AIModel[]>(MODELS);

  const toggleStatus = (id: string) => {
    setModels(prev => prev.map(m =>
      m.id === id ? { ...m, status: m.status === "active" ? "inactive" : "active" } : m
    ));
  };

  const activeCount = models.filter(m => m.status === "active").length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Danh sách AI Models</h1>
          <p className="text-sm text-gray-500 mt-0.5">{activeCount} model đang hoạt động · {models.length} tổng cộng</p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 border border-emerald-100 rounded-lg text-sm text-emerald-700 font-medium">
          <CheckCircle className="w-4 h-4" />
          {activeCount} model active
        </div>
      </div>

      {/* Active model highlight */}
      <div className="bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl p-5 text-white">
        <div className="flex items-center gap-2 mb-1">
          <Zap className="w-4 h-4" />
          <span className="text-sm font-semibold opacity-80">Model chính hiện tại</span>
        </div>
        <div className="text-2xl font-black">Gemini 2.0 Flash</div>
        <div className="text-sm opacity-70 mt-1">Được dùng cho CV Analysis và ATS Scoring · Google AI</div>
      </div>

      {/* Model grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {models.map(m => (
          <div key={m.id} className={`bg-white rounded-2xl border shadow-sm p-5 transition ${m.status === "inactive" ? "opacity-60" : ""}`}>
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${PROVIDER_COLOR[m.provider] || "bg-gray-50 border-gray-100"}`}>
                  <Brain className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-bold text-gray-800">{m.name}</div>
                  <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${PROVIDER_COLOR[m.provider] || ""}`}>
                    {m.provider}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${STATUS_STYLE[m.status]}`}>
                  {m.status === "active" ? "Active" : m.status === "beta" ? "Beta" : "Inactive"}
                </span>
                <button
                  onClick={() => toggleStatus(m.id)}
                  className="text-gray-400 hover:text-blue-500 transition"
                  title={m.status === "active" ? "Tắt model" : "Bật model"}
                >
                  {m.status === "active"
                    ? <ToggleRight className="w-6 h-6 text-emerald-500" />
                    : <ToggleLeft className="w-6 h-6" />
                  }
                </button>
              </div>
            </div>

            <p className="text-[13px] text-gray-500 mb-3">{m.description}</p>

            <div className="grid grid-cols-3 gap-2 text-center">
              {[
                { label: "Tốc độ", value: m.speed },
                { label: "Context", value: m.context_window },
                { label: "Giá/1K token", value: m.price_per_1k },
              ].map(stat => (
                <div key={stat.label} className="bg-gray-50 rounded-xl p-2.5">
                  <div className="text-[10px] text-gray-400 font-medium">{stat.label}</div>
                  <div className="text-[12px] font-bold text-gray-700 mt-0.5">{stat.value}</div>
                </div>
              ))}
            </div>

            <div className="mt-3 pt-3 border-t border-gray-50 flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-[12px] text-gray-400">
                <Bot className="w-3.5 h-3.5" />
                {m.use_case}
              </div>
              <button className="flex items-center gap-1.5 text-[12px] text-blue-500 hover:text-blue-600 transition">
                <Edit2 className="w-3.5 h-3.5" /> Cấu hình
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
