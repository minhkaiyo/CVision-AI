"use client";

import { motion } from "framer-motion";
import { TrendingUp, Users, DollarSign, BarChart2 } from "lucide-react";

const TOP_SKILLS = [
  { skill: "Python", demand: 92, growth: "+18%", category: "AI/ML" },
  { skill: "React / Next.js", demand: 88, growth: "+12%", category: "Frontend" },
  { skill: "Docker & K8s", demand: 82, growth: "+25%", category: "DevOps" },
  { skill: "TypeScript", demand: 79, growth: "+20%", category: "Frontend" },
  { skill: "LLM / Prompt Eng.", demand: 74, growth: "+65%", category: "AI/ML" },
  { skill: "SQL & Analytics", demand: 71, growth: "+8%", category: "Data" },
  { skill: "Spring Boot", demand: 68, growth: "+5%", category: "Backend" },
  { skill: "AWS / GCP", demand: 65, growth: "+15%", category: "Cloud" },
];

const INDUSTRY_HIRING = [
  { name: "Công nghệ thông tin", pct: 38, color: "bg-blue-500" },
  { name: "Tài chính & FinTech", pct: 22, color: "bg-emerald-500" },
  { name: "Thương mại điện tử", pct: 18, color: "bg-violet-500" },
  { name: "Sản xuất & Logistics", pct: 12, color: "bg-amber-500" },
  { name: "Marketing & Truyền thông", pct: 10, color: "bg-rose-500" },
];

const SALARY_RANGES = [
  { range: "< 10 triệu", pct: 15 },
  { range: "10 – 20 triệu", pct: 32 },
  { range: "20 – 35 triệu", pct: 28 },
  { range: "35 – 50 triệu", pct: 16 },
  { range: "> 50 triệu", pct: 9 },
];

const CATEGORY_COLORS: Record<string, string> = {
  "AI/ML": "bg-violet-100 text-violet-700",
  "Frontend": "bg-blue-100 text-blue-700",
  "DevOps": "bg-amber-100 text-amber-700",
  "Data": "bg-emerald-100 text-emerald-700",
  "Backend": "bg-rose-100 text-rose-700",
  "Cloud": "bg-sky-100 text-sky-700",
};

const card = "backdrop-blur-[40px] bg-white/20 border-[1.5px] border-white/60 shadow-[inset_0_2px_4px_rgba(255,255,255,0.8),inset_0_-1px_2px_rgba(255,255,255,0.3),0_12px_40px_rgba(31,38,135,0.1)] rounded-[2.5rem] relative overflow-hidden";
const cardInner = "absolute inset-0 bg-gradient-to-br from-white/30 via-transparent to-white/10 pointer-events-none";

export default function InsightsPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-[26px] font-extrabold text-slate-800 flex items-center gap-3 mb-1 tracking-tight">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center shadow-lg shadow-blue-500/20 text-white border border-white/30 shadow-[inset_0_1px_1px_rgba(255,255,255,0.4)]">
            <TrendingUp className="w-5 h-5" />
          </div>
          Thị Trường Việc Làm Q2/2025
        </h1>
        <p className="text-slate-500 text-[14px] font-medium ml-14">Cập nhật theo dữ liệu tuyển dụng thực tế tại Việt Nam</p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {[
          { icon: TrendingUp, label: "Tăng trưởng IT", value: "+18%", sub: "so với Q1/2025", color: "text-emerald-600", bg: "bg-emerald-100/50", iconBg: "bg-emerald-100" },
          { icon: Users, label: "Vị trí đang mở", value: "2,400+", sub: "trên toàn quốc", color: "text-blue-700", bg: "bg-blue-100/50", iconBg: "bg-blue-100" },
          { icon: DollarSign, label: "Mức lương trung bình", value: "25 triệu", sub: "lĩnh vực tech", color: "text-fuchsia-700", bg: "bg-fuchsia-100/50", iconBg: "bg-fuchsia-100" },
        ].map((s, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}
            className={`${card} p-6 flex flex-col items-center justify-center text-center gap-4 group hover:bg-white/50 transition-all`}>
            <div className={cardInner} />
            
            <div className={`relative z-10 w-14 h-14 rounded-2xl ${s.bg} flex items-center justify-center shrink-0 shadow-[inset_0_1px_2px_rgba(255,255,255,0.8),0_4px_12px_rgba(0,0,0,0.05)] border border-white/60 group-hover:scale-110 transition-transform`}>
              <s.icon className={`w-7 h-7 ${s.color}`} />
            </div>
            
            <div className="relative z-10">
              <div className={`text-[28px] font-black ${s.color} tracking-tight leading-none mb-1 drop-shadow-sm`}>{s.value}</div>
              <div className="text-[13.5px] font-bold text-slate-700">{s.label}</div>
              <div className="text-[11px] text-slate-500 font-medium">{s.sub}</div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Row 2 — Skills + Industries */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Top skills */}
        <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }}
          className={`${card} p-7`}>
          <div className={cardInner} />
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-9 h-9 rounded-xl bg-blue-100/60 border border-white/60 shadow-[inset_0_1px_1px_rgba(255,255,255,0.8)] flex items-center justify-center">
                <BarChart2 className="w-4 h-4 text-blue-600" />
              </div>
              <h2 className="font-extrabold text-slate-800 text-[16px]">Top Skills Đang Hot</h2>
            </div>
            <div className="space-y-4">
              {TOP_SKILLS.map((s, i) => (
                <motion.div key={s.skill} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.15 + i * 0.05 }}
                  className="flex items-center gap-3 group">
                  <span className={`text-[10px] font-bold px-2 py-1 rounded-lg shrink-0 w-16 text-center shadow-sm border border-white/50 ${CATEGORY_COLORS[s.category] ?? "bg-slate-100/60 text-slate-600"}`}>
                    {s.category}
                  </span>
                  <span className="w-32 text-[13.5px] text-slate-800 font-semibold shrink-0 truncate drop-shadow-sm">{s.skill}</span>
                  <div className="flex-1 bg-slate-200/50 border border-black/5 shadow-inner rounded-full h-2.5 overflow-hidden backdrop-blur-sm">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${s.demand}%` }}
                      transition={{ duration: 0.8, delay: 0.2 + i * 0.05 }}
                      className="bg-gradient-to-r from-blue-400 to-indigo-500 h-full rounded-full shadow-[inset_0_1px_1px_rgba(255,255,255,0.4)]"
                    />
                  </div>
                  <span className="text-[13px] font-black text-slate-800 w-6 text-right shrink-0">{s.demand}</span>
                  <span className="text-[11.5px] text-emerald-600 font-bold w-10 shrink-0 text-right drop-shadow-sm">{s.growth}</span>
                </motion.div>
              ))}
            </div>
          </div>
        </motion.div>

        {/* Industry hiring */}
        <motion.div initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }}
          className={`${card} p-7`}>
          <div className={cardInner} />
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-9 h-9 rounded-xl bg-indigo-100/60 border border-white/60 shadow-[inset_0_1px_1px_rgba(255,255,255,0.8)] flex items-center justify-center">
                <Users className="w-4 h-4 text-indigo-700" />
              </div>
              <h2 className="font-extrabold text-slate-800 text-[16px]">Ngành Tuyển Dụng Nhiều Nhất</h2>
            </div>
            <div className="space-y-5">
              {INDUSTRY_HIRING.map((ind, i) => (
                <motion.div key={ind.name} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 + i * 0.06 }}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[14px] text-slate-800 font-semibold drop-shadow-sm">{ind.name}</span>
                    <span className="text-[14px] font-black text-slate-900">{ind.pct}%</span>
                  </div>
                  <div className="h-1.5 bg-slate-200/50 border border-black/5 shadow-inner rounded-full overflow-hidden backdrop-blur-sm">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${ind.pct}%` }}
                      transition={{ duration: 0.8, delay: 0.25 + i * 0.06 }}
                      className={`h-full rounded-full shadow-[inset_0_1px_1px_rgba(255,255,255,0.3)] ${ind.color}`}
                    />
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Legend */}
            <div className="flex flex-wrap gap-3 mt-8 pt-5 border-t border-slate-300/30">
              {INDUSTRY_HIRING.map(ind => (
                <div key={ind.name} className="flex items-center gap-1.5 text-[11.5px] font-bold text-slate-600">
                  <span className={`w-3 h-3 rounded-full ${ind.color} shadow-[inset_0_1px_1px_rgba(255,255,255,0.4),0_2px_4px_rgba(0,0,0,0.1)]`} />
                  {ind.name.split(" ")[0]}
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      </div>

      {/* Salary distribution */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
        className={`${card} p-7`}>
        <div className={cardInner} />
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-9 h-9 rounded-xl bg-amber-100/60 border border-white/60 shadow-[inset_0_1px_1px_rgba(255,255,255,0.8)] flex items-center justify-center">
              <DollarSign className="w-4 h-4 text-amber-700" />
            </div>
            <h2 className="font-extrabold text-slate-800 text-[16px]">Phân Bổ Mức Lương Thị Trường</h2>
          </div>
          <div className="space-y-4">
            {SALARY_RANGES.map((s, i) => (
              <motion.div key={s.range} initial={{ opacity: 0, x: -5 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 + i * 0.06 }}
                className="flex items-center gap-4">
                <span className="w-28 text-[13.5px] text-slate-700 font-bold shrink-0 drop-shadow-sm">{s.range}</span>
                <div className="flex-1 bg-slate-200/50 border border-black/5 rounded-full h-4 overflow-hidden shadow-inner backdrop-blur-sm">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${s.pct * 2}%` }}
                    transition={{ duration: 0.8, delay: 0.35 + i * 0.06 }}
                    className="bg-gradient-to-r from-amber-400 to-orange-500 h-full rounded-full shadow-[inset_0_1px_1px_rgba(255,255,255,0.5),0_2px_8px_rgba(245,158,11,0.3)]"
                  />
                </div>
                <span className="text-[13.5px] font-black text-slate-800 w-8 text-right shrink-0">{s.pct}%</span>
              </motion.div>
            ))}
          </div>
          <p className="text-[11.5px] text-slate-500 mt-6 text-center font-semibold">
            Dữ liệu từ 12,000+ tin tuyển dụng tại Việt Nam · Q2/2025
          </p>
        </div>
      </motion.div>
    </div>
  );
}

