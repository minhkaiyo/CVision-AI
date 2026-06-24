// admin/page.tsx — CVision Admin Dashboard (Firebase Firestore)
"use client";

import { useEffect, useState } from "react";
import {
  collection, getDocs, query, orderBy, limit, where, getCountFromServer,
} from "firebase/firestore";
import { getFirestoreDb } from "@/lib/firebase";
import {
  Users, FileText, CreditCard, TrendingUp, Activity,
  Search, RefreshCw, ArrowUpRight, Loader2,
} from "lucide-react";
import Link from "next/link";

interface UserRow {
  id: string;
  email?: string;
  full_name?: string;
  plan?: string;
  created_at?: string;
  role?: string;
}

interface Metrics {
  total_users: number;
  premium_users: number;
  analyses_count: number;
  total_revenue_vnd: number;
}

const PLAN_PRICE: Record<string, number> = {
  PRO: 199000,
  PREMIUM: 399000,
  ENTERPRISE: 999000,
};

export default function AdminPage() {
  const [metrics, setMetrics] = useState<Metrics>({ total_users: 0, premium_users: 0, analyses_count: 0, total_revenue_vnd: 0 });
  const [users, setUsers] = useState<UserRow[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = async () => {
    try {
      const db = getFirestoreDb();

      // Count all users
      const usersSnap = await getDocs(collection(db, "profiles"));
      const allUsers = usersSnap.docs.map(d => ({ id: d.id, ...d.data() } as UserRow));

      // Count premium
      const premiumUsers = allUsers.filter(u => u.plan && u.plan !== "FREE" && u.plan !== "free");

      // Count analyses
      let analysesCount = 0;
      try {
        const aSnap = await getCountFromServer(collection(db, "analyses"));
        analysesCount = aSnap.data().count;
      } catch { analysesCount = 0; }

      // Revenue estimate
      const revenue = premiumUsers.reduce((sum, u) => sum + (PLAN_PRICE[u.plan?.toUpperCase() || ""] || 0), 0);

      setMetrics({
        total_users: allUsers.length,
        premium_users: premiumUsers.length,
        analyses_count: analysesCount,
        total_revenue_vnd: revenue,
      });
      setUsers(allUsers.sort((a, b) => (b.created_at || "").localeCompare(a.created_at || "")));
    } catch (e) {
      console.error("Admin data fetch error:", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleRefresh = () => { setRefreshing(true); fetchData(); };

  const filtered = users.filter(u =>
    (u.email || "").toLowerCase().includes(search.toLowerCase()) ||
    (u.full_name || "").toLowerCase().includes(search.toLowerCase())
  );

  const STAT_CARDS = [
    {
      label: "Tổng người dùng", value: metrics.total_users, sub: "Tất cả tài khoản",
      icon: Users, bg: "bg-blue-50", border: "border-blue-100", iconColor: "text-blue-500",
    },
    {
      label: "Người dùng Premium",
      value: metrics.premium_users,
      sub: `${Math.round((metrics.premium_users / Math.max(metrics.total_users, 1)) * 100)}% tổng số`,
      icon: CreditCard, bg: "bg-amber-50", border: "border-amber-100", iconColor: "text-amber-500",
    },
    {
      label: "Lượt phân tích", value: metrics.analyses_count, sub: "Tổng cộng",
      icon: FileText, bg: "bg-emerald-50", border: "border-emerald-100", iconColor: "text-emerald-500",
    },
    {
      label: "Doanh thu ước tính",
      value: `${(metrics.total_revenue_vnd / 1000).toFixed(0)}K đ`,
      sub: "Dựa trên gói đang dùng",
      icon: TrendingUp, bg: "bg-purple-50", border: "border-purple-100", iconColor: "text-purple-500",
    },
  ];

  const QUICK_ACCESS = [
    { label: "Quản lý người dùng", sub: "Xem và chỉnh sửa tài khoản", href: "/admin/customers", icon: Users },
    { label: "Quản lý subscriptions", sub: "Theo dõi đăng ký dịch vụ", href: "/admin/subscriptions", icon: CreditCard },
    { label: "Xem analytics", sub: "Báo cáo và thống kê chi tiết", href: "/admin/analytics", icon: TrendingUp },
    { label: "Cài đặt hệ thống", sub: "Cấu hình platform", href: "/admin/settings", icon: Activity },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tổng quan hệ thống</h1>
          <p className="text-sm text-gray-500 mt-0.5">CVision AI Platform · Cập nhật thời gian thực từ Firebase</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleRefresh}
            className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
            Làm mới
          </button>
          <span className="text-xs text-emerald-600 bg-emerald-50 border border-emerald-100 px-2.5 py-1 rounded-full font-medium flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Hoạt động ổn định
          </span>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {STAT_CARDS.map((card) => (
          <div key={card.label} className={`rounded-2xl border p-5 ${card.bg} ${card.border}`}>
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">{card.label}</span>
              <div className={`w-8 h-8 rounded-xl bg-white/70 flex items-center justify-center ${card.iconColor}`}>
                <card.icon className="w-4 h-4" />
              </div>
            </div>
            {loading ? (
              <div className="h-8 w-16 bg-gray-200 animate-pulse rounded" />
            ) : (
              <div className="text-2xl font-black text-gray-800">{card.value}</div>
            )}
            <div className="text-[11px] text-gray-400 mt-1">{card.sub}</div>
          </div>
        ))}
      </div>

      {/* Users + Quick Access */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Users */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between p-5 border-b border-gray-50">
            <div>
              <h2 className="font-bold text-gray-800">Người dùng mới nhất</h2>
              <p className="text-[12px] text-gray-400 mt-0.5">Quản lý và cập nhật gói dịch vụ</p>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Tìm người dùng..."
                className="pl-9 pr-4 py-2 text-[13px] bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:border-blue-300 w-48"
              />
            </div>
          </div>

          <div className="divide-y divide-gray-50">
            {loading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4 p-4 animate-pulse">
                  <div className="w-9 h-9 rounded-full bg-gray-200" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 w-32 bg-gray-200 rounded" />
                    <div className="h-2 w-48 bg-gray-100 rounded" />
                  </div>
                  <div className="h-6 w-16 bg-gray-200 rounded-full" />
                </div>
              ))
            ) : filtered.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <Users className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">Không có dữ liệu người dùng</p>
              </div>
            ) : (
              filtered.slice(0, 8).map((u) => (
                <div key={u.id} className="flex items-center gap-4 p-4 hover:bg-gray-50/50 transition">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center text-white text-xs font-bold shrink-0">
                    {(u.full_name || u.email || "U").charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-semibold text-gray-700 truncate">{u.full_name || "—"}</div>
                    <div className="text-[11px] text-gray-400 truncate">{u.email}</div>
                  </div>
                  <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${
                    u.plan && u.plan !== "FREE" ? "bg-amber-50 text-amber-600" : "bg-gray-100 text-gray-500"
                  }`}>
                    {u.plan || "FREE"}
                  </span>
                </div>
              ))
            )}
          </div>

          {filtered.length > 8 && (
            <div className="p-4 border-t border-gray-50 text-center">
              <Link href="/admin/customers" className="text-[13px] text-blue-500 hover:text-blue-600 font-medium flex items-center justify-center gap-1">
                Xem tất cả {filtered.length} người dùng <ArrowUpRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          )}
        </div>

        {/* Quick Access */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h2 className="font-bold text-gray-800 mb-4">Truy cập nhanh</h2>
          <div className="space-y-2">
            {QUICK_ACCESS.map((item) => (
              <Link key={item.href} href={item.href}
                className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 transition group"
              >
                <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center shrink-0 group-hover:bg-blue-100 transition">
                  <item.icon className="w-4 h-4 text-blue-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-semibold text-gray-700">{item.label}</div>
                  <div className="text-[11px] text-gray-400">{item.sub}</div>
                </div>
                <ArrowUpRight className="w-3.5 h-3.5 text-gray-300 group-hover:text-blue-400 transition" />
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
