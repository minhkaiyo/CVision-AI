"use client";

/**
 * Admin login page — two-factor: Firebase auth + admin role check.
 * URL: /admin/login
 * After verifying role="admin" in Firestore, sets a session cookie and redirects to /admin.
 */

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Shield, Eye, EyeOff, Loader2, AlertCircle, Sparkles } from "lucide-react";
import { signInWithEmail, getProfile, onAppAuthStateChange, signOutAppUser } from "@/lib/auth";

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState("");

  // If already logged in as admin, redirect immediately
  useEffect(() => {
    const unsub = onAppAuthStateChange(async (u) => {
      if (u) {
        const profile = await getProfile(u.uid).catch(() => null);
        if (profile?.role === "admin") {
          router.replace("/admin");
          return;
        }
      }
      setChecking(false);
    });
    return unsub;
  }, [router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const { data, error: signInError } = await signInWithEmail(email, password);
      if (signInError || !data?.user) throw signInError ?? new Error("Login failed");

      // Check admin role in Firestore
      const profile = await getProfile(data.user.uid).catch(() => null);

      if (profile?.role !== "admin") {
        // Not admin — sign them out and show error
        await signOutAppUser();
        setError("Tài khoản này không có quyền truy cập Admin.");
        setLoading(false);
        return;
      }

      router.replace("/admin");
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code ?? "";
      if (code === "auth/invalid-credential" || code === "auth/wrong-password" || code === "auth/user-not-found") {
        setError("Email hoặc mật khẩu không đúng.");
      } else if (code === "auth/too-many-requests") {
        setError("Quá nhiều lần thử. Vui lòng đợi vài phút.");
      } else {
        setError("Đăng nhập thất bại. Vui lòng thử lại.");
      }
      setLoading(false);
    }
  };

  if (checking) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a14] flex items-center justify-center p-4">
      {/* Background glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-600/10 rounded-full blur-3xl" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className="relative w-full max-w-md"
      >
        <div
          className="rounded-3xl p-8"
          style={{
            background: "rgba(15,15,25,0.8)",
            backdropFilter: "blur(40px)",
            border: "1px solid rgba(255,255,255,0.08)",
            boxShadow: "0 32px 80px rgba(0,0,0,0.5)",
          }}
        >
          {/* Header */}
          <div className="flex flex-col items-center mb-8">
            <div className="w-14 h-14 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mb-4">
              <Shield className="w-7 h-7 text-blue-400" />
            </div>
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="w-4 h-4 text-blue-400" />
              <span className="text-white/60 text-sm font-medium">CVision</span>
            </div>
            <h1 className="text-2xl font-black text-white">Admin Dashboard</h1>
            <p className="text-white/40 text-sm mt-1">Chỉ dành cho quản trị viên được cấp phép</p>
          </div>

          {/* Error */}
          {error && (
            <div className="mb-5 px-4 py-3 rounded-2xl flex items-start gap-3 text-sm"
              style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)" }}>
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <span className="text-red-300">{error}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-[11px] font-bold text-white/40 uppercase tracking-widest mb-2">
                Email Admin
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="admin@cvision.ai"
                required
                autoComplete="username"
                className="w-full px-4 py-3 text-[14px] text-white rounded-2xl outline-none transition-all placeholder:text-white/20"
                style={{
                  background: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.09)",
                }}
                onFocus={e => (e.target.style.borderColor = "rgba(59,130,246,0.5)")}
                onBlur={e => (e.target.style.borderColor = "rgba(255,255,255,0.09)")}
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-white/40 uppercase tracking-widest mb-2">
                Mật khẩu
              </label>
              <div className="relative">
                <input
                  type={showPass ? "text" : "password"}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  autoComplete="current-password"
                  className="w-full px-4 py-3 pr-12 text-[14px] text-white rounded-2xl outline-none transition-all placeholder:text-white/20"
                  style={{
                    background: "rgba(255,255,255,0.06)",
                    border: "1px solid rgba(255,255,255,0.09)",
                  }}
                  onFocus={e => (e.target.style.borderColor = "rgba(59,130,246,0.5)")}
                  onBlur={e => (e.target.style.borderColor = "rgba(255,255,255,0.09)")}
                />
                <button type="button" onClick={() => setShowPass(v => !v)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-white/25 hover:text-white/60 transition">
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl font-bold text-[14px] mt-2 transition-all hover:opacity-90 disabled:opacity-50"
              style={{ background: "rgba(59,130,246,0.9)", color: "white" }}
            >
              {loading
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Đang xác thực...</>
                : <><Shield className="w-4 h-4" /> Đăng nhập Admin</>
              }
            </button>
          </form>

          <div className="mt-6 pt-5 border-t border-white/5 text-center">
            <a href="/dashboard" className="text-[12px] text-white/30 hover:text-white/60 transition">
              ← Về User Dashboard
            </a>
          </div>
        </div>

        <p className="text-center text-[11px] text-white/20 mt-4">
          Mọi hành động đăng nhập đều được ghi lại và giám sát.
        </p>
      </motion.div>
    </div>
  );
}
