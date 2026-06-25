import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  return NextResponse.json({
    checkout_url: body.success_url || "/dashboard/billing?checkout=demo",
    session_id: `local_checkout_${Date.now()}`,
    mode: "demo",
  });
}
