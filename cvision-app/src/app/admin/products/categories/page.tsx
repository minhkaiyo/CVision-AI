// admin/products/categories/page.tsx — CVision Admin: Danh mục dịch vụ
"use client";

import { useState } from "react";
import { Tag, Plus, Edit2, Trash2, CheckCircle, FileText, MessageSquare, PenTool, Target } from "lucide-react";

interface Category {
  id: string;
  name: string;
  slug: string;
  description: string;
  icon: React.ElementType;
  features: string[];
  plan_required: string;
  active: boolean;
}

const INITIAL_CATEGORIES: Category[] = [
  {
    id: "ats-scanner", name: "ATS Scanner", slug: "ats-scanner",
    description: "Phân tích CV theo tiêu chuẩn ATS với điểm số chi tiết",
    icon: Target, plan_required: "FREE",
    features: ["Điểm ATS tổng", "Keyword matching", "Phân tích layout", "Gợi ý cải thiện"],
    active: true,
  },
  {
    id: "ai-chat", name: "AI Career Assistant", slug: "ai-chat",
    description: "Chat AI thời gian thực — tư vấn nghề nghiệp tức thì",
    icon: MessageSquare, plan_required: "FREE",
    features: ["Chat không giới hạn", "Phân tích CV theo ngữ cảnh", "Mock interview questions"],
    active: true,
  },
  {
    id: "cover-letter", name: "Cover Letter Generator", slug: "cover-letter",
    description: "Tự động tạo thư xin việc cá nhân hóa theo JD",
    icon: PenTool, plan_required: "PRO",
    features: ["Template đa dạng", "Tùy chỉnh tone văn phong", "Export PDF/Word"],
    active: true,
  },
  {
    id: "cv-versions", name: "CV Version Control", slug: "cv-versions",
    description: "Quản lý nhiều phiên bản CV cho từng vị trí ứng tuyển",
    icon: FileText, plan_required: "PREMIUM",
    features: ["Lưu không giới hạn phiên bản", "So sánh diff giữa versions", "Tag & tìm kiếm"],
    active: false,
  },
];

const PLAN_COLORS: Record<string, string> = {
  FREE: "bg-gray-100 text-gray-600",
  PRO: "bg-blue-100 text-blue-700",
  PREMIUM: "bg-amber-100 text-amber-700",
  ENTERPRISE: "bg-purple-100 text-purple-700",
};

export default function CategoriesAdminPage() {
  const [categories, setCategories] = useState<Category[]>(INITIAL_CATEGORIES);

  const toggleActive = (id: string) => {
    setCategories(prev => prev.map(c => c.id === id ? { ...c, active: !c.active } : c));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Danh mục Dịch vụ AI</h1>
          <p className="text-sm text-gray-500 mt-0.5">{categories.filter(c => c.active).length} danh mục đang hoạt động</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 text-sm text-white bg-blue-500 hover:bg-blue-600 rounded-xl transition shadow-sm">
          <Plus className="w-4 h-4" /> Thêm danh mục
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {categories.map(c => (
          <div key={c.id} className={`bg-white rounded-2xl border shadow-sm p-5 transition ${!c.active ? "opacity-60" : ""}`}>
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center">
                  <c.icon className="w-5 h-5 text-blue-500" />
                </div>
                <div>
                  <div className="font-bold text-gray-800">{c.name}</div>
                  <span className="text-[11px] text-gray-400 font-mono">/{c.slug}</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${c.active ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-500"}`}>
                  {c.active ? "Active" : "Inactive"}
                </span>
              </div>
            </div>

            <p className="text-[13px] text-gray-500 mb-3">{c.description}</p>

            <div className="mb-3">
              <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">Tính năng</p>
              <div className="space-y-1">
                {c.features.map(f => (
                  <div key={f} className="flex items-center gap-2 text-[12px] text-gray-600">
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                    {f}
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-gray-50">
              <div className="flex items-center gap-2">
                <Tag className="w-3.5 h-3.5 text-gray-400" />
                <span className="text-[12px] text-gray-500">Gói tối thiểu:</span>
                <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${PLAN_COLORS[c.plan_required] || PLAN_COLORS.FREE}`}>
                  {c.plan_required}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button className="p-1.5 text-gray-400 hover:text-blue-500 transition" title="Chỉnh sửa">
                  <Edit2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => toggleActive(c.id)}
                  className={`px-3 py-1.5 text-[12px] rounded-lg font-semibold transition ${
                    c.active ? "bg-red-50 text-red-500 hover:bg-red-100" : "bg-emerald-50 text-emerald-600 hover:bg-emerald-100"
                  }`}
                >
                  {c.active ? "Tắt" : "Bật"}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
