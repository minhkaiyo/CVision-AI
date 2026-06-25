/**
 * POST /api/v1/payment/confirm
 *
 * Called after SePay confirms payment (paid=true).
 * Updates the user's plan in Firestore.
 *
 * Body: { userId, plan, orderCode, transactionId }
 */

import { NextRequest, NextResponse } from "next/server";
import { initializeApp, getApps, cert, App } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const PLAN_MAP: Record<string, string> = {
  pro_monthly: "pro",
  pro_yearly: "pro",
  premium_monthly: "premium",
  premium_yearly: "premium",
  enterprise_monthly: "enterprise",
  enterprise_yearly: "enterprise",
};

function getAdminApp(): App {
  if (getApps().length) return getApps()[0];
  const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (serviceAccount) {
    return initializeApp({ credential: cert(JSON.parse(serviceAccount)) });
  }
  // Fallback: use default credentials (works on Firebase Hosting / Cloud Run)
  return initializeApp();
}

export async function POST(req: NextRequest) {
  try {
    const { userId, plan, orderCode, transactionId, amount } = await req.json();

    if (!userId || !plan) {
      return NextResponse.json({ error: "Thiếu userId hoặc plan" }, { status: 400 });
    }

    const resolvedPlan = PLAN_MAP[plan] ?? "premium";

    const app = getAdminApp();
    const db = getFirestore(app);

    // Update user profile plan
    await db.collection("profiles").doc(userId).set(
      {
        plan: resolvedPlan,
        updated_at: new Date().toISOString(),
      },
      { merge: true }
    );

    // Record the payment
    await db.collection("subscriptions").add({
      user_id: userId,
      plan: resolvedPlan,
      provider: "sepay",
      status: "active",
      order_code: orderCode ?? null,
      transaction_id: transactionId ?? null,
      amount: amount ?? null,
      created_at: new Date().toISOString(),
    });

    return NextResponse.json({ success: true, plan: resolvedPlan });
  } catch (err: unknown) {
    console.error("Payment confirm error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Lỗi server" },
      { status: 500 }
    );
  }
}
