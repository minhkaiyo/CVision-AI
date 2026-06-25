import { NextResponse } from "next/server";
import { buildDiffItemsFromAnalysis, buildOptimizedMarkdown } from "@/lib/cv-template-renderer";

export const maxDuration = 60;

export async function GET(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const analysis = {
    role: "CV toi uu",
    summary: "Phien ban CV duoc tao bang local fallback khi backend rieng chua ket noi.",
    missing_keywords: ["ATS", "impact", "metrics"],
  };

  return NextResponse.json({
    id,
    title: "CV toi uu",
    target_role: "CV toi uu",
    status: "ready",
    created_at: new Date().toISOString(),
    diff_items: buildDiffItemsFromAnalysis(analysis),
    optimized_markdown: buildOptimizedMarkdown({ analysis }),
  });
}

export async function DELETE() {
  return NextResponse.json({ status: "success" });
}
