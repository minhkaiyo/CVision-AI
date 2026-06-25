import { NextRequest, NextResponse } from "next/server";
import mammoth from "mammoth";

export const maxDuration = 60;

const BACKEND = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1";

/**
 * POST /api/v1/extract
 *
 * Extracts text from CV files (PDF, DOCX, images, TXT).
 *
 * Strategy per format:
 * - TXT  → read buffer directly
 * - DOCX → mammoth (no AI needed)
 * - PDF  → try pdfjs first, fallback to backend /resumes/parse-text
 * - IMG  → send to backend which uses markitdown + layout analysis
 */
export async function POST(req: NextRequest) {
  try {
    let ext = "";
    let buffer: Buffer;
    let fileName = "file";

    const contentType = req.headers.get("content-type") || "";

    if (contentType.includes("application/json")) {
      // Mode 1: URL from Cloudinary
      const body = await req.json();
      const { url, fileName: fn } = body;
      if (!url) return NextResponse.json({ error: "Thiếu URL file" }, { status: 400 });

      fileName = fn ?? "file";
      ext = (fn as string)?.split(".").pop()?.toLowerCase() ||
        url.split("?")[0].split(".").pop()?.toLowerCase() || "";

      const fetchRes = await fetch(url);
      if (!fetchRes.ok) throw new Error(`Không thể tải file (${fetchRes.status})`);
      buffer = Buffer.from(await fetchRes.arrayBuffer());
    } else {
      // Mode 2: FormData
      const formData = await req.formData();
      const file = formData.get("file") as File;
      if (!file) return NextResponse.json({ error: "Không tìm thấy file" }, { status: 400 });
      fileName = file.name;
      ext = file.name.split(".").pop()?.toLowerCase() || "";
      buffer = Buffer.from(await file.arrayBuffer());
    }

    let extractedText = "";

    // ── TXT ────────────────────────────────────────────────────────────────
    if (ext === "txt") {
      extractedText = buffer.toString("utf-8");
    }

    // ── DOCX/DOC ──────────────────────────────────────────────────────────
    else if (ext === "docx" || ext === "doc") {
      const result = await mammoth.extractRawText({ buffer });
      extractedText = result.value;
    }

    // ── PDF ────────────────────────────────────────────────────────────────
    else if (ext === "pdf") {
      // Try pdfjs-dist first (no AI, no network)
      try {
        const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs" as never) as { getDocument: (src: { data: Uint8Array }) => { promise: Promise<{ numPages: number; getPage: (n: number) => Promise<{ getTextContent: () => Promise<{ items: { str?: string }[] }> }> }> } };
        const doc = await pdfjs.getDocument({ data: new Uint8Array(buffer) }).promise;
        const pages: string[] = [];
        for (let i = 1; i <= doc.numPages; i++) {
          const page = await doc.getPage(i);
          const content = await page.getTextContent();
          pages.push(content.items.map((item: { str?: string }) => item.str ?? "").join(" "));
        }
        extractedText = pages.join("\n\n");
      } catch {
        // pdfjs failed (scanned PDF) → send to backend
        extractedText = await extractViaBackend(buffer, fileName);
      }
    }

    // ── Images ────────────────────────────────────────────────────────────
    else if (["png", "jpg", "jpeg", "webp"].includes(ext)) {
      extractedText = await extractViaBackend(buffer, fileName);
    }

    else {
      return NextResponse.json(
        { error: `Định dạng .${ext} không được hỗ trợ. Dùng PDF, DOCX, TXT, hoặc ảnh.` },
        { status: 415 }
      );
    }

    // ── Cleanup ────────────────────────────────────────────────────────────
    extractedText = (extractedText || "")
      .replace(/\0/g, "")
      .replace(/\r\n/g, "\n")
      .replace(/\r/g, "\n")
      .replace(/\n{4,}/g, "\n\n")
      .replace(/[ \t]{3,}/g, "  ")
      .trim();

    if (!extractedText || extractedText.length < 5) {
      return NextResponse.json(
        { error: "File rỗng hoặc không thể đọc được nội dung. Thử upload file DOCX hoặc PDF có text thay vì ảnh scan." },
        { status: 422 }
      );
    }

    return NextResponse.json({
      success: true,
      text: extractedText.slice(0, 50000),
      wordCount: extractedText.split(/\s+/).filter(Boolean).length,
      fileName,
      ext,
    });

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Extract API error:", err);
    return NextResponse.json({ error: "Lỗi trích xuất: " + message }, { status: 500 });
  }
}

/**
 * Send file to FastAPI backend for extraction via markitdown.
 * Backend uses pdfminer + markitdown, no AI key needed for text PDFs.
 */
async function extractViaBackend(buffer: Buffer, fileName: string): Promise<string> {
  try {
    const form = new FormData();
    const blob = new Blob([new Uint8Array(buffer)], { type: getMimeType(fileName) });
    form.append("cv", blob, fileName);
    form.append("role", "extract");  // dummy role — backend just parses

    const res = await fetch(`${BACKEND}/analyses`, {
      method: "POST",
      body: form,
    });

    if (res.ok) {
      const data = await res.json();
      // Return extracted markdown text from the analysis result
      return data?.result?.summary ?? "";
    }
  } catch { /* fallback */ }

  // Last resort: return empty (handled by caller)
  return "";
}

function getMimeType(fileName: string): string {
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  const map: Record<string, string> = {
    pdf: "application/pdf",
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    webp: "image/webp",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    doc: "application/msword",
    txt: "text/plain",
  };
  return map[ext] ?? "application/octet-stream";
}
