"use client";

import { useEffect, useRef, useState } from "react";
import { 
  Camera, Save, Eye, EyeOff, Shield, Bell, Link2, 
  Loader2, Upload, Crown, Activity, CheckCircle2, Lock, Mail, Phone, GraduationCap, Briefcase, User, Map
} from "lucide-react";
import Image from "next/image";
import { toast } from "@/components/ui/toast";
import {
  getProfile,
  onAppAuthStateChange,
  type AppUser,
  updateCurrentUserPassword,
  upsertProfile,
  uploadAvatar,
} from "@/lib/auth";

// ── Glassmorphism Card Wrapper ────────────────────────────────────────────────
function Card({ title, description, icon: Icon, children }: {
  title: string; description?: string; icon: React.ElementType; children: React.ReactNode;
}) {
  return (
    <div className="backdrop-blur-[40px] bg-white/20 border-[1.5px] border-white/60 shadow-[inset_0_2px_4px_rgba(255,255,255,0.8),inset_0_-1px_2px_rgba(255,255,255,0.3),0_12px_40px_rgba(31,38,135,0.1)] rounded-[2.5rem] overflow-hidden relative">
      <div className="absolute inset-0 bg-gradient-to-br from-white/30 via-transparent to-white/10 pointer-events-none" />
      <div className="absolute top-0 right-0 w-40 h-40 bg-blue-400/20 rounded-full blur-[60px] pointer-events-none" />
      <div className="px-6 py-5 border-b border-gray-100/50 flex items-center justify-between z-10 relative">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center shrink-0 border border-blue-100/50 shadow-sm">
            <Icon className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h3 className="font-extrabold text-gray-900 text-[15px]">{title}</h3>
            {description && <p className="text-[12px] text-gray-500 font-medium mt-0.5">{description}</p>}
          </div>
        </div>
      </div>
      <div className="p-6 space-y-5 z-10 relative">{children}</div>
    </div>
  );
}

function Field({ label, icon: Icon, children }: { label: string; icon?: React.ElementType; children: React.ReactNode }) {
  return (
    <div>
      <label className="flex items-center gap-1.5 text-[12px] font-bold text-gray-500 uppercase tracking-wider mb-2">
        {Icon && <Icon className="w-3.5 h-3.5" />}
        {label}
      </label>
      {children}
    </div>
  );
}

const INPUT = "w-full bg-white border border-gray-200 rounded-lg px-3.5 py-2.5 text-[14px] text-gray-800 placeholder:text-gray-400 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all shadow-sm";

export default function ProfilePage() {
  const [user, setUser] = useState<AppUser | null>(null);
  const [profile, setProfile] = useState({ full_name: "", email: "", phone: "", school: "", major: "" });
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [saving, setSaving] = useState(false);

  // Password change
  const [currentPwd, setCurrentPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [savingPwd, setSavingPwd] = useState(false);

  // Notifications
  const [notifRenewal, setNotifRenewal] = useState(true);
  const [notifTips, setNotifTips] = useState(false);
  const [notifAnalysis, setNotifAnalysis] = useState(true);
  const [savingNotif, setSavingNotif] = useState(false);

  useEffect(() => {
    const unsub = onAppAuthStateChange(async (u) => {
      setUser(u);
      if (u) {
        const data = await getProfile(u.uid).catch(() => null);
        if (data) {
          setProfile({
            full_name: data.full_name ?? "",
            email: u.email ?? "",
            phone: data.phone ?? "",
            school: data.school ?? "",
            major: data.major ?? "",
          });
          setAvatarUrl(data.avatar_url ?? null);
          const notif = (data as Record<string, unknown>).notification_settings as Record<string, boolean> | undefined;
          if (notif) {
            setNotifRenewal(notif.renewal ?? true);
            setNotifAnalysis(notif.analysis ?? true);
            setNotifTips(notif.tips ?? false);
          }
        } else {
          setProfile(p => ({ ...p, email: u.email ?? "" }));
        }
      }
    });
    return unsub;
  }, []);

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    if (!file.type.startsWith("image/")) { toast("error", "Chỉ chấp nhận file ảnh."); return; }
    if (file.size > 5 * 1024 * 1024) { toast("error", "Ảnh không được vượt quá 5MB."); return; }
    
    const reader = new FileReader();
    reader.onload = (ev) => setAvatarPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
    
    setUploadingAvatar(true);
    setUploadProgress(0);
    try {
      const url = await uploadAvatar(user.uid, file, (pct) => setUploadProgress(pct));
      setAvatarUrl(url);
      setAvatarPreview(null);
      toast("success", "Đã cập nhật ảnh đại diện!");
    } catch {
      setAvatarPreview(null);
      toast("error", "Upload ảnh thất bại. Thử lại sau.");
    } finally {
      setUploadingAvatar(false);
      if (avatarInputRef.current) avatarInputRef.current.value = "";
    }
  };

  const saveProfile = async () => {
    if (!user) return;
    setSaving(true);
    try {
      await upsertProfile(user.uid, {
        full_name: profile.full_name,
        email: profile.email,
        phone: profile.phone,
        school: profile.school,
        major: profile.major,
      });
      toast("success", "Đã lưu thông tin cá nhân!");
    } catch {
      toast("error", "Lưu thất bại. Thử lại sau.");
    } finally {
      setSaving(false);
    }
  };

  const saveNotifications = async (renewal: boolean, analysis: boolean, tips: boolean) => {
    if (!user) return;
    setSavingNotif(true);
    try {
      await upsertProfile(user.uid, {
        notification_settings: { renewal, analysis, tips },
      } as Parameters<typeof upsertProfile>[1] & { notification_settings: Record<string, boolean> });
    } catch {
      toast("error", "Lưu cài đặt thông báo thất bại.");
    } finally {
      setSavingNotif(false);
    }
  };

  const changePassword = async () => {
    if (!user || !user.email) return;
    if (newPwd.length < 6) { toast("warning", "Mật khẩu mới phải có ít nhất 6 ký tự."); return; }
    if (newPwd !== confirmPwd) { toast("warning", "Mật khẩu xác nhận không khớp."); return; }
    setSavingPwd(true);
    try {
      await updateCurrentUserPassword(newPwd);
      toast("success", "Đã đổi mật khẩu thành công!");
      setCurrentPwd(""); setNewPwd(""); setConfirmPwd("");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Lỗi không xác định";
      toast("error", msg.includes("wrong-password") ? "Mật khẩu hiện tại không đúng." : "Đổi mật khẩu thất bại.");
    } finally {
      setSavingPwd(false);
    }
  };

  return (
    <div className="max-w-[1000px] mx-auto font-sans pb-10">
      <div className="mb-8">
        <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">Hồ sơ cá nhân</h1>
        <p className="text-gray-500 text-[14px] font-medium mt-1">Quản lý thông tin tài khoản, cài đặt bảo mật và thông báo.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* ── Left Column: Profile Summary ──────────────────────────────────────── */}
        <div className="lg:col-span-4 space-y-6 lg:sticky lg:top-6">
          <div className="backdrop-blur-[40px] bg-white/20 border-[1.5px] border-white/60 shadow-[inset_0_2px_4px_rgba(255,255,255,0.8),inset_0_-1px_2px_rgba(255,255,255,0.3),0_12px_40px_rgba(31,38,135,0.1)] rounded-[2.5rem] overflow-hidden relative flex flex-col items-center text-center p-8">
            <div className="absolute inset-0 bg-gradient-to-br from-white/30 via-transparent to-white/10 pointer-events-none" />
            <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-br from-blue-400/20 to-indigo-400/20 blur-[40px]" />
            
            {/* Avatar block */}
            <div className="relative mt-4 mb-4 z-10 group">
              <div className="w-24 h-24 rounded-full overflow-hidden shadow-lg border-4 border-white bg-gradient-to-br from-blue-500 to-indigo-600">
                {(avatarPreview || avatarUrl) ? (
                  <Image
                    src={avatarPreview ?? avatarUrl!}
                    alt="Avatar"
                    width={96}
                    height={96}
                    className="w-full h-full object-cover"
                    unoptimized
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-3xl font-extrabold text-white">
                    {profile.full_name ? profile.full_name.charAt(0).toUpperCase() : "U"}
                  </div>
                )}
              </div>
              <button
                onClick={() => avatarInputRef.current?.click()}
                disabled={uploadingAvatar}
                className="absolute bottom-0 right-0 w-8 h-8 bg-gray-900 hover:bg-black text-white rounded-full flex items-center justify-center shadow-md transition-all scale-100 hover:scale-110 disabled:opacity-50 z-20"
                title="Đổi ảnh đại diện"
              >
                {uploadingAvatar ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
              </button>
              <input
                ref={avatarInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange}
              />
              {uploadingAvatar && (
                <div className="absolute inset-0 m-1 rounded-full flex items-center justify-center bg-black/50 z-10">
                  <span className="text-white text-[12px] font-bold">{uploadProgress}%</span>
                </div>
              )}
            </div>

            {/* Basic Identity */}
            <div className="z-10 w-full mb-6">
              <h2 className="font-extrabold text-gray-900 text-lg">{profile.full_name || "Chưa cập nhật tên"}</h2>
              <p className="text-gray-500 text-[13px] font-medium">{profile.email}</p>
            </div>

            {/* Stats & Badges grid */}
            <div className="grid grid-cols-2 gap-3 w-full z-10 border-t border-gray-100/50 pt-6">
              <div className="bg-blue-50/50 p-3 rounded-xl border border-blue-100/50 flex flex-col items-center">
                <Crown className="w-5 h-5 text-amber-500 mb-1" />
                <span className="text-[11px] font-bold text-gray-500 uppercase">Gói cước</span>
                <span className="text-[14px] font-extrabold text-gray-900 mt-0.5">Tiêu chuẩn</span>
              </div>
              <div className="bg-emerald-50/50 p-3 rounded-xl border border-emerald-100/50 flex flex-col items-center">
                <Activity className="w-5 h-5 text-emerald-500 mb-1" />
                <span className="text-[11px] font-bold text-gray-500 uppercase">Phân tích</span>
                <span className="text-[14px] font-extrabold text-gray-900 mt-0.5">12 / 50</span>
              </div>
            </div>

            {/* Status indicators */}
            <div className="w-full mt-6 space-y-3 z-10 text-left">
              <div className="flex items-center justify-between text-[13px]">
                <span className="text-gray-500 font-medium flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-500" /> Trạng thái</span>
                <span className="font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md">Hoạt động</span>
              </div>
              <div className="flex items-center justify-between text-[13px]">
                <span className="text-gray-500 font-medium flex items-center gap-2"><Lock className="w-4 h-4 text-blue-500" /> Bảo mật</span>
                <span className="font-bold text-gray-700">Mật khẩu</span>
              </div>
            </div>
          </div>
        </div>

        {/* ── Right Column: Forms ──────────────────────────────────────────────── */}
        <div className="lg:col-span-8 space-y-6">
          
          {/* Profile Edit */}
          <Card title="Chỉnh sửa thông tin" description="Cập nhật chi tiết cá nhân của bạn." icon={User}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="md:col-span-2">
                <Field label="Họ và tên" icon={User}>
                  <input value={profile.full_name} onChange={e => setProfile(p => ({ ...p, full_name: e.target.value }))}
                    placeholder="Nguyễn Văn A" className={INPUT} />
                </Field>
              </div>
              <div className="md:col-span-2">
                <Field label="Email" icon={Mail}>
                  <input value={profile.email} disabled className={INPUT + " bg-gray-50 text-gray-500 cursor-not-allowed shadow-none border-gray-100"} />
                </Field>
              </div>
              <Field label="Số điện thoại" icon={Phone}>
                <input value={profile.phone} onChange={e => setProfile(p => ({ ...p, phone: e.target.value }))}
                  placeholder="0912 345 678" className={INPUT} />
              </Field>
              <Field label="Trường đại học" icon={GraduationCap}>
                <input value={profile.school} onChange={e => setProfile(p => ({ ...p, school: e.target.value }))}
                  placeholder="HUST, NEU..." className={INPUT} />
              </Field>
              <div className="md:col-span-2">
                <Field label="Ngành học" icon={Briefcase}>
                  <input value={profile.major} onChange={e => setProfile(p => ({ ...p, major: e.target.value }))}
                    placeholder="Công nghệ thông tin, Tài chính..." className={INPUT} />
                </Field>
              </div>
            </div>
            <div className="flex justify-end pt-4 mt-2 border-t border-gray-100/50">
              <button onClick={saveProfile} disabled={saving}
                className="flex items-center gap-2 bg-blue-600 text-white px-6 py-2.5 rounded-xl text-[14px] font-bold hover:bg-blue-700 hover:shadow-lg hover:-translate-y-0.5 transition-all disabled:opacity-50">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Lưu thông tin
              </button>
            </div>
          </Card>

          {/* Password */}
          <Card title="Mật khẩu & Đăng nhập" description="Đổi mật khẩu định kỳ để bảo vệ tài khoản." icon={Shield}>
            <div className="space-y-5">
              <Field label="Mật khẩu hiện tại" icon={Lock}>
                <div className="relative">
                  <input type={showPwd ? "text" : "password"} value={currentPwd}
                    onChange={e => setCurrentPwd(e.target.value)} placeholder="••••••••" className={INPUT + " pr-10"} />
                  <button onClick={() => setShowPwd(s => !s)} type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1">
                    {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </Field>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <Field label="Mật khẩu mới">
                  <input type="password" value={newPwd} onChange={e => setNewPwd(e.target.value)}
                    placeholder="Tối thiểu 6 ký tự" className={INPUT} />
                </Field>
                <Field label="Xác nhận mật khẩu mới">
                  <input type="password" value={confirmPwd} onChange={e => setConfirmPwd(e.target.value)}
                    placeholder="Nhập lại mật khẩu mới" className={INPUT} />
                </Field>
              </div>
            </div>
            <div className="flex justify-end pt-4 mt-2 border-t border-gray-100/50">
              <button onClick={changePassword} disabled={savingPwd}
                className="flex items-center gap-2 bg-gray-900 text-white px-6 py-2.5 rounded-xl text-[14px] font-bold hover:bg-gray-800 hover:shadow-lg hover:-translate-y-0.5 transition-all disabled:opacity-50">
                {savingPwd ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
                Cập nhật mật khẩu
              </button>
            </div>
          </Card>

          {/* Notifications */}
          <Card title="Tuỳ chọn thông báo" description="Quản lý cách chúng tôi liên lạc với bạn qua email." icon={Bell}>
            <div className="space-y-1">
              {[
                { label: "Gia hạn & Thanh toán", desc: "Nhận thông báo 7 ngày trước khi subscription hết hạn", val: notifRenewal, set: (v: boolean) => { setNotifRenewal(v); saveNotifications(v, notifAnalysis, notifTips); } },
                { label: "Kết quả phân tích CV", desc: "Nhận email ngay khi AI hoàn thành phân tích", val: notifAnalysis, set: (v: boolean) => { setNotifAnalysis(v); saveNotifications(notifRenewal, v, notifTips); } },
                { label: "Mẹo tìm việc & Xu hướng", desc: "Bản tin hàng tuần giúp tối ưu CV và phỏng vấn", val: notifTips, set: (v: boolean) => { setNotifTips(v); saveNotifications(notifRenewal, notifAnalysis, v); } },
              ].map((item, idx) => (
                <div key={item.label} className={`flex items-center justify-between py-4 ${idx !== 2 ? "border-b border-gray-100/50" : ""}`}>
                  <div className="pr-4">
                    <div className="text-[14px] font-bold text-gray-900">{item.label}</div>
                    <div className="text-[13px] text-gray-500 font-medium mt-0.5">{item.desc}</div>
                  </div>
                  <button onClick={() => item.set(!item.val)}
                    className={`w-12 h-6.5 rounded-full transition-colors relative shrink-0 focus:outline-none shadow-inner ${item.val ? "bg-emerald-500" : "bg-gray-200"}`}>
                    <div className={`absolute top-0.5 bottom-0.5 w-5.5 bg-white rounded-full shadow-sm transition-all duration-300 ease-out ${item.val ? "left-[22px] right-1" : "left-0.5 right-[22px]"}`} />
                  </button>
                </div>
              ))}
            </div>
          </Card>

          {/* Social connections */}
          <Card title="Kết nối bên ngoài" description="Đồng bộ hóa dữ liệu từ các nền tảng nghề nghiệp." icon={Link2}>
            <Field label="LinkedIn Profile URL">
              <div className="flex flex-col sm:flex-row gap-3">
                <input placeholder="https://linkedin.com/in/your-profile" className={INPUT} />
                <button onClick={() => toast("warning", "Tính năng đang phát triển.")}
                  className="flex items-center justify-center gap-2 bg-white border border-gray-200 text-gray-700 px-6 py-2.5 rounded-xl text-[14px] font-bold hover:bg-gray-50 hover:border-gray-300 transition-all shrink-0 shadow-sm">
                  <Link2 className="w-4 h-4" /> Kết nối
                </button>
              </div>
            </Field>
            <p className="text-[12.5px] text-gray-500 font-medium mt-3 bg-blue-50/50 p-3 rounded-lg border border-blue-100/50 inline-block">
              <span className="font-bold text-blue-600">Sắp ra mắt:</span> Kết nối LinkedIn để tự động trích xuất lịch sử làm việc vào CV.
            </p>
          </Card>

          {/* Career Roadmap */}
          <Card title="Lộ Trình Phát Triển" icon={Map}>
            <p className="text-[13px] text-gray-500 mb-5">Kế hoạch phát triển sự nghiệp được AI cá nhân hóa cho bạn.</p>
            <div className="space-y-0">
              {[
                { month: "Tháng 1–2", title: "Nắm vững TypeScript nâng cao + System Design", done: true, current: false },
                { month: "Tháng 3–4", title: "Học Next.js 15 + Triển khai production app", done: true, current: false },
                { month: "Tháng 5–6", title: "Deep dive vào AI/LLM integration", done: false, current: true },
                { month: "Tháng 7–8", title: "Cloud Architecture (AWS/GCP) + DevOps basics", done: false, current: false },
                { month: "Tháng 9–12", title: "Senior-level project + Open source contribution", done: false, current: false },
              ].map((item, i, arr) => (
                <div key={i} className="flex gap-4">
                  {/* Timeline line + dot */}
                  <div className="flex flex-col items-center">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-[13px] font-bold border-2 transition-all ${
                      item.done ? "bg-emerald-500 border-emerald-500 text-white" :
                      item.current ? "bg-blue-500 border-blue-500 text-white shadow-md shadow-blue-200" :
                      "bg-white border-gray-200 text-gray-400"
                    }`}>
                      {item.done ? "✓" : item.current ? "●" : "○"}
                    </div>
                    {i < arr.length - 1 && (
                      <div className={`w-0.5 flex-1 my-1 ${item.done ? "bg-emerald-200" : "bg-gray-100"}`} style={{ minHeight: 24 }} />
                    )}
                  </div>
                  {/* Content */}
                  <div className={`pb-5 flex-1 ${item.current ? "bg-blue-50/50 border border-blue-100 rounded-xl p-3 -ml-1 mb-1" : ""}`}>
                    <p className={`text-[11px] font-bold uppercase tracking-wider mb-0.5 ${item.done ? "text-emerald-600" : item.current ? "text-blue-600" : "text-gray-400"}`}>
                      {item.month} {item.current && "· Hiện tại"}
                    </p>
                    <p className={`text-[13.5px] font-semibold ${item.done ? "text-gray-700" : item.current ? "text-blue-900" : "text-gray-400"}`}>
                      {item.title}
                    </p>
                  </div>
                </div>
              ))}
            </div>
            <button disabled className="mt-2 flex items-center gap-2 bg-white border border-gray-200 text-gray-400 px-5 py-2.5 rounded-xl text-[13px] font-semibold cursor-not-allowed opacity-60">
              🔗 Xem khoá học gợi ý
            </button>
          </Card>

        </div>
      </div>
    </div>
  );
}
