// admin/customers/page.tsx — CVision Admin: Quản lý người dùng (Firebase)
"use client";

import { useEffect, useState } from "react";
import { collection, getDocs, doc, updateDoc } from "firebase/firestore";
import { getFirestoreDb } from "@/lib/firebase";
import { Users, Search, Shield, ChevronDown, RefreshCw, Mail, Calendar } from "lucide-react";
import { toast } from "@/components/ui/toast";

interface UserRow {
  id: string;
  email?: string;
  full_name?: string;
  plan?: string;
  role?: string;
  created_at?: string;
  phone?: string;
  school?: string;
}

const PLANS = ["FREE", "PRO", "PREMIUM", "ENTERPRISE"];
const PLAN_COLORS: Record<string, string> = {
  FREE: "bg-gray-100 text-gray-600",
  PRO: "bg-blue-100 text-blue-700",
  PREMIUM: "bg-amber-100 text-amber-700",
  ENTERPRISE: "bg-purple-100 text-purple-700",
};

export default function CustomersAdminPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [planFilter, setPlanFilter] = useState("ALL");
  const [updating, setUpdating] = useState<string | null>(null);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const db = getFirestoreDb();
      const snap = await getDocs(collection(db, "profiles"));
      const rows = snap.docs.map(d => ({ id: d.id, ...d.data() } as UserRow));
      setUsers(rows.sort((a, b) => (b.created_at || "").localeCompare(a.created_at || "")));
    } catch (e) {
      console.error(e);
      toast("error", "Không thể tải danh sách người dùng.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchUsers(); }, []);

  const handlePlanChange = async (userId: string, newPlan: string) => {
    setUpdating(userId);
    try {
      const db = getFirestoreDb();
      await updateDoc(doc(db, "profiles", userId), { plan: newPlan });
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, plan: newPlan } : u));
      toast("success", `Đã cập nhật gói thành ${newPlan}.`);
    } catch {
      toast("error", "Cập nhật thất bại.");
    } finally {
      setUpdating(null);
    }
  };

  const filtered = users.filter(u => {
    const matchSearch =
      (u.email || "").toLowerCase().includes(search.toLowerCase()) ||
      (u.full_name || "").toLowerCase().includes(search.toLowerCase());
    const matchPlan = planFilter === "ALL" || (u.plan || "FREE") === planFilter;
    return matchSearch && matchPlan;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Quản lý Người dùng</h1>
          <p className="text-sm text-gray-500 mt-0.5">Xem và cập nhật tài khoản · {users.length} tổng cộng</p>
        </div>
        <button onClick={fetchUsers} className="flex items-center gap-2 px-3 py-1.5 text-sm bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition">
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          Làm mới
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Tìm email hoặc tên..."
            className="pl-9 pr-4 py-2 text-[13px] bg-white border border-gray-200 rounded-xl focus:outline-none focus:border-blue-300 w-64"
          />
        </div>
        <div className="relative">
          <select
            value={planFilter}
            onChange={e => setPlanFilter(e.target.value)}
            className="appearance-none pl-4 pr-8 py-2 text-[13px] bg-white border border-gray-200 rounded-xl focus:outline-none focus:border-blue-300"
          >
            <option value="ALL">Tất cả gói</option>
            {PLANS.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
          <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
        </div>
        <div className="ml-auto text-[13px] text-gray-500 flex items-center gap-1.5">
          <Users className="w-4 h-4" />
          {filtered.length} / {users.length} người dùng
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/70">
                <th className="text-left py-3 px-4 font-semibold text-gray-500 text-[11px] uppercase tracking-wider">Người dùng</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-500 text-[11px] uppercase tracking-wider">Email</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-500 text-[11px] uppercase tracking-wider">Gói</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-500 text-[11px] uppercase tracking-wider">Vai trò</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-500 text-[11px] uppercase tracking-wider">Ngày tạo</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-500 text-[11px] uppercase tracking-wider">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    {Array.from({ length: 6 }).map((_, j) => (
                      <td key={j} className="px-4 py-3.5">
                        <div className="h-4 bg-gray-100 rounded w-24" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-16 text-gray-400">
                  <Users className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p>Không tìm thấy người dùng</p>
                </td></tr>
              ) : (
                filtered.map(u => (
                  <tr key={u.id} className="hover:bg-gray-50/50 transition">
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center text-white text-xs font-bold shrink-0">
                          {(u.full_name || u.email || "U").charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="font-semibold text-gray-700">{u.full_name || "—"}</div>
                          <div className="text-[11px] text-gray-400">{u.id.slice(0, 8)}...</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-1.5 text-gray-600">
                        <Mail className="w-3.5 h-3.5 text-gray-400" />
                        {u.email || "—"}
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${PLAN_COLORS[u.plan?.toUpperCase() || "FREE"] || PLAN_COLORS.FREE}`}>
                        {u.plan || "FREE"}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-1.5 text-gray-500">
                        <Shield className="w-3.5 h-3.5" />
                        {u.role || "user"}
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-gray-500">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-gray-400" />
                        {u.created_at ? new Date(u.created_at).toLocaleDateString("vi-VN") : "—"}
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="relative inline-block">
                        {updating === u.id ? (
                          <span className="text-blue-500 text-xs animate-pulse">Đang lưu...</span>
                        ) : (
                          <select
                            value={u.plan || "FREE"}
                            onChange={e => handlePlanChange(u.id, e.target.value)}
                            className="text-[12px] pl-2 pr-6 py-1 border border-gray-200 rounded-lg bg-white hover:border-blue-300 focus:outline-none focus:border-blue-400 appearance-none cursor-pointer"
                          >
                            {PLANS.map(p => <option key={p} value={p}>{p}</option>)}
                          </select>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
