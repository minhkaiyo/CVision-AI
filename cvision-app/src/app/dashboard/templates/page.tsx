"use client";

import { useEffect, useState } from "react";
import { Check, Download, Eye, Loader2, Sparkles, FileText, Wand2, ShieldCheck, Filter, Search, SearchX } from "lucide-react";
import { toast } from "@/components/ui/toast";
import { getCVVersions, getAnalyses } from "@/lib/store";
import { apiGenerateTemplateCV } from "@/lib/api";
import type { CVVersion, AnalysisResult } from "@/lib/types";

// ── Template definitions ──────────────────────────────────────────────────────

interface Template {
  id: string;
  name: string;
  description: string;
  color: string;           // tailwind bg class for preview header
  accent: string;          // tailwind class for section titles
  tags: string[];
  atsScore: number;        
  preview: "single" | "two-column";
}

const TEMPLATES: Template[] = [
  {
    id: "modern-professional",
    name: "Modern Professional",
    description: "Layout chuẩn mực, font sạch. Tối ưu cho khối ngành IT, Finance, Marketing.",
    color: "bg-blue-600",
    accent: "bg-blue-600",
    tags: ["ATS-Friendly", "Single Column", "IT"],
    atsScore: 98,
    preview: "single",
  },
  {
    id: "minimalist-clean",
    name: "Minimalist Clean",
    description: "Tối giản tuyệt đối, loại bỏ màu sắc thừa. Đạt điểm ATS tuyệt đối.",
    color: "bg-gray-800",
    accent: "bg-gray-800",
    tags: ["ATS Max", "Single Column"],
    atsScore: 100,
    preview: "single",
  },
  {
    id: "creative-bold",
    name: "Creative Bold",
    description: "Sử dụng màu sắc nhấn mạnh mẽ. Phù hợp Design, Marketing, Creative roles.",
    color: "bg-purple-600",
    accent: "bg-purple-600",
    tags: ["Creative", "Single Column", "Marketing"],
    atsScore: 85,
    preview: "single",
  },
  {
    id: "executive-standard",
    name: "Executive Standard",
    description: "Phong cách nghiêm chỉnh, sang trọng. Dành cho Senior và Management level.",
    color: "bg-emerald-700",
    accent: "bg-emerald-700",
    tags: ["Senior", "Single Column", "Formal"],
    atsScore: 96,
    preview: "single",
  },
  {
    id: "tech-modern",
    name: "Tech Modern",
    description: "Thiết kế sắc nét, tối ưu diện tích cho việc liệt kê nhiều công nghệ.",
    color: "bg-indigo-600",
    accent: "bg-indigo-600",
    tags: ["Tech", "ATS-Friendly", "IT"],
    atsScore: 94,
    preview: "single",
  },
  {
    id: "banking-finance",
    name: "Banking & Finance",
    description: "Bố cục truyền thống, chuyên biệt cho ngành Ngân hàng, Kế toán, Tài chính.",
    color: "bg-amber-700",
    accent: "bg-amber-700",
    tags: ["Finance", "Formal", "Single Column"],
    atsScore: 97,
    preview: "single",
  },
];

const FILTERS = ["Tất cả", "ATS Max", "Tech", "Formal", "Creative"];

// ── Shared Glassmorphism Styles ──────────────────────────────────────────────
const glassCard = "backdrop-blur-xl bg-white/80 border border-white/60 shadow-sm rounded-2xl";

// ── Realistic Template Preview Graphic ─────────────────────────────────────────
function ResumePreviewMock({ template }: { template: Template }) {
  return (
    <div className="w-[75%] h-full bg-white shadow-[0_8px_30px_rgb(0,0,0,0.08)] flex flex-col rounded-t border border-gray-100 overflow-hidden mx-auto transition-transform duration-300 group-hover:-translate-y-2">
      {/* Header */}
      <div className={`w-full py-2.5 flex flex-col items-center justify-center ${template.id.includes('creative') ? template.color : 'bg-white'}`}>
        <div className={`w-1/2 h-1.5 rounded-full mb-1 ${template.id.includes('creative') ? 'bg-white/90' : 'bg-gray-800'}`} />
        <div className={`w-1/3 h-1 rounded-full ${template.id.includes('creative') ? 'bg-white/60' : 'bg-gray-400'}`} />
      </div>
      
      {/* Body */}
      <div className="p-2.5 flex-1 flex flex-col gap-2">
        {/* Section 1 */}
        <div>
          <div className="flex items-center gap-1 mb-1.5 border-b border-gray-100 pb-0.5">
            <div className={`w-1/3 h-1 rounded-full ${template.accent}`} />
          </div>
          <div className="space-y-1 pl-1">
            <div className="flex justify-between items-center">
              <div className="w-2/5 h-1 bg-gray-600 rounded-full" />
              <div className="w-1/5 h-0.5 bg-gray-300 rounded-full" />
            </div>
            <div className="w-[90%] h-0.5 bg-gray-300 rounded-full" />
            <div className="w-[80%] h-0.5 bg-gray-300 rounded-full" />
          </div>
        </div>

        {/* Section 2 */}
        <div>
          <div className="flex items-center gap-1 mb-1.5 border-b border-gray-100 pb-0.5">
            <div className={`w-1/4 h-1 rounded-full ${template.accent}`} />
          </div>
          <div className="space-y-1 pl-1">
            <div className="flex justify-between items-center">
              <div className="w-1/2 h-1 bg-gray-600 rounded-full" />
              <div className="w-1/6 h-0.5 bg-gray-300 rounded-full" />
            </div>
            <div className="w-[85%] h-0.5 bg-gray-300 rounded-full" />
            <div className="w-[70%] h-0.5 bg-gray-300 rounded-full" />
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Template Preview Card ─────────────────────────────────────────────────────
function TemplateCard({
  template,
  selected,
  onSelect,
}: {
  template: Template;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <div
      onClick={onSelect}
      className={`${glassCard} overflow-hidden cursor-pointer transition-all duration-300 group border-2 ${
        selected
          ? "border-blue-500 shadow-md scale-[1.02]"
          : "border-transparent hover:border-gray-200 hover:shadow-md"
      }`}
    >
      {/* Visual Preview Area */}
      <div className={`h-48 pt-4 flex flex-col justify-end relative bg-gradient-to-b from-gray-50 to-gray-100`}>
        {selected && (
          <div className="absolute top-3 right-3 bg-blue-500 text-white rounded-full p-1 shadow-md z-10 animate-in zoom-in duration-200">
            <Check className="w-4 h-4" />
          </div>
        )}
        <ResumePreviewMock template={template} />
      </div>

      {/* Info Area */}
      <div className="p-4 bg-white/50 backdrop-blur-md">
        <div className="flex justify-between items-start mb-1">
          <h3 className="font-extrabold text-gray-900 text-[15px]">{template.name}</h3>
          <span className="text-[10px] font-bold bg-emerald-50 text-emerald-600 border border-emerald-100 px-2 py-0.5 rounded shadow-sm whitespace-nowrap">
            ATS {template.atsScore}%
          </span>
        </div>
        <p className="text-[12px] text-gray-500 leading-relaxed font-medium mb-3 line-clamp-2 h-9">{template.description}</p>
        <div className="flex flex-wrap gap-1.5">
          {template.tags.slice(0, 3).map(tag => (
            <span key={tag} className="text-[10.5px] font-bold px-2 py-0.5 bg-gray-100/80 text-gray-600 border border-gray-200/50 rounded-md">
              {tag}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Apply template to CV version ─────────────────────────────────────────────

async function applyTemplateAndExport(
  templateId: string,
  sourceId: string,
  sourceType: "version" | "analysis",
  title: string,
  sourceContext?: Record<string, unknown>
): Promise<void> {
  const result = await apiGenerateTemplateCV({
    source_id: sourceId,
    source_type: sourceType,
    template_id: templateId,
    source_context: sourceContext,
  });
  const htmlContent = result.html;
  const blob = new Blob([htmlContent], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const win = window.open(url, "_blank");
  if (win) {
    win.onload = () => {
      setTimeout(() => win.print(), 500);
    };
  }
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function TemplatesPage() {
  const [selectedTemplate, setSelectedTemplate] = useState<string>("modern-professional");
  const [filter, setFilter] = useState("Tất cả");
  const [cvVersions, setCVVersions] = useState<CVVersion[]>([]);
  const [analyses, setAnalyses] = useState<AnalysisResult[]>([]);
  const [selectedCV, setSelectedCV] = useState<string>("");
  const [exporting, setExporting] = useState(false);
  const [syncing, setSyncing] = useState(true);

  useEffect(() => {
    const localVersions = getCVVersions();
    const localAnalyses = getAnalyses();
    setCVVersions(localVersions);
    setAnalyses(localAnalyses);

    import("@/lib/api").then(({ apiListCVVersions, apiListAnalyses }) => {
      Promise.allSettled([apiListCVVersions(), apiListAnalyses()])
        .then(([versionsResult, analysesResult]) => {
          if (versionsResult.status === "fulfilled") {
            const remote = versionsResult.value.cv_versions;
            const merged = [...localVersions];
            for (const r of remote) {
              if (!merged.find(v => v.id === r.id)) {
                merged.push({
                  id: r.id, analysis_id: "", title: r.title, target_role: r.target_role ?? "",
                  status: r.status as CVVersion["status"], createdAt: r.created_at, updatedAt: r.created_at,
                  diff_items: (r.diff_items as CVVersion["diff_items"]) ?? [],
                });
              }
            }
            setCVVersions(merged);
          }
          if (analysesResult.status === "fulfilled") {
            const remote = analysesResult.value.analyses;
            const merged = [...localAnalyses];
            for (const r of remote) {
              if (!merged.find(a => a.analysis_id === r.id)) {
                merged.push({
                  analysis_id: r.id, fileName: r.file_name ?? "unknown.pdf", role: r.role ?? "",
                  createdAt: r.created_at, total_score: r.total_score, layout_score: r.layout_score,
                  content_score: r.content_score, ats_score: r.ats_score, keyword_score: r.keyword_score,
                  skills_score: r.skills_score, achievement_score: r.achievement_score, ats_platform_scores: r.ats_platform_scores,
                  matched_keywords: r.matched_keywords ?? [], missing_keywords: r.missing_keywords ?? [],
                  suggestions: (r.suggestions as AnalysisResult["suggestions"]) ?? [], hr_review: r.hr_review as AnalysisResult["hr_review"],
                  summary: r.summary, resume_id: r.resume_id, job_id: r.job_id,
                });
              }
            }
            setAnalyses(merged);
          }
        })
        .finally(() => setSyncing(false));
    });
  }, []);

  const allSources = [
    ...cvVersions.map(v => ({ id: v.id, label: `✨ ${v.title}`, type: "version" as const })),
    ...analyses.map(a => ({ id: a.analysis_id, label: `📄 ${a.role} — ${a.fileName}`, type: "analysis" as const })),
  ];

  const filteredTemplates = filter === "Tất cả" 
    ? TEMPLATES 
    : TEMPLATES.filter(t => t.tags.includes(filter));

  const template = TEMPLATES.find(t => t.id === selectedTemplate)!;

  const handleApply = async () => {
    if (!selectedCV) {
      toast("warning", "Vui lòng chọn CV hoặc kết quả phân tích để áp dụng template.");
      return;
    }
    setExporting(true);
    try {
      const source = allSources.find(s => s.id === selectedCV);
      if (!source) {
        throw new Error("Không tìm thấy CV đã chọn.");
      }
      const title = source.label.replace(/^[^\wÀ-ỹ]+/u, "") || "CV-CVision";
      const sourceContext =
        source.type === "version"
          ? {
              version: cvVersions.find(v => v.id === source.id),
              analysis: analyses.find(a => a.analysis_id === cvVersions.find(v => v.id === source.id)?.analysis_id),
            }
          : {
              analysis: analyses.find(a => a.analysis_id === source.id),
            };
      await applyTemplateAndExport(selectedTemplate, source.id, source.type, title, sourceContext);
      toast("success", "Đã xuất CV với template đã chọn!");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Xuất CV thất bại. Thử lại sau.";
      toast("error", message);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="max-w-[1100px] mx-auto font-sans pb-10">
      
      {/* Header & Filters */}
      <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900 flex items-center gap-2 mb-1.5 tracking-tight">
            <Sparkles className="w-6 h-6 text-blue-600" /> Thư viện Mẫu CV
          </h1>
          <p className="text-gray-500 text-[14px] font-medium">
            Tất cả template đều vượt qua hệ thống quét ATS. Hãy chọn phong cách phù hợp nhất.
          </p>
        </div>
        
        {/* Filter Chips */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 md:pb-0 hide-scrollbar">
          <Filter className="w-4 h-4 text-gray-400 mr-1 shrink-0" />
          {FILTERS.map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-1.5 rounded-full text-[13px] font-bold whitespace-nowrap transition-all ${
                filter === f 
                  ? "bg-gray-900 text-white shadow-md" 
                  : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50 hover:border-gray-300"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 items-start">
        
        {/* ── Left Column: Template Grid ──────────────────────────────────────── */}
        <div className="xl:col-span-8 space-y-4">
          {filteredTemplates.length === 0 ? (
            <div className={`${glassCard} py-20 flex flex-col items-center justify-center text-center`}>
              <SearchX className="w-12 h-12 text-gray-300 mb-3" />
              <p className="font-bold text-gray-900 text-lg">Không tìm thấy mẫu CV</p>
              <p className="text-gray-500 text-sm mt-1">Vui lòng chọn một bộ lọc khác.</p>
              <button onClick={() => setFilter("Tất cả")} className="mt-4 px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-bold shadow-sm hover:bg-gray-50 text-blue-600">
                Hiển thị tất cả
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              {filteredTemplates.map(tpl => (
                <TemplateCard
                  key={tpl.id}
                  template={tpl}
                  selected={selectedTemplate === tpl.id}
                  onSelect={() => setSelectedTemplate(tpl.id)}
                />
              ))}
            </div>
          )}
        </div>

        {/* ── Right Column: Apply Panel (Sticky) ──────────────────────────────── */}
        <div className="xl:col-span-4 xl:sticky xl:top-6 space-y-5">
          
          {/* Trust Badge */}
          <div className="flex items-center justify-center gap-2 bg-emerald-50 border border-emerald-100 rounded-xl py-2.5 px-4 shadow-sm">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span className="text-[12.5px] font-bold text-emerald-700">100% Template Chuẩn Định Dạng ATS</span>
          </div>

          <div className={`${glassCard} p-6 shadow-md`}>
            
            {/* Selected Template Header */}
            <div className="flex gap-4 items-start pb-5 border-b border-gray-100/80 mb-5">
              <div className={`w-12 h-14 rounded-lg bg-gradient-to-b from-gray-100 to-white shadow-sm border border-gray-200 shrink-0 flex items-center justify-center overflow-hidden relative`}>
                <div className={`absolute top-0 w-full h-2 ${template.color}`} />
                <FileText className="w-6 h-6 text-gray-400 mt-1" />
              </div>
              <div>
                <h3 className="font-extrabold text-gray-900 text-[16px] leading-tight mb-1">{template.name}</h3>
                <div className="flex items-center gap-1.5 text-[12px] font-bold text-emerald-600">
                  <Check className="w-3.5 h-3.5" /> Điểm ATS Mặc định: {template.atsScore}%
                </div>
              </div>
            </div>

            {/* Target CV Selection */}
            <div className="space-y-4">
              <div>
                <label className="font-bold text-gray-800 text-[13.5px] flex items-center gap-2 mb-2">
                  <Wand2 className="w-4 h-4 text-blue-600" /> Áp dụng dữ liệu từ:
                </label>
                
                {syncing ? (
                  <div className="flex items-center justify-center gap-2 text-gray-500 text-[13px] bg-gray-50 py-3 rounded-xl border border-gray-100">
                    <Loader2 className="w-4 h-4 animate-spin text-blue-500" /> Đang tải dữ liệu...
                  </div>
                ) : allSources.length === 0 ? (
                  <div className="text-center py-4 bg-gray-50 rounded-xl border border-gray-100">
                    <p className="text-[13px] text-gray-500 mb-2 font-medium">Bạn chưa có dữ liệu CV nào.</p>
                    <a href="/dashboard/upload" className="text-blue-600 font-bold hover:underline text-[13px]">
                      Tải lên & Phân tích ngay →
                    </a>
                  </div>
                ) : (
                  <div className="relative">
                    <select
                      value={selectedCV}
                      onChange={e => setSelectedCV(e.target.value)}
                      className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-[14px] text-gray-800 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all shadow-sm appearance-none font-medium cursor-pointer"
                    >
                      <option value="" disabled>— Chọn CV hoặc Kết quả phân tích —</option>
                      {cvVersions.length > 0 && (
                        <optgroup label="Phiên bản CV đã tối ưu" className="font-bold">
                          {cvVersions.map(v => (
                            <option key={v.id} value={v.id}>{v.title}</option>
                          ))}
                        </optgroup>
                      )}
                      {analyses.length > 0 && (
                        <optgroup label="Kết quả phân tích gốc" className="font-bold">
                          {analyses.map(a => (
                            <option key={a.analysis_id} value={a.analysis_id}>
                              {a.role} — {a.fileName}
                            </option>
                          ))}
                        </optgroup>
                      )}
                    </select>
                    {/* Custom Dropdown Arrow */}
                    <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none">
                      <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                    </div>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="pt-2 flex flex-col gap-3">
                <button
                  onClick={handleApply}
                  disabled={exporting || !selectedCV}
                  className={`w-full flex items-center justify-center gap-2 font-bold py-3.5 rounded-xl transition-all text-[14px] shadow-sm ${
                    !selectedCV 
                      ? "bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-200" 
                      : "bg-blue-600 hover:bg-blue-700 text-white shadow-blue-500/25 hover:shadow-lg hover:-translate-y-0.5"
                  }`}
                >
                  {exporting ? (
                    <><Loader2 className="w-4.5 h-4.5 animate-spin" /> Đang xử lý PDF...</>
                  ) : !selectedCV ? (
                    <><Download className="w-4.5 h-4.5" /> Chọn CV để xuất PDF</>
                  ) : (
                    <><Download className="w-4.5 h-4.5" /> Xuất PDF mẫu {template.name}</>
                  )}
                </button>

                <button
                  onClick={() => {
                    toast("success", `Đang mở bản xem trước mẫu "${template.name}"...`);
                    // Mock preview action
                  }}
                  className="w-full flex items-center justify-center gap-2 bg-white border border-gray-200 text-gray-700 font-bold py-3 rounded-xl hover:bg-gray-50 hover:border-gray-300 transition-all text-[14px] shadow-sm group"
                >
                  <Eye className="w-4.5 h-4.5 text-gray-400 group-hover:text-blue-500 transition-colors" /> Xem trước bản lớn
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
