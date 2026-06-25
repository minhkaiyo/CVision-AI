import { NextResponse } from "next/server";
import { renderTemplateHtml, type TemplateSourceContext } from "@/lib/cv-template-renderer";

export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const templateId = body.template_id || "modern-professional";
    const context = (body.source_context ?? {}) as TemplateSourceContext;
    const title =
      context.version?.title ||
      context.analysis?.role ||
      body.title ||
      "CVision optimized CV";

    const html = renderTemplateHtml({
      templateId,
      title,
      context,
    });

    return NextResponse.json({
      status: "success",
      title,
      html,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ detail: message }, { status: 500 });
  }
}
