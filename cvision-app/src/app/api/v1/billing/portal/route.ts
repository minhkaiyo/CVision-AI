import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json({
    portal_url: "/dashboard/billing?portal=demo",
    mode: "demo",
  });
}
