// admin/subscriptions/page.tsx — CVision Admin: Khách Premium (Firebase)
"use client";

import { useEffect, useState } from "react";
import { collection, getDocs, doc, updateDoc } from "firebase/firestore";
import { getFirestoreDb } from "@/lib/firebase";
import { CreditCard, Star, RefreshCw, Search, TrendingUp, Users } from "lucide-react";
import { toast } from "@/components/ui/toast";

interface SubRow {
  id: string;
  email?: string;
  full_name?: string;
  plan?: string;
  created_at?: string;
  updated_at?: string;
}

const PLAN_PRICE: Record<string, number> = { PRO: 49000, PREMIUM: 99000, ENTERPRISE: 299000, B2B: 0 };
const PLAN_COLORS: Record<string, string> = {
  PRO: "bg-blue-100 text-blue-700 border-blue-200",
  PREMIUM: "bg-amber-100 text-amber-700 border-amber-200",
  ENTERPRISE: "bg-purple-100 text-purple-700 border-purple-200",
  B2B: "bg-slate-800 text-white border-slate-700",
};

export default function SubscriptionsAdminPage() {
  const [subs, setSubs] = useState<SubRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [revoking, setRevoking] = useState<string | null>(null);

  const fetchSubs = async () => {
    setLoading(true);
    try {
      const db = getFirestoreDb();
      const snap = await getDocs(collection(db, "profiles"));
      const all = snap.docs.map(d => {
        const data = d.data();
        if (data.created_at && typeof data.created_at.toDate === "function") {
          data.created_at = data.created_at.toDate().toISOString();
        }
        if (data.updated_at && typeof data.updated_at.toDate === "function") {
          data.updated_at = data.updated_at.toDate().toISOString();
        }
        if (data.plan && typeof data.plan === "string") {
          data.plan = data.plan.toUpperCase();
        }
        return { id: d.id, ...data } as SubRow;
      });
      setSubs(all.filter(u => u.plan && u.plan !== "FREE"));
    } catch { toast("error", "Không thể tải danh sách."); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchSubs(); }, []);

  const handleRevoke = async (userId: string) => {
    if (!confirm("Thu hồi quyền Premium của người dùng này?")) return;
    setRevoking(userId);
    try {
      await updateDoc(doc(getFirestoreDb(), "profiles", userId), { plan: "FREE" });
      setSubs(prev => prev.filter(u => u.id !== userId));
      toast("success", "Đã thu hồi quyền Premium.");
    } catch { toast("error", "Thao tác thất bại."); }
    finally { setRevoking(null); }
  };

  const filtered = subs.filter(u =>
    (u.email || "").toLowerCase().includes(search.toLowerCase()) ||
    (u.full_name || "").toLowerCase().includes(search.toLowerCase())
  );

  const totalRevenue = subs.reduce((s, u) => s + (PLAN_PRICE[u.plan?.toUpperCase() || ""] || 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Khách Premium</h1>
          <p className="text-sm text-gray-500 mt-0.5">Người dùng đang có gói trả phí · {subs.length} tổng</p>
        </div>
        <button onClick={fetchSubs} className="flex items-center gap-2 px-3 py-1.5 text-sm bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition">
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          Làm mới
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Tổng Premium", value: subs.length, icon: Users, color: "text-amber-500", bg: "bg-amber-50 border-amber-100" },
          { label: "Doanh thu ước tính", value: `${(totalRevenue / 1000).toFixed(0)}K đ`, icon: TrendingUp, color: "text-purple-500", bg: "bg-purple-50 border-purple-100" },
      { label: "Gói phổ biến", value: subs.length ? (["PRO","PREMIUM","ENTERPRISE","B2B"].sort((a,b) => subs.filter(s=>s.plan===b).length - subs.filter(s=>s.plan===a).length)[0]) : "—", icon: Star, color: "text-blue-500", bg: "bg-blue-50 border-blue-100" },
        ].map(c => (
          <div key={c.label} className={`rounded-2xl border p-5 ${c.bg}`}>
            <div className="flex items-center gap-3 mb-2">
              <c.icon className={`w-5 h-5 ${c.color}`} />
              <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">{c.label}</span>
            </div>
            <div className="text-2xl font-black text-gray-800">{loading ? "..." : c.value}</div>
          </div>
        ))}
      </div>

      {/* Breakdown by plan */}
      <div className="grid grid-cols-3 gap-4">
        {["PRO", "PREMIUM", "ENTERPRISE", "B2B"].map(plan => {
          const count = subs.filter(s => s.plan?.toUpperCase() === plan).length;
          return (
            <div key={plan} className={`rounded-xl border p-4 ${PLAN_COLORS[plan]}`}>
              <div className="font-bold text-sm">{plan}</div>
              <div className="text-2xl font-black mt-1">{count}</div>
              <div className="text-xs opacity-70">{plan === "B2B" ? "Liên hệ" : `${(PLAN_PRICE[plan]/1000).toFixed(0)}K đ/tháng`}</div>
            </div>
          );
        })}
      </div>

      {/* Search */}
      <div className="relative w-72">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Tìm theo tên hoặc email..."
          className="pl-9 pr-4 py-2 text-[13px] w-full bg-white border border-gray-200 rounded-xl focus:outline-none focus:border-blue-300"
        />
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50/70">
              <th className="text-left py-3 px-4 font-semibold text-gray-500 text-[11px] uppercase tracking-wider">Người dùng</th>
              <th className="text-left py-3 px-4 font-semibold text-gray-500 text-[11px] uppercase tracking-wider">Gói</th>
              <th className="text-left py-3 px-4 font-semibold text-gray-500 text-[11px] uppercase tracking-wider">Giá trị/tháng</th>
              <th className="text-left py-3 px-4 font-semibold text-gray-500 text-[11px] uppercase tracking-wider">Từ ngày</th>
              <th className="text-left py-3 px-4 font-semibold text-gray-500 text-[11px] uppercase tracking-wider">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {loading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <tr key={i} className="animate-pulse">
                  {Array.from({ length: 5 }).map((_, j) => (
                    <td key={j} className="px-4 py-4"><div className="h-4 bg-gray-100 rounded w-20" /></td>
                  ))}
                </tr>
              ))
            ) : filtered.length === 0 ? (
              <tr><td colSpan={5} className="text-center py-12 text-gray-400">
                <CreditCard className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p>Chưa có khách Premium</p>
              </td></tr>
            ) : (
              filtered.map(u => (
                <tr key={u.id} className="hover:bg-gray-50/50 transition">
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-white text-xs font-bold">
                        {(u.full_name || u.email || "U").charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="font-semibold text-gray-700">{u.full_name || "—"}</div>
                        <div className="text-[11px] text-gray-400">{u.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3.5">
                    <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold border ${PLAN_COLORS[u.plan?.toUpperCase() || ""] || ""}`}>
                      {u.plan}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 font-semibold text-gray-700">
                    {((PLAN_PRICE[u.plan?.toUpperCase() || ""] || 0) / 1000).toFixed(0)}K đ
                  </td>
                  <td className="px-4 py-3.5 text-gray-500">
                    {u.created_at ? new Date(u.created_at).toLocaleDateString("vi-VN") : "—"}
                  </td>
                  <td className="px-4 py-3.5">
                    <button
                      onClick={() => handleRevoke(u.id)}
                      disabled={revoking === u.id}
                      className="text-[12px] px-3 py-1.5 text-red-500 bg-red-50 border border-red-100 hover:bg-red-100 rounded-lg transition disabled:opacity-50"
                    >
                      {revoking === u.id ? "Đang xử lý..." : "Thu hồi"}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
