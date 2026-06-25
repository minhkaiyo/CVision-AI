"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { Download, Eye, Trash2, Plus, FileText, Loader2, Sparkles, Wand2, UploadCloud, ChevronRight, LayoutTemplate } from "lucide-react";
import { getCVVersions, deleteCVVersion, getAnalyses, saveCVVersion, pushNotification } from "@/lib/store";
import { apiListCVVersions, apiDeleteCVVersion, apiExportCVPDF } from "@/lib/api";
import type { CVVersion, AnalysisResult, DiffItem } from "@/lib/types";
import { toast } from "@/components/ui/toast";
import { useRouter } from "next/navigation";

// ── Shared UI Styles ─────────────────────────────────────────────────────────
const glassCard = "backdrop-blur-[40px] bg-white/20 border-[1.5px] border-white/60 shadow-[inset_0_2px_4px_rgba(255,255,255,0.8),inset_0_-1px_2px_rgba(255,255,255,0.3),0_12px_40px_rgba(31,38,135,0.1)] rounded-[2.5rem] relative overflow-hidden";

// ── Generate CV Version modal ─────────────────────────────────
function GenerateModal({
  analyses,
  onClose,
  onGenerated,
}: {
  analyses: AnalysisResult[];
  onClose: () => void;
  onGenerated: (v: CVVersion) => void;
}) {
  const [selectedAnalysis, setSelectedAnalysis] = useState(analyses[0]?.analysis_id ?? "");
  const [loading, setLoading] = useState(false);

  const handleGenerate = async () => {
    const analysis = analyses.find((a) => a.analysis_id === selectedAnalysis);
    if (!analysis) { toast("warning", "Vui lòng chọn một kết quả phân tích."); return; }

    setLoading(true);
    try {
      const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "/api/v1";
      let diffs: DiffItem[] = [];
      let optimizedMarkdown = "";
      let backendVersionId: string | undefined;

      if (analysis.resume_id && analysis.job_id) {
        const cvVerRes = await fetch(`${apiBase}/cv-versions`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            resume_id: analysis.resume_id,
            job_id: analysis.job_id,
            analysis_id: analysis.analysis_id,
            source_context: { analysis },
          }),
        }).catch(() => null);

        if (cvVerRes?.ok) {
          const cvVerData = await cvVerRes.json();
          backendVersionId = cvVerData.cv_version_id;
          if (backendVersionId) {
            const detailRes = await fetch(`${apiBase}/cv-versions/${backendVersionId}`, {
              headers: { "Content-Type": "application/json" },
            }).catch(() => null);
            if (detailRes?.ok) {
              const detail = await detailRes.json();
              diffs = (detail.diff_items ?? []) as DiffItem[];
              optimizedMarkdown = detail.optimized_markdown ?? "";
            }
          }
        }
      }

      if (diffs.length === 0 && analysis.resume_id && analysis.job_id) {
        const previewRes = await fetch(`${apiBase}/resumes/improve/preview`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ resume_id: analysis.resume_id, job_id: analysis.job_id }),
        }).catch(() => null);
        if (previewRes?.ok) {
          const previewData = await previewRes.json();
          diffs = previewData.data?.diff_summary?.changes ?? [];
          optimizedMarkdown = previewData.data?.improved_resume?.content ?? "";
        }
      }

      if (diffs.length === 0) {
        diffs = (analysis.suggestions ?? []).map((s, i) => ({
          path: `suggestion_${i}`,
          action: "replace" as const,
          original: s.problem,
          value: s.recommendation,
          reason: s.recommendation,
          confidence: (s.priority === "high" ? "high" : s.priority === "medium" ? "medium" : "low") as DiffItem["confidence"],
          applied: false,
        }));
      }

      const version: CVVersion = {
        id: backendVersionId ?? `ver_${Date.now()}`,
        analysis_id: analysis.analysis_id,
        resume_id: analysis.resume_id,
        title: `${analysis.role} — CV tối ưu`,
        target_role: analysis.role,
        status: "ready",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        diff_items: diffs,
        optimized_markdown: optimizedMarkdown,
      };

      saveCVVersion(version);
      onGenerated(version);
      toast("success", "Đã tạo phiên bản CV tối ưu!");
      pushNotification({
        type: "success",
        title: "Phiên bản CV mới đã sẵn sàng",
        body: `"${version.title}" với ${version.diff_items?.length ?? 0} gợi ý tối ưu. Xuất PDF ngay!`,
        link: `/dashboard/cv-versions`,
      });
    } catch {
      toast("error", "Có lỗi khi tạo phiên bản CV. Thử lại sau.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white border border-gray-100 rounded-3xl p-8 w-full max-w-md shadow-2xl">
        <h3 className="text-2xl font-extrabold text-gray-900 mb-2">Tạo phiên bản CV mới</h3>
        <p className="text-gray-500 text-[14px] mb-6 font-medium">AI sẽ dựa trên kết quả phân tích ATS để tạo ra phiên bản CV tối ưu nhất cho bạn.</p>
        
        <div className="space-y-6">
          <div>
            <label className="block text-[13px] font-bold text-gray-700 mb-2">Chọn kết quả phân tích</label>
            {analyses.length === 0 ? (
              <div className="p-4 bg-orange-50 rounded-xl border border-orange-100 text-orange-600 text-sm text-center">
                Chưa có phân tích nào. <Link href="/dashboard/upload" className="font-bold underline">Phân tích CV trước.</Link>
              </div>
            ) : (
              <select
                value={selectedAnalysis}
                onChange={(e) => setSelectedAnalysis(e.target.value)}
                className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-[14px] font-medium text-gray-800 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition shadow-sm"
              >
                {analyses.map((a) => (
                  <option key={a.analysis_id} value={a.analysis_id}>{a.role} — {a.fileName}</option>
                ))}
              </select>
            )}
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={onClose} className="flex-1 bg-white border border-gray-200 text-gray-600 py-3 rounded-xl text-[14px] font-bold hover:bg-gray-50 transition shadow-sm">
              Hủy
            </button>
            <button
              onClick={handleGenerate}
              disabled={loading || analyses.length === 0}
              className="flex-1 bg-blue-600 text-white py-3 rounded-xl text-[14px] font-bold hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg"
            >
              {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Đang tạo...</> : <><Wand2 className="w-4 h-4" /> Tạo ngay</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Diff Preview modal ────────────────────────────────────────
function DiffModal({ version, onClose }: { version: CVVersion; onClose: () => void }) {
  const diffs = version.diff_items ?? [];
  const confColor: Record<string, string> = {
    high: "text-emerald-600 border-emerald-100 bg-emerald-50",
    medium: "text-amber-600 border-amber-100 bg-amber-50",
    low: "text-gray-500 border-gray-200 bg-gray-50",
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white border border-gray-100 rounded-3xl w-full max-w-2xl shadow-2xl max-h-[85vh] flex flex-col overflow-hidden">
        <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
          <div>
            <h3 className="text-xl font-extrabold text-gray-900">{version.title}</h3>
            <p className="text-[13px] text-gray-500 font-medium mt-1">Chi tiết gợi ý thay đổi để tối ưu ATS</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full bg-white border border-gray-200 text-gray-500 hover:bg-red-50 hover:border-red-200 hover:text-red-500 transition font-bold text-lg shadow-sm">×</button>
        </div>
        <div className="flex-1 overflow-y-auto p-6 space-y-5 bg-white">
          {diffs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Sparkles className="w-12 h-12 text-blue-200 mb-3" />
              <p className="text-gray-500 font-medium">Không có gợi ý thay đổi nào được ghi nhận.</p>
            </div>
          ) : diffs.map((diff, i) => (
            <div key={i} className="bg-white border border-gray-100 rounded-2xl p-5 hover:border-blue-200 hover:shadow-md transition-all shadow-sm">
              <div className="flex items-start justify-between gap-3 mb-4">
                <span className="text-xs text-gray-500 font-mono bg-gray-50 px-2 py-1 rounded-md border border-gray-100 shadow-inner">{diff.path}</span>
                <span className={`text-xs px-2.5 py-1 rounded-full border font-bold ${confColor[diff.confidence] ?? confColor.low}`}>
                  {diff.confidence === "high" ? "Độ tin cậy: Cao" : diff.confidence === "medium" ? "Độ tin cậy: Vừa" : "Độ tin cậy: Thấp"}
                </span>
              </div>
              {diff.original && (
                <div className="mb-3 p-3.5 bg-red-50/50 border border-red-100 rounded-xl relative overflow-hidden">
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-red-400" />
                  <span className="text-[11px] font-bold uppercase tracking-wider text-red-600 block mb-1.5 ml-2">Phiên bản gốc:</span>
                  <p className="text-[13.5px] text-gray-600 ml-2 font-medium">{diff.original}</p>
                </div>
              )}
              <div className="mb-3 p-3.5 bg-emerald-50/50 border border-emerald-100 rounded-xl relative overflow-hidden">
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-emerald-500" />
                <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-600 block mb-1.5 ml-2">Đề xuất tối ưu (AI):</span>
                <p className="text-[13.5px] text-gray-800 font-bold ml-2">{Array.isArray(diff.value) ? diff.value.join(", ") : diff.value}</p>
              </div>
              <p className="text-[13px] text-gray-600 mt-3 font-medium flex items-start gap-2 bg-blue-50/50 p-3 rounded-lg border border-blue-100/50">
                <Sparkles className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
                {diff.reason}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────
export default function CVVersions() {
  const router = useRouter();
  const [versions, setVersions] = useState<CVVersion[]>(() =>
    typeof window !== "undefined" ? getCVVersions() : []
  );
  const [analyses] = useState<AnalysisResult[]>(() =>
    typeof window !== "undefined" ? getAnalyses() : []
  );
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [previewVersion, setPreviewVersion] = useState<CVVersion | null>(null);
  const [exportingId, setExportingId] = useState<string | null>(null);

  // Sync from backend on mount
  useEffect(() => {
    let cancelled = false;
    async function sync() {
      try {
        const { cv_versions: remote } = await apiListCVVersions();
        if (cancelled) return;
        for (const r of remote) {
          const exists = getCVVersions().find((v) => v.id === r.id);
          if (!exists) {
            saveCVVersion({
              id: r.id, analysis_id: "", title: r.title, target_role: r.target_role ?? "",
              status: r.status as CVVersion["status"], createdAt: r.created_at, updatedAt: r.created_at,
              diff_items: (r.diff_items as CVVersion["diff_items"]) ?? [],
            });
          }
        }
        setVersions(getCVVersions());
      } catch {
        // Backend not available — use local store silently
      }
    }
    sync();
    return () => { cancelled = true; };
  }, []);

  const handleDelete = (id: string) => {
    deleteCVVersion(id);
    setVersions(getCVVersions());
    apiDeleteCVVersion(id).catch(() => null);
    toast("success", "Đã xóa phiên bản CV.");
  };

  const handleDownload = async (v: CVVersion) => {
    setExportingId(v.id);
    try {
      const sourceAnalysis = analyses.find((analysis) => analysis.analysis_id === v.analysis_id);
      const blob = await apiExportCVPDF(v.id, { version: v, analysis: sourceAnalysis });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${v.title.replace(/\s+/g, "-")}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      toast("success", "Đã tải xuống PDF!");
    } catch {
      const content = v.optimized_markdown ?? `# ${v.title}\n\nTarget Role: ${v.target_role}`;
      const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${v.title.replace(/\s+/g, "-")}.txt`;
      a.click();
      URL.revokeObjectURL(url);
      toast("success", "Đã tải xuống (Vui lòng nâng cấp Premium để xuất PDF gốc).");
    } finally {
      setExportingId(null);
    }
  };

  const statusBadge: Record<CVVersion["status"], { label: string; cls: string }> = {
    draft: { label: "Nháp", cls: "bg-gray-100 text-gray-500 border border-gray-200" },
    ready: { label: "Hoàn thiện", cls: "bg-emerald-50 text-emerald-600 border border-emerald-100" },
    exported: { label: "Đã xuất", cls: "bg-blue-50 text-blue-600 border border-blue-100" },
  };

  return (
    <div className="max-w-[1100px] mx-auto space-y-8 animate-in fade-in duration-500 pb-10 font-sans">
      
      {/* ── Header Compact ─────────────────────────────────────────────────── */}
      <div className="relative w-full h-[120px] rounded-2xl overflow-hidden shadow-sm">
        <Image src="/banner-cv-analysis.png" alt="Các bản CV đã tạo" fill className="object-cover object-center" />
        <div className="absolute inset-0 bg-gradient-to-r from-blue-950/90 via-blue-900/80 to-transparent flex flex-col justify-center px-8 md:px-12">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight flex items-center gap-2">
                <FileText className="w-6 h-6 text-blue-400" /> Quản lý các phiên bản CV
              </h1>
              <p className="text-blue-100 max-w-xl text-[14px] leading-relaxed mt-1.5 font-medium hidden sm:block">
                Mỗi vị trí ứng tuyển cần một CV riêng biệt. Tại đây bạn quản lý các bản CV đã được AI tinh chỉnh từ khóa.
              </p>
            </div>
          </div>
        </div>
      </div>

      {versions.length === 0 ? (
        // ── Empty State: Interactive & Helpful ──────────────────────────────
        <div className={`${glassCard} p-8 md:p-12 overflow-hidden relative`}>
          {/* BG blur decoration */}
          <div className="absolute -top-40 -right-40 w-96 h-96 bg-blue-100 rounded-full blur-3xl opacity-50 pointer-events-none" />
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center relative z-10">
            {/* Left: Content & CTAs */}
            <div className="space-y-6">
              <div>
                <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mb-6 shadow-sm border border-blue-100/50">
                  <Wand2 className="w-8 h-8 text-blue-600" />
                </div>
                <h2 className="text-2xl font-extrabold text-gray-900 mb-3">Bạn chưa có phiên bản CV tối ưu nào</h2>
                <p className="text-gray-500 text-[14.5px] font-medium leading-relaxed max-w-md">
                  Quy trình chuẩn của CVision giúp bạn tăng x3 cơ hội trúng tuyển bằng cách tối ưu CV cho từng tin tuyển dụng cụ thể:
                </p>
              </div>

              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-gray-100 text-gray-500 flex items-center justify-center font-bold text-sm shrink-0">1</div>
                  <p className="text-[14px] font-bold text-gray-700">Tải CV của bạn lên cùng Job Description</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-gray-100 text-gray-500 flex items-center justify-center font-bold text-sm shrink-0">2</div>
                  <p className="text-[14px] font-bold text-gray-700">AI chấm điểm và đề xuất sửa lỗi ATS</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 border border-blue-200 flex items-center justify-center font-bold text-sm shrink-0 shadow-sm">3</div>
                  <p className="text-[14px] font-bold text-blue-700">Tạo phiên bản CV tối ưu và Xuất PDF</p>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 pt-4">
                <button 
                  onClick={() => router.push('/dashboard/upload')}
                  className="bg-blue-600 text-white px-6 py-3.5 rounded-xl font-bold text-[14px] hover:bg-blue-700 hover:shadow-lg hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2"
                >
                  <UploadCloud className="w-4.5 h-4.5" /> Phân tích CV mới ngay
                </button>
                <button 
                  onClick={() => router.push('/dashboard/templates')}
                  className="bg-white border border-gray-200 text-gray-700 px-6 py-3.5 rounded-xl font-bold text-[14px] hover:bg-gray-50 hover:border-gray-300 transition-all flex items-center justify-center gap-2 shadow-sm"
                >
                  <LayoutTemplate className="w-4.5 h-4.5" /> Xem Thư viện Mẫu
                </button>
              </div>
            </div>

            {/* Right: Mock Preview Graphic */}
            <div className="hidden lg:flex justify-end relative">
              <div className="w-full max-w-[340px] bg-white border border-gray-100 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.06)] p-5 transform rotate-3 hover:rotate-0 hover:scale-105 transition-all duration-500">
                <div className="flex items-center justify-between border-b border-gray-100 pb-4 mb-4">
                  <div>
                    <div className="h-4 w-32 bg-gray-200 rounded mb-2" />
                    <div className="h-3 w-24 bg-gray-100 rounded" />
                  </div>
                  <div className="w-16 h-6 bg-emerald-50 border border-emerald-100 rounded-full" />
                </div>
                <div className="space-y-4 mb-6">
                  <div className="h-10 bg-gray-50 rounded-xl flex items-center px-4 gap-2">
                    <div className="w-4 h-4 rounded-full bg-blue-100" />
                    <div className="h-3 w-20 bg-gray-200 rounded" />
                  </div>
                  <div className="h-10 bg-gray-50 rounded-xl flex items-center px-4 gap-2">
                    <div className="w-4 h-4 rounded-full bg-amber-100" />
                    <div className="h-3 w-28 bg-gray-200 rounded" />
                  </div>
                </div>
                <div className="flex gap-2">
                  <div className="flex-1 h-9 bg-gray-100 rounded-lg" />
                  <div className="flex-[1.5] h-9 bg-blue-100 rounded-lg" />
                </div>
              </div>
              
              {/* Blur overlay to make it look like a placeholder */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-white/60 blur-[1px] pointer-events-none rounded-3xl" />
            </div>
          </div>
        </div>
      ) : (
        // ── Data Grid ────────────────────────────────────────────────────────
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Add new card */}
          <button
            onClick={() => setShowGenerateModal(true)}
            className={`${glassCard} flex flex-col items-center justify-center p-8 text-blue-500 hover:text-blue-600 hover:border-blue-400 border-2 border-dashed border-blue-200 hover:bg-blue-50/50 transition-all min-h-[220px] group shadow-sm`}
          >
            <div className="w-16 h-16 bg-white border border-blue-100 rounded-full flex items-center justify-center mb-4 shadow-sm group-hover:scale-110 transition-transform duration-300">
              <Plus className="w-8 h-8 text-blue-500" />
            </div>
            <span className="text-[16px] font-extrabold text-blue-800">Tạo phiên bản mới</span>
            <span className="text-[13px] text-blue-500/80 mt-1.5 font-medium text-center">Sinh ra từ một Kết quả phân tích</span>
          </button>

          {versions.map((v) => (
            <div key={v.id} className={`${glassCard} flex flex-col overflow-hidden hover:shadow-lg hover:border-blue-200 transition-all duration-300 group`}>
              {/* Card header */}
              <div className="p-6 border-b border-gray-100/80 bg-gray-50/30 group-hover:bg-blue-50/30 transition-colors flex-1">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <h3 className="font-extrabold text-gray-900 text-[16px] leading-snug line-clamp-2">{v.title}</h3>
                  <span className={`text-[10px] px-2.5 py-1 rounded-full shrink-0 font-bold uppercase tracking-wider shadow-sm ${statusBadge[v.status]?.cls}`}>
                    {statusBadge[v.status]?.label}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-[13px] text-gray-500 font-medium mb-2">
                  <span className="w-6 h-6 rounded-lg bg-white border border-gray-200 flex items-center justify-center text-gray-400 shadow-sm shrink-0">
                    <FileText className="w-3.5 h-3.5" />
                  </span>
                  <span className="truncate">{v.target_role}</span>
                </div>
                <p className="text-[12px] text-gray-400 font-medium ml-8">{new Date(v.createdAt).toLocaleDateString("vi-VN")} lúc {new Date(v.createdAt).toLocaleTimeString("vi-VN", {hour: '2-digit', minute:'2-digit'})}</p>
              </div>

              {/* Diff summary */}
              {v.diff_items && v.diff_items.length > 0 && (
                <div className="px-6 py-3.5 border-b border-gray-100/80 bg-white flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-amber-500" />
                    <p className="text-[12.5px] font-bold text-gray-700">{v.diff_items.length} thay đổi tối ưu</p>
                  </div>
                  <div className="flex gap-1.5">
                    {(["high", "medium", "low"] as const).map((c) => {
                      const count = v.diff_items!.filter((d) => d.confidence === c).length;
                      if (!count) return null;
                      const cls = c === "high" ? "bg-emerald-100 text-emerald-600 border border-emerald-200" : c === "medium" ? "bg-amber-100 text-amber-600 border border-amber-200" : "bg-gray-100 text-gray-500 border border-gray-200";
                      return <span key={c} className={`w-5 h-5 flex items-center justify-center rounded-md text-[10px] font-bold shadow-sm ${cls}`} title={c}>{count}</span>;
                    })}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="p-4 flex gap-2 bg-white rounded-b-3xl">
                <button
                  onClick={() => setPreviewVersion(v)}
                  className="flex-1 flex items-center justify-center gap-1.5 bg-white border border-gray-200 text-gray-700 py-2.5 rounded-xl text-[13px] font-bold hover:bg-gray-50 hover:text-gray-900 transition shadow-sm"
                >
                  <Eye className="w-4 h-4 text-gray-400" /> Xem Diff
                </button>
                <button
                  onClick={() => handleDownload(v)}
                  disabled={exportingId === v.id}
                  className="flex-[1.5] flex items-center justify-center gap-1.5 bg-blue-600 border border-blue-600 text-white py-2.5 rounded-xl text-[13px] font-bold hover:bg-blue-700 transition shadow-sm shadow-blue-500/25 hover:-translate-y-0.5 disabled:opacity-50 disabled:hover:translate-y-0"
                >
                  {exportingId === v.id
                    ? <><Loader2 className="w-4 h-4 animate-spin" /> Xử lý...</>
                    : <><Download className="w-4 h-4" /> Xuất PDF</>
                  }
                </button>
                <button
                  onClick={() => handleDelete(v.id)}
                  className="w-11 h-11 shrink-0 flex items-center justify-center bg-white border border-gray-200 text-gray-400 rounded-xl hover:text-red-500 hover:border-red-200 hover:bg-red-50 transition shadow-sm"
                  title="Xóa"
                >
                  <Trash2 className="w-4.5 h-4.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showGenerateModal && (
        <GenerateModal
          analyses={analyses}
          onClose={() => setShowGenerateModal(false)}
          onGenerated={(v) => { setVersions(getCVVersions()); setShowGenerateModal(false); setPreviewVersion(v); }}
        />
      )}
      {previewVersion && (
        <DiffModal version={previewVersion} onClose={() => setPreviewVersion(null)} />
      )}
    </div>
  );
}
