// admin/orders/page.tsx — CVision Admin: Quản lý Giao dịch
"use client";

import { useEffect, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { getFirestoreDb } from "@/lib/firebase";
import { ShoppingCart, RefreshCw, Search, TrendingUp, CheckCircle, Clock } from "lucide-react";

interface OrderRow {
  id: string;
  user_id?: string;
  user_email?: string;
  user_name?: string;
  plan?: string;
  amount?: number;
  status?: string;
  created_at?: string;
}

const PLAN_PRICE: Record<string, number> = { PRO: 199000, PREMIUM: 399000, ENTERPRISE: 999000 };
const STATUS_STYLE: Record<string, string> = {
  completed: "bg-emerald-100 text-emerald-700",
  pending: "bg-yellow-100 text-yellow-700",
  cancelled: "bg-red-100 text-red-700",
};

export default function OrdersAdminPage() {
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const db = getFirestoreDb();
      const snap = await getDocs(collection(db, "profiles"));
      // Generate order-like rows from premium users
      const premiumUsers = snap.docs
        .map(d => ({ id: d.id, ...d.data() } as { id: string; email?: string; full_name?: string; plan?: string; created_at?: string }))
        .filter(u => u.plan && u.plan !== "FREE");

      const rows: OrderRow[] = premiumUsers.map(u => ({
        id: `ORD-${u.id.slice(0, 8).toUpperCase()}`,
        user_id: u.id,
        user_email: u.email,
        user_name: u.full_name,
        plan: u.plan,
        amount: PLAN_PRICE[u.plan?.toUpperCase() || ""] || 0,
        status: "completed",
        created_at: u.created_at,
      }));

      setOrders(rows.sort((a, b) => (b.created_at || "").localeCompare(a.created_at || "")));
    } catch { } finally { setLoading(false); }
  };

  useEffect(() => { fetchOrders(); }, []);

  const filtered = orders.filter(o =>
    (o.user_email || "").toLowerCase().includes(search.toLowerCase()) ||
    (o.user_name || "").toLowerCase().includes(search.toLowerCase()) ||
    (o.id || "").toLowerCase().includes(search.toLowerCase())
  );

  const totalRevenue = orders.reduce((s, o) => s + (o.amount || 0), 0);
  const completedCount = orders.filter(o => o.status === "completed").length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Quản lý Giao dịch</h1>
          <p className="text-sm text-gray-500 mt-0.5">Lịch sử thanh toán và đăng ký · {orders.length} giao dịch</p>
        </div>
        <button onClick={fetchOrders} className="flex items-center gap-2 px-3 py-1.5 text-sm bg-white border border-gray-200 rounded-lg hover:bg-gray-50">
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} /> Làm mới
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-purple-50 border border-purple-100 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-2"><TrendingUp className="w-4 h-4 text-purple-500" /><span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Tổng doanh thu</span></div>
          <div className="text-2xl font-black text-gray-800">{(totalRevenue / 1000).toFixed(0)}K đ</div>
        </div>
        <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-2"><CheckCircle className="w-4 h-4 text-emerald-500" /><span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Hoàn thành</span></div>
          <div className="text-2xl font-black text-gray-800">{completedCount}</div>
        </div>
        <div className="bg-blue-50 border border-blue-100 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-2"><ShoppingCart className="w-4 h-4 text-blue-500" /><span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Tổng giao dịch</span></div>
          <div className="text-2xl font-black text-gray-800">{orders.length}</div>
        </div>
      </div>

      {/* Search */}
      <div className="relative w-72">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Tìm giao dịch..."
          className="pl-9 pr-4 py-2 text-[13px] w-full bg-white border border-gray-200 rounded-xl focus:outline-none focus:border-blue-300" />
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50/70">
              {["Mã GD", "Khách hàng", "Gói", "Số tiền", "Trạng thái", "Ngày"].map(h => (
                <th key={h} className="text-left py-3 px-4 font-semibold text-gray-500 text-[11px] uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {loading ? Array.from({ length: 5 }).map((_, i) => (
              <tr key={i} className="animate-pulse">{Array.from({ length: 6 }).map((_, j) => (
                <td key={j} className="px-4 py-4"><div className="h-4 bg-gray-100 rounded w-20" /></td>
              ))}</tr>
            )) : filtered.length === 0 ? (
              <tr><td colSpan={6} className="text-center py-12 text-gray-400">
                <ShoppingCart className="w-8 h-8 mx-auto mb-2 opacity-30" /><p>Chưa có giao dịch</p>
              </td></tr>
            ) : filtered.map(o => (
              <tr key={o.id} className="hover:bg-gray-50/50 transition">
                <td className="px-4 py-3.5 font-mono text-[12px] text-gray-500">{o.id}</td>
                <td className="px-4 py-3.5">
                  <div className="font-semibold text-gray-700">{o.user_name || "—"}</div>
                  <div className="text-[11px] text-gray-400">{o.user_email}</div>
                </td>
                <td className="px-4 py-3.5">
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-blue-100 text-blue-700">{o.plan}</span>
                </td>
                <td className="px-4 py-3.5 font-semibold text-gray-800">{((o.amount || 0) / 1000).toFixed(0)}K đ</td>
                <td className="px-4 py-3.5">
                  <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${STATUS_STYLE[o.status || "completed"] || STATUS_STYLE.completed}`}>
                    {o.status === "completed" ? "Hoàn thành" : o.status === "pending" ? "Chờ xử lý" : "Đã hủy"}
                  </span>
                </td>
                <td className="px-4 py-3.5 text-gray-500">
                  {o.created_at ? new Date(o.created_at).toLocaleDateString("vi-VN") : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
