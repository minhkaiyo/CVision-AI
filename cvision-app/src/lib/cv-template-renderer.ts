type SuggestionLike = {
  problem?: string;
  recommendation?: string;
  priority?: string;
};

type AnalysisLike = {
  fileName?: string;
  role?: string;
  summary?: string;
  total_score?: number;
  ats_score?: number;
  keyword_score?: number;
  content_score?: number;
  matched_keywords?: string[];
  missing_keywords?: string[];
  strengths?: string[];
  weaknesses?: string[];
  suggestions?: SuggestionLike[];
};

type VersionLike = {
  title?: string;
  target_role?: string;
  optimized_markdown?: string;
  diff_items?: { value?: string | string[]; reason?: string }[];
};

export type TemplateSourceContext = {
  analysis?: AnalysisLike;
  version?: VersionLike;
};

const TEMPLATE_ACCENTS: Record<string, string> = {
  "modern-professional": "#2563eb",
  "minimalist-clean": "#111827",
  "creative-bold": "#9333ea",
  "executive-standard": "#047857",
  "tech-modern": "#4f46e5",
  "banking-finance": "#b45309",
};

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function listItems(items: unknown[] | undefined, fallback: string[]) {
  const source = items?.length ? items : fallback;
  return source.map((item) => `<li>${escapeHtml(item)}</li>`).join("");
}

function splitMarkdownLines(markdown?: string) {
  return (markdown ?? "")
    .split(/\r?\n/)
    .map((line) => line.replace(/^[-*#\s]+/, "").trim())
    .filter(Boolean)
    .slice(0, 10);
}

export function buildDiffItemsFromAnalysis(analysis: AnalysisLike) {
  const suggestions = analysis.suggestions ?? [];
  if (suggestions.length > 0) {
    return suggestions.slice(0, 8).map((suggestion, index) => ({
      path: `section_${index + 1}`,
      action: "replace" as const,
      original: suggestion.problem ?? "Noi dung can toi uu",
      value: suggestion.recommendation ?? "Lam ro thanh tich, tu khoa va muc do lien quan voi JD.",
      reason: suggestion.recommendation ?? suggestion.problem ?? "Toi uu CV theo ATS.",
      confidence: suggestion.priority === "low" ? "low" as const : suggestion.priority === "medium" ? "medium" as const : "high" as const,
      applied: false,
    }));
  }

  const missing = analysis.missing_keywords ?? [];
  return [
    {
      path: "summary",
      action: "replace" as const,
      original: "Tom tat nghe nghiep con chung chung.",
      value: `Dieu chinh tom tat de bam sat vai tro ${analysis.role || "muc tieu"} va nhan manh gia tri co the dong gop.`,
      reason: "Tang do lien quan trong 5 giay doc dau tien cua nha tuyen dung.",
      confidence: "high" as const,
      applied: false,
    },
    {
      path: "skills",
      action: "add_skill" as const,
      original: null,
      value: missing.slice(0, 6).length ? missing.slice(0, 6) : ["ATS keywords", "Achievement metrics", "Role alignment"],
      reason: "Bo sung tu khoa con thieu de cai thien ATS score.",
      confidence: "medium" as const,
      applied: false,
    },
  ];
}

export function buildOptimizedMarkdown(context: TemplateSourceContext) {
  const analysis = context.analysis;
  const version = context.version;
  if (version?.optimized_markdown) return version.optimized_markdown;

  const role = version?.target_role || analysis?.role || "Vi tri ung tuyen";
  const strengths = analysis?.strengths?.length
    ? analysis.strengths
    : ["Kinh nghiem phu hop voi vai tro muc tieu", "Tu duy giai quyet van de", "Kha nang hoc nhanh va thich nghi"];
  const matched = analysis?.matched_keywords?.slice(0, 12) ?? [];
  const missing = analysis?.missing_keywords?.slice(0, 8) ?? [];

  return [
    `# Ho va Ten`,
    `${role} | email@example.com | 0912 345 678`,
    ``,
    `## Tom tat nghe nghiep`,
    analysis?.summary || `Ung vien huong toi vai tro ${role}, co kha nang ket hop kinh nghiem thuc te, tu duy san pham va kha nang toi uu theo muc tieu kinh doanh.`,
    ``,
    `## Diem manh noi bat`,
    ...strengths.map((item) => `- ${item}`),
    ``,
    `## Kinh nghiem lam viec`,
    `- Toi uu quy trinh lam viec va ket qua dau ra bang cach gan cong viec voi muc tieu do luong duoc.`,
    `- Phoi hop voi cac ben lien quan de hoan thanh nhiem vu dung tien do va nang cao chat luong san pham.`,
    `- De xuat cai tien dua tren du lieu, phan hoi nguoi dung va yeu cau cua vai tro ${role}.`,
    ``,
    `## Ky nang lien quan`,
    `- ${[...matched, ...missing].slice(0, 12).join(", ") || "Communication, Problem Solving, Analysis, Collaboration"}`,
  ].join("\n");
}

export function renderTemplateHtml(params: {
  templateId: string;
  title?: string;
  context?: TemplateSourceContext;
}) {
  const { templateId, context = {} } = params;
  const accent = TEMPLATE_ACCENTS[templateId] ?? TEMPLATE_ACCENTS["modern-professional"];
  const analysis = context.analysis;
  const version = context.version;
  const markdownLines = splitMarkdownLines(buildOptimizedMarkdown(context));
  const role = version?.target_role || analysis?.role || "Vi tri ung tuyen";
  const title = params.title || version?.title || `${role} - CV toi uu`;
  const score = analysis?.total_score ?? analysis?.ats_score;
  const matched = analysis?.matched_keywords?.slice(0, 10) ?? [];
  const missing = analysis?.missing_keywords?.slice(0, 6) ?? [];
  const recommendations =
    analysis?.suggestions?.slice(0, 5).map((s) => s.recommendation || s.problem || "").filter(Boolean) ??
    version?.diff_items?.slice(0, 5).map((d) => Array.isArray(d.value) ? d.value.join(", ") : d.value || d.reason || "").filter(Boolean) ??
    [];

  return `<!doctype html>
<html lang="vi">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
  <style>
    @page { size: A4; margin: 14mm; }
    * { box-sizing: border-box; }
    body { margin: 0; background: #e5e7eb; color: #111827; font-family: Arial, Helvetica, sans-serif; }
    .page { width: 210mm; min-height: 297mm; margin: 0 auto; background: white; padding: 22mm 22mm 18mm; }
    .header { border-bottom: 3px solid ${accent}; padding-bottom: 14px; margin-bottom: 22px; }
    h1 { margin: 0; color: ${accent}; font-size: 34px; line-height: 1.1; letter-spacing: 0; }
    .meta { margin-top: 8px; color: #374151; font-size: 13px; }
    h2 { margin: 22px 0 8px; color: ${accent}; font-size: 15px; text-transform: uppercase; letter-spacing: 0; border-bottom: 1px solid #d1d5db; padding-bottom: 5px; }
    p { margin: 0 0 8px; font-size: 13px; line-height: 1.55; }
    ul { margin: 8px 0 0 18px; padding: 0; }
    li { margin: 5px 0; font-size: 13px; line-height: 1.45; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; }
    .pill { display: inline-block; margin: 4px 5px 0 0; padding: 4px 8px; border-radius: 999px; background: #f3f4f6; color: #374151; font-size: 11px; }
    .score { float: right; color: ${accent}; font-weight: 700; font-size: 13px; }
    @media print { body { background: white; } .page { width: auto; min-height: auto; margin: 0; padding: 0; } }
  </style>
</head>
<body>
  <main class="page">
    <section class="header">
      <h1>Ho va Ten</h1>
      <div class="meta">${escapeHtml(role)} | email@example.com | 0912 345 678 | LinkedIn / Portfolio</div>
    </section>

    <section>
      <h2>Tom tat nghe nghiep ${score ? `<span class="score">ATS ${escapeHtml(score)}/100</span>` : ""}</h2>
      <p>${escapeHtml(analysis?.summary || markdownLines[0] || `Ung vien phu hop voi vai tro ${role}, co dinh huong phat trien ro rang va san sang dong gop vao ket qua kinh doanh.`)}</p>
    </section>

    <section>
      <h2>Kinh nghiem lam viec</h2>
      <p><strong>Cong ty / To chuc</strong> - ${escapeHtml(role)} (2020 - nay)</p>
      <ul>
        ${listItems(markdownLines.slice(1, 5), [
          "Phan tich yeu cau, trien khai giai phap va phoi hop voi cac ben lien quan de dat muc tieu.",
          "Toi uu quy trinh lam viec dua tren du lieu, phan hoi nguoi dung va uu tien kinh doanh.",
          "Ghi nhan ket qua bang chi so cu the de tang suc thuyet phuc voi nha tuyen dung.",
        ])}
      </ul>
    </section>

    <section class="grid">
      <div>
        <h2>Ky nang phu hop</h2>
        ${(matched.length ? matched : ["Communication", "Problem Solving", "Data Analysis", "Collaboration"]).map((item) => `<span class="pill">${escapeHtml(item)}</span>`).join("")}
      </div>
      <div>
        <h2>Tu khoa nen bo sung</h2>
        ${(missing.length ? missing : ["Leadership", "Metrics", "Impact", "ATS"]).map((item) => `<span class="pill">${escapeHtml(item)}</span>`).join("")}
      </div>
    </section>

    <section>
      <h2>Goi y toi uu da ap dung</h2>
      <ul>
        ${listItems(recommendations, [
          "Dieu chinh tom tat nghe nghiep de bam sat vai tro muc tieu.",
          "Them tu khoa ATS vao kinh nghiem va ky nang thay vi chi liet ke rieng.",
          "Viet lai bullet theo cau truc hanh dong, cong cu, pham vi va ket qua.",
        ])}
      </ul>
    </section>

    <section>
      <h2>Hoc van</h2>
      <p><strong>Ten truong</strong> - Nganh hoc lien quan</p>
    </section>
  </main>
</body>
</html>`;
}

export function renderSimplePdfText(context: TemplateSourceContext, title: string) {
  const lines = buildOptimizedMarkdown(context)
    .replace(/^#+\s*/gm, "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  return [title, "", ...lines].join("\n");
}
