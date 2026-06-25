"use client";

import { useState } from "react";
import Image from "next/image";
import {
  AlignLeft,
  Copy,
  Download,
  FileText,
  Languages,
  Loader2,
  PenLine,
  RefreshCw,
  Save,
  Settings2,
  Sparkles,
} from "lucide-react";

import { toast } from "@/components/ui/toast";
import { getAnalyses, getCVVersions, pushNotification } from "@/lib/store";
import type { AnalysisResult, CVVersion } from "@/lib/types";

type SourceOption = {
  id: string;
  label: string;
  kind: "analysis" | "version";
};

const toneOptions = [
  { value: "professional", label: "Chuyên nghiệp" },
  { value: "creative", label: "Sáng tạo" },
  { value: "enthusiastic", label: "Nhiệt huyết" },
];

function isMeaningfulText(value: string) {
  const text = value.trim().toLowerCase();
  if (text.length < 3) return false;
  if (/^([a-z])\1+$/.test(text)) return false;
  return true;
}

function buildAnalysisContext(analysis: AnalysisResult) {
  const suggestions = (analysis.suggestions || [])
    .slice(0, 5)
    .map((s, index) => `${index + 1}. ${s.problem} -> ${s.recommendation}`)
    .join("\n");

  return [
    `Nguồn CV: ${analysis.fileName}`,
    `Vị trí đã phân tích: ${analysis.role}`,
    `Tổng điểm: ${analysis.total_score}/100`,
    `ATS: ${analysis.ats_score}/100, Keyword: ${analysis.keyword_score}/100, Content: ${analysis.content_score}/100`,
    analysis.summary ? `Tóm tắt CV: ${analysis.summary}` : "",
    analysis.strengths?.length ? `Điểm mạnh: ${analysis.strengths.join("; ")}` : "",
    analysis.weaknesses?.length ? `Điểm cần cải thiện: ${analysis.weaknesses.join("; ")}` : "",
    analysis.matched_keywords?.length ? `Từ khóa đã khớp: ${analysis.matched_keywords.slice(0, 20).join(", ")}` : "",
    analysis.missing_keywords?.length ? `Từ khóa còn thiếu: ${analysis.missing_keywords.slice(0, 20).join(", ")}` : "",
    suggestions ? `Gợi ý tối ưu:\n${suggestions}` : "",
    analysis.jd ? `JD cũ từ lần phân tích:\n${analysis.jd}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");
}

function buildVersionContext(version: CVVersion) {
  const diffs = (version.diff_items || [])
    .slice(0, 8)
    .map((item, index) => `${index + 1}. ${item.reason || item.value}`)
    .join("\n");

  return [
    `Phiên bản CV: ${version.title}`,
    `Vị trí mục tiêu: ${version.target_role || "Không rõ"}`,
    version.target_company ? `Công ty mục tiêu: ${version.target_company}` : "",
    version.optimized_markdown ? `Nội dung CV tối ưu:\n${version.optimized_markdown}` : "",
    diffs ? `Các thay đổi tối ưu chính:\n${diffs}` : "",
    version.cover_letter ? `Cover letter trước đó:\n${version.cover_letter}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");
}

export default function CoverLetterPage() {
  const [cvVersions] = useState<CVVersion[]>(() => (typeof window !== "undefined" ? getCVVersions() : []));
  const [analyses] = useState<AnalysisResult[]>(() => (typeof window !== "undefined" ? getAnalyses() : []));

  const [selectedSource, setSelectedSource] = useState("");
  const [company, setCompany] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [jd, setJd] = useState("");
  const [tone, setTone] = useState("professional");
  const [language, setLanguage] = useState("vi");
  const [length, setLength] = useState("standard");
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);

  const sources: SourceOption[] = [
    ...analyses.map((a) => ({
      id: a.analysis_id,
      label: `${a.fileName} (${a.role})`,
      kind: "analysis" as const,
    })),
    ...cvVersions.map((v) => ({
      id: v.id,
      label: v.title,
      kind: "version" as const,
    })),
  ];

  const selected = sources.find((source) => source.id === selectedSource);
  const isFormValid = isMeaningfulText(jobTitle);

  const handleGenerate = async () => {
    if (!isFormValid) {
      toast("warning", "Nhập vị trí ứng tuyển rõ hơn, ví dụ: Frontend Developer.");
      return;
    }

    setLoading(true);
    setResult("");

    try {
      let resumeMarkdown = "";
      if (selected?.kind === "version") {
        const version = cvVersions.find((item) => item.id === selectedSource);
        resumeMarkdown = version ? buildVersionContext(version) : "";
      }
      if (selected?.kind === "analysis") {
        const analysis = analyses.find((item) => item.analysis_id === selectedSource);
        resumeMarkdown = analysis ? buildAnalysisContext(analysis) : "";
      }

      const { apiGenerateCoverLetter } = await import("@/lib/api");

      // Retry up to 3 times to handle Render cold start (503 Service Unavailable)
      let lastErr: unknown = null;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const data = await apiGenerateCoverLetter({
            job_title: jobTitle.trim(),
            company_name: company.trim() || undefined,
            job_description: jd.trim() || undefined,
            resume_markdown: resumeMarkdown || undefined,
            tone,
            language,
            length,
          });
          setResult(data.cover_letter ?? "");
          toast("success", "Cover letter đã được tạo thành công.");
          pushNotification({
            type: "success",
            title: "Cover Letter đã được tạo",
            body: `Cover letter cho vị trí ${jobTitle.trim()}${company ? ` tại ${company}` : ""} đã sẵn sàng.`,
            link: "/dashboard/cover-letter",
          });
          return;
        } catch (err: unknown) {
          lastErr = err;
          const msg = err instanceof Error ? err.message : "";
          if ((msg.includes("503") || msg.includes("Service Unavailable")) && attempt < 2) {
            await new Promise(r => setTimeout(r, 4000 * (attempt + 1)));
            continue;
          }
          throw err;
        }
      }
      throw lastErr;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "";
      toast("error", message || "Chưa tạo được cover letter. Kiểm tra AI provider hoặc nhập JD chi tiết hơn.");
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!result) return;
    await navigator.clipboard.writeText(result);
    toast("success", "Đã sao chép vào clipboard.");
  };

  const handleDownload = () => {
    if (!result) return;
    const blob = new Blob([result], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `cover-letter-${jobTitle.trim().replace(/\s+/g, "-") || "draft"}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast("success", "Đã tải xuống file TXT.");
  };

  return (
    <div className="mx-auto max-w-[1200px] space-y-8 pb-10 font-sans animate-in fade-in duration-500">
      <div className="relative h-[150px] w-full overflow-hidden rounded-2xl shadow-sm">
        <Image
          src="/banner-job-prep.png"
          alt="Cover Letter"
          fill
          sizes="(max-width: 768px) 100vw, 1200px"
          priority
          className="object-cover"
        />
        <div className="absolute inset-0 flex flex-col justify-center bg-gradient-to-r from-blue-950/90 via-blue-900/80 to-transparent px-8 md:px-12">
          <h1 className="mb-2 flex items-center gap-2.5 text-2xl font-extrabold tracking-tight text-white md:text-3xl">
            <PenLine className="h-7 w-7 text-blue-300" />
            Tạo Cover Letter AI
          </h1>
          <p className="max-w-xl text-[14px] font-medium leading-relaxed text-blue-100/90">
            Viết thư ứng tuyển dựa trên CV, JD và vai trò cụ thể. Nội dung chỉ dùng thông tin có căn cứ, không sinh mẫu chung chung.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-12">
        <div className="space-y-5 lg:sticky lg:top-6 lg:col-span-4">
          <div className="backdrop-blur-[40px] bg-white/20 border-[1.5px] border-white/60 shadow-[inset_0_2px_4px_rgba(255,255,255,0.8),inset_0_-1px_2px_rgba(255,255,255,0.3),0_12px_40px_rgba(31,38,135,0.1)] p-6 rounded-[2.5rem] relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-white/30 via-transparent to-white/10 pointer-events-none" />
            <div className="relative z-10">
            <h2 className="mb-5 flex items-center gap-2 text-[16px] font-extrabold text-gray-900">
              <Settings2 className="h-[18px] w-[18px] text-blue-600" />
              Thông số đầu vào
            </h2>

            <div className="space-y-4">
              {sources.length > 0 && (
                <div>
                  <label className="mb-1.5 block text-[13px] font-bold text-gray-700">Chọn CV nguồn</label>
                  <select
                    value={selectedSource}
                    onChange={(e) => setSelectedSource(e.target.value)}
                    className="w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-[13.5px] font-medium text-gray-800 shadow-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
                  >
                    <option value="">Không chọn, chỉ dùng thông tin nhập tay</option>
                    {sources.map((source) => (
                      <option key={source.id} value={source.id}>
                        {source.kind === "version" ? "CV tối ưu: " : "Phân tích: "}
                        {source.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="mb-1.5 block text-[13px] font-bold text-gray-700">
                  Vị trí ứng tuyển <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={jobTitle}
                  onChange={(e) => setJobTitle(e.target.value)}
                  placeholder="VD: Frontend Developer, Data Analyst..."
                  className="w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-[13.5px] font-medium text-gray-800 shadow-sm outline-none transition placeholder:text-gray-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-[13px] font-bold text-gray-700">Tên công ty / người nhận</label>
                <input
                  type="text"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  placeholder="VD: Bộ phận Tuyển dụng VNG"
                  className="w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-[13.5px] font-medium text-gray-800 shadow-sm outline-none transition placeholder:text-gray-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1.5 flex items-center gap-1 text-[13px] font-bold text-gray-700">
                    <Languages className="h-3.5 w-3.5" />
                    Ngôn ngữ
                  </label>
                  <select
                    value={language}
                    onChange={(e) => setLanguage(e.target.value)}
                    className="w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-[13.5px] font-medium text-gray-800 shadow-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
                  >
                    <option value="vi">Tiếng Việt</option>
                    <option value="en">Tiếng Anh</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 flex items-center gap-1 text-[13px] font-bold text-gray-700">
                    <AlignLeft className="h-3.5 w-3.5" />
                    Độ dài
                  </label>
                  <select
                    value={length}
                    onChange={(e) => setLength(e.target.value)}
                    className="w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-[13.5px] font-medium text-gray-800 shadow-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
                  >
                    <option value="short">Ngắn gọn</option>
                    <option value="standard">Chuẩn</option>
                    <option value="detailed">Chi tiết</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-[13px] font-bold text-gray-700">Giọng văn</label>
                <div className="flex gap-2">
                  {toneOptions.map((option) => (
                    <button
                      type="button"
                      key={option.value}
                      onClick={() => setTone(option.value)}
                      className={`flex-1 rounded-xl border py-2.5 text-[12px] font-bold transition-all ${
                        tone === option.value
                          ? "scale-[1.02] border-blue-600 bg-blue-600 text-white shadow-md"
                          : "border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50"
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-[13px] font-bold text-gray-700">Mô tả công việc (JD)</label>
                <textarea
                  rows={5}
                  value={jd}
                  onChange={(e) => setJd(e.target.value)}
                  placeholder="Dán JD vào đây để AI viết sát yêu cầu tuyển dụng hơn..."
                  className="w-full resize-none rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-[13.5px] font-medium text-gray-800 shadow-sm outline-none transition placeholder:text-gray-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
                />
              </div>

              <button
                type="button"
                onClick={handleGenerate}
                disabled={loading || !isFormValid}
                className={`flex w-full items-center justify-center gap-2 rounded-xl py-3.5 text-[14.5px] font-bold shadow-sm transition-all ${
                  !isFormValid
                    ? "cursor-not-allowed border border-gray-200 bg-gray-100 text-gray-400"
                    : loading
                      ? "bg-blue-600 text-white shadow-lg"
                      : "bg-blue-600 text-white hover:-translate-y-0.5 hover:bg-blue-700 hover:shadow-lg hover:shadow-blue-500/25"
                }`}
              >
                {loading ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Đang soạn thảo...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-5 w-5" />
                    Tạo Cover Letter
                  </>
                )}
              </button>
            </div>
            </div>
          </div>
        </div>

        <div className="flex min-h-[700px] flex-col lg:col-span-8 lg:h-[calc(100vh-140px)]">
          <div className="z-10 flex flex-wrap items-center justify-between gap-3 rounded-t-2xl border border-gray-200 bg-white p-3 shadow-sm">
            <h3 className="flex items-center gap-2 pl-2 text-[15px] font-extrabold text-gray-800">
              <FileText className="h-5 w-5 text-blue-600" />
              Bản nháp Cover Letter
            </h3>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleGenerate}
                disabled={!result || loading}
                className="flex items-center gap-1.5 rounded-lg border border-transparent px-3 py-1.5 text-[13px] font-bold text-gray-600 transition hover:border-blue-100 hover:bg-blue-50 hover:text-blue-600 disabled:opacity-40"
              >
                <RefreshCw className="h-4 w-4" />
                Tạo lại
              </button>
              <button
                type="button"
                onClick={() => toast("success", "Đã lưu bản nháp vào hệ thống.")}
                disabled={!result || loading}
                className="flex items-center gap-1.5 rounded-lg border border-transparent px-3 py-1.5 text-[13px] font-bold text-gray-600 transition hover:border-emerald-100 hover:bg-emerald-50 hover:text-emerald-600 disabled:opacity-40"
              >
                <Save className="h-4 w-4" />
                Lưu
              </button>
              <div className="mx-1 h-6 w-px self-center bg-gray-200" />
              <button
                type="button"
                onClick={handleCopy}
                disabled={!result || loading}
                className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-[13px] font-bold text-gray-600 transition hover:bg-gray-100 hover:text-gray-900 disabled:opacity-40"
              >
                <Copy className="h-4 w-4" />
                Copy
              </button>
              <button
                type="button"
                onClick={handleDownload}
                disabled={!result || loading}
                className="flex items-center gap-1.5 rounded-lg bg-gray-900 px-4 py-1.5 text-[13px] font-bold text-white shadow-sm transition hover:bg-black disabled:opacity-40"
              >
                <Download className="h-4 w-4" />
                Tải về
              </button>
            </div>
          </div>

          <div className="relative flex-1 overflow-y-auto rounded-b-2xl border-x border-b border-gray-200 bg-gray-100 p-6 shadow-inner md:p-10">
            {loading ? (
              <div className="mx-auto min-h-full w-full max-w-[800px] animate-pulse rounded-sm border border-gray-100 bg-white p-10 shadow-[0_4px_20px_rgba(0,0,0,0.05)]">
                <div className="mb-8 h-5 w-1/3 rounded-md bg-gray-200" />
                <div className="mb-10 space-y-4">
                  <div className="h-4 w-1/4 rounded-md bg-gray-200" />
                  <div className="h-4 w-1/5 rounded-md bg-gray-200" />
                </div>
                <div className="mb-8 space-y-3">
                  <div className="h-3 w-full rounded-md bg-gray-200" />
                  <div className="h-3 w-[95%] rounded-md bg-gray-200" />
                  <div className="h-3 w-[90%] rounded-md bg-gray-200" />
                  <div className="h-3 w-[98%] rounded-md bg-gray-200" />
                  <div className="h-3 w-[85%] rounded-md bg-gray-200" />
                </div>
                <div className="mb-8 space-y-3">
                  <div className="h-3 w-full rounded-md bg-gray-200" />
                  <div className="h-3 w-[92%] rounded-md bg-gray-200" />
                  <div className="h-3 w-[80%] rounded-md bg-gray-200" />
                </div>
                <div className="mt-16 h-4 w-1/4 rounded-md bg-gray-200" />
                <div className="mt-4 h-4 w-1/5 rounded-md bg-gray-200" />
              </div>
            ) : result ? (
              <div className="mx-auto min-h-full w-full max-w-[800px] rounded-sm border border-gray-200 bg-white p-10 shadow-[0_8px_30px_rgba(0,0,0,0.08)] transition-all md:p-14">
                <textarea
                  value={result}
                  onChange={(e) => setResult(e.target.value)}
                  className="h-full min-h-[600px] w-full resize-none bg-transparent font-serif text-[15px] leading-[1.8] text-gray-800 outline-none"
                  spellCheck="false"
                />
              </div>
            ) : (
              <div className="flex h-full flex-col items-center justify-center text-center text-gray-400">
                <div className="mb-5 flex h-24 w-24 items-center justify-center rounded-full border border-gray-100 bg-white shadow-sm">
                  <PenLine className="h-10 w-10 text-blue-300" />
                </div>
                <h3 className="mb-2 text-lg font-extrabold text-gray-600">Chưa có bản nháp nào</h3>
                <p className="max-w-sm text-[14px] font-medium leading-relaxed text-gray-500">
                  Điền vị trí ứng tuyển, thêm JD nếu có, rồi tạo cover letter. AI sẽ viết dựa trên dữ liệu thật thay vì dùng mẫu demo.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
