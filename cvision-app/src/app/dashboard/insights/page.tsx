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
  "AI/ML": "bg-violet-50 text-violet-600",
  "Frontend": "bg-blue-50 text-blue-600",
  "DevOps": "bg-amber-50 text-amber-600",
  "Data": "bg-emerald-50 text-emerald-600",
  "Backend": "bg-rose-50 text-rose-600",
  "Cloud": "bg-sky-50 text-sky-600",
};

const card = "backdrop-blur-xl bg-white/75 border border-white/60 shadow-sm rounded-2xl";

export default function InsightsPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2 mb-1">
          <TrendingUp className="w-6 h-6 text-blue-500" /> Thị Trường Việc Làm Q2/2025
        </h1>
        <p className="text-gray-500 text-[13.5px]">Cập nhật theo dữ liệu tuyển dụng thực tế tại Việt Nam</p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { icon: TrendingUp, label: "Tăng trưởng IT", value: "+18%", sub: "so với Q1/2025", color: "text-emerald-600" },
          { icon: Users, label: "Vị trí đang mở", value: "2,400+", sub: "trên toàn quốc", color: "text-blue-600" },
          { icon: DollarSign, label: "Mức lương trung bình", value: "25 triệu", sub: "lĩnh vực tech", color: "text-violet-600" },
        ].map((s, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}
            className={`${card} p-5 flex items-center gap-4`}>
            <div className="w-11 h-11 rounded-xl bg-gray-50 flex items-center justify-center shrink-0">
              <s.icon className={`w-5 h-5 ${s.color}`} />
            </div>
            <div>
              <div className={`text-xl font-black ${s.color}`}>{s.value}</div>
              <div className="text-[12px] font-semibold text-gray-700">{s.label}</div>
              <div className="text-[11px] text-gray-400">{s.sub}</div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Row 2 — Skills + Industries */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Top skills */}
        <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }}
          className={`${card} p-6`}>
          <div className="flex items-center gap-2 mb-5">
            <BarChart2 className="w-5 h-5 text-blue-500" />
            <h2 className="font-bold text-gray-800 text-[15px]">Top Skills Đang Hot</h2>
          </div>
          <div className="space-y-3.5">
            {TOP_SKILLS.map((s, i) => (
              <motion.div key={s.skill} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.15 + i * 0.05 }}
                className="flex items-center gap-3">
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 ${CATEGORY_COLORS[s.category] ?? "bg-gray-50 text-gray-600"}`}>
                  {s.category}
                </span>
                <span className="w-28 text-[13px] text-gray-700 font-medium shrink-0 truncate">{s.skill}</span>
                <div className="flex-1 bg-gray-100 rounded-full h-2">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${s.demand}%` }}
                    transition={{ duration: 0.8, delay: 0.2 + i * 0.05 }}
                    className="bg-blue-500 h-2 rounded-full"
                  />
                </div>
                <span className="text-[13px] font-bold text-gray-700 w-6 text-right shrink-0">{s.demand}</span>
                <span className="text-[11px] text-emerald-600 font-semibold w-12 shrink-0">{s.growth}</span>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Industry hiring */}
        <motion.div initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }}
          className={`${card} p-6`}>
          <div className="flex items-center gap-2 mb-5">
            <Users className="w-5 h-5 text-violet-500" />
            <h2 className="font-bold text-gray-800 text-[15px]">Ngành Tuyển Dụng Nhiều Nhất</h2>
          </div>
          <div className="space-y-4">
            {INDUSTRY_HIRING.map((ind, i) => (
              <motion.div key={ind.name} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 + i * 0.06 }}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[13px] text-gray-700 font-medium">{ind.name}</span>
                  <span className="text-[13px] font-black text-gray-800">{ind.pct}%</span>
                </div>
                <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${ind.pct}%` }}
                    transition={{ duration: 0.8, delay: 0.25 + i * 0.06 }}
                    className={`h-full rounded-full ${ind.color}`}
                  />
                </div>
              </motion.div>
            ))}
          </div>

          {/* Legend */}
          <div className="flex flex-wrap gap-2 mt-5 pt-4 border-t border-gray-50">
            {INDUSTRY_HIRING.map(ind => (
              <div key={ind.name} className="flex items-center gap-1.5 text-[11px] text-gray-500">
                <span className={`w-2.5 h-2.5 rounded-full ${ind.color}`} />
                {ind.name.split(" ")[0]}
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Salary distribution */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
        className={`${card} p-6`}>
        <div className="flex items-center gap-2 mb-5">
          <DollarSign className="w-5 h-5 text-amber-500" />
          <h2 className="font-bold text-gray-800 text-[15px]">Phân Bổ Mức Lương Thị Trường</h2>
        </div>
        <div className="space-y-3">
          {SALARY_RANGES.map((s, i) => (
            <motion.div key={s.range} initial={{ opacity: 0, x: -5 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 + i * 0.06 }}
              className="flex items-center gap-4">
              <span className="w-28 text-[13px] text-gray-600 font-medium shrink-0">{s.range}</span>
              <div className="flex-1 bg-gray-100 rounded-full h-3">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${s.pct * 2}%` }}
                  transition={{ duration: 0.8, delay: 0.35 + i * 0.06 }}
                  className="bg-gradient-to-r from-amber-400 to-amber-500 h-3 rounded-full"
                />
              </div>
              <span className="text-[13px] font-bold text-gray-700 w-8 shrink-0">{s.pct}%</span>
            </motion.div>
          ))}
        </div>
        <p className="text-[11px] text-gray-400 mt-4 text-center italic">
          Dữ liệu từ 12,000+ tin tuyển dụng tại Việt Nam · Q2/2025
        </p>
      </motion.div>
    </div>
  );
}
