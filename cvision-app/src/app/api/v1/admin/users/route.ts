import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    users: [
      {
        id: "local-user",
        email: "demo@cvision.local",
        full_name: "Demo User",
        plan: "free",
        role: "user",
      },
    ],
    mode: "local-fallback",
  });
}
