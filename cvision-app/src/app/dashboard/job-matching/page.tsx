"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Briefcase, MapPin, DollarSign, Search, Clock, ExternalLink, SlidersHorizontal } from "lucide-react";
import Image from "next/image";

// ── Mock Data ─────────────────────────────────────────────────────────────────

const MOCK_JOBS = [
  { id: "1", title: "Frontend Developer", company: "FPT Software", logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/1/11/FPT_logo_2010.svg/1200px-FPT_logo_2010.svg.png", location: "Hà Nội (Hybrid)", salary: "18 – 30 triệu", matchScore: 94, tags: ["React", "TypeScript", "Next.js"], posted: "2 ngày trước", industry: "it" },
  { id: "2", title: "AI/ML Engineer", company: "VNG Corporation", logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/5/52/VNG_logo.svg/1200px-VNG_logo.svg.png", location: "TP. HCM (On-site)", salary: "25 – 45 triệu", matchScore: 88, tags: ["Python", "TensorFlow", "LLM"], posted: "1 ngày trước", industry: "it" },
  { id: "3", title: "Product Manager", company: "Tiki", logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/2/2e/Tiki_logocombined.svg/1200px-Tiki_logocombined.svg.png", location: "TP. HCM (Remote)", salary: "30 – 50 triệu", matchScore: 79, tags: ["Agile", "Jira", "Analytics"], posted: "3 ngày trước", industry: "finance" },
  { id: "4", title: "Data Analyst", company: "Momo", logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/b/ba/MoMo_Logo.png/1200px-MoMo_Logo.png", location: "Hà Nội (Hybrid)", salary: "15 – 25 triệu", matchScore: 75, tags: ["SQL", "Python", "Tableau"], posted: "5 ngày trước", industry: "finance" },
  { id: "5", title: "Marketing Specialist", company: "Shopee", logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/f/fe/Shopee.svg/1200px-Shopee.svg.png", location: "TP. HCM (On-site)", salary: "12 – 20 triệu", matchScore: 65, tags: ["Content", "SEO", "Analytics"], posted: "1 tuần trước", industry: "marketing" },
  { id: "6", title: "Backend Developer (Java)", company: "VNPT", logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/6/68/VNPT_logo.svg/1200px-VNPT_logo.svg.png", location: "Hà Nội (On-site)", salary: "20 – 35 triệu", matchScore: 61, tags: ["Java", "Spring Boot", "Microservices"], posted: "4 ngày trước", industry: "it" },
];

const INDUSTRIES = [
  { id: "all", label: "Tất cả" },
  { id: "it", label: "IT" },
  { id: "finance", label: "Tài chính" },
  { id: "marketing", label: "Marketing" },
  { id: "engineering", label: "Kỹ thuật" },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function matchBadge(score: number) {
  if (score >= 85) return { label: "Rất phù hợp", cls: "bg-emerald-50 text-emerald-600 border-emerald-100" };
  if (score >= 70) return { label: "Phù hợp", cls: "bg-blue-50 text-blue-600 border-blue-100" };
  return { label: "Khá phù hợp", cls: "bg-amber-50 text-amber-600 border-amber-100" };
}

// ── JobCard ───────────────────────────────────────────────────────────────────

function JobCard({ job, index }: { job: typeof MOCK_JOBS[0]; index: number }) {
  const badge = matchBadge(job.matchScore);
  const [imgError, setImgError] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: index * 0.07 }}
      className="backdrop-blur-[40px] bg-white/20 border-[1.5px] border-white/60 shadow-[inset_0_2px_4px_rgba(255,255,255,0.8),inset_0_-1px_2px_rgba(255,255,255,0.3),0_12px_40px_rgba(31,38,135,0.1)] rounded-[2.5rem] p-5 flex flex-col gap-4 hover:shadow-lg hover:border-white/80 transition-all duration-300 relative overflow-hidden"
    >
      <div className="absolute inset-0 bg-gradient-to-br from-white/30 via-transparent to-white/10 pointer-events-none" />
      <div className="relative z-10 flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl overflow-hidden bg-gray-50 border border-gray-100 flex items-center justify-center shrink-0">
            {imgError ? (
              <span className="text-gray-500 font-bold text-sm">{job.company[0]}</span>
            ) : (
              <Image src={job.logo} alt={job.company} width={40} height={40} className="object-contain p-1" unoptimized onError={() => setImgError(true)} />
            )}
          </div>
          <div className="min-w-0">
            <p className="text-[12px] text-gray-500 font-medium truncate">{job.company}</p>
          </div>
        </div>
        {/* Match badge */}
        <div className="shrink-0 flex flex-col items-end gap-1">
          <span className={`text-[11px] font-bold px-2 py-0.5 rounded border ${badge.cls}`}>{badge.label}</span>
          <span className={`text-[13px] font-black ${job.matchScore >= 85 ? "text-emerald-600" : job.matchScore >= 70 ? "text-blue-600" : "text-amber-600"}`}>{job.matchScore}%</span>
        </div>
      </div>

      {/* Match bar */}
      <div className="h-1 bg-gray-100 rounded-full overflow-hidden -mt-1">
        <motion.div
          initial={{ width: 0 }}
          whileInView={{ width: `${job.matchScore}%` }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, delay: index * 0.07 + 0.2 }}
          className={`h-full rounded-full ${job.matchScore >= 85 ? "bg-emerald-500" : job.matchScore >= 70 ? "bg-blue-500" : "bg-amber-500"}`}
        />
      </div>

      {/* Job title & details */}
      <div>
        <h3 className="font-semibold text-gray-900 text-[15px] mb-2">{job.title}</h3>
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-1.5 text-[12px] text-gray-500">
            <MapPin className="w-3.5 h-3.5 shrink-0" /> {job.location}
          </div>
          <div className="flex items-center gap-1.5 text-[12px] text-gray-500">
            <DollarSign className="w-3.5 h-3.5 shrink-0" /> {job.salary}
          </div>
        </div>
      </div>

      {/* Tags */}
      <div className="flex flex-wrap gap-1.5">
        {job.tags.map(tag => (
          <span key={tag} className="text-[11px] font-semibold px-2 py-0.5 bg-blue-50 text-blue-600 border border-blue-100 rounded">
            {tag}
          </span>
        ))}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-1 border-t border-gray-50">
        <span className="flex items-center gap-1 text-[11px] text-gray-400">
          <Clock className="w-3 h-3" /> {job.posted}
        </span>
        <a href="#" className="flex items-center gap-1 text-[12px] font-semibold text-blue-600 hover:text-blue-700 transition">
          Xem chi tiết <ExternalLink className="w-3.5 h-3.5" />
        </a>
      </div>
    </motion.div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function JobMatchingPage() {
  const [search, setSearch] = useState("");
  const [industry, setIndustry] = useState("all");

  const filtered = MOCK_JOBS
    .filter(j => {
      const q = search.toLowerCase();
      return (j.title.toLowerCase().includes(q) || j.company.toLowerCase().includes(q)) &&
        (industry === "all" || j.industry === industry);
    })
    .sort((a, b) => b.matchScore - a.matchScore);

  const topScore = Math.max(...MOCK_JOBS.map(j => j.matchScore));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2 mb-1">
          <Briefcase className="w-6 h-6 text-blue-500" /> Việc Làm Phù Hợp
        </h1>
        <p className="text-gray-500 text-[13.5px]">
          Dựa trên CV của bạn, chúng tôi tìm thấy <strong className="text-gray-700">{MOCK_JOBS.length} vị trí</strong> phù hợp
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Độ phù hợp cao nhất", value: `${topScore}%`, icon: "🎯" },
          { label: "Vị trí phù hợp", value: MOCK_JOBS.length, icon: "💼" },
          { label: "Ứng tuyển mới hôm nay", value: 3, icon: "🔔" },
        ].map((s, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}
            className="backdrop-blur-[40px] bg-white/20 border-[1.5px] border-white/60 shadow-[inset_0_2px_4px_rgba(255,255,255,0.8),inset_0_-1px_2px_rgba(255,255,255,0.3),0_12px_40px_rgba(31,38,135,0.1)] rounded-[2.5rem] p-4 flex items-center gap-3">
            <span className="text-2xl">{s.icon}</span>
            <div>
              <div className="text-xl font-black text-gray-900">{s.value}</div>
              <div className="text-[11px] text-gray-500 font-medium">{s.label}</div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Tìm kiếm tên công việc hoặc công ty..."
            className="w-full pl-9 pr-4 py-2.5 text-[13px] bg-white border border-gray-200 rounded-xl focus:outline-none focus:border-blue-400 transition" />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <SlidersHorizontal className="w-4 h-4 text-gray-400" />
          {INDUSTRIES.map(ind => (
            <button key={ind.id} onClick={() => setIndustry(ind.id)}
              className={`px-3 py-1.5 rounded-lg text-[12px] font-semibold transition ${industry === ind.id ? "bg-blue-500 text-white shadow-sm" : "bg-white border border-gray-200 text-gray-600 hover:border-blue-300"}`}>
              {ind.label}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="backdrop-blur-[40px] bg-white/20 border-[1.5px] border-white/60 shadow-[inset_0_2px_4px_rgba(255,255,255,0.8),inset_0_-1px_2px_rgba(255,255,255,0.3),0_12px_40px_rgba(31,38,135,0.1)] rounded-[2.5rem] py-16 text-center">
          <Briefcase className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 text-sm">Không tìm thấy vị trí phù hợp</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map((job, i) => <JobCard key={job.id} job={job} index={i} />)}
        </div>
      )}
    </div>
  );
}
