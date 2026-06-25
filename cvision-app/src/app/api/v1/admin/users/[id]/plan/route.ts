import { NextResponse } from "next/server";

export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const body = await req.json().catch(() => ({}));
  return NextResponse.json({
    status: "success",
    user_id: id,
    plan: body.plan ?? "free",
    mode: "local-fallback",
  });
}
