"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { UploadCloud, FileType2, Loader2, CheckCircle2, X, Sparkles, FileText, Search, LayoutTemplate, Briefcase, UserCheck, ChevronRight, FileCheck2, Cpu } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "@/components/ui/toast";
import { saveAnalysis, pushNotification } from "@/lib/store";
import type { AnalysisResult } from "@/lib/types";
import { useCloudinaryUpload } from "@/hooks/useCloudinaryUpload";
import { useAnalysis } from "@/lib/analysis-context";

const MAX_SIZE_MB = 10;
const ALLOWED_TYPES = ["application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "image/png", "image/jpeg", "image/webp"];
const ALLOWED_EXT = [".pdf", ".doc", ".docx", ".png", ".jpg", ".jpeg", ".webp"];

// ── Shared UI Styles ─────────────────────────────────────────────────────────
const glassCard = "backdrop-blur-[40px] bg-white/20 border-[1.5px] border-white/60 shadow-[inset_0_2px_4px_rgba(255,255,255,0.8),inset_0_-1px_2px_rgba(255,255,255,0.3),0_12px_40px_rgba(31,38,135,0.1)] rounded-[2.5rem] relative overflow-hidden";

export default function UploadPage() {
  const router = useRouter();
  // Use global context — state persists when user navigates away
  const {
    file, setFile,
    role, setRole,
    jd, setJd,
    loading, setLoading,
    step, setStep,
    setUploadProgress,
    reset,
  } = useAnalysis();
  const [dragOver, setDragOver] = useState(false); // UI-only, stays local
  const { uploadFile, progress } = useCloudinaryUpload();

  // Sync cloudinary upload progress into global context
  useEffect(() => { setUploadProgress(progress); }, [progress, setUploadProgress]);

  const validateFile = (f: File): string | null => {
    const ext = "." + f.name.split(".").pop()?.toLowerCase();
    if (!ALLOWED_EXT.includes(ext) && !ALLOWED_TYPES.includes(f.type)) {
      return `Định dạng không hỗ trợ. Chỉ nhận PDF, DOC, DOCX.`;
    }
    if (f.size > MAX_SIZE_MB * 1024 * 1024) {
      return `File quá lớn (${(f.size / 1024 / 1024).toFixed(1)} MB). Giới hạn ${MAX_SIZE_MB} MB.`;
    }
    return null;
  };

  const pickFile = (f: File) => {
    const err = validateFile(f);
    if (err) { toast("error", err); return; }
    setFile(f);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) pickFile(e.target.files[0]);
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f) {
      const validationError = validateFile(f);
      if (validationError) { toast("error", validationError); return; }
      setFile(f);
    }
  }, []);

  const handleAnalyze = async () => {
    if (!file) { toast("warning", "Vui lòng tải lên file CV!"); return; }
    if (!role.trim()) { toast("warning", "Vui lòng nhập vị trí ứng tuyển!"); return; }

    setLoading(true);

    try {
      setStep("uploading");
      const cloudinaryUrl = await uploadFile(file);

      setStep("reading");
      const extractRes = await fetch("/api/v1/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: cloudinaryUrl, fileName: file.name }),
      });
      if (!extractRes.ok) {
        const err = await extractRes.json().catch(() => ({}));
        throw new Error(err.error ?? "Không thể đọc nội dung file CV.");
      }
      const { text: cvText } = await extractRes.json();

      setStep("analyzing");
      let resultData: Partial<AnalysisResult> = {};
      let isDemo = false;

      const backendForm = new FormData();
      backendForm.append("cv", file);
      backendForm.append("role", role.trim());
      if (jd.trim()) backendForm.append("jd", jd.trim());

      const backendRes = process.env.NEXT_PUBLIC_API_URL
        ? await fetch(`${process.env.NEXT_PUBLIC_API_URL}/analyses`, { method: "POST", body: backendForm }).catch(() => null)
        : null;

      if (backendRes?.ok) {
        const data = await backendRes.json();
        resultData = {
          ...(data.result ?? {}),
          analysis_id: data.analysis_id,
          resume_id: data.resume_id,
          job_id: data.job_id,
        };
      } else {
        const nextForm = new FormData();
        nextForm.append("cvText", cvText);
        nextForm.append("role", role.trim());
        if (jd.trim()) nextForm.append("jd", jd.trim());

        const nextRes = await fetch("/api/v1/analyses", { method: "POST", body: nextForm }).catch(() => null);

        if (nextRes?.ok) {
          const data = await nextRes.json();
          resultData = { ...(data.result ?? {}), analysis_id: data.analysis_id };
        } else {
          toast("warning", "Chưa cấu hình AI API — hiển thị kết quả demo.");
          resultData = buildDemoResult(cvText, role.trim());
          isDemo = true;
        }
      }

      const analysis: AnalysisResult = {
        analysis_id: (resultData.analysis_id as string) ?? `local_${Date.now()}`,
        fileName: file.name,
        role: role.trim(),
        jd: jd.trim(),
        createdAt: new Date().toISOString(),
        isDemo,
        total_score: (resultData.total_score as number) ?? 0,
        layout_score: (resultData.layout_score as number) ?? 0,
        content_score: (resultData.content_score as number) ?? 0,
        ats_score: (resultData.ats_score as number) ?? 0,
        keyword_score: (resultData.keyword_score as number) ?? 0,
        skills_score: (resultData.skills_score as number) ?? 0,
        achievement_score: (resultData.achievement_score as number) ?? 0,
        matched_keywords: (resultData.matched_keywords as string[]) ?? [],
        missing_keywords: (resultData.missing_keywords as string[]) ?? [],
        semantic_keywords: (resultData.semantic_keywords as string[]) ?? [],
        suggestions: (resultData.suggestions as AnalysisResult["suggestions"]) ?? [],
        hr_review: resultData.hr_review as AnalysisResult["hr_review"],
        summary: resultData.summary as string,
        strengths: (resultData.strengths as string[]) ?? [],
        weaknesses: (resultData.weaknesses as string[]) ?? [],
        ats_platform_scores: resultData.ats_platform_scores as Record<string, number>,
        resume_id: resultData.resume_id as string,
        job_id: resultData.job_id as string,
        fileUrl: cloudinaryUrl,
      };

      saveAnalysis(analysis);
      setStep("done");
      toast("success", "Phân tích hoàn tất!");
      // Push real notification
      pushNotification({
        type: "success",
        title: "Phân tích CV hoàn thành",
        body: `CV "${file.name}" cho vị trí ${role.trim()} đạt ${analysis.total_score}/100 điểm ATS.`,
        link: `/dashboard/analyses/${analysis.analysis_id}`,
      });
      // Reset context so next analysis starts fresh, then navigate
      setTimeout(() => {
        reset();
        router.push(`/dashboard/analyses/${analysis.analysis_id}`);
      }, 600);
    } catch (err: unknown) {
      toast("error", err instanceof Error ? err.message : "Lỗi kết nối. Vui lòng thử lại.");
      setStep("idle");
    } finally {
      setLoading(false);
    }
  };

  // Stepper UI for Loading
  const loadingSteps = [
    { id: "uploading", label: "Tải lên an toàn", desc: `${progress}% hoàn thành` },
    { id: "reading", label: "Trích xuất văn bản", desc: "Đọc cấu trúc file" },
    { id: "analyzing", label: "AI Phân tích", desc: "Chấm điểm ATS & Đối chiếu JD" },
    { id: "done", label: "Hoàn tất", desc: "Đang chuyển hướng..." },
  ];

  const getCurrentStepIndex = () => {
    if (step === "idle") return -1;
    return loadingSteps.findIndex(s => s.id === step);
  };
  const stepIdx = getCurrentStepIndex();

  // Smart CTA Logic
  let ctaText = "Phân tích CV ngay";
  let ctaState: "active" | "missing_file" | "missing_role" = "active";
  if (!file) {
    ctaText = "1. Tải CV lên để bắt đầu";
    ctaState = "missing_file";
  } else if (!role.trim()) {
    ctaText = "2. Nhập vị trí ứng tuyển";
    ctaState = "missing_role";
  }

  return (
    <div className="max-w-[1100px] mx-auto font-sans pb-10">
      
      {/* ── Header Compact ─────────────────────────────────────────────────── */}
      <div className="relative w-full h-[120px] rounded-2xl overflow-hidden shadow-sm mb-8">
        <Image src="/banner-job-prep.png" alt="Phân tích CV" fill className="object-cover object-center" />
        <div className="absolute inset-0 bg-gradient-to-r from-blue-950/90 via-blue-900/80 to-transparent flex flex-col justify-center px-8 md:px-12">
          <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-blue-400" /> Phân Tích & Chấm Điểm CV
          </h1>
          <p className="text-blue-100 max-w-xl text-[14px] leading-relaxed mt-1.5 font-medium hidden sm:block">
            Tải lên CV của bạn, nhập Job Description và để AI đánh giá mức độ phù hợp. Phát hiện lỗi ATS và nhận gợi ý sửa chi tiết.
          </p>
        </div>
      </div>

      {loading && step !== "idle" ? (
        // ── Loading Workflow State ──────────────────────────────────────────
        <div className={`${glassCard} p-12 flex flex-col items-center justify-center min-h-[500px]`}>
          <div className="relative w-32 h-32 mb-8 flex items-center justify-center">
            <div className="absolute inset-0 rounded-full border-4 border-blue-100"></div>
            <div className="absolute inset-0 rounded-full border-4 border-blue-500 border-t-transparent animate-spin"></div>
            <Cpu className="w-12 h-12 text-blue-600 animate-pulse" />
          </div>
          <h2 className="text-2xl font-extrabold text-gray-900 mb-2">Hệ thống đang làm việc</h2>
          <p className="text-gray-500 font-medium mb-12">Vui lòng không đóng trang này trong khi AI đang xử lý hồ sơ của bạn.</p>
          
          <div className="flex flex-col md:flex-row gap-4 md:gap-8 justify-center w-full max-w-3xl">
            {loadingSteps.map((s, idx) => {
              const status = idx < stepIdx ? "completed" : idx === stepIdx ? "current" : "pending";
              return (
                <div key={s.id} className="flex-1 flex flex-row md:flex-col items-center md:text-center gap-4 md:gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shrink-0 transition-all duration-500 ${
                    status === "completed" ? "bg-emerald-500 text-white shadow-md scale-110" :
                    status === "current" ? "bg-blue-600 text-white shadow-lg shadow-blue-500/30 scale-110" :
                    "bg-gray-100 text-gray-400 border border-gray-200"
                  }`}>
                    {status === "completed" ? <CheckCircle2 className="w-5 h-5" /> : (idx + 1)}
                  </div>
                  <div>
                    <div className={`font-bold text-[14px] ${status === "pending" ? "text-gray-400" : "text-gray-900"}`}>{s.label}</div>
                    <div className={`text-[12px] font-medium mt-0.5 ${status === "current" ? "text-blue-600" : "text-gray-400"}`}>{s.desc}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        // ── Main Workflow Form ──────────────────────────────────────────────
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Left Column: Form & Upload */}
          <div className="lg:col-span-7 flex flex-col gap-6">
            <div className={`${glassCard} p-6 md:p-8 flex-1 flex flex-col`}>
              <h2 className="font-extrabold text-gray-900 text-[18px] mb-6 flex items-center gap-2">
                <FileCheck2 className="w-5 h-5 text-blue-600" /> Tải Lên Hồ Sơ (CV/Resume)
              </h2>
              
              {/* Dropzone / File Card */}
              <div
                onDrop={handleDrop}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                className={`w-full min-h-[220px] relative border-2 border-dashed rounded-2xl p-6 flex flex-col items-center justify-center text-center transition-all duration-300 shadow-sm ${
                  dragOver
                    ? "border-blue-400 bg-blue-50/50 scale-[1.01]"
                    : file
                    ? "border-emerald-300 bg-emerald-50/30"
                    : "border-gray-200 bg-gray-50/50 hover:border-blue-300 hover:bg-blue-50/30 cursor-pointer"
                }`}
              >
                {!file && (
                  <input
                    type="file"
                    accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.webp"
                    onChange={handleFileChange}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                    aria-label="Chọn file CV"
                  />
                )}
                
                {file ? (
                  <div className="w-full flex items-center bg-white border border-gray-100 p-4 rounded-xl shadow-sm z-20 animate-in zoom-in-95 duration-200 relative group">
                    <div className="w-12 h-12 bg-emerald-100/80 rounded-xl flex items-center justify-center text-emerald-600 shrink-0 border border-emerald-200/50">
                      <FileText className="w-6 h-6" />
                    </div>
                    <div className="ml-4 flex-1 text-left overflow-hidden">
                      <p className="text-gray-900 font-bold text-[15px] truncate">{file.name}</p>
                      <p className="text-gray-500 text-[13px] font-medium mt-0.5">
                        {file.type.includes("pdf") ? "Tài liệu PDF" : "Tài liệu CV"} • {(file.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setFile(null)}
                      className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 text-gray-500 hover:bg-red-100 hover:text-red-600 transition-colors shrink-0"
                      title="Xóa file"
                    >
                      <X className="w-4 h-4" />
                    </button>
                    <div className="absolute -top-3 -right-3 bg-emerald-500 text-white rounded-full p-1 shadow-md">
                      <CheckCircle2 className="w-4 h-4" />
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center z-0">
                    <div className="w-14 h-14 bg-white border border-gray-100 rounded-full flex items-center justify-center text-blue-500 mb-4 shadow-sm group-hover:scale-110 transition-transform">
                      <UploadCloud className="w-6 h-6" />
                    </div>
                    <h3 className="text-gray-900 font-extrabold text-[15px]">Kéo thả CV vào đây</h3>
                    <p className="text-gray-500 mt-1.5 text-[13px] font-medium">hoặc nhấp để duyệt file từ máy tính</p>
                    <div className="mt-4 flex gap-2">
                      <span className="text-[11px] font-bold px-2.5 py-1 bg-white border border-gray-200 text-gray-500 rounded-md shadow-sm">PDF, DOCX, IMG</span>
                      <span className="text-[11px] font-bold px-2.5 py-1 bg-white border border-gray-200 text-gray-500 rounded-md shadow-sm">Tối đa {MAX_SIZE_MB}MB</span>
                    </div>
                  </div>
                )}
              </div>

              {/* JD Form */}
              <div className="mt-8 space-y-5 flex-1 flex flex-col">
                <div>
                  <label htmlFor="role" className="block text-[13.5px] font-bold text-gray-800 mb-2">
                    Vị trí ứng tuyển <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="role"
                    type="text"
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    placeholder="VD: Frontend Developer, Data Analyst..."
                    className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-[14px] text-gray-800 placeholder:text-gray-400 font-medium outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition shadow-sm"
                  />
                </div>
                <div className="flex-1 flex flex-col">
                  <label htmlFor="jd" className="flex items-center justify-between text-[13.5px] font-bold text-gray-800 mb-2">
                    <span>Job Description (JD)</span>
                    <span className="text-gray-400 font-medium text-[12px] font-normal bg-gray-50 px-2 py-0.5 rounded-md border border-gray-100">Tuỳ chọn · Đề xuất</span>
                  </label>
                  <textarea
                    id="jd"
                    value={jd}
                    onChange={(e) => setJd(e.target.value)}
                    placeholder="Dán toàn bộ nội dung tin tuyển dụng vào đây để AI đối chiếu từ khóa và chấm điểm độ fit..."
                    className="w-full flex-1 min-h-[140px] bg-white border border-gray-200 rounded-xl px-4 py-3 text-[14px] text-gray-800 placeholder:text-gray-400 font-medium outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 resize-none transition shadow-sm"
                  />
                </div>
              </div>

              <div className="mt-6 pt-6 border-t border-gray-100">
                <button
                  onClick={handleAnalyze}
                  disabled={ctaState !== "active"}
                  className={`w-full py-4 rounded-xl font-bold text-[15px] transition-all flex items-center justify-center gap-2 shadow-sm ${
                    ctaState === "active" 
                      ? "bg-blue-600 text-white hover:bg-blue-700 hover:shadow-lg hover:-translate-y-0.5" 
                      : "bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-200"
                  }`}
                >
                  {ctaState === "active" ? <Sparkles className="w-5 h-5" /> : null}
                  {ctaText}
                </button>
              </div>
            </div>
          </div>

          {/* Right Column: AI Power & Preview */}
          <div className="lg:col-span-5 flex flex-col gap-6">
            
            {/* What to expect checklist */}
            <div className={`${glassCard} p-6`}>
              <h3 className="font-extrabold text-gray-900 text-[15px] mb-4 flex items-center gap-2">
                <Cpu className="w-4.5 h-4.5 text-indigo-600" /> Hệ thống AI sẽ phân tích:
              </h3>
              <div className="space-y-3.5">
                {[
                  { icon: Search, title: "Chấm điểm chuẩn ATS", desc: "Phát hiện bảng, cột ẩn, hình ảnh làm nghẽn máy quét ATS." },
                  { icon: FileText, title: "Đối chiếu từ khóa (Keywords)", desc: "Trích xuất và so khớp kỹ năng với Job Description." },
                  { icon: LayoutTemplate, title: "Đánh giá Bố cục (Layout)", desc: "Kiểm tra cấu trúc các mục: Học vấn, Kinh nghiệm..." },
                  { icon: Briefcase, title: "Định lượng Thành tích", desc: "Kiểm tra mức độ sử dụng số liệu trong kinh nghiệm làm việc." },
                  { icon: UserCheck, title: "Góc nhìn Nhà tuyển dụng", desc: "Mô phỏng 3s ấn tượng đầu tiên của HR về CV của bạn." }
                ].map((item, i) => (
                  <div key={i} className="flex gap-3 items-start">
                    <div className="w-7 h-7 rounded-lg bg-blue-50/50 border border-blue-100/50 flex items-center justify-center shrink-0 mt-0.5">
                      <item.icon className="w-3.5 h-3.5 text-blue-600" />
                    </div>
                    <div>
                      <div className="text-[13px] font-bold text-gray-900">{item.title}</div>
                      <div className="text-[12px] font-medium text-gray-500 leading-snug mt-0.5">{item.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Empty Result Preview / Wireframe */}
            <div className={`${glassCard} p-6 flex-1 flex flex-col relative overflow-hidden bg-gradient-to-b from-white to-gray-50/50`}>
              <h3 className="font-extrabold text-gray-400 text-[13px] mb-4 uppercase tracking-wider">Preview Báo cáo</h3>
              <div className="flex-1 w-full border border-gray-100 rounded-xl bg-white shadow-sm p-4 relative opacity-50 blur-[2px] pointer-events-none select-none">
                {/* Fake Dashboard Layout */}
                <div className="flex gap-4 mb-4">
                  <div className="w-16 h-16 rounded-full bg-gray-200" />
                  <div className="flex-1 space-y-2 py-2">
                    <div className="w-1/2 h-4 bg-gray-200 rounded" />
                    <div className="w-3/4 h-3 bg-gray-100 rounded" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="h-20 bg-gray-50 rounded-lg border border-gray-100" />
                  <div className="h-20 bg-gray-50 rounded-lg border border-gray-100" />
                </div>
                <div className="space-y-2">
                  <div className="w-full h-2 bg-gray-100 rounded" />
                  <div className="w-full h-2 bg-gray-100 rounded" />
                  <div className="w-4/5 h-2 bg-gray-100 rounded" />
                </div>
              </div>
              
              {/* Overlay message */}
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center pt-8">
                <div className="bg-white/80 backdrop-blur-md px-4 py-2 rounded-full border border-gray-200/50 shadow-sm flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-blue-500" />
                  <span className="text-[13px] font-bold text-gray-700">Kết quả sẽ hiển thị tại đây</span>
                </div>
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}

// ── Demo result builder (when backend is unavailable) ────────

function buildDemoResult(cvText: string, role: string): Partial<AnalysisResult> {
  const text = cvText.toLowerCase();
  const words = text.split(/\s+/).filter(Boolean);
  const wordCount = words.length;

  const cvSectionKeywords = ["experience", "education", "skills", "work", "summary", "profile", "projects", "objective", "contact", "kinh nghiệm", "học vấn", "kỹ năng", "dự án", "chứng chỉ", "certification"];
  const foundSections = cvSectionKeywords.filter(k => text.includes(k)).length;
  const hasEmail = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/.test(cvText);
  const hasPhone = /(\+84|0)\d{8,10}/.test(cvText);
  const hasDate = /\b(19|20)\d{2}\b/.test(cvText);
  const hasMetrics = /\d+\s*(%|x\b|lần|người|team|triệu|nghìn|k\b|million)/.test(text);

  let penalty = 0;
  if (wordCount < 30)       penalty += 60;
  else if (wordCount < 60)  penalty += 30;
  else if (wordCount < 100) penalty += 10;
  if (foundSections === 0)      penalty += 40;
  else if (foundSections < 2)   penalty += 20;
  if (!hasEmail && wordCount > 50) penalty += 10;
  if (!hasDate && wordCount > 100) penalty += 10;
  penalty = Math.min(penalty, 90);

  const mult = 1.0 - penalty / 100;
  const isValidCV = penalty < 50;

  const commonKeywords = ["python", "react", "sql", "javascript", "typescript", "excel", "figma", "node.js", "java", "git", "aws", "docker", "communication", "leadership", "agile", "scrum"];
  const matched = commonKeywords.filter(k => words.some(w => w.includes(k)));
  const missing = commonKeywords.filter(k => !matched.includes(k)).slice(0, 5);

  const rawLayout = Math.min(foundSections * 14 + (hasEmail ? 8 : 0) + (hasPhone ? 6 : 0) + Math.min(wordCount / 20, 12), 100);
  const rawContent = Math.min(foundSections * 10 + Math.min(wordCount / 15, 25) + (hasMetrics ? 15 : 0), 100);
  const rawKeyword = matched.length > 0 ? Math.min(30 + matched.length * 8, 90) : 10;
  const rawSkills  = Math.min(matched.length * 10, 80);
  const rawAchievement = hasMetrics ? 65 : (foundSections > 2 ? 35 : 15);
  const rawAts     = Math.min(rawKeyword * 0.6 + rawLayout * 0.4, 95);

  const rawTotal = Math.round(rawLayout * 0.15 + rawContent * 0.25 + rawAts * 0.30 + rawKeyword * 0.15 + rawSkills * 0.10 + rawAchievement * 0.05);
  const penalize = (s: number) => Math.max(0, Math.round(s * mult));
  const totalScore = Math.max(1, penalize(rawTotal));

  const notCVWarning = !isValidCV ? "Tài liệu có vẻ không phải CV. Kết nối backend để phân tích chính xác." : undefined;

  return {
    total_score: totalScore,
    layout_score: penalize(rawLayout),
    content_score: penalize(rawContent),
    ats_score: penalize(rawAts),
    keyword_score: penalize(rawKeyword),
    skills_score: penalize(rawSkills),
    achievement_score: penalize(rawAchievement),
    matched_keywords: matched,
    missing_keywords: missing,
    ats_platform_scores: {
      workday:        Math.min(penalize(rawAts) + 5, 100),
      taleo:          Math.max(penalize(rawAts) - 5, 0),
      icims:          penalize(rawAts),
      greenhouse:     Math.min(penalize(rawAts) + 3, 100),
      lever:          Math.min(penalize(rawAts) + 2, 100),
      successfactors: Math.max(penalize(rawAts) - 8, 0),
    },
    suggestions: isValidCV ? [
      { category: "keyword", priority: "high", problem: "Thiếu từ khóa quan trọng trong JD", recommendation: `Bổ sung: ${missing.slice(0, 3).join(", ")}`, evidence: "ATS sẽ lọc CV thiếu từ khóa cốt lõi" },
      { category: "achievement", priority: "medium", problem: "Mô tả kinh nghiệm chưa có số liệu định lượng", recommendation: "Thêm con số cụ thể: tăng X%, tiết kiệm Y giờ/tuần...", evidence: "CV có số liệu định lượng được đọc kỹ hơn 40%" },
      { category: "content", priority: "low", problem: "Mục tiêu nghề nghiệp quá chung chung", recommendation: `Cá nhân hóa mục tiêu cho vị trí ${role}`, evidence: "HR thường đọc phần này đầu tiên" },
    ] : [
      { category: "content", priority: "high", problem: notCVWarning ?? "Tài liệu không nhận dạng được là CV", recommendation: "Vui lòng upload file CV đúng định dạng (PDF hoặc DOCX)", evidence: `Tài liệu chỉ có ${wordCount} từ và ${foundSections} section CV` },
    ],
    hr_review: isValidCV ? {
      first_impression: `CV nhìn tổng thể ${totalScore >= 60 ? "khá ổn" : "cần cải thiện nhiều"} cho vị trí ${role}. Cần cải thiện phần từ khóa để qua ATS.`,
      strengths: [...(foundSections > 2 ? ["Cấu trúc CV có đủ các mục cơ bản"] : []), ...(matched.length > 0 ? [`Có ${matched.length} kỹ năng liên quan`] : []), ...(hasMetrics ? ["Có sử dụng số liệu định lượng"] : [])].slice(0, 3),
      concerns: [...(rawKeyword < 50 ? ["Tỷ lệ khớp từ khóa với JD còn thấp"] : []), ...(!hasMetrics ? ["Thiếu số liệu định lượng trong thành tích"] : []), ...(foundSections < 3 ? ["Thiếu một số mục CV quan trọng"] : [])].slice(0, 3),
      priority_actions: [`Thêm từ khóa: ${missing.slice(0, 3).join(", ")}`, "Viết lại ít nhất 2 bullet điểm với số liệu cụ thể", `Tùy chỉnh mục tiêu cho vị trí ${role}`],
    } : undefined,
    summary: isValidCV ? `CV có điểm tổng ${totalScore}/100. ${totalScore < 50 ? "Cần cải thiện đáng kể" : totalScore < 70 ? "Khá ổn nhưng cần tối ưu thêm" : "Tốt"} để phù hợp vị trí ${role}.` : `Tài liệu này không được nhận dạng là CV (${wordCount} từ, ${foundSections} section). Vui lòng upload CV đúng định dạng.`,
    strengths: isValidCV ? [...(foundSections > 2 ? [`Cấu trúc CV có ${foundSections} section rõ ràng`] : []), ...(matched.length > 0 ? [`${matched.length} kỹ năng phù hợp với ${role}`] : [])] : [],
    weaknesses: isValidCV ? [...(rawKeyword < 50 ? ["Tỷ lệ khớp từ khóa ATS chưa cao"] : []), ...(!hasMetrics ? ["Thiếu số liệu định lượng cho thành tích"] : []), ...(wordCount < 200 ? ["CV có thể quá ngắn, thiếu thông tin"] : [])] : ["Không phát hiện cấu trúc CV hợp lệ", `Chỉ có ${wordCount} từ, không đủ để phân tích`],
  };
}
