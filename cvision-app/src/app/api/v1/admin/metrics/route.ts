import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    total_users: 1,
    premium_users: 0,
    total_revenue_vnd: 0,
    analyses_count: 0,
    mode: "local-fallback",
  });
}
