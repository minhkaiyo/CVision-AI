"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  AlertTriangle, CheckCircle2, XCircle, Lightbulb, Target,
  User, BarChart2, TrendingUp, ArrowLeft, Loader2, Sparkles,
  Shield, Star, Zap, Cpu, SearchCheck, Briefcase, ExternalLink, ChevronRight
} from "lucide-react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { getAnalysisById } from "@/lib/store";
import type { AnalysisResult, CareerSuggestion } from "@/lib/types";

type Tab = "score" | "ats" | "keywords" | "achievements" | "hr" | "career";

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: "score", label: "Điểm số", icon: Star },
  { id: "ats", label: "ATS", icon: Shield },
  { id: "keywords", label: "Từ khóa", icon: Zap },
  { id: "achievements", label: "Thành tích", icon: TrendingUp },
  { id: "hr", label: "HR View", icon: User },
  { id: "career", label: "Gợi ý Nghề", icon: Briefcase },
];

// ── Glassmorphism Styles (iOS Light Theme - Professional & Sharp) ──
const glassCard = "backdrop-blur-xl bg-white/75 border border-white/60 shadow-sm rounded-2xl";
const glassInset = "backdrop-blur-md bg-gray-50/50 border border-gray-200/50 rounded-xl shadow-inner";

function ScoreColor(s: number) {
  if (s >= 80) return "text-emerald-600";
  if (s >= 60) return "text-amber-600";
  return "text-rose-600";
}

function GlowColor(s: number) {
  if (s >= 80) return "border-emerald-500/20 bg-emerald-50/30";
  if (s >= 60) return "border-amber-500/20 bg-amber-50/30";
  return "border-rose-500/20 bg-rose-50/30";
}

function BarGradient(s: number) {
  if (s >= 80) return "from-emerald-400 to-emerald-500";
  if (s >= 60) return "from-amber-400 to-amber-500";
  return "from-rose-400 to-rose-500";
}

// ── Score ring SVG ──────────────────────────────────────────
function ScoreRing({ score, size = 120 }: { score: number; size?: number }) {
  const r = (size - 16) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (score / 100) * circ;
  const color = score >= 80 ? "#10b981" : score >= 60 ? "#f59e0b" : "#f43f5e";
  return (
    <svg width={size} height={size} className="rotate-[-90deg]">
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(0,0,0,0.05)" strokeWidth={8} />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color}
        strokeWidth={8} strokeLinecap="round"
        strokeDasharray={circ} strokeDashoffset={offset}
        style={{ transition: "stroke-dashoffset 1.2s cubic-bezier(0.34,1.56,0.64,1)" }}
      />
    </svg>
  );
}

// ── Animated score bar ──────────────────────────────────────
function ScoreBar({ label, value }: { label: string; value: number }) {
  return (
    <div className={`${glassCard} p-5 space-y-3 hover:shadow-md transition-shadow duration-300`}>
      <div className="flex justify-between items-center">
        <span className="text-[14px] text-gray-700 font-bold">{label}</span>
        <span className={`text-[16px] font-black tabular-nums ${ScoreColor(value)}`}>{value}</span>
      </div>
      <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${value}%` }}
          transition={{ duration: 1, ease: [0.34, 1.56, 0.64, 1] }}
          className={`h-full rounded-full bg-gradient-to-r ${BarGradient(value)}`}
        />
      </div>
    </div>
  );
}

// ── Priority badge ──────────────────────────────────────────
function PriorityBadge({ priority }: { priority: string }) {
  const cfg: Record<string, string> = {
    high: "bg-rose-50 text-rose-600 border-rose-200",
    medium: "bg-amber-50 text-amber-600 border-amber-200",
    low: "bg-blue-50 text-blue-600 border-blue-200",
  };
  const lbl: Record<string, string> = { high: "Cao", medium: "Vừa", low: "Thấp" };
  return (
    <span className={`text-[11px] px-2.5 py-0.5 rounded font-bold border ${cfg[priority] ?? cfg.low}`}>
      {lbl[priority] ?? priority}
    </span>
  );
}

// ── Tab: Score ───────────────────────────────────────────────
function TabScore({ a }: { a: AnalysisResult }) {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
      {/* Hero score card */}
      <div className={`${glassCard} p-6 md:p-8 flex items-center justify-between overflow-hidden relative ${GlowColor(a.total_score)}`}>
        {/* SVG Illustration Background */}
        <div className="absolute right-0 top-0 bottom-0 w-1/2 opacity-10 pointer-events-none overflow-hidden flex items-center justify-end pr-10">
          <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" className="w-64 h-64 text-blue-500 fill-current">
            <path d="M44.7,-76.4C58.8,-69.2,71.8,-59.1,81.6,-46.3C91.4,-33.5,98,-18,97,-2.9C96.1,12.2,87.6,26.9,77.5,39.4C67.4,51.9,55.7,62.2,42.4,70.5C29.1,78.8,14.5,85.1,-0.6,86C-15.7,86.9,-31.4,82.4,-44.3,73.8C-57.2,65.2,-67.3,52.5,-75.4,38.6C-83.5,24.7,-89.6,9.6,-88.2,-4.8C-86.8,-19.2,-77.9,-32.9,-67.2,-44.6C-56.5,-56.3,-44,-66,-30.3,-72.5C-16.6,-79,-2.3,-82.3,11.5,-80.5C25.3,-78.7,30.6,-83.6,44.7,-76.4Z" transform="translate(100 100)" />
          </svg>
        </div>
        
        <div className="space-y-3 relative z-10 flex-1">
          <div className="flex items-center gap-2">
            <Target className="w-5 h-5 text-blue-500" />
            <p className="text-[12px] font-bold text-gray-500 uppercase tracking-widest">Điểm tổng quan CV</p>
          </div>
          <h2 className="text-gray-900 text-xl md:text-2xl font-medium">Vị trí: <span className="font-extrabold">{a.role}</span></h2>
          {a.summary && <p className="text-gray-600 text-sm max-w-md leading-relaxed">{a.summary}</p>}
          {a.isDemo && (
            <span className="inline-flex mt-2 text-[12px] px-3 py-1 rounded bg-amber-100 text-amber-700 font-semibold">
              Bản Demo — Vui lòng cấu hình Backend
            </span>
          )}
        </div>
        
        <div className="relative flex items-center justify-center shrink-0 z-10 ml-4 bg-white/50 p-3 rounded-2xl border border-white/60 shadow-sm">
          <ScoreRing score={a.total_score} size={100} />
          <div className="absolute inset-0 flex items-center justify-center flex-col">
            <span className={`text-3xl font-black tabular-nums leading-none ${ScoreColor(a.total_score)}`}>{a.total_score}</span>
            <span className="text-[10px] font-bold text-gray-400 mt-1">/ 100</span>
          </div>
        </div>
      </div>

      {/* Score breakdown grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {[
          { label: "Bố cục & Trình bày", value: a.layout_score },
          { label: "Nội dung", value: a.content_score },
          { label: "Điểm ATS", value: a.ats_score },
          { label: "Từ khóa", value: a.keyword_score },
          { label: "Kỹ năng", value: a.skills_score },
          { label: "Thành tích", value: a.achievement_score },
        ].map((item, i) => (
          <motion.div key={item.label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
            <ScoreBar label={item.label} value={item.value} />
          </motion.div>
        ))}
      </div>

      {/* Strengths & Weaknesses */}
      {(a.strengths?.length || a.weaknesses?.length) ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {a.strengths?.length ? (
            <div className={`${glassCard} p-6 border-emerald-100 bg-emerald-50/20`}>
              <h4 className="font-bold text-emerald-700 text-[15px] mb-4 flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5" /> Điểm mạnh nổi bật
              </h4>
              <ul className="space-y-3">
                {a.strengths.map((s, i) => (
                  <li key={i} className="text-gray-700 text-[13px] flex gap-3 items-start">
                    <span className="text-emerald-500 mt-0.5 shrink-0">❖</span>{s}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {a.weaknesses?.length ? (
            <div className={`${glassCard} p-6 border-rose-100 bg-rose-50/20`}>
              <h4 className="font-bold text-rose-700 text-[15px] mb-4 flex items-center gap-2">
                <XCircle className="w-5 h-5" /> Cần khắc phục
              </h4>
              <ul className="space-y-3">
                {a.weaknesses.map((s, i) => (
                  <li key={i} className="text-gray-700 text-[13px] flex gap-3 items-start">
                    <span className="text-rose-500 mt-0.5 shrink-0">❖</span>{s}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}

      {/* Suggestions */}
      {a.suggestions?.length ? (
        <div className="space-y-3 pt-2">
          <div className="flex items-center gap-2 pl-1 mb-2">
            <Lightbulb className="w-4 h-4 text-amber-500" />
            <h3 className="text-[13px] font-bold text-gray-500 uppercase tracking-widest">Gợi ý nâng cấp CV</h3>
          </div>
          {a.suggestions.map((s, i) => (
            <motion.div key={i} initial={{ opacity: 0, x: -5 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}
              className={`${glassCard} p-5 hover:bg-white transition-colors duration-200 border-l-4 ${s.priority === 'high' ? 'border-l-rose-400' : s.priority === 'medium' ? 'border-l-amber-400' : 'border-l-blue-400'}`}>
              <div className="flex items-start justify-between gap-4 mb-2">
                <p className="text-[14px] font-bold text-gray-800">{s.problem}</p>
                <PriorityBadge priority={s.priority} />
              </div>
              <p className="text-[13px] text-gray-600 leading-relaxed">{s.recommendation}</p>
              {s.evidence && <p className="text-[12px] text-gray-500 mt-3 italic bg-gray-50 p-2.5 rounded border border-gray-100">"{s.evidence}"</p>}
            </motion.div>
          ))}
        </div>
      ) : null}
    </motion.div>
  );
}

// ── Tab: ATS ─────────────────────────────────────────────────
function TabATS({ a }: { a: AnalysisResult }) {
  const platforms = a.ats_platform_scores ?? {};
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
      <div className={`${glassCard} p-6 md:p-8 flex flex-col md:flex-row items-center justify-between gap-6 relative overflow-hidden bg-gradient-to-r from-blue-50/50 to-indigo-50/30`}>
        {/* Background Graphic */}
        <Cpu className="absolute -right-6 -bottom-6 w-48 h-48 text-blue-500/5 rotate-12 pointer-events-none" />
        
        <div className="relative z-10 space-y-2 flex-1 text-center md:text-left">
          <p className="text-[12px] font-bold text-blue-600 uppercase tracking-widest">Hệ thống lọc tự động (ATS)</p>
          <h3 className="text-xl font-extrabold text-gray-900">Khả năng vượt qua rào cản máy quét</h3>
          <p className="text-gray-600 text-[13px] max-w-md mx-auto md:mx-0">
            Điểm số này đánh giá định dạng CV, mật độ từ khóa và cấu trúc dữ liệu của bạn dưới góc nhìn của các bot tuyển dụng phổ biến.
          </p>
        </div>
        <div className="relative shrink-0 z-10 bg-white p-4 rounded-2xl shadow-sm border border-blue-100 flex flex-col items-center">
          <ScoreRing score={a.ats_score} size={90} />
          <div className="absolute inset-0 flex items-center justify-center pb-4">
            <span className={`text-2xl font-black ${ScoreColor(a.ats_score)}`}>{a.ats_score}</span>
          </div>
          <span className="text-[10px] font-bold text-gray-400 mt-2">ĐIỂM ATS</span>
        </div>
      </div>

      {Object.keys(platforms).length > 0 && (
        <div className="space-y-3">
          <h3 className="text-[13px] font-bold text-gray-500 uppercase tracking-widest pl-1">Tương thích theo nền tảng</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Object.entries(platforms).map(([platform, score]) => (
              <ScoreBar key={platform} label={platform.charAt(0).toUpperCase() + platform.slice(1)} value={score as number} />
            ))}
          </div>
        </div>
      )}

      <div className={`${glassCard} border-amber-200 bg-amber-50/40 p-6 flex gap-4 items-start`}>
        <div className="bg-amber-100 p-2.5 rounded-lg shrink-0 text-amber-600">
          <AlertTriangle className="w-5 h-5" />
        </div>
        <div>
          <h4 className="font-bold text-gray-900 text-[14px] mb-2">Nguyên tắc thiết kế thân thiện với ATS</h4>
          <ul className="space-y-2 text-[13px] text-gray-700">
            <li className="flex gap-2"><span className="text-amber-500 font-bold">•</span> Không sử dụng Text Box, Word Art hoặc định dạng cột phức tạp.</li>
            <li className="flex gap-2"><span className="text-amber-500 font-bold">•</span> Dùng các tiêu đề chuẩn mực (Kinh nghiệm làm việc, Học vấn, Kỹ năng).</li>
            <li className="flex gap-2"><span className="text-amber-500 font-bold">•</span> Đảm bảo định dạng PDF của bạn có thể bôi đen và copy text bình thường.</li>
          </ul>
        </div>
      </div>
    </motion.div>
  );
}

// ── Tab: Keywords ────────────────────────────────────────────
function TabKeywords({ a }: { a: AnalysisResult }) {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
      
      {/* Decorative Header */}
      <div className={`${glassCard} p-6 flex items-center gap-5 bg-gradient-to-r from-emerald-50/50 to-teal-50/50`}>
        <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-xl flex items-center justify-center shrink-0">
          <SearchCheck className="w-6 h-6" />
        </div>
        <div>
          <h3 className="text-[16px] font-bold text-gray-900">Phân tích Từ khóa chuyên môn</h3>
          <p className="text-[13px] text-gray-500">Đối chiếu kỹ năng trong CV của bạn với yêu cầu thực tế từ Job Description.</p>
        </div>
      </div>

      {a.matched_keywords?.length > 0 && (
        <div className={`${glassCard} p-6`}>
          <h3 className="text-[13px] font-bold text-emerald-700 uppercase tracking-widest mb-4 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" /> Từ khóa đã khớp ({a.matched_keywords.length})
          </h3>
          <div className="flex flex-wrap gap-2">
            {a.matched_keywords.map((kw) => (
              <span key={kw} className="px-3 py-1 rounded text-[13px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                {kw}
              </span>
            ))}
          </div>
        </div>
      )}

      {a.semantic_keywords?.length ? (
        <div className={`${glassCard} p-6`}>
          <h3 className="text-[13px] font-bold text-blue-700 uppercase tracking-widest mb-4 flex items-center gap-2">
            <Lightbulb className="w-4 h-4" /> Khớp ngữ nghĩa (Đồng nghĩa/Liên quan)
          </h3>
          <div className="flex flex-wrap gap-2">
            {a.semantic_keywords.map((kw) => (
              <span key={kw} className="px-3 py-1 rounded text-[13px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                {kw}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      {a.missing_keywords?.length > 0 && (
        <div className={`${glassCard} p-6 border-rose-200 bg-rose-50/20`}>
          <h3 className="text-[13px] font-bold text-rose-700 uppercase tracking-widest mb-4 flex items-center gap-2">
            <XCircle className="w-4 h-4" /> Từ khóa còn thiếu từ JD ({a.missing_keywords.length})
          </h3>
          <div className="flex flex-wrap gap-2 mb-3">
            {a.missing_keywords.map((kw) => (
              <span key={kw} className="px-3 py-1 rounded text-[13px] font-medium bg-white text-rose-600 border border-rose-200 opacity-90">
                {kw}
              </span>
            ))}
          </div>
          <p className="text-gray-500 text-[12px] italic">Bổ sung những từ này một cách tự nhiên vào phần kinh nghiệm làm việc để tăng tỷ lệ qua vòng hồ sơ.</p>
        </div>
      )}
    </motion.div>
  );
}

// ── Tab: Achievements ────────────────────────────────────────
function TabAchievements({ a }: { a: AnalysisResult }) {
  const achieveSuggestions = a.suggestions?.filter((s) => s.category === "achievement") ?? [];
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
      <div className={`${glassCard} p-6 flex flex-col md:flex-row items-center justify-between gap-4`}>
        <div className="flex items-center gap-4">
          <div className="p-3 bg-indigo-100 text-indigo-600 rounded-xl">
            <Briefcase className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-[16px] font-bold text-gray-900">Tính thuyết phục của thành tích</h3>
            <p className="text-[13px] text-gray-500">Mức độ định lượng và rõ ràng trong kinh nghiệm làm việc.</p>
          </div>
        </div>
        <div className="flex items-center gap-4 bg-white p-3 rounded-xl border border-gray-100 w-full md:w-auto">
          <div className="w-full md:w-32 h-2 rounded-full bg-gray-100 overflow-hidden">
            <motion.div initial={{ width: 0 }} animate={{ width: `${a.achievement_score}%` }}
              transition={{ duration: 1, ease: [0.34, 1.56, 0.64, 1] }}
              className={`h-full rounded-full bg-gradient-to-r ${BarGradient(a.achievement_score)}`} />
          </div>
          <span className={`text-lg font-black tabular-nums ${ScoreColor(a.achievement_score)}`}>{a.achievement_score}</span>
        </div>
      </div>

      {/* STAR framework Graphic */}
      <div className={`${glassCard} p-6 bg-gradient-to-br from-gray-50 to-white`}>
        <h4 className="font-bold text-gray-900 text-[14px] mb-4 flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-indigo-500" /> Mô hình STAR chuẩn quốc tế
        </h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          {[
            ["S", "Situation", "Tình huống", "bg-blue-50 text-blue-700 border-blue-100"],
            ["T", "Task", "Nhiệm vụ", "bg-purple-50 text-purple-700 border-purple-100"],
            ["A", "Action", "Hành động", "bg-amber-50 text-amber-700 border-amber-100"],
            ["R", "Result", "Kết quả", "bg-emerald-50 text-emerald-700 border-emerald-100"],
          ].map(([letter, word, sub, cls]) => (
            <div key={letter} className={`p-4 rounded-xl border text-center ${cls}`}>
              <div className="text-2xl font-black mb-1">{letter}</div>
              <div className="text-[11px] font-bold uppercase">{word}</div>
              <div className="text-[10px] opacity-70 mt-1">{sub}</div>
            </div>
          ))}
        </div>
        <div className="bg-white p-4 rounded-xl border border-gray-100 relative">
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-indigo-500 rounded-l-xl" />
          <p className="text-[13px] text-gray-600 pl-2">
            <span className="font-semibold text-gray-900">Ví dụ tốt:</span> "Phát triển hệ thống báo cáo tự động (Action) cho team 10 người (Situation/Task), giúp giảm 3 giờ/tuần công việc thủ công (Result)."
          </p>
        </div>
      </div>

      {achieveSuggestions.length > 0 ? (
        <div className="space-y-3 pt-2">
          <h3 className="text-[13px] font-bold text-gray-500 uppercase tracking-widest pl-1">Gợi ý viết lại bullet points</h3>
          {achieveSuggestions.map((s, i) => (
            <div key={i} className={`${glassCard} p-5 border-l-4 border-l-indigo-400`}>
              <p className="text-[14px] font-bold text-gray-900 mb-1">{s.problem}</p>
              <p className="text-[13px] text-gray-600">{s.recommendation}</p>
            </div>
          ))}
        </div>
      ) : (
        <div className={`${glassCard} py-12 text-center bg-gray-50/30`}>
          <Target className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 text-[13px]">Kinh nghiệm của bạn đã được viết khá tốt. Hãy duy trì cấu trúc định lượng này.</p>
        </div>
      )}
    </motion.div>
  );
}

// ── Tab: Career Suggestions ──────────────────────────────────
const PRIORITY_CFG = {
  high:   { label: "Rất phù hợp",   cls: "bg-emerald-50 text-emerald-700 border-emerald-200", dot: "bg-emerald-500", bar: "bg-emerald-500" },
  medium: { label: "Phù hợp",       cls: "bg-amber-50 text-amber-700 border-amber-200",       dot: "bg-amber-500",   bar: "bg-amber-500" },
  low:    { label: "Tiềm năng",      cls: "bg-blue-50 text-blue-700 border-blue-200",          dot: "bg-blue-400",    bar: "bg-blue-400" },
};

function CareerSuggestionCard({ s, index }: { s: CareerSuggestion; index: number }) {
  const [expanded, setExpanded] = useState(false);
  const cfg = PRIORITY_CFG[s.priority] ?? PRIORITY_CFG.medium;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06 }}
      className={`${glassCard} overflow-hidden`}
    >
      {/* Card header */}
      <div
        className="p-5 cursor-pointer hover:bg-gray-50/50 transition-colors"
        onClick={() => setExpanded(v => !v)}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            {/* Priority indicator */}
            <div className={`w-2 h-2 rounded-full mt-2 shrink-0 ${cfg.dot}`} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <h3 className="font-bold text-gray-900 text-[15px]">{s.role}</h3>
                <span className={`text-[11px] px-2 py-0.5 rounded font-bold border ${cfg.cls}`}>
                  {cfg.label}
                </span>
              </div>
              <p className="text-[12px] text-gray-500 font-medium">{s.industry}</p>
            </div>
          </div>

          {/* Match score ring */}
          <div className="shrink-0 flex flex-col items-center">
            <div className="relative w-12 h-12">
              <svg viewBox="0 0 48 48" className="rotate-[-90deg] w-12 h-12">
                <circle cx="24" cy="24" r="19" fill="none" stroke="#f0f0f0" strokeWidth="5" />
                <circle cx="24" cy="24" r="19" fill="none" stroke={s.match_score >= 70 ? "#10b981" : s.match_score >= 50 ? "#f59e0b" : "#60a5fa"}
                  strokeWidth="5" strokeLinecap="round"
                  strokeDasharray={2 * Math.PI * 19}
                  strokeDashoffset={2 * Math.PI * 19 * (1 - s.match_score / 100)} />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-[11px] font-black text-gray-700">
                {s.match_score}%
              </span>
            </div>
          </div>
        </div>

        {/* Match bar */}
        <div className="mt-3 ml-5">
          <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${s.match_score}%` }}
              transition={{ duration: 0.8, delay: index * 0.06 + 0.2 }}
              className={`h-full rounded-full ${cfg.bar}`}
            />
          </div>
        </div>

        {/* Reason preview */}
        <p className="text-[13px] text-gray-600 mt-3 ml-5 leading-relaxed line-clamp-2">{s.reason}</p>

        <div className="flex items-center justify-between mt-3 ml-5">
          <span className="text-[12px] text-gray-400">{s.salary_range}</span>
          <ChevronRight className={`w-4 h-4 text-gray-400 transition-transform ${expanded ? "rotate-90" : ""}`} />
        </div>
      </div>

      {/* Expanded detail */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-5 pt-2 border-t border-gray-100 space-y-4 ml-5">
              {/* Skills */}
              <div className="grid grid-cols-2 gap-4">
                {s.required_skills?.length > 0 && (
                  <div>
                    <p className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider mb-2">
                      ✓ Kỹ năng đang có
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {s.required_skills.map(sk => (
                        <span key={sk} className="text-[11px] px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded font-medium">
                          {sk}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {s.missing_skills?.length > 0 && (
                  <div>
                    <p className="text-[11px] font-bold text-rose-500 uppercase tracking-wider mb-2">
                      ✗ Cần bổ sung
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {s.missing_skills.map(sk => (
                        <span key={sk} className="text-[11px] px-2 py-0.5 bg-rose-50 text-rose-600 border border-rose-200 rounded font-medium">
                          {sk}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Job links */}
              {s.job_links?.length > 0 && (
                <div>
                  <p className="text-[11px] font-bold text-blue-600 uppercase tracking-wider mb-2">
                    🔗 Trang tuyển dụng liên quan
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {s.job_links.map(link => (
                      <a
                        key={link.url}
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-[12px] font-semibold px-3 py-1.5 bg-white border border-blue-200 text-blue-600 rounded-lg hover:bg-blue-50 hover:border-blue-400 transition-colors"
                      >
                        <ExternalLink className="w-3 h-3" />
                        {link.name}
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function TabCareer({ analysisId, isDemo }: { analysisId: string; isDemo?: boolean }) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<{
    suggestions: CareerSuggestion[];
    overall_profile: string;
    top_strength: string;
  } | null>(null);
  const [error, setError] = useState("");

  const fetchSuggestions = async () => {
    if (isDemo) {
      setError("Kết nối backend để nhận gợi ý nghề nghiệp được cá nhân hóa.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const { getAccessToken } = await import("@/lib/auth");
      const token = await getAccessToken().catch(() => null);
      if (!process.env.NEXT_PUBLIC_API_URL) {
        setData({
          overall_profile: "Ho so co the tiep tuc khai thac cho cac vai tro gan voi ky nang da khop trong CV.",
          top_strength: "Co du lieu phan tich ATS de suy ra huong nghe nghiep phu hop.",
          suggestions: [
            {
              role: "Chuyen vien phu hop voi CV hien tai",
              industry: "Cong nghe / Van phong",
              priority: "high",
              match_score: 82,
              reason: "Dua tren diem ATS, tu khoa da khop va muc tieu ung tuyen hien tai.",
              required_skills: ["Communication", "Problem Solving", "Data-driven execution"],
              missing_skills: ["Metrics", "Portfolio", "Interview stories"],
              salary_range: "Tham khao theo thi truong",
              job_links: [{ name: "LinkedIn Jobs", url: "https://www.linkedin.com/jobs/" }],
            },
          ],
        });
        return;
      }
      const BASE = process.env.NEXT_PUBLIC_API_URL;
      const res = await fetch(`${BASE}/analyses/${analysisId}/career-suggestions`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error("Không thể lấy gợi ý. Backend có thể chưa chạy.");
      const json = await res.json();
      setData(json);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Lỗi không xác định");
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
      {/* Header */}
      <div className={`${glassCard} p-6 bg-gradient-to-r from-indigo-50/60 to-blue-50/40 flex items-start gap-4`}>
        <div className="w-12 h-12 bg-indigo-100 text-indigo-600 rounded-xl flex items-center justify-center shrink-0">
          <Briefcase className="w-6 h-6" />
        </div>
        <div className="flex-1">
          <h3 className="text-[16px] font-bold text-gray-900 mb-1">Gợi ý Ngành Nghề Phù Hợp</h3>
          <p className="text-[13px] text-gray-500 mb-4">
            AI phân tích toàn bộ CV của bạn và đề xuất các vị trí phù hợp nhất, kèm mức độ ưu tiên và link tuyển dụng.
          </p>
          {!data && (
            <button
              onClick={fetchSuggestions}
              disabled={loading}
              className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-[13px] font-bold hover:bg-indigo-700 transition disabled:opacity-60"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              {loading ? "Đang phân tích..." : "Phân tích ngành nghề"}
            </button>
          )}
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className={`${glassCard} p-5 border-amber-200 bg-amber-50/40 flex gap-3 items-start`}>
          <Target className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-[13px] text-gray-700">{error}</p>
            <button onClick={fetchSuggestions} className="mt-2 text-[12px] text-indigo-600 font-semibold hover:underline">
              Thử lại
            </button>
          </div>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className={`${glassCard} p-10 flex flex-col items-center gap-3`}>
          <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
          <p className="text-[13px] text-gray-500">AI đang phân tích CV và tìm kiếm ngành nghề phù hợp...</p>
        </div>
      )}

      {/* Results */}
      {data && (
        <>
          {/* Profile summary */}
          {(data.overall_profile || data.top_strength) && (
            <div className={`${glassCard} p-5 flex gap-4 items-start border-indigo-100 bg-indigo-50/20`}>
              <Star className="w-5 h-5 text-indigo-500 shrink-0 mt-0.5" />
              <div className="space-y-1">
                {data.overall_profile && <p className="text-[13px] text-gray-700">{data.overall_profile}</p>}
                {data.top_strength && (
                  <p className="text-[13px] font-semibold text-indigo-700">
                    💡 Điểm mạnh nổi bật: {data.top_strength}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Legend */}
          <div className="flex flex-wrap gap-3 px-1">
            {Object.entries(PRIORITY_CFG).map(([key, cfg]) => (
              <span key={key} className={`inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded border ${cfg.cls}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                {cfg.label}
              </span>
            ))}
            <span className="text-[11px] text-gray-400 self-center">— Click để xem chi tiết và link tuyển dụng</span>
          </div>

          {/* Suggestion cards — sorted by match_score desc */}
          <div className="space-y-3">
            {[...data.suggestions]
              .sort((a, b) => b.match_score - a.match_score)
              .map((s, i) => (
                <CareerSuggestionCard key={i} s={s} index={i} />
              ))}
          </div>

          {/* Refresh button */}
          <button
            onClick={fetchSuggestions}
            className="w-full flex items-center justify-center gap-2 py-3 border border-gray-200 rounded-xl text-[13px] text-gray-500 font-semibold hover:bg-gray-50 transition"
          >
            <Sparkles className="w-4 h-4" /> Phân tích lại với AI
          </button>
        </>
      )}
    </motion.div>
  );
}

// ── Tab: HR View ──────────────────────────────────────────────
function TabHR({ a }: { a: AnalysisResult }) {
  const hr = a.hr_review;
  if (!hr) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className={`${glassCard} py-16 text-center`}>
        <User className="w-12 h-12 text-gray-300 mx-auto mb-3" />
        <p className="text-gray-500 text-[13px]">Dữ liệu góc nhìn HR chưa sẵn sàng. Vui lòng thử lại sau.</p>
      </motion.div>
    );
  }
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
      <div className={`${glassCard} p-6 flex flex-col md:flex-row gap-6 bg-gradient-to-br from-indigo-50/50 to-white`}>
        <div className="w-16 h-16 rounded-full bg-indigo-100 flex items-center justify-center shrink-0 border border-indigo-200">
          <User className="w-8 h-8 text-indigo-600" />
        </div>
        <div>
          <h4 className="text-[13px] font-bold text-indigo-700 uppercase tracking-widest mb-2">
            Ấn tượng trong 6 giây đầu tiên
          </h4>
          <p className="text-gray-700 text-[14px] leading-relaxed italic">
            "{hr.first_impression}"
          </p>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {hr.strengths?.length ? (
          <div className={`${glassCard} p-6 border-emerald-100 bg-emerald-50/20`}>
            <h4 className="text-[14px] font-bold text-emerald-700 mb-4 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" /> Điểm cộng đối với HR
            </h4>
            <ul className="space-y-3">
              {hr.strengths.map((s, i) => (
                <li key={i} className="text-[13px] text-gray-700 flex gap-2 items-start">
                  <span className="text-emerald-500 font-bold mt-0.5">✓</span>{s}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {hr.concerns?.length ? (
          <div className={`${glassCard} p-6 border-rose-100 bg-rose-50/20`}>
            <h4 className="text-[14px] font-bold text-rose-700 mb-4 flex items-center gap-2">
              <XCircle className="w-4 h-4" /> Điểm khiến HR ngần ngại
            </h4>
            <ul className="space-y-3">
              {hr.concerns.map((s, i) => (
                <li key={i} className="text-[13px] text-gray-700 flex gap-2 items-start">
                  <span className="text-rose-500 font-bold mt-0.5">!</span>{s}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
      
      {hr.priority_actions?.length ? (
        <div className={`${glassCard} p-6 border-blue-100`}>
          <h4 className="text-[14px] font-bold text-gray-900 mb-4">Việc cần làm ngay để cải thiện CV</h4>
          <ol className="space-y-3">
            {hr.priority_actions.map((act, i) => (
              <li key={i} className="text-[13px] text-gray-700 flex gap-3 items-center p-2 rounded bg-gray-50 border border-gray-100">
                <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-[11px] font-black shrink-0">
                  {i + 1}
                </span>
                {act}
              </li>
            ))}
          </ol>
        </div>
      ) : null}
    </motion.div>
  );
}

// ── Main Page ─────────────────────────────────────────────────
export default function AnalysisDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>("score");
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [fetching, setFetching] = useState(true);

  const id = params?.id as string;

  useEffect(() => {
    if (!id) { setFetching(false); return; }

    const local = getAnalysisById(id);
    if (local) { setAnalysis(local); setFetching(false); return; }

    import("@/lib/api").then(({ apiGetAnalysis }) =>
      apiGetAnalysis(id)
        .then((data) => {
          const result: AnalysisResult = {
            analysis_id: data.id,
            fileName: data.file_name ?? "unknown.pdf",
            role: data.role ?? "",
            createdAt: data.created_at,
            total_score: data.total_score,
            layout_score: data.layout_score,
            content_score: data.content_score,
            ats_score: data.ats_score,
            keyword_score: data.keyword_score,
            skills_score: data.skills_score,
            achievement_score: data.achievement_score,
            ats_platform_scores: data.ats_platform_scores,
            matched_keywords: data.matched_keywords ?? [],
            missing_keywords: data.missing_keywords ?? [],
            suggestions: (data.suggestions as AnalysisResult["suggestions"]) ?? [],
            hr_review: data.hr_review as AnalysisResult["hr_review"],
            summary: data.summary,
            resume_id: data.resume_id,
            job_id: data.job_id,
          };
          const { saveAnalysis } = require("@/lib/store");
          saveAnalysis(result);
          setAnalysis(result);
        })
        .catch(() => setAnalysis(null))
        .finally(() => setFetching(false))
    );
  }, [id]);

  if (fetching) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
          <p className="text-sm font-medium text-gray-500">Đang trích xuất dữ liệu...</p>
        </div>
      </div>
    );
  }

  if (!id || !analysis) {
    return (
      <div className={`${glassCard} flex flex-col items-center justify-center py-20 text-center mt-10`}>
        <XCircle className="w-12 h-12 text-gray-300 mb-4" />
        <h2 className="text-gray-900 font-bold text-lg mb-2">Không tìm thấy báo cáo</h2>
        <p className="text-gray-500 text-[13px] mb-6">Kết quả này có thể đã bị xóa hoặc chưa được tạo thành công.</p>
        <Link href="/dashboard/upload"
          className="px-6 py-2.5 rounded-lg text-[13px] font-bold bg-blue-600 text-white hover:bg-blue-700 transition-colors">
          Phân tích CV mới
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative font-sans">
      {/* ── Minimal Professional Background ── */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10 bg-[#f8fafc]">
        {/* Soft, clean gradients instead of strong orbs */}
        <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-blue-50/50 rounded-full blur-[100px] translate-x-1/3 -translate-y-1/3" />
        <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-emerald-50/40 rounded-full blur-[80px] -translate-x-1/3 translate-y-1/3" />
      </div>

      <div className="max-w-4xl mx-auto space-y-6 pb-20 pt-2 md:pt-4">
        {/* Header Compact */}
        <div className="flex items-center gap-4">
          <button onClick={() => router.back()} className="text-gray-500 hover:text-gray-900 bg-white border border-gray-200 shadow-sm p-2 rounded-xl transition">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-[16px] font-bold text-gray-900">{analysis.fileName}</h1>
            <p className="text-gray-500 text-[12px]">{analysis.role} • {new Date(analysis.createdAt).toLocaleDateString("vi-VN")}</p>
          </div>
        </div>

        {/* Flat Tabs (Not floating full width) */}
        <div className="border-b border-gray-200">
          <div className="flex gap-6 overflow-x-auto pb-[-1px]">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const active = activeTab === tab.id;
              return (
                <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                  className={`relative flex items-center gap-2 py-3 text-[13px] font-bold whitespace-nowrap transition-colors ${
                    active ? "text-blue-600" : "text-gray-500 hover:text-gray-800"
                  }`}>
                  <Icon className={`w-4 h-4 ${active ? "text-blue-600" : "text-gray-400"}`} />
                  {tab.label}
                  {active && (
                    <motion.div layoutId="tab-underline"
                      className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600"
                      transition={{ type: "spring", bounce: 0.2, duration: 0.6 }} />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Tab content wrapper */}
        <div className="pt-2">
          <AnimatePresence mode="wait" onExitComplete={() => window.scrollTo({ top: 0, behavior: "smooth" })}>
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              {activeTab === "score" && <TabScore a={analysis} />}
              {activeTab === "ats" && <TabATS a={analysis} />}
              {activeTab === "keywords" && <TabKeywords a={analysis} />}
              {activeTab === "achievements" && <TabAchievements a={analysis} />}
              {activeTab === "hr" && <TabHR a={analysis} />}
              {activeTab === "career" && <TabCareer analysisId={analysis.analysis_id} isDemo={analysis.isDemo} />}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Call to Action */}
        <div className="pt-6">
          <Link href="/dashboard/cv-versions"
            className="group flex items-center justify-between w-full p-6 rounded-2xl bg-white border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center">
                <Sparkles className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-[15px] font-bold text-gray-900">Nâng cấp CV ngay bây giờ</h3>
                <p className="text-[13px] text-gray-500 mt-0.5">Áp dụng trực tiếp các gợi ý trên vào CV của bạn bằng Trình soạn thảo AI.</p>
              </div>
            </div>
            <div className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors">
              <ArrowLeft className="w-5 h-5 rotate-180" />
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}
