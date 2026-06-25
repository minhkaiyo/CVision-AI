"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ReactNode, useState, useEffect, useRef, useCallback } from "react";
import {
  FileText, LogOut, MessageSquare, Plus, User, Layers, Menu, X,
  ChevronDown, Bell, Search, Sparkles, History, Target, Home,
  ChevronLeft, PenTool, Bookmark, CheckCheck, Info, AlertTriangle, Loader2,
  Briefcase, TrendingUp,
} from "lucide-react";
import Image from "next/image";
import { useAuthGuard } from "@/lib/use-auth-guard";
import { toast } from "@/components/ui/toast";
import { motion, AnimatePresence } from "framer-motion";
import { AIChatWidget } from "@/components/AIChatWidget";
import { getProfile, onAppAuthStateChange, signOutAppUser } from "@/lib/auth";
import {
  getNotifications, markNotificationRead, markAllNotificationsRead,
  type AppNotification,
} from "@/lib/store";
import { AnalysisProvider, useAnalysis } from "@/lib/analysis-context";
import { BackgroundParticles } from "@/components/BackgroundParticles";

// ── Notification helpers ──────────────────────────────────────────────────────

const NOTIF_ICON = {
  info: <Info className="w-4 h-4 text-blue-500" />,
  success: <CheckCheck className="w-4 h-4 text-emerald-500" />,
  warning: <AlertTriangle className="w-4 h-4 text-amber-500" />,
};

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Vừa xong";
  if (mins < 60) return `${mins} phút trước`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} giờ trước`;
  const days = Math.floor(hrs / 24);
  return `${days} ngày trước`;
}

// ── NotificationBell ──────────────────────────────────────────────────────────

function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [notifs, setNotifs] = useState<AppNotification[]>([]);
  const [bannerVisible, setBannerVisible] = useState(false);
  const [bannerNotif, setBannerNotif] = useState<AppNotification | null>(null);
  const bellRef = useRef<HTMLDivElement>(null);
  const unread = notifs.filter(n => !n.read).length;
  const bannerShownRef = useRef(false);

  // Load from localStorage
  const reload = useCallback(() => {
    setNotifs(getNotifications());
  }, []);

  useEffect(() => {
    reload();

    // Listen for real-time pushes from anywhere in the app
    const onNew = (e: Event) => {
      const notif = (e as CustomEvent<AppNotification>).detail;
      reload();
      // Show banner if not already open
      if (!bannerShownRef.current) {
        bannerShownRef.current = true;
        setBannerNotif(notif);
        setBannerVisible(true);
        setTimeout(() => { setBannerVisible(false); bannerShownRef.current = false; }, 5000);
      }
    };
    window.addEventListener("cvision:notification", onNew);
    return () => window.removeEventListener("cvision:notification", onNew);
  }, [reload]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (bellRef.current && !bellRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const markAllRead = () => { markAllNotificationsRead(); reload(); };
  const markRead = (id: string) => { markNotificationRead(id); reload(); };

  return (
    <div className="relative" ref={bellRef}>
      {/* Floating banner — appears then shrinks into bell */}
      <AnimatePresence>
        {bannerVisible && bannerNotif && !open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.95, x: 0 }}
            animate={{ opacity: 1, y: 0, scale: 1, x: 0 }}
            exit={{ opacity: 0, y: -8, scale: 0.8, x: 60 }}
            transition={{ duration: 0.35, ease: "easeOut" }}
            className="absolute right-0 top-12 w-72 bg-white rounded-2xl shadow-xl border border-gray-100 p-4 z-50 cursor-pointer"
            onClick={() => { setBannerVisible(false); setOpen(true); markRead(bannerNotif.id); }}
          >
            <div className="flex items-start gap-3">
              <div className="mt-0.5">{NOTIF_ICON[bannerNotif.type]}</div>
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-bold text-gray-800">{bannerNotif.title}</div>
                <div className="text-[12px] text-gray-500 mt-0.5 leading-snug">{bannerNotif.body}</div>
              </div>
              <button
                onClick={e => { e.stopPropagation(); setBannerVisible(false); }}
                className="text-gray-300 hover:text-gray-500 mt-0.5"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bell button */}
      <button
        onClick={() => { setOpen(v => !v); setBannerVisible(false); }}
        className="relative w-9 h-9 flex items-center justify-center rounded-xl bg-gray-50 border border-gray-200 hover:bg-gray-100 transition text-gray-500"
      >
        <Bell className="w-4 h-4" />
        {unread > 0 && (
          <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-red-400 rounded-full" />
        )}
      </button>

      {/* Dropdown panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 mt-2 w-80 bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden z-50"
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-50">
              <div className="font-bold text-gray-800 text-[14px]">
                Thông báo {unread > 0 && <span className="ml-1 text-[11px] bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded-full font-bold">{unread}</span>}
              </div>
              {unread > 0 && (
                <button onClick={markAllRead} className="text-[11px] text-blue-500 hover:text-blue-700 font-semibold transition">
                  Đánh dấu đã đọc
                </button>
              )}
            </div>

            <div className="max-h-80 overflow-y-auto divide-y divide-gray-50">
              {notifs.length === 0 ? (
                <div className="py-10 text-center text-gray-400 text-sm">Không có thông báo</div>
              ) : (
                notifs.map(n => (
                  <div
                    key={n.id}
                    onClick={() => markRead(n.id)}
                    className={`flex items-start gap-3 px-4 py-3.5 cursor-pointer hover:bg-gray-50 transition ${!n.read ? "bg-blue-50/40" : ""}`}
                  >
                    <div className="mt-0.5 shrink-0">{NOTIF_ICON[n.type]}</div>
                    <div className="flex-1 min-w-0">
                      <div className={`text-[13px] font-semibold ${n.read ? "text-gray-600" : "text-gray-900"}`}>{n.title}</div>
                      <div className="text-[12px] text-gray-500 mt-0.5 leading-snug">{n.body}</div>
                      <div className="text-[11px] text-gray-400 mt-1">{relativeTime(n.createdAt)}</div>
                    </div>
                    {!n.read && <span className="w-2 h-2 bg-blue-500 rounded-full mt-1.5 shrink-0" />}
                  </div>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── UserMenu ──────────────────────────────────────────────────────────────────

function UserMenu() {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const [userName, setUserName] = useState("User");
  const [userPlan, setUserPlan] = useState("FREE");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  useEffect(() => {
    const unsub = onAppAuthStateChange(async (u) => {
      if (u) {
        const profile = await getProfile(u.uid).catch(() => null);
        setUserName(profile?.full_name || u.email?.split("@")[0] || "User");
        setUserPlan(profile?.plan?.toUpperCase() || "FREE");
        setAvatarUrl(profile?.avatar_url ?? null);
      }
    });
    return unsub;
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleLogout = async () => {
    try {
      const { error } = await signOutAppUser();
      if (error) throw error;
      toast("success", "Đã đăng xuất thành công");
      router.push("/login");
    } catch {
      toast("error", "Có lỗi khi đăng xuất. Vui lòng thử lại.");
    }
  };

  // Admin link removed — users should not access /admin
  const MENU_ITEMS = [
    { label: "Chỉnh sửa Profile", icon: User, href: "/dashboard/profile" },
    { label: "Tạo Cover Letter", icon: PenTool, href: "/dashboard/cover-letter" },
    { label: "Lịch sử Phân tích", icon: Bookmark, href: "/dashboard/analyses" },
    { label: "Nâng cấp tài khoản", icon: Sparkles, href: "/dashboard/billing" },
  ];

  const initials = userName.charAt(0).toUpperCase();

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-2 py-1.5 rounded-full hover:bg-gray-100 transition focus:outline-none"
      >
        <div className="w-8 h-8 rounded-full overflow-hidden bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center text-white text-[11px] font-bold shadow-sm shrink-0">
          {avatarUrl
            ? <Image src={avatarUrl} alt={userName} width={32} height={32} className="w-full h-full object-cover" unoptimized />
            : initials
          }
        </div>
        <div className="hidden sm:block text-left mr-1">
          <div className="text-[13px] font-bold text-gray-700 leading-tight">{userName}</div>
        </div>
        <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="absolute right-0 mt-2 w-56 bg-white border border-gray-100 rounded-2xl shadow-xl overflow-hidden z-50 origin-top-right"
          >
            <div className="p-4 border-b border-gray-50 bg-blue-50/30 flex items-center gap-3">
              <div className="w-9 h-9 rounded-full overflow-hidden bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center text-white text-[12px] font-bold shrink-0">
                {avatarUrl
                  ? <Image src={avatarUrl} alt={userName} width={36} height={36} className="w-full h-full object-cover" unoptimized />
                  : initials
                }
              </div>
              <div className="min-w-0">
                <div className="font-bold text-gray-800 text-[14px] truncate">{userName}</div>
                <div className="text-[11px] font-black text-emerald-500 tracking-wider">{userPlan}</div>
              </div>
            </div>
            <div className="py-2">
              {MENU_ITEMS.map((item) => (
                <Link
                  key={item.label}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-3 px-4 py-2.5 text-[13px] text-gray-600 hover:text-blue-600 hover:bg-blue-50/50 transition-colors"
                >
                  <item.icon className="w-4 h-4" />
                  {item.label}
                </Link>
              ))}
              <div className="h-px bg-gray-50 my-1.5" />
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-[13px] text-red-500 hover:bg-red-50 transition-colors"
              >
                <LogOut className="w-4 h-4" />
                Đăng xuất
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Nav config ────────────────────────────────────────────────────────────────

const NAV_MAIN = [
  { href: "/dashboard", label: "Trang Chủ", icon: Home, exact: true },
  { href: "/dashboard/analyses", label: "Lịch Sử Phân Tích", icon: History },
  { href: "/dashboard/cv-versions", label: "Các Bản CV", icon: FileText },
  { href: "/dashboard/upload", label: "Phân Tích Mới", icon: Target },
];

const NAV_TOOLS = [
  { href: "/dashboard/cover-letter", label: "Tạo Cover Letter", icon: MessageSquare },
  { href: "/dashboard/templates", label: "Mẫu CV (Templates)", icon: Layers },
  { href: "/dashboard/job-matching", label: "Việc Làm Phù Hợp", icon: Briefcase },
  { href: "/dashboard/insights", label: "Thị Trường Việc Làm", icon: TrendingUp },
];

const NAV_ACCOUNT = [
  { href: "/dashboard/billing", label: "Nâng Cấp Tài Khoản", icon: Sparkles },
  { href: "/dashboard/profile", label: "Hồ Sơ", icon: User },
];

// ── NavLink ───────────────────────────────────────────────────────────────────

function NavLink({ href, label, icon: Icon, exact, onClick, accent = false }: {
  href: string; label: string; icon: React.ElementType;
  exact?: boolean; onClick?: () => void; accent?: boolean;
}) {
  const pathname = usePathname();
  const active = exact ? pathname === href : pathname.startsWith(href);
  return (
    <Link href={href} onClick={onClick}
      className={`flex items-center gap-3.5 px-4 py-3 text-[14px] rounded-2xl font-semibold transition-all duration-300 group relative overflow-hidden ${
        active 
          ? "text-blue-700 shadow-[0_8px_20px_rgba(59,130,246,0.15)] bg-gradient-to-r from-blue-100/80 to-indigo-100/80 border border-white/60"
          : accent 
            ? "text-indigo-600 hover:bg-white/50 border border-transparent hover:border-white/60"
            : "text-slate-500 hover:bg-white/50 border border-transparent hover:border-white/60 hover:text-slate-800 hover:shadow-sm"
      }`}
    >
      {active && (
        <motion.div layoutId="navIndicator" className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-blue-500 to-indigo-500 rounded-r-full" />
      )}
      <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
        active ? "bg-white text-blue-600 shadow-sm" : "bg-white/50 text-slate-400 group-hover:text-blue-500 group-hover:bg-white"
      }`}>
        <Icon className="w-4 h-4" />
      </div>
      {label}
    </Link>
  );
}

// ── Sidebar ───────────────────────────────────────────────────────────────────

function Sidebar({ onClose }: { onClose?: () => void }) {
  const router = useRouter();
  const [userName, setUserName] = useState("Người dùng");
  const [userEmail, setUserEmail] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  useEffect(() => {
    const unsub = onAppAuthStateChange(async (u) => {
      if (u) {
        const profile = await getProfile(u.uid).catch(() => null);
        setUserName(profile?.full_name || u.displayName || u.email?.split("@")[0] || "Người dùng");
        setUserEmail(u.email || "");
        setAvatarUrl(profile?.avatar_url ?? null);
      }
    });
    return unsub;
  }, []);

  const handleLogout = async () => {
    try {
      const { error } = await signOutAppUser();
      if (error) throw error;
      toast("success", "Đã đăng xuất thành công");
      router.push("/login");
    } catch {
      toast("error", "Có lỗi khi đăng xuất. Vui lòng thử lại.");
    }
  };

  const initials = userName.charAt(0).toUpperCase();

  return (
    <div className="flex flex-col h-full bg-transparent">
      {/* Logo */}
      <div className="h-20 flex items-center justify-between px-6 shrink-0">
        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="flex items-center gap-2 group">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/30 group-hover:scale-105 transition-all">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <span className="font-extrabold text-[20px] bg-clip-text text-transparent bg-gradient-to-r from-blue-700 to-indigo-700 tracking-tight">CVision</span>
          </Link>
        </div>
        {onClose && (
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 md:hidden bg-white/50 p-2 rounded-full backdrop-blur-md">
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Nav */}
      <div className="flex-1 overflow-y-auto py-2 px-4 space-y-1 scrollbar-hide">
        {NAV_MAIN.map(item => <NavLink key={item.href} {...item} onClick={onClose} />)}
        <div className="pt-5">
          <p className="text-[11px] font-black text-indigo-400/70 uppercase tracking-widest px-3 pb-2 mb-1">Công Cụ AI</p>
          {NAV_TOOLS.map(item => <NavLink key={item.href} {...item} onClick={onClose} />)}
        </div>
        <div className="pt-5">
          <p className="text-[11px] font-black text-indigo-400/70 uppercase tracking-widest px-3 pb-2 mb-1">Tài Khoản</p>
          {NAV_ACCOUNT.map(item => <NavLink key={item.href} {...item} onClick={onClose} accent={item.href === "/dashboard/billing"} />)}
        </div>
      </div>

      {/* Bottom user card */}
      <div className="p-4 shrink-0">
        <div className="backdrop-blur-xl bg-white/60 border border-white/80 shadow-sm flex items-center justify-between px-4 py-3 rounded-2xl hover:bg-white/80 transition-all">
          <Link href="/dashboard/profile" className="flex items-center gap-3 min-w-0 flex-1">
            <div className="w-9 h-9 rounded-full overflow-hidden bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center text-white text-xs font-bold shrink-0 shadow-inner">
              {avatarUrl
                ? <Image src={avatarUrl} alt={userName} width={36} height={36} className="w-full h-full object-cover" unoptimized />
                : initials
              }
            </div>
            <div className="min-w-0">
              <div className="text-[13px] font-bold text-gray-800 truncate max-w-[110px]">{userName}</div>
              <div className="text-[11px] text-gray-500 truncate max-w-[110px] font-medium">{userEmail}</div>
            </div>
          </Link>
          <button onClick={handleLogout} title="Đăng xuất" className="text-gray-400 hover:text-red-500 transition shrink-0 bg-white/50 p-2 rounded-xl">
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Background Analysis Indicator ──────────────────────────────────────────
// Shows in topbar when user navigates away during analysis

function BackgroundAnalysisIndicator() {
  const { loading, step, role, file } = useAnalysis();
  const pathname = usePathname();
  const isOnUploadPage = pathname === "/dashboard/upload";

  // Only show when actively loading AND user is NOT on the upload page
  if (!loading || isOnUploadPage) return null;

  const stepLabel: Record<string, string> = {
    uploading: "Đang tải lên...",
    reading: "Đang đọc file...",
    analyzing: "AI đang phân tích...",
    done: "Hoàn tất!",
  };

  return (
    <Link
      href="/dashboard/upload"
      className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-blue-50 border border-blue-200 rounded-xl text-blue-700 text-[13px] font-bold hover:bg-blue-100 transition-all animate-pulse"
      title="Nhấn để quay lại trang phân tích"
    >
      <Loader2 className="w-3.5 h-3.5 animate-spin" />
      <span>{stepLabel[step] ?? "Đang xử lý..."}</span>
      {role && <span className="text-blue-500 font-medium truncate max-w-[100px]">· {role}</span>}
    </Link>
  );
}

// ── Layout ────────────────────────────────────────────────────────────────────

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { loading } = useAuthGuard();

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#f8fafc]">
        <div className="w-8 h-8 border-2 border-blue-200 border-t-blue-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <AnalysisProvider>
      <DashboardShell mobileOpen={mobileOpen} setMobileOpen={setMobileOpen}>
        {children}
      </DashboardShell>
    </AnalysisProvider>
  );
}

function DashboardShell({
  children,
  mobileOpen,
  setMobileOpen,
}: {
  children: ReactNode;
  mobileOpen: boolean;
  setMobileOpen: (v: boolean) => void;
}) {
  return (
    <div className="flex h-screen bg-[#e8effc] font-inter overflow-hidden p-3 md:p-5 gap-5 relative z-0">
      {/* ── Extemely Beautiful Animated Background ── */}
      <BackgroundParticles />
      <div className="absolute inset-0 overflow-hidden pointer-events-none -z-10">
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.04] mix-blend-overlay z-10" />
        
        <motion.div 
          animate={{ x: ["0%", "30%", "-10%", "0%"], y: ["0%", "-20%", "10%", "0%"] }}
          transition={{ duration: 15, ease: "easeInOut", repeat: Infinity }}
          className="absolute -top-[10%] -left-[10%] w-[70%] h-[70%] rounded-full bg-gradient-to-r from-blue-400/60 to-cyan-400/60 blur-[120px] mix-blend-multiply" 
        />
        
        <motion.div 
          animate={{ x: ["0%", "-30%", "20%", "0%"], y: ["0%", "20%", "-20%", "0%"] }}
          transition={{ duration: 20, ease: "easeInOut", repeat: Infinity }}
          className="absolute -bottom-[10%] -right-[10%] w-[80%] h-[80%] rounded-full bg-gradient-to-l from-purple-400/60 to-pink-400/60 blur-[120px] mix-blend-multiply" 
        />
      </div>

      {/* Sidebar Glass Panel */}
      <aside className="hidden md:flex w-[260px] flex-col flex-shrink-0 z-20 backdrop-blur-[40px] bg-white/20 border-[1.5px] border-white/60 shadow-[inset_0_2px_4px_rgba(255,255,255,0.8),inset_0_-1px_2px_rgba(255,255,255,0.3),0_12px_40px_rgba(31,38,135,0.1)] rounded-[2.5rem] overflow-hidden relative">
        <div className="absolute inset-0 bg-gradient-to-br from-white/30 via-transparent to-white/10 pointer-events-none" />
        <div className="relative z-10 flex flex-col h-full"><Sidebar /></div>
      </aside>

      <AnimatePresence>
        {mobileOpen && (
          <div className="fixed inset-0 z-50 md:hidden p-3">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/20 backdrop-blur-md rounded-3xl" onClick={() => setMobileOpen(false)} />
            <motion.aside initial={{ x: "-100%" }} animate={{ x: 0 }} exit={{ x: "-100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="absolute left-3 top-3 bottom-3 w-[260px] z-10 backdrop-blur-[40px] bg-white/20 border-[1.5px] border-white/60 shadow-[inset_0_2px_4px_rgba(255,255,255,0.8),0_12px_40px_rgba(31,38,135,0.15)] rounded-[2.5rem] overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-white/30 via-transparent to-white/10 pointer-events-none" />
              <div className="relative z-10 flex flex-col h-full"><Sidebar onClose={() => setMobileOpen(false)} /></div>
            </motion.aside>
          </div>
        )}
      </AnimatePresence>

      <div className="flex-1 flex flex-col overflow-hidden gap-5 z-10">
        {/* Header Glass Panel */}
        <header className="h-[72px] backdrop-blur-[40px] bg-white/20 border-[1.5px] border-white/60 shadow-[inset_0_2px_4px_rgba(255,255,255,0.8),inset_0_-1px_2px_rgba(255,255,255,0.3),0_12px_40px_rgba(31,38,135,0.08)] rounded-[2rem] flex items-center justify-between px-5 md:px-7 flex-shrink-0 z-30 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-white/30 via-transparent to-white/10 pointer-events-none" />
          
          <div className="relative z-10 flex items-center w-full justify-between">
            <button onClick={() => setMobileOpen(true)}
              className="text-indigo-600/70 hover:text-indigo-800 transition md:hidden bg-white/30 p-2.5 rounded-2xl shadow-[inset_0_1px_1px_rgba(255,255,255,1)] border border-white/50" aria-label="Menu">
              <Menu className="w-5 h-5" />
            </button>

            <div className="hidden md:flex items-center gap-2 px-5 py-2.5 bg-white/30 border-[1.5px] border-white/60 shadow-[inset_0_2px_3px_rgba(0,0,0,0.03),0_4px_12px_rgba(31,38,135,0.05)] rounded-2xl text-sm text-indigo-900/60 w-[340px] cursor-text hover:bg-white/40 transition-all">
              <Search className="w-4 h-4 shrink-0 text-indigo-500/80" />
              <span className="text-[13.5px] font-semibold tracking-wide">Tìm kiếm...</span>
              <span className="ml-auto text-[10px] bg-white/40 border border-white/60 text-indigo-500/80 shadow-sm px-2 py-0.5 rounded-lg font-black uppercase tracking-wider drop-shadow-sm">⌘K</span>
            </div>

            <div className="flex items-center gap-3.5">
              <BackgroundAnalysisIndicator />
              <Link href="/dashboard/upload"
                className="hidden md:flex items-center gap-2 text-[13.5px] font-bold px-6 py-3 bg-gradient-to-tr from-blue-500 via-indigo-500 to-purple-500 text-white rounded-2xl hover:opacity-90 transition-all shadow-[0_6px_25px_rgba(99,102,241,0.5),inset_0_2px_2px_rgba(255,255,255,0.4)]">
                <Plus className="w-4 h-4" /> Phân Tích CV
              </Link>

              <NotificationBell />
              <UserMenu />
            </div>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto rounded-[2.5rem] scrollbar-hide">
          <div className="max-w-[1200px] mx-auto w-full pb-10">
            {children}
          </div>
        </main>
      </div>

      <AIChatWidget />
    </div>
  );
}
