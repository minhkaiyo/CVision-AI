/**
 * GET /api/v1/payment/check?code=CVA_123456&price=99000
 *
 * Polls SePay transaction list to verify if a bank transfer has been made
 * with the matching payment code and amount.
 *
 * Called by the frontend every 5s while user is on the payment waiting screen.
 */

import { NextResponse } from "next/server";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get("code");
    const price = searchParams.get("price");

    if (!code || !price) {
      return NextResponse.json(
        { error: "Thiếu mã giao dịch hoặc số tiền" },
        { status: 400 }
      );
    }

    const SEPAY_TOKEN = process.env.SEPAY_TOKEN;
    if (!SEPAY_TOKEN) {
      return NextResponse.json(
        { error: "SEPAY_TOKEN chưa được cấu hình" },
        { status: 500 }
      );
    }

    const expectedAmount = parseInt(price, 10);
    const normalizedCode = code.trim().toUpperCase();

    // Fetch latest 20 transactions from SePay
    const res = await fetch(
      "https://my.sepay.vn/userapi/transactions/list?limit=20",
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${SEPAY_TOKEN}`,
          "Content-Type": "application/json",
        },
        cache: "no-store",
      }
    );

    if (!res.ok) {
      throw new Error(`SePay API error: ${res.status}`);
    }

    const data = await res.json();

    if (!data?.transactions || !Array.isArray(data.transactions)) {
      return NextResponse.json({ paid: false, message: "Chưa có giao dịch" });
    }

    // Find a matching transaction
    const tx = data.transactions.find((t: Record<string, string>) => {
      const content = (t.transaction_content ?? "").toUpperCase();
      const amountIn = parseInt(t.amount_in ?? "0", 10);
      return content.includes(normalizedCode) && amountIn >= expectedAmount;
    });

    if (!tx) {
      return NextResponse.json({ paid: false });
    }

    return NextResponse.json({
      paid: true,
      transaction: {
        id: tx.id,
        amount: tx.amount_in,
        content: tx.transaction_content,
        date: tx.transaction_date,
        bank: tx.bank_brand_name,
      },
    });
  } catch (err: unknown) {
    console.error("SePay check error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Lỗi không xác định" },
      { status: 500 }
    );
  }
}
