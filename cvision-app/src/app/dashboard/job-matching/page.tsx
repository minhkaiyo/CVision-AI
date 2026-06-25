"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Briefcase, MapPin, DollarSign, Search, Clock, ExternalLink,
  SlidersHorizontal, Loader2, RefreshCw, Wifi, WifiOff, CheckCircle,
  Building2, MonitorSmartphone, Users, Zap, TrendingUp, Filter, X,
} from "lucide-react";
import Image from "next/image";
import { getAnalyses } from "@/lib/store";
import type { AnalysisResult } from "@/lib/types";

// ── Types ──────────────────────────────────────────────────────────────────────

interface Job {
  id: string;
  title: string;
  company: string;
  logo: string;
  location: string;
  salary: string;
  salary_min?: number;
  salary_max?: number;
  tags: string[];
  industry: string;
  matchScore: number;
  posted: string;
  url: string;
  description: string;
  source: string;
  work_type: "remote" | "hybrid" | "onsite";
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function matchBadge(score: number) {
  if (score >= 85) return { label: "Rất phù hợp", cls: "bg-emerald-50 text-emerald-700 border-emerald-200", bar: "bg-emerald-500" };
  if (score >= 70) return { label: "Phù hợp", cls: "bg-blue-50 text-blue-700 border-blue-200", bar: "bg-blue-500" };
  return { label: "Khá phù hợp", cls: "bg-amber-50 text-amber-700 border-amber-200", bar: "bg-amber-400" };
}

function workTypeBadge(type: Job["work_type"]) {
  const map = {
    remote: { label: "Remote", cls: "bg-emerald-50 text-emerald-700" },
    hybrid: { label: "Hybrid", cls: "bg-blue-50 text-blue-700" },
    onsite: { label: "On-site", cls: "bg-gray-100 text-gray-700" },
  };
  return map[type] ?? map.onsite;
}

function relativePosted(str: string) { return str; }

// ── JobCard ───────────────────────────────────────────────────────────────────

function JobCard({ job, index }: { job: Job; index: number }) {
  const badge = matchBadge(job.matchScore);
  const workType = workTypeBadge(job.work_type);
  const [imgError, setImgError] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06, type: "spring", stiffness: 200 }}
      className="group backdrop-blur-[40px] bg-white/20 border-[1.5px] border-white/60 shadow-[inset_0_2px_4px_rgba(255,255,255,0.8),inset_0_-1px_2px_rgba(255,255,255,0.3),0_12px_40px_rgba(31,38,135,0.1)] rounded-[2rem] p-5 flex flex-col gap-4 hover:shadow-[inset_0_2px_4px_rgba(255,255,255,0.9),0_20px_60px_rgba(31,38,135,0.2)] hover:border-white/80 hover:-translate-y-1 transition-all duration-300 relative overflow-hidden cursor-pointer"
    >
      <div className="absolute inset-0 bg-gradient-to-br from-white/30 via-transparent to-white/10 pointer-events-none" />

      {/* Header */}
      <div className="relative z-10 flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-11 h-11 rounded-2xl overflow-hidden bg-white/60 border border-white/80 flex items-center justify-center shrink-0 shadow-[inset_0_1px_2px_rgba(255,255,255,0.8)]">
            {imgError ? (
              <span className="text-gray-600 font-bold text-sm">{job.company[0]}</span>
            ) : (
              <Image
                src={job.logo}
                alt={job.company}
                width={44}
                height={44}
                className="object-contain p-1.5"
                unoptimized
                onError={() => setImgError(true)}
              />
            )}
          </div>
          <div className="min-w-0">
            <p className="text-[12px] text-gray-600 font-semibold truncate flex items-center gap-1">
              <Building2 className="w-3 h-3 text-gray-400 shrink-0" />
              {job.company}
            </p>
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${workType.cls}`}>
              {workType.label}
            </span>
          </div>
        </div>

        {/* Match badge */}
        <div className="shrink-0 flex flex-col items-end gap-1">
          <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${badge.cls}`}>
            {badge.label}
          </span>
          <span className="text-xl font-black text-gray-800 leading-none">
            {job.matchScore}%
          </span>
        </div>
      </div>

      {/* Match bar */}
      <div className="h-1.5 bg-white/40 rounded-full overflow-hidden -mt-2 border border-white/50">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${job.matchScore}%` }}
          transition={{ duration: 0.9, delay: index * 0.06 + 0.2, ease: "easeOut" }}
          className={`h-full rounded-full ${badge.bar} shadow-sm`}
        />
      </div>

      {/* Job title & details */}
      <div className="relative z-10">
        <h3 className="font-bold text-gray-900 text-[15px] mb-2 group-hover:text-blue-700 transition-colors">
          {job.title}
        </h3>
        <p className="text-[12px] text-gray-500 leading-relaxed mb-2 line-clamp-2">{job.description}</p>
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-1.5 text-[12px] text-gray-500 font-medium">
            <MapPin className="w-3.5 h-3.5 shrink-0 text-blue-400" /> {job.location}
          </div>
          <div className="flex items-center gap-1.5 text-[12px] text-gray-600 font-semibold">
            <DollarSign className="w-3.5 h-3.5 shrink-0 text-emerald-500" /> {job.salary}
          </div>
        </div>
      </div>

      {/* Tags */}
      <div className="relative z-10 flex flex-wrap gap-1.5">
        {job.tags.slice(0, 4).map(tag => (
          <span key={tag} className="text-[11px] font-semibold px-2 py-0.5 bg-indigo-50/60 text-indigo-700 border border-indigo-100/80 rounded-lg backdrop-blur-sm">
            {tag}
          </span>
        ))}
        {job.tags.length > 4 && (
          <span className="text-[11px] font-semibold px-2 py-0.5 bg-gray-50/60 text-gray-500 border border-gray-100 rounded-lg">
            +{job.tags.length - 4}
          </span>
        )}
      </div>

      {/* Footer */}
      <div className="relative z-10 flex items-center justify-between pt-2 border-t border-white/40">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1 text-[11px] text-gray-400 font-medium">
            <Clock className="w-3 h-3" /> {relativePosted(job.posted)}
          </span>
          <span className="text-[10px] bg-gray-100/60 text-gray-500 px-2 py-0.5 rounded-md font-medium border border-gray-100">
            {job.source}
          </span>
        </div>
        <a
          href={job.url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={e => e.stopPropagation()}
          className="flex items-center gap-1 text-[12px] font-bold text-blue-600 hover:text-blue-700 transition bg-blue-50/50 px-3 py-1.5 rounded-xl border border-blue-100/80 hover:bg-blue-100/60"
        >
          Ứng tuyển <ExternalLink className="w-3.5 h-3.5" />
        </a>
      </div>
    </motion.div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────

const WORK_TYPES = [
  { id: "all", label: "Tất cả" },
  { id: "remote", label: "🏠 Remote" },
  { id: "hybrid", label: "⚡ Hybrid" },
  { id: "onsite", label: "🏢 On-site" },
];

const SALARY_FILTERS = [
  { id: "all", label: "Tất cả mức lương" },
  { id: "under20", label: "< 20 triệu", min: 0, max: 20 },
  { id: "20to35", label: "20 – 35 triệu", min: 20, max: 35 },
  { id: "35plus", label: "> 35 triệu", min: 35, max: 999 },
];

export default function JobMatchingPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [workType, setWorkType] = useState("all");
  const [salaryFilter, setSalaryFilter] = useState("all");
  const [showFilters, setShowFilters] = useState(false);
  const [cvAnalysis, setCvAnalysis] = useState<AnalysisResult | null>(null);
  const [isPersonalized, setIsPersonalized] = useState(false);

  const fetchJobs = useCallback(async (analysis?: AnalysisResult | null) => {
    setLoading(true);
    setError(null);
    try {
      let res: Response;
      if (analysis) {
        res = await fetch("/api/v1/jobs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            cv_keywords: analysis.matched_keywords ?? [],
            role: analysis.role ?? "",
            skills: [],
            matched_keywords: analysis.matched_keywords ?? [],
            missing_keywords: analysis.missing_keywords ?? [],
          }),
        });
        setIsPersonalized(true);
      } else {
        res = await fetch("/api/v1/jobs");
        setIsPersonalized(false);
      }
      const data = await res.json();
      setJobs(data.jobs ?? []);
    } catch {
      setError("Không thể tải danh sách việc làm. Vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Load latest CV analysis from localStorage
    const analyses = getAnalyses();
    const latest = analyses.filter(a => !a.isDemo)[0] ?? analyses[0] ?? null;
    setCvAnalysis(latest);
    fetchJobs(latest);
  }, [fetchJobs]);

  // Filter
  const salaryDef = SALARY_FILTERS.find(s => s.id === salaryFilter);
  const filtered = jobs.filter(j => {
    const q = search.toLowerCase();
    const matchSearch = !q || j.title.toLowerCase().includes(q) || j.company.toLowerCase().includes(q) || j.tags.some(t => t.toLowerCase().includes(q));
    const matchWork = workType === "all" || j.work_type === workType;
    const matchSalary = !salaryDef || salaryDef.id === "all" || (
      (j.salary_max ?? 0) >= (salaryDef.min ?? 0) && (j.salary_min ?? 999) <= (salaryDef.max ?? 999)
    );
    return matchSearch && matchWork && matchSalary;
  });

  const topScore = jobs.length > 0 ? Math.max(...jobs.map(j => j.matchScore)) : 0;
  const highMatch = jobs.filter(j => j.matchScore >= 85).length;

  const glassCard = "backdrop-blur-[40px] bg-white/20 border-[1.5px] border-white/60 shadow-[inset_0_2px_4px_rgba(255,255,255,0.8),inset_0_-1px_2px_rgba(255,255,255,0.3),0_12px_40px_rgba(31,38,135,0.1)] rounded-[2.5rem] relative overflow-hidden";

  return (
    <div className="space-y-6 pb-10">
      {/* Header */}
      <div className={`${glassCard} px-7 py-6`}>
        <div className="absolute inset-0 bg-gradient-to-br from-white/30 via-transparent to-white/10 pointer-events-none" />
        <div className="relative z-10 flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-[24px] font-extrabold text-gray-800 flex items-center gap-2.5 mb-1 tracking-tight">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg text-white">
                <Briefcase className="w-5 h-5" />
              </div>
              Việc Làm Phù Hợp
            </h1>
            <p className="text-gray-500 text-[13px] ml-12">
              {isPersonalized ? (
                <span className="flex items-center gap-1.5">
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
                  Cá nhân hóa dựa trên CV: <strong className="text-gray-700">{cvAnalysis?.role}</strong>
                </span>
              ) : (
                <span className="flex items-center gap-1.5">
                  <Wifi className="w-3.5 h-3.5 text-blue-400" />
                  Hiển thị tổng hợp — <span className="text-blue-600 font-medium">tải CV để cá nhân hóa</span>
                </span>
              )}
            </p>
          </div>
          <button
            onClick={() => fetchJobs(cvAnalysis)}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2.5 bg-blue-500 text-white rounded-2xl font-bold text-sm hover:bg-blue-600 transition shadow-lg shadow-blue-500/20 disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            Làm mới
          </button>
        </div>
      </div>

      {/* Stats */}
      {!loading && jobs.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { icon: TrendingUp, label: "Phù hợp cao nhất", value: `${topScore}%`, color: "text-emerald-600", bg: "from-emerald-400 to-green-500" },
            { icon: Briefcase, label: "Tổng vị trí", value: jobs.length, color: "text-blue-600", bg: "from-blue-400 to-indigo-500" },
            { icon: Zap, label: "Rất phù hợp (>85%)", value: highMatch, color: "text-violet-600", bg: "from-violet-400 to-purple-500" },
            { icon: MonitorSmartphone, label: "Có Remote/Hybrid", value: jobs.filter(j => j.work_type !== "onsite").length, color: "text-orange-600", bg: "from-orange-400 to-amber-500" },
          ].map((s, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.07 }}
              className={`${glassCard} p-4 flex items-center gap-3`}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-white/30 via-transparent to-white/10 pointer-events-none" />
              <div className={`relative z-10 w-10 h-10 rounded-xl bg-gradient-to-br ${s.bg} flex items-center justify-center shrink-0 text-white shadow-lg`}>
                <s.icon className="w-5 h-5" />
              </div>
              <div className="relative z-10">
                <div className={`text-2xl font-black ${s.color}`}>{s.value}</div>
                <div className="text-[11px] text-gray-500 font-medium">{s.label}</div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className={`${glassCard} px-5 py-4`}>
        <div className="absolute inset-0 bg-gradient-to-br from-white/30 via-transparent to-white/10 pointer-events-none" />
        <div className="relative z-10 flex flex-wrap gap-3 items-center">
          {/* Search */}
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Tìm việc, công ty, kỹ năng..."
              className="w-full pl-10 pr-10 py-2.5 text-[13px] bg-white/50 border border-white/70 rounded-2xl backdrop-blur-sm focus:outline-none focus:border-blue-300 focus:bg-white/70 transition font-medium placeholder:text-gray-400"
            />
            {search && (
              <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Work Type */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {WORK_TYPES.map(t => (
              <button
                key={t.id}
                onClick={() => setWorkType(t.id)}
                className={`px-3 py-2 rounded-xl text-[12px] font-bold transition-all border ${workType === t.id ? "bg-blue-500 text-white border-blue-400 shadow-md" : "bg-white/40 text-gray-600 border-white/60 hover:bg-white/60"}`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* More filters */}
          <button
            onClick={() => setShowFilters(v => !v)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-[12px] font-bold transition-all border ${showFilters ? "bg-indigo-500 text-white border-indigo-400" : "bg-white/40 text-gray-600 border-white/60 hover:bg-white/60"}`}
          >
            <Filter className="w-3.5 h-3.5" /> Lọc thêm
          </button>
        </div>

        {/* Extended filters */}
        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="relative z-10 overflow-hidden"
            >
              <div className="pt-3 mt-3 border-t border-white/40 flex flex-wrap gap-3 items-center">
                <span className="text-[12px] font-bold text-gray-600 flex items-center gap-1">
                  <DollarSign className="w-3.5 h-3.5" /> Mức lương:
                </span>
                {SALARY_FILTERS.map(s => (
                  <button
                    key={s.id}
                    onClick={() => setSalaryFilter(s.id)}
                    className={`px-3 py-1.5 rounded-xl text-[12px] font-semibold border transition-all ${salaryFilter === s.id ? "bg-emerald-500 text-white border-emerald-400" : "bg-white/40 text-gray-600 border-white/60 hover:bg-white/60"}`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* CV link suggestion if no analysis */}
      {!isPersonalized && !loading && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className={`${glassCard} px-6 py-4`}
        >
          <div className="absolute inset-0 bg-gradient-to-br from-blue-50/40 via-transparent to-indigo-50/20 pointer-events-none" />
          <div className="relative z-10 flex items-center gap-4">
            <div className="w-10 h-10 rounded-2xl bg-blue-100 flex items-center justify-center shrink-0">
              <Users className="w-5 h-5 text-blue-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-semibold text-gray-700">
                Tải CV lên để nhận gợi ý việc làm được cá nhân hóa bởi AI
              </p>
              <p className="text-[12px] text-gray-500">Hệ thống sẽ phân tích CV và tính điểm phù hợp thực tế cho từng vị trí</p>
            </div>
            <a
              href="/dashboard/upload"
              className="shrink-0 px-4 py-2 bg-blue-500 text-white rounded-xl text-[12px] font-bold hover:bg-blue-600 transition shadow-md"
            >
              Tải CV ngay
            </a>
          </div>
        </motion.div>
      )}

      {/* Loading */}
      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className={`${glassCard} p-5 h-[280px] animate-pulse`}>
              <div className="absolute inset-0 bg-gradient-to-br from-white/30 via-transparent to-white/10 pointer-events-none" />
              <div className="relative z-10 space-y-3">
                <div className="flex gap-3">
                  <div className="w-11 h-11 bg-white/50 rounded-2xl" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 bg-white/50 rounded w-1/2" />
                    <div className="h-2 bg-white/40 rounded w-1/3" />
                  </div>
                </div>
                <div className="h-1.5 bg-white/40 rounded-full" />
                <div className="h-4 bg-white/50 rounded w-3/4" />
                <div className="space-y-2">
                  <div className="h-3 bg-white/40 rounded w-full" />
                  <div className="h-3 bg-white/40 rounded w-5/6" />
                </div>
                <div className="flex gap-2">
                  {[1,2,3].map(j => <div key={j} className="h-5 w-16 bg-white/40 rounded-lg" />)}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Error */}
      {error && !loading && (
        <div className={`${glassCard} py-12 px-6 text-center`}>
          <div className="absolute inset-0 bg-gradient-to-br from-white/30 via-transparent to-white/10 pointer-events-none" />
          <div className="relative z-10">
            <WifiOff className="w-12 h-12 text-red-400 mx-auto mb-3" />
            <p className="text-gray-700 font-semibold mb-4">{error}</p>
            <button onClick={() => fetchJobs(cvAnalysis)} className="px-5 py-2.5 bg-blue-500 text-white rounded-xl font-bold text-sm hover:bg-blue-600 transition">
              Thử lại
            </button>
          </div>
        </div>
      )}

      {/* Job grid */}
      {!loading && !error && (
        <>
          {filtered.length === 0 ? (
            <div className={`${glassCard} py-16 text-center`}>
              <div className="absolute inset-0 bg-gradient-to-br from-white/30 via-transparent to-white/10 pointer-events-none" />
              <div className="relative z-10">
                <Briefcase className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 text-sm font-medium">Không tìm thấy vị trí phù hợp với bộ lọc hiện tại</p>
                <button onClick={() => { setSearch(""); setWorkType("all"); setSalaryFilter("all"); }} className="mt-4 text-[13px] text-blue-600 font-semibold hover:underline">
                  Xóa bộ lọc
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <p className="text-[13px] text-gray-500 font-medium">
                  Tìm thấy <strong className="text-gray-800">{filtered.length}</strong> vị trí
                  {search && <> · khớp với "<span className="text-blue-600">{search}</span>"</>}
                </p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {filtered.map((job, i) => (
                  <JobCard key={job.id} job={job} index={i} />
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
