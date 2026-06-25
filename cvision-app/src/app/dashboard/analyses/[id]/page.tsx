"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  AlertTriangle, CheckCircle2, XCircle, Lightbulb, Target,
  User, BarChart2, TrendingUp, ArrowLeft, Loader2, Sparkles,
  Shield, Star, Zap,
} from "lucide-react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { getAnalysisById } from "@/lib/store";
import type { AnalysisResult } from "@/lib/types";

type Tab = "score" | "ats" | "keywords" | "achievements" | "hr";

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: "score", label: "Điểm số", icon: Star },
  { id: "ats", label: "ATS", icon: Shield },
  { id: "keywords", label: "Từ khóa", icon: Zap },
  { id: "achievements", label: "Thành tích", icon: TrendingUp },
  { id: "hr", label: "HR View", icon: User },
];

// ── Glass card base ──────────────────────────────────────────
const glass = "backdrop-blur-xl bg-white/[0.04] border border-white/[0.09] rounded-2xl";
const glassDark = "backdrop-blur-xl bg-black/20 border border-white/[0.07] rounded-2xl";

function ScoreColor(s: number) {
  if (s >= 80) return "text-emerald-400";
  if (s >= 60) return "text-amber-400";
  return "text-rose-400";
}

function GlowColor(s: number) {
  if (s >= 80) return "shadow-emerald-500/20";
  if (s >= 60) return "shadow-amber-500/20";
  return "shadow-rose-500/20";
}

function BarGradient(s: number) {
  if (s >= 80) return "from-emerald-500 to-teal-400";
  if (s >= 60) return "from-amber-500 to-yellow-400";
  return "from-rose-500 to-pink-400";
}

// ── Score ring SVG ──────────────────────────────────────────
function ScoreRing({ score, size = 120 }: { score: number; size?: number }) {
  const r = (size - 16) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (score / 100) * circ;
  const color = score >= 80 ? "#34d399" : score >= 60 ? "#fbbf24" : "#f43f5e";
  return (
    <svg width={size} height={size} className="rotate-[-90deg]">
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={8} />
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
    <div className={`${glass} p-4 space-y-2.5`}>
      <div className="flex justify-between items-center">
        <span className="text-[13px] text-zinc-400 font-medium">{label}</span>
        <span className={`text-[15px] font-black tabular-nums ${ScoreColor(value)}`}>{value}</span>
      </div>
      <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
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
    high: "bg-rose-500/10 text-rose-400 border-rose-500/20",
    medium: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    low: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  };
  const lbl: Record<string, string> = { high: "Cao", medium: "Vừa", low: "Thấp" };
  return (
    <span className={`text-[11px] px-2.5 py-1 rounded-full font-bold border backdrop-blur-sm ${cfg[priority] ?? cfg.low}`}>
      {lbl[priority] ?? priority}
    </span>
  );
}

// ── Tab: Score ───────────────────────────────────────────────
function TabScore({ a }: { a: AnalysisResult }) {
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
      {/* Hero score card */}
      <div className={`${glass} p-6 flex items-center justify-between shadow-2xl ${GlowColor(a.total_score)}`}>
        <div className="space-y-2">
          <p className="text-[11px] font-bold text-zinc-500 uppercase tracking-widest">Điểm tổng quan</p>
          <p className="text-zinc-300 text-sm">Vị trí: <span className="text-white font-semibold">{a.role}</span></p>
          {a.summary && <p className="text-zinc-400 text-xs max-w-xs leading-relaxed">{a.summary}</p>}
          {a.isDemo && (
            <span className="inline-block text-[11px] px-3 py-1 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 backdrop-blur-sm">
              Demo — kết nối backend để có kết quả thực
            </span>
          )}
        </div>
        <div className="relative flex items-center justify-center shrink-0">
          <ScoreRing score={a.total_score} size={100} />
          <div className="absolute inset-0 flex items-center justify-center">
            <span className={`text-2xl font-black tabular-nums ${ScoreColor(a.total_score)}`}>{a.total_score}</span>
          </div>
        </div>
      </div>

      {/* Score breakdown grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {[
          { label: "Bố cục & Trình bày", value: a.layout_score },
          { label: "Nội dung", value: a.content_score },
          { label: "Điểm ATS", value: a.ats_score },
          { label: "Từ khóa", value: a.keyword_score },
          { label: "Kỹ năng", value: a.skills_score },
          { label: "Thành tích", value: a.achievement_score },
        ].map((item, i) => (
          <motion.div key={item.label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }}>
            <ScoreBar label={item.label} value={item.value} />
          </motion.div>
        ))}
      </div>

      {/* Strengths & Weaknesses */}
      {(a.strengths?.length || a.weaknesses?.length) ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {a.strengths?.length ? (
            <div className="bg-emerald-500/[0.06] border border-emerald-500/20 rounded-2xl p-5 backdrop-blur-xl">
              <h4 className="font-bold text-emerald-400 text-sm mb-3 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" /> Điểm mạnh
              </h4>
              <ul className="space-y-2">
                {a.strengths.map((s, i) => (
                  <li key={i} className="text-zinc-300 text-[13px] flex gap-2 items-start">
                    <span className="text-emerald-400 mt-0.5 shrink-0">✦</span>{s}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {a.weaknesses?.length ? (
            <div className="bg-rose-500/[0.06] border border-rose-500/20 rounded-2xl p-5 backdrop-blur-xl">
              <h4 className="font-bold text-rose-400 text-sm mb-3 flex items-center gap-2">
                <XCircle className="w-4 h-4" /> Điểm yếu
              </h4>
              <ul className="space-y-2">
                {a.weaknesses.map((s, i) => (
                  <li key={i} className="text-zinc-300 text-[13px] flex gap-2 items-start">
                    <span className="text-rose-400 mt-0.5 shrink-0">✦</span>{s}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}

      {/* Suggestions */}
      {a.suggestions?.length ? (
        <div className="space-y-3">
          <h3 className="text-[13px] font-bold text-zinc-300 uppercase tracking-widest">Gợi ý cải thiện</h3>
          {a.suggestions.map((s, i) => (
            <motion.div key={i} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.06 }}
              className={`${glassDark} p-4 hover:bg-white/[0.06] transition-colors`}>
              <div className="flex items-start justify-between gap-3 mb-2">
                <p className="text-[13px] font-semibold text-zinc-200">{s.problem}</p>
                <PriorityBadge priority={s.priority} />
              </div>
              <p className="text-[13px] text-zinc-400 leading-relaxed">{s.recommendation}</p>
              {s.evidence && <p className="text-[11px] text-zinc-600 mt-2 italic">{s.evidence}</p>}
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
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
      <div className={`${glass} p-6 flex items-center justify-between shadow-2xl`}>
        <div>
          <p className="text-[11px] font-bold text-zinc-500 uppercase tracking-widest mb-1">Điểm ATS tổng thể</p>
          <p className="text-zinc-400 text-xs">Khả năng CV vượt qua hệ thống lọc tự động</p>
        </div>
        <div className="relative shrink-0">
          <ScoreRing score={a.ats_score} size={80} />
          <div className="absolute inset-0 flex items-center justify-center">
            <span className={`text-lg font-black ${ScoreColor(a.ats_score)}`}>{a.ats_score}</span>
          </div>
        </div>
      </div>

      {Object.keys(platforms).length > 0 && (
        <div className="space-y-2.5">
          <h3 className="text-[11px] font-bold text-zinc-500 uppercase tracking-widest">Điểm theo nền tảng ATS</h3>
          {Object.entries(platforms).map(([platform, score]) => (
            <ScoreBar key={platform} label={platform.charAt(0).toUpperCase() + platform.slice(1)} value={score as number} />
          ))}
        </div>
      )}

      <div className="bg-amber-500/[0.06] border border-amber-500/20 rounded-2xl p-5 backdrop-blur-xl">
        <h4 className="font-bold text-amber-400 text-sm mb-3 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" /> Lưu ý quan trọng về ATS
        </h4>
        <ul className="space-y-2.5 text-[13px] text-zinc-300">
          {[
            "Tránh dùng bảng, cột đa cột, hình ảnh trong CV (ATS khó đọc)",
            "Dùng heading chuẩn: Experience, Education, Skills",
            "Tỷ lệ khớp từ khóa với JD cần đạt ít nhất 60%",
          ].map((tip, i) => (
            <li key={i} className="flex gap-2.5 items-start">
              <span className="text-amber-400 mt-0.5 shrink-0">→</span>{tip}
            </li>
          ))}
        </ul>
      </div>
    </motion.div>
  );
}

// ── Tab: Keywords ────────────────────────────────────────────
function TabKeywords({ a }: { a: AnalysisResult }) {
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      {a.matched_keywords?.length > 0 && (
        <div>
          <h3 className="text-[11px] font-bold text-emerald-400 uppercase tracking-widest mb-3 flex items-center gap-2">
            <CheckCircle2 className="w-3.5 h-3.5" /> Từ khóa khớp ({a.matched_keywords.length})
          </h3>
          <div className="flex flex-wrap gap-2">
            {a.matched_keywords.map((kw) => (
              <span key={kw} className="px-3 py-1 rounded-full text-[12px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 backdrop-blur-sm hover:bg-emerald-500/20 transition">
                {kw}
              </span>
            ))}
          </div>
        </div>
      )}
      {a.semantic_keywords?.length ? (
        <div>
          <h3 className="text-[11px] font-bold text-blue-400 uppercase tracking-widest mb-3 flex items-center gap-2">
            <Lightbulb className="w-3.5 h-3.5" /> Khớp ngữ nghĩa ({a.semantic_keywords.length})
          </h3>
          <div className="flex flex-wrap gap-2">
            {a.semantic_keywords.map((kw) => (
              <span key={kw} className="px-3 py-1 rounded-full text-[12px] font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20 backdrop-blur-sm hover:bg-blue-500/20 transition">
                {kw}
              </span>
            ))}
          </div>
        </div>
      ) : null}
      {a.missing_keywords?.length > 0 && (
        <div>
          <h3 className="text-[11px] font-bold text-rose-400 uppercase tracking-widest mb-3 flex items-center gap-2">
            <XCircle className="w-3.5 h-3.5" /> Từ khóa thiếu ({a.missing_keywords.length})
          </h3>
          <div className="flex flex-wrap gap-2">
            {a.missing_keywords.map((kw) => (
              <span key={kw} className="px-3 py-1 rounded-full text-[12px] font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20 backdrop-blur-sm hover:bg-rose-500/20 transition cursor-default">
                {kw}
              </span>
            ))}
          </div>
          <p className="text-zinc-500 text-[12px] mt-3 italic">Bổ sung những từ khóa này nếu bạn thực sự có kỹ năng/kinh nghiệm đó.</p>
        </div>
      )}
    </motion.div>
  );
}

// ── Tab: Achievements ────────────────────────────────────────
function TabAchievements({ a }: { a: AnalysisResult }) {
  const achieveSuggestions = a.suggestions?.filter((s) => s.category === "achievement") ?? [];
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
      <div className={`${glass} p-5 flex items-center justify-between`}>
        <span className="text-[13px] text-zinc-400">Điểm thành tích</span>
        <div className="flex items-center gap-3">
          <div className="w-32 h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
            <motion.div initial={{ width: 0 }} animate={{ width: `${a.achievement_score}%` }}
              transition={{ duration: 1, ease: [0.34, 1.56, 0.64, 1] }}
              className={`h-full rounded-full bg-gradient-to-r ${BarGradient(a.achievement_score)}`} />
          </div>
          <span className={`text-lg font-black tabular-nums ${ScoreColor(a.achievement_score)}`}>{a.achievement_score}</span>
        </div>
      </div>

      {/* STAR framework */}
      <div className={`${glassDark} p-5`}>
        <h4 className="font-bold text-white text-sm mb-4 flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-amber-400" /> Framework STAR — Viết thành tích hiệu quả
        </h4>
        <div className="grid grid-cols-4 gap-2.5 mb-4">
          {[
            ["S", "Situation", "bg-blue-500/10 text-blue-400 border-blue-500/20"],
            ["T", "Task", "bg-purple-500/10 text-purple-400 border-purple-500/20"],
            ["A", "Action", "bg-amber-500/10 text-amber-400 border-amber-500/20"],
            ["R", "Result", "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"],
          ].map(([letter, word, cls]) => (
            <div key={letter} className={`p-3 rounded-xl border backdrop-blur-xl text-center ${cls}`}>
              <div className="text-xl font-black">{letter}</div>
              <div className="text-[10px] mt-1 font-semibold opacity-70">{word}</div>
            </div>
          ))}
        </div>
        <p className="text-[12px] text-zinc-500 italic leading-relaxed">
          &ldquo;Phát triển hệ thống báo cáo tự động cho team 10 người, giảm 3 giờ/tuần công việc thủ công&rdquo;
        </p>
      </div>

      {achieveSuggestions.length > 0 ? (
        <div className="space-y-3">
          <h3 className="text-[11px] font-bold text-zinc-500 uppercase tracking-widest">Gợi ý AI cho thành tích</h3>
          {achieveSuggestions.map((s, i) => (
            <div key={i} className={`${glassDark} p-4 hover:bg-white/[0.06] transition-colors`}>
              <p className="text-[13px] font-semibold text-zinc-200 mb-1">{s.problem}</p>
              <p className="text-[13px] text-zinc-400 leading-relaxed">{s.recommendation}</p>
            </div>
          ))}
        </div>
      ) : (
        <div className={`${glass} py-10 text-center`}>
          <Target className="w-10 h-10 mx-auto mb-3 text-zinc-700" />
          <p className="text-zinc-500 text-sm">Không có gợi ý cụ thể. Thêm JD để AI phân tích sâu hơn.</p>
        </div>
      )}
    </motion.div>
  );
}

// ── Tab: HR View ──────────────────────────────────────────────
function TabHR({ a }: { a: AnalysisResult }) {
  const hr = a.hr_review;
  if (!hr) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className={`${glass} py-16 text-center`}>
        <User className="w-12 h-12 mx-auto mb-3 text-zinc-700" />
        <p className="text-zinc-500 text-sm">Chưa có dữ liệu HR View. Kết nối backend để phân tích đầy đủ.</p>
      </motion.div>
    );
  }
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
      <div className={`${glass} p-5`}>
        <h4 className="text-[11px] font-bold text-zinc-500 uppercase tracking-widest mb-3 flex items-center gap-2">
          <User className="w-3.5 h-3.5" /> Ấn tượng đầu tiên của HR (30 giây)
        </h4>
        <p className="text-zinc-300 text-[13px] leading-relaxed">{hr.first_impression}</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {hr.strengths?.length ? (
          <div className="bg-emerald-500/[0.06] border border-emerald-500/20 rounded-2xl p-5 backdrop-blur-xl">
            <h4 className="text-sm font-bold text-emerald-400 mb-3">Điểm mạnh HR nhận ra</h4>
            <ul className="space-y-2">
              {hr.strengths.map((s, i) => (
                <li key={i} className="text-[13px] text-zinc-300 flex gap-2 items-start">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />{s}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {hr.concerns?.length ? (
          <div className="bg-rose-500/[0.06] border border-rose-500/20 rounded-2xl p-5 backdrop-blur-xl">
            <h4 className="text-sm font-bold text-rose-400 mb-3">Điểm lo ngại của HR</h4>
            <ul className="space-y-2">
              {hr.concerns.map((s, i) => (
                <li key={i} className="text-[13px] text-zinc-300 flex gap-2 items-start">
                  <XCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />{s}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
      {hr.priority_actions?.length ? (
        <div className={`${glassDark} p-5`}>
          <h4 className="text-sm font-bold text-white mb-4">Hành động ưu tiên</h4>
          <ol className="space-y-3">
            {hr.priority_actions.map((act, i) => (
              <li key={i} className="text-[13px] text-zinc-300 flex gap-3 items-start">
                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-black shrink-0 mt-0.5 ${glass}`}>
                  {i + 1}
                </span>
                {act}
              </li>
            ))}
          </ol>
        </div>
      ) : null}
      <p className="text-[11px] text-zinc-600 text-center italic">
        Đây là ước tính dựa trên CV và JD, không phải cam kết từ nhà tuyển dụng thực.
      </p>
    </motion.div>
  );
}

// ── Main Page ─────────────────────────────────────────────────
export default function AnalysisDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>("score");

  const id = params?.id as string;
  const analysis = id ? getAnalysisById(id) : null;

  if (!id) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-zinc-500" />
      </div>
    );
  }

  if (!analysis) {
    return (
      <div className={`${glass} flex flex-col items-center justify-center py-20 text-center`}>
        <XCircle className="w-12 h-12 text-zinc-700 mb-4" />
        <h2 className="text-white font-bold text-lg mb-2">Không tìm thấy kết quả phân tích</h2>
        <p className="text-zinc-500 text-sm mb-6">Kết quả này có thể đã bị xóa hoặc chưa được tạo.</p>
        <Link href="/dashboard/upload"
          className="px-6 py-2.5 rounded-full text-sm font-bold bg-white/10 text-white border border-white/20 hover:bg-white/20 transition backdrop-blur-xl">
          Phân tích CV mới
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative">
      {/* Ambient background blobs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10">
        <div className={`absolute top-20 right-1/4 w-72 h-72 rounded-full blur-3xl opacity-20 ${analysis.total_score >= 80 ? "bg-emerald-500" : analysis.total_score >= 60 ? "bg-amber-500" : "bg-rose-500"}`} />
        <div className="absolute bottom-40 left-1/4 w-96 h-96 bg-blue-600 rounded-full blur-3xl opacity-10" />
      </div>

      <div className="space-y-5 pb-10">
        {/* Header */}
        <div className={`${glass} p-4 flex items-center gap-4 shadow-xl`}>
          <button onClick={() => router.back()} className="text-zinc-400 hover:text-white transition p-1.5 rounded-xl hover:bg-white/10">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-[15px] font-bold text-white truncate">{analysis.fileName}</h1>
            <p className="text-zinc-500 text-[12px]">{analysis.role} · {new Date(analysis.createdAt).toLocaleDateString("vi-VN")}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <div className={`text-2xl font-black tabular-nums ${ScoreColor(analysis.total_score)}`}>
              {analysis.total_score}<span className="text-sm text-zinc-500 font-normal">/100</span>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className={`${glass} p-1.5 flex gap-1 overflow-x-auto`}>
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className={`relative flex items-center gap-2 px-4 py-2.5 rounded-xl text-[13px] font-semibold whitespace-nowrap transition-all flex-1 justify-center ${
                  active
                    ? "bg-white/10 text-white shadow-lg backdrop-blur-xl"
                    : "text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.04]"
                }`}>
                {active && (
                  <motion.div layoutId="tab-pill"
                    className="absolute inset-0 rounded-xl bg-white/[0.08] border border-white/10"
                    transition={{ type: "spring", bounce: 0.2, duration: 0.4 }} />
                )}
                <Icon className="w-3.5 h-3.5 relative z-10" />
                <span className="relative z-10">{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Tab content */}
        <AnimatePresence mode="wait">
          <div key={activeTab}>
            {activeTab === "score" && <TabScore a={analysis} />}
            {activeTab === "ats" && <TabATS a={analysis} />}
            {activeTab === "keywords" && <TabKeywords a={analysis} />}
            {activeTab === "achievements" && <TabAchievements a={analysis} />}
            {activeTab === "hr" && <TabHR a={analysis} />}
          </div>
        </AnimatePresence>

        {/* CTA */}
        <Link href="/dashboard/cv-versions"
          className="flex items-center justify-center gap-2.5 w-full py-4 rounded-2xl font-bold text-[14px] transition-all
            bg-gradient-to-r from-blue-600 to-indigo-600 text-white
            hover:from-blue-500 hover:to-indigo-500
            shadow-xl shadow-blue-500/20 hover:shadow-blue-500/40
            border border-white/10 backdrop-blur-xl">
          <Sparkles className="w-5 h-5" />
          Tạo phiên bản CV tối ưu từ kết quả này
          <BarChart2 className="w-4 h-4 opacity-70" />
        </Link>
      </div>
    </div>
  );
}
