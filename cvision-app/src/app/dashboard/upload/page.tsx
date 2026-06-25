"use client";

import { useCallback, useState } from "react";
import Image from "next/image";
import { UploadCloud, FileType2, Loader2, CheckCircle2, X, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "@/components/ui/toast";
import { saveAnalysis } from "@/lib/store";
import type { AnalysisResult } from "@/lib/types";
import { useCloudinaryUpload } from "@/hooks/useCloudinaryUpload";

const MAX_SIZE_MB = 10;
const ALLOWED_TYPES = ["application/pdf", "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "image/png", "image/jpeg", "image/webp"];
const ALLOWED_EXT = [".pdf", ".doc", ".docx", ".png", ".jpg", ".jpeg", ".webp"];

export default function UploadPage() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [role, setRole] = useState("");
  const [jd, setJd] = useState("");
  const [loading, setLoading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [step, setStep] = useState<"idle" | "reading" | "uploading" | "analyzing" | "done">("idle");
  const { uploadFile, progress } = useCloudinaryUpload();

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
      // Step 1: Upload lên Cloudinary trước (không giới hạn dung lượng, có progress bar)
      setStep("uploading");
      const cloudinaryUrl = await uploadFile(file);

      // Step 2: Gửi URL cho extract API để trích xuất text (tránh giới hạn 4MB của Next.js)
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

      // Step 3: Chạy phân tích AI
      setStep("analyzing");

      let resultData: Partial<AnalysisResult> = {};
      let isDemo = false;

      // 3a. FastAPI backend
      const backendForm = new FormData();
      backendForm.append("cv", file);
      backendForm.append("role", role.trim());
      if (jd.trim()) backendForm.append("jd", jd.trim());

      const backendRes = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1"}/analyses`,
        { method: "POST", body: backendForm }
      ).catch(() => null);

      if (backendRes?.ok) {
        const data = await backendRes.json();
        resultData = {
          ...(data.result ?? {}),
          analysis_id: data.analysis_id,
          resume_id: data.resume_id,
          job_id: data.job_id,
        };
      } else {
        // 3b. Next.js AI route
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
      setTimeout(() => router.push(`/dashboard/analyses/${analysis.analysis_id}`), 600);
    } catch (err: unknown) {
      toast("error", err instanceof Error ? err.message : "Lỗi kết nối. Vui lòng thử lại.");
      setStep("idle");
    } finally {
      setLoading(false);
    }
  };

  const stepLabel: Record<string, string> = {
    reading: "Đang đọc CV...",
    uploading: "Đang tải lên...",
    analyzing: "AI đang phân tích...",
    done: "Hoàn tất!",
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500">
      {/* Header Banner */}
      <div className="relative w-full h-[180px] md:h-[220px] rounded-3xl overflow-hidden shadow-sm">
        <Image src="/banner-job-prep.png" alt="Phân tích CV" fill className="object-cover" />
        <div className="absolute inset-0 bg-gradient-to-r from-blue-900/80 to-transparent flex flex-col justify-center px-8 md:px-12">
          <h1 className="text-3xl md:text-4xl font-bold text-white tracking-tight mb-2 flex items-center gap-2">
            <Sparkles className="w-8 h-8 text-blue-300" /> Phân tích CV mới
          </h1>
          <p className="text-blue-100 max-w-md text-sm md:text-base leading-relaxed">
            Tải lên CV và cung cấp Job Description để AI đánh giá chính xác mức độ phù hợp và tối ưu từ khóa ATS.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Upload Zone (Left - 2 cols) */}
        <div className="lg:col-span-2 flex flex-col h-full">
          <div
            onDrop={handleDrop}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            className={`flex-1 relative border-2 border-dashed rounded-3xl p-8 flex flex-col items-center justify-center text-center transition-all duration-300 shadow-sm ${
              dragOver
                ? "border-blue-400 bg-blue-50/50 scale-[1.02]"
                : file
                ? "border-emerald-400 bg-emerald-50/50"
                : "border-gray-200 bg-white hover:border-blue-300 hover:bg-blue-50/30 hover:shadow-md cursor-pointer"
            }`}
          >
            <input
              type="file"
              accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.webp"
              onChange={handleFileChange}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
              disabled={loading}
              aria-label="Chọn file CV"
            />
            {file ? (
              <div className="flex flex-col items-center animate-in zoom-in duration-300">
                <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600 mb-4 shadow-sm">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <p className="text-gray-800 font-bold text-lg max-w-[200px] truncate">{file.name}</p>
                <p className="text-gray-400 text-sm mt-1 font-medium">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setFile(null); }}
                  className="mt-4 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-red-50 text-red-500 hover:bg-red-100 text-xs font-semibold transition z-20"
                  disabled={loading}
                >
                  <X className="w-3.5 h-3.5" /> Xóa file
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-center">
                <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center text-blue-500 mb-4 shadow-sm group-hover:scale-110 transition-transform">
                  <UploadCloud className="w-8 h-8" />
                </div>
                <h3 className="text-gray-800 font-bold text-lg">Kéo thả CV vào đây</h3>
                <p className="text-gray-400 mt-2 text-sm max-w-[180px]">hoặc nhấp để chọn file từ máy tính</p>
                <div className="mt-6 flex gap-2">
                  <span className="text-[10px] font-bold px-2 py-1 bg-gray-100 text-gray-500 rounded-md">PDF</span>
                  <span className="text-[10px] font-bold px-2 py-1 bg-gray-100 text-gray-500 rounded-md">DOCX</span>
                  <span className="text-[10px] font-bold px-2 py-1 bg-gray-100 text-gray-500 rounded-md">IMG</span>
                  <span className="text-[10px] font-bold px-2 py-1 bg-gray-100 text-gray-500 rounded-md">&lt;{MAX_SIZE_MB}MB</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Context Form (Right - 3 cols) */}
        <div className="lg:col-span-3 bg-white p-6 md:p-8 rounded-3xl border border-gray-100 shadow-sm flex flex-col space-y-6">
          <div>
            <label htmlFor="role" className="block text-sm font-bold text-gray-700 mb-2">
              Vị trí ứng tuyển <span className="text-red-500">*</span>
            </label>
            <input
              id="role"
              type="text"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              placeholder="VD: Frontend Developer, Data Analyst..."
              disabled={loading}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-800 placeholder:text-gray-400 font-medium outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-400/10 transition disabled:opacity-50 disabled:bg-gray-100"
            />
          </div>
          <div className="flex-1 flex flex-col">
            <label htmlFor="jd" className="block text-sm font-bold text-gray-700 mb-2">
              Job Description (JD){" "}
              <span className="text-gray-400 font-normal italic text-xs ml-1">(Đề xuất thêm để AI chấm điểm)</span>
            </label>
            <textarea
              id="jd"
              value={jd}
              onChange={(e) => setJd(e.target.value)}
              disabled={loading}
              placeholder="Dán toàn bộ nội dung Job Description vào đây..."
              className="w-full flex-1 min-h-[140px] bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-800 placeholder:text-gray-400 font-medium outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-400/10 resize-none transition disabled:opacity-50 disabled:bg-gray-100"
            />
          </div>

          {/* Loading progress */}
          {loading && step !== "idle" && (
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                  <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                </div>
                <div className="flex-1">
                  <div className="font-bold text-sm text-blue-900">{stepLabel[step]}</div>
                  <div className="text-blue-600/70 text-xs mt-0.5 font-medium">Vui lòng không đóng trang này...</div>
                </div>
              </div>
              {step === "uploading" && (
                <div className="w-full bg-blue-200/50 rounded-full h-1.5 overflow-hidden">
                  <div className="bg-blue-600 h-1.5 rounded-full transition-all duration-300" style={{ width: `${progress}%` }}></div>
                </div>
              )}
            </div>
          )}

          {/* Submit Button */}
          <div className="flex justify-end pt-2">
            <button
              onClick={handleAnalyze}
              disabled={loading || !file || !role.trim()}
              className="bg-blue-600 text-white px-8 py-3.5 rounded-xl font-bold text-sm hover:bg-blue-700 hover:shadow-lg hover:-translate-y-0.5 transition-all flex items-center gap-2 disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-none disabled:cursor-not-allowed w-full md:w-auto justify-center"
            >
              {loading ? (
                <><Loader2 className="w-5 h-5 animate-spin" /> {stepLabel[step] ?? "Đang xử lý..."}</>
              ) : (
                <><FileType2 className="w-5 h-5" /> Phân Tích CV Ngay</>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Demo result builder (when backend is unavailable) ────────

function buildDemoResult(cvText: string, role: string): Partial<AnalysisResult> {
  const text = cvText.toLowerCase();
  const words = text.split(/\s+/).filter(Boolean);
  const wordCount = words.length;

  // ── CV structure detection ──────────────────────────────────────────────
  const cvSectionKeywords = [
    "experience", "education", "skills", "work", "summary", "profile",
    "projects", "objective", "contact", "kinh nghiệm", "học vấn", "kỹ năng",
    "dự án", "chứng chỉ", "certification",
  ];
  const foundSections = cvSectionKeywords.filter(k => text.includes(k)).length;

  const hasEmail = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/.test(cvText);
  const hasPhone = /(\+84|0)\d{8,10}/.test(cvText);
  const hasDate = /\b(19|20)\d{2}\b/.test(cvText);
  const hasMetrics = /\d+\s*(%|x\b|lần|người|team|triệu|nghìn|k\b|million)/.test(text);

  // ── Penalty calculation (mirrors backend logic) ─────────────────────────
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

  // ── Keyword matching ────────────────────────────────────────────────────
  const commonKeywords = [
    "python", "react", "sql", "javascript", "typescript", "excel",
    "figma", "node.js", "java", "git", "aws", "docker",
    "communication", "leadership", "agile", "scrum",
  ];
  const matched = commonKeywords.filter(k => words.some(w => w.includes(k)));
  const missing = commonKeywords.filter(k => !matched.includes(k)).slice(0, 5);

  // ── 0-based scores (no freebies) ────────────────────────────────────────
  const rawLayout = Math.min(
    foundSections * 14 + (hasEmail ? 8 : 0) + (hasPhone ? 6 : 0) + Math.min(wordCount / 20, 12),
    100
  );
  const rawContent = Math.min(
    foundSections * 10 + Math.min(wordCount / 15, 25) + (hasMetrics ? 15 : 0),
    100
  );
  const rawKeyword = matched.length > 0 ? Math.min(30 + matched.length * 8, 90) : 10;
  const rawSkills  = Math.min(matched.length * 10, 80);
  const rawAchievement = hasMetrics ? 65 : (foundSections > 2 ? 35 : 15);
  const rawAts     = Math.min(rawKeyword * 0.6 + rawLayout * 0.4, 95);

  const rawTotal = Math.round(
    rawLayout      * 0.15 +
    rawContent     * 0.25 +
    rawAts         * 0.30 +
    rawKeyword     * 0.15 +
    rawSkills      * 0.10 +
    rawAchievement * 0.05
  );

  const penalize = (s: number) => Math.max(0, Math.round(s * mult));

  const totalScore = Math.max(1, penalize(rawTotal));

  // ── Warning for non-CV content ──────────────────────────────────────────
  const notCVWarning = !isValidCV
    ? "Tài liệu có vẻ không phải CV. Kết nối backend để phân tích chính xác."
    : undefined;

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
      {
        category: "keyword" as const,
        priority: "high" as const,
        problem: "Thiếu từ khóa quan trọng trong JD",
        recommendation: `Bổ sung: ${missing.slice(0, 3).join(", ")}`,
        evidence: "ATS sẽ lọc CV thiếu từ khóa cốt lõi",
      },
      {
        category: "achievement" as const,
        priority: "medium" as const,
        problem: "Mô tả kinh nghiệm chưa có số liệu định lượng",
        recommendation: "Thêm con số cụ thể: tăng X%, tiết kiệm Y giờ/tuần...",
        evidence: "CV có số liệu định lượng được đọc kỹ hơn 40%",
      },
      {
        category: "content" as const,
        priority: "low" as const,
        problem: "Mục tiêu nghề nghiệp quá chung chung",
        recommendation: `Cá nhân hóa mục tiêu cho vị trí ${role}`,
        evidence: "HR thường đọc phần này đầu tiên",
      },
    ] : [
      {
        category: "content" as const,
        priority: "high" as const,
        problem: notCVWarning ?? "Tài liệu không nhận dạng được là CV",
        recommendation: "Vui lòng upload file CV đúng định dạng (PDF hoặc DOCX)",
        evidence: `Tài liệu chỉ có ${wordCount} từ và ${foundSections} section CV`,
      },
    ],
    hr_review: isValidCV ? {
      first_impression: `CV nhìn tổng thể ${totalScore >= 60 ? "khá ổn" : "cần cải thiện nhiều"} cho vị trí ${role}. Cần cải thiện phần từ khóa để qua ATS.`,
      strengths: [
        ...(foundSections > 2 ? ["Cấu trúc CV có đủ các mục cơ bản"] : []),
        ...(matched.length > 0 ? [`Có ${matched.length} kỹ năng liên quan`] : []),
        ...(hasMetrics ? ["Có sử dụng số liệu định lượng"] : []),
      ].slice(0, 3),
      concerns: [
        ...(rawKeyword < 50 ? ["Tỷ lệ khớp từ khóa với JD còn thấp"] : []),
        ...(!hasMetrics ? ["Thiếu số liệu định lượng trong thành tích"] : []),
        ...(foundSections < 3 ? ["Thiếu một số mục CV quan trọng"] : []),
      ].slice(0, 3),
      priority_actions: [
        `Thêm từ khóa: ${missing.slice(0, 3).join(", ")}`,
        "Viết lại ít nhất 2 bullet điểm với số liệu cụ thể",
        `Tùy chỉnh mục tiêu cho vị trí ${role}`,
      ],
    } : undefined,
    summary: isValidCV
      ? `CV có điểm tổng ${totalScore}/100. ${totalScore < 50 ? "Cần cải thiện đáng kể" : totalScore < 70 ? "Khá ổn nhưng cần tối ưu thêm" : "Tốt"} để phù hợp vị trí ${role}.`
      : `Tài liệu này không được nhận dạng là CV (${wordCount} từ, ${foundSections} section). Vui lòng upload CV đúng định dạng.`,
    strengths: isValidCV
      ? [
          ...(foundSections > 2 ? [`Cấu trúc CV có ${foundSections} section rõ ràng`] : []),
          ...(matched.length > 0 ? [`${matched.length} kỹ năng phù hợp với ${role}`] : []),
        ]
      : [],
    weaknesses: isValidCV
      ? [
          ...(rawKeyword < 50 ? ["Tỷ lệ khớp từ khóa ATS chưa cao"] : []),
          ...(!hasMetrics ? ["Thiếu số liệu định lượng cho thành tích"] : []),
          ...(wordCount < 200 ? ["CV có thể quá ngắn, thiếu thông tin"] : []),
        ]
      : ["Không phát hiện cấu trúc CV hợp lệ", `Chỉ có ${wordCount} từ, không đủ để phân tích`],
  };
}
