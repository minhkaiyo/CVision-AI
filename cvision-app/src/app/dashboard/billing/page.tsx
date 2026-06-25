"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  CheckCircle2, CreditCard, Loader2, Sparkles, X,
  ExternalLink, ShieldCheck, Zap, Crown, Building2, Star,
} from "lucide-react";
import { apiGetSubscription, apiCreatePortalSession } from "@/lib/api";
import { toast } from "@/components/ui/toast";
import { SePayModal } from "@/components/SePayModal";

// ── Plan definitions ──────────────────────────────────────────────────────────

type PlanId = "free" | "pro" | "premium" | "enterprise" | "b2b";

interface PlanDef {
  id: PlanId;
  label: string;
  price: number | null;      // null = contact
  priceYear?: number | null;
  yearDiscount?: string;
  icon: React.ElementType;
  color: string;             // tailwind gradient/text
  badge?: string;
  checkoutKey?: string;      // Stripe price key
  checkoutKeyYear?: string;
  features: { text: string; included: boolean; highlight?: boolean }[];
}

const PLANS: PlanDef[] = [
  {
    id: "free",
    label: "Free",
    price: 0,
    icon: Star,
    color: "text-gray-600",
    features: [
      { text: "1 phân tích CV / ngày", included: true },
      { text: "Chấm điểm ATS + từ khóa", included: true },
      { text: "Báo cáo điểm cơ bản", included: true },
      { text: "Phân tích ATS không giới hạn", included: false },
      { text: "Tạo phiên bản CV tối ưu (AI diff)", included: false },
      { text: "Giả lập HR & Dự đoán xác suất", included: false },
      { text: "Xuất PDF/DOCX chuẩn ATS", included: false },
      { text: "Cover Letter Generator", included: false },
      { text: "Ưu tiên xử lý", included: false },
    ],
  },
  {
    id: "pro",
    label: "Pro",
    price: 49000,
    priceYear: 470000,
    yearDiscount: "Giảm 20%",
    icon: Zap,
    color: "text-blue-600",
    checkoutKey: "pro_monthly",
    checkoutKeyYear: "pro_yearly",
    features: [
      { text: "10 phân tích CV / ngày", included: true },
      { text: "Chấm điểm ATS + từ khóa", included: true },
      { text: "Báo cáo điểm đầy đủ 6 tiêu chí", included: true },
      { text: "Phân tích ATS không giới hạn", included: true, highlight: true },
      { text: "Tạo phiên bản CV tối ưu (AI diff)", included: true, highlight: true },
      { text: "Giả lập HR & Dự đoán xác suất", included: false },
      { text: "Xuất PDF/DOCX chuẩn ATS", included: true },
      { text: "Cover Letter Generator", included: false },
      { text: "Ưu tiên xử lý", included: false },
    ],
  },
  {
    id: "premium",
    label: "Premium",
    price: 99000,
    priceYear: 950000,
    yearDiscount: "Giảm 20%",
    icon: Sparkles,
    color: "text-amber-500",
    badge: "Phổ biến nhất",
    checkoutKey: "premium_monthly",
    checkoutKeyYear: "premium_yearly",
    features: [
      { text: "Phân tích CV không giới hạn", included: true },
      { text: "Chấm điểm ATS + từ khóa", included: true },
      { text: "Báo cáo điểm đầy đủ 6 tiêu chí", included: true },
      { text: "Phân tích ATS không giới hạn", included: true, highlight: true },
      { text: "Tạo phiên bản CV tối ưu (AI diff)", included: true, highlight: true },
      { text: "Giả lập HR & Dự đoán xác suất", included: true, highlight: true },
      { text: "Xuất PDF/DOCX chuẩn ATS", included: true },
      { text: "Cover Letter Generator", included: true, highlight: true },
      { text: "Ưu tiên xử lý", included: false },
    ],
  },
  {
    id: "enterprise",
    label: "Enterprise",
    price: 299000,
    priceYear: 2900000,
    yearDiscount: "Giảm ~19%",
    icon: Crown,
    color: "text-purple-600",
    checkoutKey: "enterprise_monthly",
    checkoutKeyYear: "enterprise_yearly",
    features: [
      { text: "Phân tích CV không giới hạn", included: true },
      { text: "Chấm điểm ATS + từ khóa", included: true },
      { text: "Báo cáo điểm đầy đủ 6 tiêu chí", included: true },
      { text: "Phân tích ATS không giới hạn", included: true },
      { text: "Tạo phiên bản CV tối ưu (AI diff)", included: true },
      { text: "Giả lập HR & Dự đoán xác suất", included: true },
      { text: "Xuất PDF/DOCX chuẩn ATS", included: true },
      { text: "Cover Letter Generator", included: true },
      { text: "Ưu tiên xử lý (SLA 4h)", included: true, highlight: true },
    ],
  },
];

const B2B_FEATURES = [
  "Tất cả tính năng Enterprise",
  "Admin portal quản lý đội nhóm/sinh viên",
  "Tùy chỉnh logo & tên miền riêng",
  "API endpoint tích hợp hệ thống nội bộ",
  "Báo cáo tổng hợp theo tổ chức",
  "Hỗ trợ 24/7 qua Slack/email ưu tiên",
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(price: number) {
  return price.toLocaleString("vi-VN") + "₫";
}

const PLAN_RANK: Record<string, number> = {
  free: 0, pro: 1, premium: 2, enterprise: 3, b2b: 4,
};

function isPaidPlan(plan: string) {
  return PLAN_RANK[plan.toLowerCase()] > 0;
}

function isAtLeast(current: string, target: string) {
  return (PLAN_RANK[current.toLowerCase()] ?? 0) >= (PLAN_RANK[target.toLowerCase()] ?? 0);
}

// ── PlanCard ──────────────────────────────────────────────────────────────────

function PlanCard({
  plan,
  currentPlan,
  onUpgrade,
  upgradingPlan,
}: {
  plan: PlanDef;
  currentPlan: string;
  onUpgrade: (key: string) => void;
  upgradingPlan: string | null;
}) {
  const [yearly, setYearly] = useState(false);
  const isCurrent = currentPlan.toLowerCase() === plan.id;
  const isOwned = isAtLeast(currentPlan, plan.id);
  const isPopular = plan.badge === "Phổ biến nhất";

  const activeKey = yearly ? plan.checkoutKeyYear : plan.checkoutKey;
  const isThisUpgrading = !!activeKey && upgradingPlan === activeKey;

  const borderClass = isCurrent
    ? "border-2 border-blue-400 shadow-blue-100 shadow-lg"
    : isPopular
    ? "border-2 border-amber-300 shadow-amber-100 shadow-md"
    : "border border-gray-100 shadow-sm";

  return (
    <div className={`relative backdrop-blur-[40px] bg-white/20 border-[1.5px] shadow-[inset_0_2px_4px_rgba(255,255,255,0.8),inset_0_-1px_2px_rgba(255,255,255,0.3),0_12px_40px_rgba(31,38,135,0.1)] rounded-[2.5rem] p-6 flex flex-col overflow-hidden ${borderClass}`}>
      <div className="absolute inset-0 bg-gradient-to-br from-white/30 via-transparent to-white/10 pointer-events-none" />
      <div className="relative z-10 flex flex-col h-full">
      {/* Badge */}
      {plan.badge && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-amber-400 text-amber-900 text-[11px] font-black px-3 py-1 rounded-full uppercase tracking-wider whitespace-nowrap">
          {plan.badge}
        </div>
      )}
      {isCurrent && (
        <div className="absolute -top-3 right-4 bg-blue-500 text-white text-[11px] font-black px-3 py-1 rounded-full uppercase tracking-wider">
          Đang dùng
        </div>
      )}

      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <plan.icon className={`w-5 h-5 ${plan.color}`} />
        <h3 className="font-bold text-gray-900 text-[16px]">{plan.label}</h3>
      </div>

      {/* Price */}
      <div className="mb-4">
        {plan.price === null ? (
          <div className="text-2xl font-black text-gray-900">Liên hệ</div>
        ) : plan.price === 0 ? (
          <div className="text-2xl font-black text-gray-900">Miễn phí</div>
        ) : (
          <>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-black text-gray-900">
                {yearly && plan.priceYear ? fmt(plan.priceYear) : fmt(plan.price)}
              </span>
              <span className="text-gray-400 text-sm font-medium">{yearly ? "/năm" : "/tháng"}</span>
            </div>
            {plan.priceYear && (
              <button
                onClick={() => setYearly(v => !v)}
                className={`mt-1.5 text-[11px] font-bold px-2 py-0.5 rounded-full transition ${
                  yearly
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                }`}
              >
                {yearly ? `✓ Gói năm (${plan.yearDiscount})` : `Chuyển gói năm → ${plan.yearDiscount}`}
              </button>
            )}
          </>
        )}
      </div>

      {/* Features */}
      <ul className="space-y-2.5 flex-1 mb-5">
        {plan.features.map((f, i) => (
          <li key={i} className={`flex items-start gap-2 text-[13px] ${f.included ? "text-gray-700" : "text-gray-300 line-through"}`}>
            {f.included
              ? <CheckCircle2 className={`w-4 h-4 shrink-0 mt-0.5 ${f.highlight ? "text-amber-500" : "text-emerald-500"}`} />
              : <X className="w-4 h-4 shrink-0 mt-0.5 text-gray-200" />
            }
            <span className={f.highlight && f.included ? "font-semibold text-gray-800" : ""}>{f.text}</span>
          </li>
        ))}
      </ul>

      {/* CTA */}
      <div className="mt-auto">
        {plan.id === "free" ? (
          <div className="w-full text-center py-2.5 text-sm text-gray-500 bg-white/30 rounded-xl font-medium border border-white/40 shadow-[inset_0_1px_1px_rgba(255,255,255,0.8)]">
            {isCurrent ? "Gói hiện tại" : "Gói mặc định"}
          </div>
        ) : (
          <button
            disabled={isThisUpgrading || isCurrent || isOwned}
            onClick={() => {
              const key = yearly ? plan.checkoutKeyYear : plan.checkoutKey;
              if (key) onUpgrade(key);
            }}
            className={`w-full py-2.5 rounded-xl font-bold text-sm transition flex items-center justify-center gap-2 ${
              isCurrent || isOwned
                ? "bg-gray-100/50 text-gray-400 cursor-not-allowed"
                : "bg-gradient-to-r from-blue-500 to-indigo-600 text-white hover:opacity-90 shadow-[0_4px_15px_rgba(59,130,246,0.4),inset_0_1px_1px_rgba(255,255,255,0.4)]"
            }`}
          >
            {isThisUpgrading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {isCurrent ? "Đang sử dụng" : isOwned ? "Đã bao gồm" : isThisUpgrading ? "Đang xử lý..." : "Nâng cấp"}
          </button>
        )}
      </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

interface SubInfo {
  plan: string;
  status: string;
  provider?: string;
  current_period_end?: string;
}

export default function BillingPage() {
  const [sub, setSub] = useState<SubInfo | null>(null);
  const [loading, setLoading] = useState(true);
  // Track which specific plan key is being upgraded (not a shared boolean)
  const [upgradingPlan, setUpgradingPlan] = useState<string | null>(null);
  const [openingPortal, setOpeningPortal] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [sePayPlan, setSePayPlan] = useState<string | null>(null); // open modal for this plan

  useEffect(() => {
    import("@/lib/auth").then(({ onAppAuthStateChange }) => {
      const unsub = onAppAuthStateChange((u) => {
        if (u) { setUserId(u.uid); setUserEmail(u.email ?? null); }
      });
      return unsub;
    });

    apiGetSubscription()
      .then(setSub)
      .catch(() => setSub({ plan: "free", status: "active" }))
      .finally(() => setLoading(false));
  }, []);

  const handleUpgrade = (planKey: string) => {
    if (!userId) { toast("error", "Vui lòng đăng nhập lại."); return; }
    setSePayPlan(planKey); // open SePay modal
  };

  const handleManage = async () => {
    setOpeningPortal(true);
    try {
      const { portal_url } = await apiCreatePortalSession();
      window.open(portal_url, "_blank");
    } catch (err: unknown) {
      toast("error", err instanceof Error ? err.message : "Không thể mở cổng quản lý");
    } finally {
      setOpeningPortal(false);
    }
  };

  const currentPlan = sub?.plan ?? "free";

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {/* Banner */}
      <div className="relative w-full h-[160px] md:h-[200px] rounded-3xl overflow-hidden shadow-sm">
        <Image src="/banner-career-growth.png" alt="Quản lý Gói dịch vụ" fill className="object-cover" />
        <div className="absolute inset-0 bg-gradient-to-r from-blue-900/80 to-transparent flex flex-col justify-center px-8">
          <h1 className="text-3xl font-bold text-white mb-1 flex items-center gap-2">
            <CreditCard className="w-7 h-7 text-blue-300" /> Quản lý Gói dịch vụ
          </h1>
          <p className="text-blue-100 text-sm max-w-md">
            Chọn gói phù hợp với mục tiêu nghề nghiệp của bạn. Hủy bất kỳ lúc nào.
          </p>
        </div>
      </div>

      {/* Current plan status bar */}
      {isPaidPlan(currentPlan) && (
        <div className="bg-white border border-gray-100 rounded-2xl p-4 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-amber-50 rounded-xl flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-amber-500" />
            </div>
            <div>
              <div className="text-[13px] font-bold text-gray-800">
                Đang dùng gói <span className="capitalize text-blue-600">{currentPlan}</span>
              </div>
              {sub?.current_period_end && (
                <div className="text-[11px] text-gray-400">
                  Gia hạn vào {new Date(sub.current_period_end).toLocaleDateString("vi-VN")}
                </div>
              )}
            </div>
          </div>
          <button
            onClick={handleManage}
            disabled={openingPortal}
            className="flex items-center gap-2 px-4 py-2 text-[13px] font-semibold border border-gray-200 rounded-xl hover:bg-gray-50 transition text-gray-600"
          >
            {openingPortal ? <Loader2 className="w-4 h-4 animate-spin" /> : <ExternalLink className="w-4 h-4" />}
            Quản lý gói cước
          </button>
        </div>
      )}

      {/* Plan cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {PLANS.map(plan => (
          <PlanCard
            key={plan.id}
            plan={plan}
            currentPlan={currentPlan}
            onUpgrade={handleUpgrade}
            upgradingPlan={upgradingPlan}
          />
        ))}
      </div>

      {/* B2B card */}
      <div className="bg-gradient-to-r from-slate-800 to-slate-900 rounded-2xl p-6 md:p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 shadow-lg">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <Building2 className="w-5 h-5 text-blue-400" />
            <h3 className="font-bold text-white text-[17px]">B2B — Dành cho Doanh nghiệp & Trường học</h3>
          </div>
          <p className="text-slate-400 text-sm mb-4">Giải pháp toàn diện cho HR teams, trung tâm nghề nghiệp và đại học.</p>
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
            {B2B_FEATURES.map((f, i) => (
              <li key={i} className="flex items-center gap-2 text-[13px] text-slate-300">
                <CheckCircle2 className="w-4 h-4 text-blue-400 shrink-0" />
                {f}
              </li>
            ))}
          </ul>
        </div>
        <div className="shrink-0 flex flex-col gap-3 w-full md:w-auto">
          <a
            href="mailto:contact@cvision.ai?subject=B2B Plan Inquiry"
            className="flex items-center justify-center gap-2 px-6 py-3 bg-blue-500 hover:bg-blue-400 text-white font-bold rounded-xl transition text-sm whitespace-nowrap"
          >
            Nhận báo giá
          </a>
          <p className="text-[11px] text-slate-500 text-center">Phản hồi trong vòng 24h</p>
        </div>
      </div>

      {/* Payment method note */}
      {!isPaidPlan(currentPlan) && (
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
          <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-gray-400" /> Phương thức thanh toán
          </h3>
          <div className="bg-gray-50 border-2 border-dashed border-gray-200 rounded-2xl p-6 flex flex-col items-center text-center">
            <CreditCard className="w-8 h-8 text-gray-300 mb-3" />
            <p className="text-gray-500 text-sm font-medium">Chưa có phương thức thanh toán.</p>
            <p className="text-xs text-gray-400 mt-1">Nâng cấp để thêm thẻ an toàn qua Stripe.</p>
          </div>
        </div>
      )}

      {/* Premium Human Review — Coming Soon */}
      <div className="border-2 border-dashed border-amber-200 bg-amber-50/30 rounded-2xl p-8 relative overflow-hidden">
        {/* Decoration */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-amber-100/50 rounded-full blur-2xl pointer-events-none" />

        <div className="relative">
          <span className="inline-block text-[11px] font-black px-3 py-1 bg-amber-100 text-amber-700 border border-amber-200 rounded-full uppercase tracking-wider mb-4">
            Sắp Ra Mắt
          </span>

          <h3 className="text-xl font-bold text-gray-900 mb-2 flex items-center gap-2">
            👤 Premium Human Review
          </h3>
          <p className="text-[14px] text-gray-600 mb-5 leading-relaxed">
            Chuyên gia HR thực tế xem xét và chỉnh sửa CV của bạn. Tư vấn 1-1 về định hướng sự nghiệp.
          </p>

          <ul className="space-y-2.5 mb-6">
            {[
              "HR chuyên nghiệp từ 500+ Fortune companies",
              "Phản hồi chi tiết trong 48 giờ",
              "1 buổi video call tư vấn (30 phút)",
              "Cam kết phỏng vấn hoặc hoàn tiền",
            ].map((item, i) => (
              <li key={i} className="flex items-center gap-2.5 text-[13.5px] text-gray-700">
                <span className="text-amber-500 font-bold shrink-0">✓</span> {item}
              </li>
            ))}
          </ul>

          <p className="text-[12px] text-gray-500 mb-4 font-medium">Dự kiến: Q3 2025</p>

          <button disabled className="flex items-center gap-2 px-5 py-2.5 bg-white border border-amber-200 text-amber-600 font-bold text-[13px] rounded-xl opacity-60 cursor-not-allowed">
            🔔 Thông báo tôi khi ra mắt
          </button>
        </div>
      </div>

      <div className="text-center pb-4 flex items-center justify-center gap-4">
        <Link href="/pricing" className="inline-flex items-center gap-1 text-sm font-bold text-blue-600 hover:underline">
          Xem chi tiết bảng giá <ExternalLink className="w-3.5 h-3.5" />
        </Link>
        <span className="text-gray-300">·</span>
        <span className="text-xs text-gray-400 flex items-center gap-1">
          <ShieldCheck className="w-3.5 h-3.5" /> Thanh toán bảo mật qua Chuyển khoản ngân hàng
        </span>
      </div>

      {/* SePay payment modal */}
      {sePayPlan && userId && (
        <SePayModal
          planKey={sePayPlan}
          userId={userId}
          userEmail={userEmail}
          onClose={() => setSePayPlan(null)}
          onSuccess={(plan) => {
            setSePayPlan(null);
            setSub({ plan, status: "active" });
            toast("success", `🎉 Gói ${plan.toUpperCase()} đã được kích hoạt!`);
          }}
        />
      )}
    </div>
  );
}
