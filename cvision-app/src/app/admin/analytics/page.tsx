// admin/analytics/page.tsx — CVision Admin: Phân tích & Báo cáo (Firebase)
"use client";

import { useEffect, useState } from "react";
import { collection, getDocs, query, orderBy } from "firebase/firestore";
import { getFirestoreDb } from "@/lib/firebase";
import { BarChart2, TrendingUp, Users, FileText, Star, RefreshCw } from "lucide-react";

interface AnalysisDoc {
  id: string;
  user_id?: string;
  created_at?: string;
  ats_score?: number;
  status?: string;
  plan_at_time?: string;
}

interface UserDoc {
  id: string;
  plan?: string;
  created_at?: string;
}

interface DayBucket { date: string; count: number; }

function groupByDay(items: { created_at?: string }[]): DayBucket[] {
  const map: Record<string, number> = {};
  items.forEach(it => {
    if (!it.created_at) return;
    const d = new Date(it.created_at).toLocaleDateString("vi-VN");
    map[d] = (map[d] || 0) + 1;
  });
  return Object.entries(map)
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => {
      // Parse "dd/mm/yyyy" → sortable date
      const parseViDate = (s: string) => {
        const [dd, mm, yyyy] = s.split("/");
        return new Date(`${yyyy}-${mm}-${dd}`).getTime();
      };
      return parseViDate(a.date) - parseViDate(b.date);
    })
    .slice(-14);
}

export default function AnalyticsAdminPage() {
  const [analyses, setAnalyses] = useState<AnalysisDoc[]>([]);
  const [users, setUsers] = useState<UserDoc[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    try {
      const db = getFirestoreDb();
      const [aSnap, uSnap] = await Promise.all([
        getDocs(collection(db, "analyses")),
        getDocs(collection(db, "profiles")),
      ]);
      setAnalyses(aSnap.docs.map(d => {
        const data = d.data();
        if (data.created_at && typeof data.created_at.toDate === "function") {
          data.created_at = data.created_at.toDate().toISOString();
        }
        return { id: d.id, ...data } as AnalysisDoc;
      }));
      setUsers(uSnap.docs.map(d => {
        const data = d.data();
        if (data.created_at && typeof data.created_at.toDate === "function") {
          data.created_at = data.created_at.toDate().toISOString();
        }
        if (data.plan && typeof data.plan === "string") {
          data.plan = data.plan.toUpperCase();
        }
        return { id: d.id, ...data } as UserDoc;
      }));
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, []);

  const premiumCount = users.filter(u => u.plan && u.plan !== "FREE").length;
  const avgScore = analyses.length
    ? Math.round(analyses.reduce((s, a) => s + (a.ats_score || 0), 0) / analyses.length)
    : 0;
  const analysisBuckets = groupByDay(analyses);
  const userBuckets = groupByDay(users);

  const maxAnalysis = Math.max(...analysisBuckets.map(b => b.count), 1);
  const maxUser = Math.max(...userBuckets.map(b => b.count), 1);

  const STATS = [
    { label: "Tổng người dùng", value: users.length, icon: Users, color: "text-blue-500", bg: "bg-blue-50 border-blue-100" },
    { label: "Khách Premium", value: premiumCount, icon: Star, color: "text-amber-500", bg: "bg-amber-50 border-amber-100" },
    { label: "Tổng lượt phân tích", value: analyses.length, icon: FileText, color: "text-emerald-500", bg: "bg-emerald-50 border-emerald-100" },
    { label: "Điểm ATS trung bình", value: `${avgScore}/100`, icon: TrendingUp, color: "text-purple-500", bg: "bg-purple-50 border-purple-100" },
  ];

  const scoreDistribution = [
    { label: "0–40", count: analyses.filter(a => (a.ats_score || 0) < 40).length, color: "bg-red-400" },
    { label: "40–60", count: analyses.filter(a => (a.ats_score || 0) >= 40 && (a.ats_score || 0) < 60).length, color: "bg-yellow-400" },
    { label: "60–75", count: analyses.filter(a => (a.ats_score || 0) >= 60 && (a.ats_score || 0) < 75).length, color: "bg-blue-400" },
    { label: "75–90", count: analyses.filter(a => (a.ats_score || 0) >= 75 && (a.ats_score || 0) < 90).length, color: "bg-emerald-400" },
    { label: "90–100", count: analyses.filter(a => (a.ats_score || 0) >= 90).length, color: "bg-green-500" },
  ];
  const maxDist = Math.max(...scoreDistribution.map(d => d.count), 1);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Phân tích & Báo cáo</h1>
          <p className="text-sm text-gray-500 mt-0.5">Thống kê chi tiết từ Firebase · Dữ liệu thực</p>
        </div>
        <button onClick={fetchData} className="flex items-center gap-2 px-3 py-1.5 text-sm bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition">
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          Làm mới
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {STATS.map(s => (
          <div key={s.label} className={`rounded-2xl border p-5 ${s.bg}`}>
            <div className="flex items-center gap-2 mb-2">
              <s.icon className={`w-4 h-4 ${s.color}`} />
              <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">{s.label}</span>
            </div>
            {loading ? <div className="h-8 w-16 bg-gray-200 animate-pulse rounded" /> :
              <div className="text-2xl font-black text-gray-800">{s.value}</div>
            }
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Analyses over time */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-4">
            <BarChart2 className="w-4 h-4 text-blue-500" />
            <h2 className="font-bold text-gray-800">Lượt phân tích (14 ngày gần nhất)</h2>
          </div>
          {loading ? (
            <div className="h-32 bg-gray-50 animate-pulse rounded-xl" />
          ) : analysisBuckets.length === 0 ? (
            <div className="h-32 flex items-center justify-center text-gray-400 text-sm">Chưa có dữ liệu</div>
          ) : (
            <div className="flex items-end gap-1.5 h-32">
              {analysisBuckets.map(b => (
                <div key={b.date} className="flex-1 flex flex-col items-center gap-1" title={`${b.date}: ${b.count}`}>
                  <div
                    className="w-full bg-blue-400 rounded-t-sm transition-all hover:bg-blue-500"
                    style={{ height: `${(b.count / maxAnalysis) * 100}%`, minHeight: 2 }}
                  />
                  <span className="text-[9px] text-gray-400 rotate-45 origin-left whitespace-nowrap hidden lg:block">
                    {b.date.slice(0, 5)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ATS Score Distribution */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-4 h-4 text-emerald-500" />
            <h2 className="font-bold text-gray-800">Phân phối điểm ATS</h2>
          </div>
          {loading ? (
            <div className="h-32 bg-gray-50 animate-pulse rounded-xl" />
          ) : (
            <div className="space-y-2.5">
              {scoreDistribution.map(d => (
                <div key={d.label} className="flex items-center gap-3">
                  <span className="text-[12px] text-gray-500 w-12 shrink-0">{d.label}</span>
                  <div className="flex-1 bg-gray-100 rounded-full h-2.5">
                    <div
                      className={`h-2.5 rounded-full ${d.color} transition-all`}
                      style={{ width: `${(d.count / maxDist) * 100}%` }}
                    />
                  </div>
                  <span className="text-[12px] text-gray-600 font-semibold w-8 text-right">{d.count}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* User growth */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-4">
            <Users className="w-4 h-4 text-indigo-500" />
            <h2 className="font-bold text-gray-800">Tăng trưởng người dùng (14 ngày)</h2>
          </div>
          {loading ? (
            <div className="h-32 bg-gray-50 animate-pulse rounded-xl" />
          ) : userBuckets.length === 0 ? (
            <div className="h-32 flex items-center justify-center text-gray-400 text-sm">Chưa có dữ liệu</div>
          ) : (
            <div className="flex items-end gap-1.5 h-32">
              {userBuckets.map(b => (
                <div key={b.date} className="flex-1 flex flex-col items-center gap-1" title={`${b.date}: ${b.count} người dùng mới`}>
                  <div
                    className="w-full bg-indigo-400 rounded-t-sm transition-all hover:bg-indigo-500"
                    style={{ height: `${(b.count / maxUser) * 100}%`, minHeight: 2 }}
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Plan distribution */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-4">
            <Star className="w-4 h-4 text-amber-500" />
            <h2 className="font-bold text-gray-800">Phân bố gói dịch vụ</h2>
          </div>
          {loading ? (
            <div className="h-32 bg-gray-50 animate-pulse rounded-xl" />
          ) : (
            <div className="space-y-3">
              {[
                { plan: "FREE", color: "bg-gray-300", textColor: "text-gray-600" },
                { plan: "PRO", color: "bg-blue-400", textColor: "text-blue-600" },
                { plan: "PREMIUM", color: "bg-amber-400", textColor: "text-amber-600" },
                { plan: "ENTERPRISE", color: "bg-purple-500", textColor: "text-purple-600" },
                { plan: "B2B", color: "bg-slate-700", textColor: "text-slate-700" },
              ].map(({ plan, color, textColor }) => {
                const count = users.filter(u => (u.plan || "FREE").toUpperCase() === plan).length;
                const pct = users.length ? Math.round((count / users.length) * 100) : 0;
                return (
                  <div key={plan} className="flex items-center gap-3">
                    <span className={`text-[12px] font-bold w-20 shrink-0 ${textColor}`}>{plan}</span>
                    <div className="flex-1 bg-gray-100 rounded-full h-2.5">
                      <div className={`h-2.5 rounded-full ${color}`} style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-[12px] text-gray-600 font-semibold w-12 text-right">{count} ({pct}%)</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
