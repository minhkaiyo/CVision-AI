"use client";

/**
 * SePayModal — Bank transfer payment modal with QR code and auto-polling.
 *
 * Flow:
 * 1. Generates a unique order code (CVXXX_XXXXXX)
 * 2. Shows VietQR code with pre-filled transfer info
 * 3. Polls /api/v1/payment/check every 5s
 * 4. On paid=true → calls /api/v1/payment/confirm → updates plan
 */

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, Copy, CheckCircle2, Loader2, Clock, RefreshCw, AlertCircle,
} from "lucide-react";
import Image from "next/image";
import { toast } from "@/components/ui/toast";

// ── Bank account info (set your real bank details here) ─────────────────────
// Thay bằng số tài khoản thật của bạn
const BANK_ID = "MB";          // Mã ngân hàng VietQR (MB, VCB, TCB, ACB...)
const ACCOUNT_NO = "0563036120"; // Số tài khoản của bạn
const ACCOUNT_NAME = "PHAM VAN MINH"; // Tên chủ tài khoản

const PLAN_LABELS: Record<string, string> = {
  pro_monthly: "Pro - 1 tháng",
  pro_yearly: "Pro - 1 năm",
  premium_monthly: "Premium - 1 tháng",
  premium_yearly: "Premium - 1 năm",
  enterprise_monthly: "Enterprise - 1 tháng",
  enterprise_yearly: "Enterprise - 1 năm",
};

const PLAN_PRICES: Record<string, number> = {
  pro_monthly: 49000,
  pro_yearly: 470000,
  premium_monthly: 99000,
  premium_yearly: 950000,
  enterprise_monthly: 299000,
  enterprise_yearly: 2900000,
};

function fmt(n: number) {
  return n.toLocaleString("vi-VN") + "đ";
}

function generateOrderCode(): string {
  const rand = Math.floor(Math.random() * 900000) + 100000;
  return `CV${rand}`;
}

// VietQR URL — generates a scannable QR code image
function vietQrUrl(amount: number, content: string): string {
  const encoded = encodeURIComponent(content);
  return `https://img.vietqr.io/image/${BANK_ID}-${ACCOUNT_NO}-compact2.png?amount=${amount}&addInfo=${encoded}&accountName=${encodeURIComponent(ACCOUNT_NAME)}`;
}

interface SePayModalProps {
  planKey: string;
  userId: string;
  userEmail?: string | null;
  onClose: () => void;
  onSuccess: (plan: string) => void;
}

type Status = "waiting" | "checking" | "paid" | "expired" | "error";

const POLL_INTERVAL = 5000;   // 5 seconds
const EXPIRE_SECONDS = 600;   // 10 minutes

export function SePayModal({ planKey, userId, onClose, onSuccess }: SePayModalProps) {
  const orderCode = useRef(generateOrderCode()).current;
  const amount = PLAN_PRICES[planKey] ?? 99000;
  const label = PLAN_LABELS[planKey] ?? planKey;

  const [status, setStatus] = useState<Status>("waiting");
  const [timeLeft, setTimeLeft] = useState(EXPIRE_SECONDS);
  const [copied, setCopied] = useState<string | null>(null);
  const [txInfo, setTxInfo] = useState<{ id: string; date: string; bank: string } | null>(null);

  const qrUrl = vietQrUrl(amount, orderCode);

  // Countdown timer
  useEffect(() => {
    const t = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(t);
          setStatus("expired");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, []);

  // Payment polling
  useEffect(() => {
    if (status !== "waiting") return;

    const poll = setInterval(async () => {
      try {
        setStatus("checking");
        const res = await fetch(
          `/api/v1/payment/check?code=${orderCode}&price=${amount}`
        );
        const data = await res.json();

        if (data.paid) {
          clearInterval(poll);

          // Confirm and update plan in Firestore
          const confirmRes = await fetch("/api/v1/payment/confirm", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              userId,
              plan: planKey,
              orderCode,
              transactionId: data.transaction?.id,
              amount: data.transaction?.amount,
            }),
          });

          if (confirmRes.ok) {
            const confirmData = await confirmRes.json();
            setTxInfo({
              id: data.transaction?.id ?? "",
              date: data.transaction?.date ?? "",
              bank: data.transaction?.bank ?? "",
            });
            setStatus("paid");
            onSuccess(confirmData.plan);
          } else {
            setStatus("error");
          }
        } else {
          setStatus("waiting");
        }
      } catch {
        setStatus("waiting"); // silent retry
      }
    }, POLL_INTERVAL);

    return () => clearInterval(poll);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status === "waiting"]);

  const copy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          onClick={status === "paid" ? onClose : undefined}
        />

        {/* Modal */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 16 }}
          transition={{ duration: 0.25 }}
          className="relative bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
            <div>
              <h2 className="font-bold text-gray-900 text-[16px]">Thanh toán qua Chuyển khoản</h2>
              <p className="text-[12px] text-gray-500 mt-0.5">Gói {label} · {fmt(amount)}</p>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition p-1">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-6">
            {/* SUCCESS */}
            {status === "paid" && (
              <div className="text-center py-6">
                <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle2 className="w-9 h-9 text-emerald-500" />
                </div>
                <h3 className="text-xl font-black text-gray-900 mb-2">Thanh toán thành công! 🎉</h3>
                <p className="text-gray-500 text-sm mb-4">
                  Gói <strong className="text-blue-600 capitalize">{label}</strong> đã được kích hoạt.
                </p>
                {txInfo && (
                  <div className="bg-gray-50 rounded-2xl p-4 text-left text-[12px] text-gray-500 space-y-1 mb-5">
                    <div>Mã GD: <span className="font-mono text-gray-700">{txInfo.id}</span></div>
                    {txInfo.date && <div>Thời gian: {txInfo.date}</div>}
                    {txInfo.bank && <div>Ngân hàng: {txInfo.bank}</div>}
                  </div>
                )}
                <button
                  onClick={onClose}
                  className="w-full bg-blue-500 text-white font-bold py-3 rounded-xl hover:bg-blue-600 transition"
                >
                  Đóng & Bắt đầu sử dụng
                </button>
              </div>
            )}

            {/* EXPIRED */}
            {status === "expired" && (
              <div className="text-center py-6">
                <AlertCircle className="w-12 h-12 text-amber-400 mx-auto mb-3" />
                <h3 className="font-bold text-gray-900 mb-2">Đơn đã hết hạn</h3>
                <p className="text-gray-500 text-sm mb-5">Vui lòng tạo đơn mới để tiếp tục thanh toán.</p>
                <button onClick={onClose}
                  className="w-full border border-gray-200 text-gray-600 font-semibold py-3 rounded-xl hover:bg-gray-50 transition">
                  Đóng
                </button>
              </div>
            )}

            {/* WAITING / CHECKING */}
            {(status === "waiting" || status === "checking") && (
              <>
                {/* QR Code */}
                <div className="flex justify-center mb-5">
                  <div className="relative p-2 border-2 border-blue-100 rounded-2xl bg-blue-50/30">
                    <Image
                      src={qrUrl}
                      alt="QR chuyển khoản"
                      width={200}
                      height={200}
                      className="rounded-xl"
                      unoptimized
                    />
                    {status === "checking" && (
                      <div className="absolute inset-0 bg-white/70 rounded-2xl flex items-center justify-center">
                        <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
                      </div>
                    )}
                  </div>
                </div>

                {/* Transfer info */}
                <div className="space-y-3 mb-5">
                  {[
                    { label: "Ngân hàng", value: BANK_ID, copy: false },
                    { label: "Số tài khoản", value: ACCOUNT_NO, copy: true, key: "account" },
                    { label: "Chủ tài khoản", value: ACCOUNT_NAME, copy: false },
                    { label: "Số tiền", value: fmt(amount), copy: true, key: "amount", raw: amount.toString() },
                    { label: "Nội dung CK", value: orderCode, copy: true, key: "code", highlight: true },
                  ].map((row) => (
                    <div key={row.label} className={`flex items-center justify-between px-4 py-2.5 rounded-xl ${row.highlight ? "bg-blue-50 border border-blue-200" : "bg-gray-50"}`}>
                      <div>
                        <div className="text-[11px] text-gray-400 font-medium">{row.label}</div>
                        <div className={`text-[14px] font-bold ${row.highlight ? "text-blue-700 font-mono tracking-widest" : "text-gray-800"}`}>
                          {row.value}
                        </div>
                      </div>
                      {row.copy && (
                        <button
                          onClick={() => copy(row.raw ?? row.value, row.key ?? row.label)}
                          className="ml-3 text-gray-400 hover:text-blue-500 transition p-1"
                        >
                          {copied === (row.key ?? row.label)
                            ? <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                            : <Copy className="w-4 h-4" />
                          }
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                {/* Status + Timer */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-[12px] text-gray-500">
                    {status === "checking"
                      ? <><Loader2 className="w-3.5 h-3.5 animate-spin text-blue-500" /> Đang kiểm tra...</>
                      : <><RefreshCw className="w-3.5 h-3.5" /> Tự động kiểm tra mỗi 5 giây</>
                    }
                  </div>
                  <div className={`flex items-center gap-1 text-[12px] font-mono font-bold ${timeLeft < 60 ? "text-red-500" : "text-gray-500"}`}>
                    <Clock className="w-3.5 h-3.5" />
                    {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
                  </div>
                </div>

                <p className="text-center text-[11px] text-gray-400 mt-3">
                  ⚡ Hệ thống xác nhận tự động sau khi nhận tiền · Không cần gửi ảnh
                </p>
              </>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
