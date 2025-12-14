import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import { createClient } from "npm:@supabase/supabase-js@2";
import * as kv from "./kv_store.ts";
import { PDFDocument, StandardFonts, rgb } from "npm:pdf-lib";

const app = new Hono();

// Middleware
app.use("*", cors());
app.use("*", logger(console.log));

// Supabase client
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Storage bucket setup
const BUCKET_NAME = "make-7946999d-files";
const { data: buckets } = await supabase.storage.listBuckets();
const bucketExists = buckets?.some((bucket) => bucket.name === BUCKET_NAME);
if (!bucketExists) {
  await supabase.storage.createBucket(BUCKET_NAME, { public: false });
}

// Logo remoto (superseller) usado no PDF
const LOGO_URL =
  "https://firebasestorage.googleapis.com/v0/b/supersellerco-f5a61.firebasestorage.app/o/Imagens%2FSUPERSELLERCO_LOGO_small.png?alt=media&token=cfb2f1f3-bbbc-4ead-acd7-7b348f0ce188";
let cachedLogoBytes: Uint8Array | null = null;
async function getLogoBytes() {
  if (cachedLogoBytes) return cachedLogoBytes;
  try {
    const res = await fetch(LOGO_URL);
    if (!res.ok) return null;
    const buf = new Uint8Array(await res.arrayBuffer());
    cachedLogoBytes = buf;
    return buf;
  } catch (_) {
    return null;
  }
}

// Helper function to verify authentication
async function verifyAuth(request: Request) {
  const accessToken = request.headers.get("Authorization")?.split(" ")[1];
  if (!accessToken) {
    return { error: "No token provided", user: null };
  }
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(accessToken);
  if (error || !user) {
    return { error: "Unauthorized", user: null };
  }
  return { error: null, user };
}

async function requireAdmin(request: Request) {
  const auth = await verifyAuth(request);
  if (auth.error || !auth.user) return auth;
  const userData = await kv.get(`users:${auth.user.email}`);
  if (!userData || userData.role !== "admin") {
    return { error: "Forbidden", user: null };
  }
  return { error: null, user: auth.user };
}

function normalizeRole(raw: any) {
  return (raw || "").toString().trim().toLowerCase();
}

function isCompanyScopedRole(role: string) {
  const normalized = normalizeRole(role);
  return ["empresa", "company", "gerente", "manager", "vendedor", "seller"].includes(normalized);
}

function isSellerRole(role: string) {
  const normalized = normalizeRole(role);
  return normalized === "vendedor" || normalized === "seller";
}

function isManagerRole(role: string) {
  const normalized = normalizeRole(role);
  return normalized === "gerente" || normalized === "manager";
}

function isCompanyRole(role: string) {
  const normalized = normalizeRole(role);
  return normalized === "empresa" || normalized === "company";
}

function isPartnerRole(role: string) {
  const normalized = normalizeRole(role);
  return normalized === "parceiro" || normalized === "partner";
}

function isPartnerPortalRole(role: string) {
  const normalized = normalizeRole(role);
  return ["parceiro", "partner", "gerente", "manager", "vendedor", "seller"].includes(normalized);
}

function canManagePartnerRole(requesterRole: string, targetRole: string) {
  const requester = normalizeRole(requesterRole);
  const target = normalizeRole(targetRole);
  if (isSellerRole(requester)) return false;
  if (isManagerRole(requester)) return isSellerRole(target);
  if (isCompanyRole(requester)) return isManagerRole(target) || isSellerRole(target);
  return true; // admin/parceiro/etc.
}

function asStringArray(val: any): string[] {
  if (!val) return [];
  if (Array.isArray(val)) return val.map((v) => String(v)).filter(Boolean);
  if (typeof val === "string") return val.split(",").map((v) => v.trim()).filter(Boolean);
  return [];
}

async function requireAuthWithUserData(request: Request) {
  const auth = await verifyAuth(request);
  if (auth.error || !auth.user) {
    return { error: auth.error || "Unauthorized", user: null, userData: null, role: "", companyId: null };
  }
  const userData = auth.user.email ? await kv.get(`users:${auth.user.email}`) : null;
  const rawRole =
    userData?.role ||
    (auth.user as any).role ||
    (auth.user as any).user_metadata?.role ||
    (auth.user as any).app_metadata?.role ||
    "";
  const role = normalizeRole(rawRole);
  const companyId = (userData?.companyId || "").toString().trim() || null;
  return { error: null, user: auth.user, userData, role, companyId };
}

// Logo base64 (assets/logo.png)
const logoBase64 =
  "iVBORw0KGgoAAAANSUhEUgAAAdkAAACXCAYAAABZYiGqAAAKN2lDQ1BzUkdCIElFQzYxOTY2LTIuMQAAKJF1kT1Iw1AUhU/FUhaLFDuIWqQoiIoLrUiVBVq1CECq06mFz6BVOGJUXDl76BF6Cg4+Lrh6uChoKyDk6CIlbFJcXE0rCkR9eCCi1iIf4n2kzS5d7c7d7h3QfwpMaVpllwzRdNlMjGplMWP7qRg0CGBGBmVkIMfM6nAwL5fu+P9ePEWSP7n/9OvjkgskAj1E8x3Mtkwi3iGs1aZz3icOsrKU8TzxqEUmiPnzXRXG/m8Ux1eY1pw1jJindWK5a9WeUwXiYqZuqw0RxxTvoKr6h5rPIc6zWt1qVO/ISFY0llmJCQQosFIUE2kVCTqSNh0nT6x9D/CI+WXIcZnmKFCMVjwhw/8J+uXL5UrTSo4Rhhg+2VBiMk5+8nH8A/J25csuMjjA+VjwviPkdEFoGje9jh9kDAM3g5rDk16sVSwD8mXkSZPkTdhQGgX+LnpZbwErn4K+9trb+AB3uUvvEkbVtgAAAJNJREFUeAHtnQEQACAMwEC3/4VgAA8oLLS6gVY9R/X6cWD33wFExPjwCElQsBICJJQLASAickAMEgKhJQDBICoSUAwSAqElAMEgKhJQDBICoSUAwSAqElAMEgKhJQDBICoSUAwSAqElAMEgKhJQDBICoSUAwSAqElAMEgKhJQDBICoSUAwSAqElAMEgKhJQDBICoSUAwSAqElAMEgKhJQDBICoSUAwSAqElAMEgKhJQDBICoSUAwSAqElAMEgKhJQDBICoSUAwSAqElAMEgKhJQDBICoSUAwSAqElAMEgKhJQDBICoSUAwSAqElAMEgKhJQDBICoSUAwSAqElAMEgKhJQDBICoSUAwSAqElAMEgKhJQDBICoSUAwSAqElAMEgKhJQDBICoSUAwSAqElAMEgKhJQDBICoSUAwSAqElAMEgKhJQDBICoSUAwSAqElAMEgKhJQDBICoSUAwSAqElAMEgKhJQDBICoSUAwSAqElAMEgKhJQDBICoSUAwSAqElAMEgKhJQDBICoSUAwSAqElAMEgKhJQDBICoSUAwSAqElAMHkBO0QACgACFuMAAAAASUVORK5CYII=";

// Helper para gerar PDF seguindo modelo SERVIR+GOLD (relexemplo2.pdf)
async function generateEvaluationPdf(opts: {
  evaluation: any;
  company: any;
  analysis: any;
}) {
  const { evaluation, company, analysis } = opts;
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  // Paleta e dimensões
  const colors = {
    primary: rgb(0.10, 0.60, 0.88),
    dark: rgb(0.15, 0.20, 0.28),
    muted: rgb(0.32, 0.40, 0.50),
    softBg: rgb(0.95, 0.97, 0.99),
    tableHeader: rgb(0.94, 0.96, 0.98),
    border: rgb(0.88, 0.92, 0.96),
    success: rgb(0.24, 0.62, 0.39),
    warning: rgb(0.93, 0.58, 0.09),
    danger: rgb(0.89, 0.35, 0.34),
  };
  const pageWidth = 595;
  const pageHeight = 842;
  const margin = 32;

  let page = doc.addPage([pageWidth, pageHeight]);
  let y = pageHeight - margin;

  // Utilidades de texto/layout
  const wrapText = (
    text: string,
    maxWidth: number,
    size: number,
    useBold = false,
  ) => {
    const blocks = (text || "").toString().split(/\n/);
    const all: string[] = [];
    blocks.forEach((block) => {
      const words = block.replace(/\s+/g, " ").trim().split(" ");
      let line = "";
      words.forEach((word) => {
        const candidate = line ? `${line} ${word}` : word;
        const width = (useBold ? bold : font).widthOfTextAtSize(candidate, size);
        if (width > maxWidth && line) {
          all.push(line);
          line = word;
        } else {
          line = candidate;
        }
      });
      if (line) all.push(line);
    });
    return all;
  };

  const measureHeight = (text: string, maxWidth: number, size: number, useBold = false, lineGap = 4) => {
    const lines = wrapText(text, maxWidth, size, useBold);
    if (!lines.length) return 0;
    return lines.length * size + (lines.length - 1) * lineGap;
  };

  const ensureSpace = (needed: number) => {
    if (y - needed < margin) {
      page = doc.addPage([pageWidth, pageHeight]);
      y = pageHeight - margin;
    }
  };

  const drawTextBlock = (
    text: string,
    x: number,
    size: number,
    color = colors.muted,
    useBold = false,
    maxWidth = pageWidth - x - margin,
    lineGap = 4,
  ) => {
    const lines = wrapText(text || "-", maxWidth, size, useBold);
    let yy = y;
    lines.forEach((ln) => {
      page.drawText(ln, { x, y: yy, size, font: useBold ? bold : font, color });
      yy -= size + lineGap;
    });
    const used = lines.length ? (lines.length * size + (lines.length - 1) * lineGap) : 0;
    y = yy;
    return used;
  };

  const drawFixedBlock = (
    text: string,
    x: number,
    yPos: number,
    size: number,
    color = colors.muted,
    useBold = false,
    maxWidth = pageWidth - x - margin,
    lineGap = 4,
  ) => {
    const lines = wrapText(text || "-", maxWidth, size, useBold);
    let yy = yPos;
    lines.forEach((ln) => {
      page.drawText(ln, { x, y: yy, size, font: useBold ? bold : font, color });
      yy -= size + lineGap;
    });
    const used = lines.length ? (lines.length * size + (lines.length - 1) * lineGap) : 0;
    return { used, bottomY: yy };
  };

  const drawPill = (label: string, x: number, yPos: number) => {
    const height = 18;
    const padX = 10;
    const w = (bold.widthOfTextAtSize(label, 9) + padX * 2);
    page.drawRectangle({
      x,
      y: yPos - height,
      width: w,
      height,
      color: rgb(0.90, 0.97, 1),
      borderRadius: 10,
    });
    page.drawText(label, { x: x + padX, y: yPos - 12, size: 9, font: bold, color: colors.primary });
    return w;
  };

  const drawBadge = (text: string, x: number, yPos: number, variant: "success" | "warning" | "danger") => {
    const palette = {
      success: { bg: rgb(0.90, 0.97, 0.93), color: colors.success },
      warning: { bg: rgb(1, 0.96, 0.90), color: colors.warning },
      danger: { bg: rgb(0.99, 0.93, 0.92), color: colors.danger },
    }[variant];
    const padX = 10;
    const height = 16;
    const width = padX * 2 + bold.widthOfTextAtSize(text, 9);
    page.drawRectangle({ x, y: yPos - height, width, height, color: palette.bg, borderRadius: 8 });
    page.drawText(text, { x: x + padX, y: yPos - 11.5, size: 9, font: bold, color: palette.color });
  };

  const statusFromScore = (score: number | null) => {
    if (score === null || typeof score !== "number") return { label: "—", variant: "warning" as const };
    if (score >= 9) return { label: "Excelente", variant: "success" as const };
    if (score >= 7) return { label: "Atenção", variant: "warning" as const };
    return { label: "Crítico", variant: "danger" as const };
  };

  const formatDateLong = (value: string | null | undefined) => {
    if (!value) return "-";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return value;
    const months = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
    const weekdays = ["domingo", "segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado"];
    return `${weekdays[d.getDay()]}, ${d.getDate()} de ${months[d.getMonth()]} de ${d.getFullYear()}`;
  };

  const formatHour = (value: string | undefined) => value || "--:--";
  const formatNumber = (num: number | null | undefined, digits = 1) =>
    typeof num === "number" && Number.isFinite(num) ? num.toFixed(digits) : "—";

  const asArray = (val: any) => {
    if (!val) return [];
    if (Array.isArray(val)) return val;
    if (typeof val === "string") return val.split(",").map((v) => v.trim()).filter(Boolean);
    return [];
  };
  const asList = (val: any): string[] => {
    if (Array.isArray(val)) return val.filter((v) => v !== null && v !== undefined).map((v) => String(v));
    if (val === null || val === undefined) return [];
    return [String(val)];
  };

  // helpers de imagem/anexo
  const fetchBytes = async (url: string) => {
    try {
      const res = await fetch(url);
      if (!res.ok) return null;
      return new Uint8Array(await res.arrayBuffer());
    } catch {
      return null;
    }
  };

  const embedImageFromUrl = async (url: string) => {
    const bytes = await fetchBytes(url);
    if (!bytes) return null;
    try {
      return await doc.embedPng(bytes);
    } catch (_) {
      try {
        return await doc.embedJpg(bytes);
      } catch {
        return null;
      }
    }
  };

  const drawImageFitted = (img: any, maxWidth: number, maxHeight: number) => {
    const scale = Math.min(maxWidth / img.width, maxHeight / img.height, 1);
    const w = img.width * scale;
    const h = img.height * scale;
    ensureSpace(h + 20);
    page.drawImage(img, { x: margin + (maxWidth - w) / 2, y: y - h, width: w, height: h });
    y -= h + 16;
  };

  const formatAnswer = (value: any) => {
    if (value === null || value === undefined) return "—";
    if (typeof value === "boolean") return value ? "Sim" : "Não";
    if (typeof value === "number") return Number.isFinite(value) ? value.toString() : "—";
    if (Array.isArray(value)) return value.map((v) => formatAnswer(v)).join("; ");
    if (typeof value === "object") {
      return Object.entries(value)
        .map(([k, v]) => `${k}: ${formatAnswer(v)}`)
        .join("; ");
    }
    return String(value);
  };

  // Dados do survey para títulos/perguntas
  let surveySections: any[] = [];
  let surveyQuestions: any[] = [];
  if (evaluation?.surveyId) {
    try {
      const { data: sectionsData } = await supabase
        .from("survey_sections")
        .select("*")
        .eq("survey_id", evaluation.surveyId)
        .order("order", { ascending: true });
      surveySections = sectionsData || [];
      const { data: questionsData } = await supabase
        .from("survey_questions")
        .select("*")
        .eq("survey_id", evaluation.surveyId)
        .order("order", { ascending: true });
      surveyQuestions = questionsData || [];
    } catch (err) {
      console.log("PDF: falha ao buscar survey para títulos", err);
    }
  }

  const questionMap = new Map<string, { title: string; sectionId: string | null; order: number }>();
  surveyQuestions.forEach((q: any, idx: number) => {
    questionMap.set(q.id, { title: q.title || `Pergunta ${idx + 1}`, sectionId: q.section_id, order: q.order ?? idx });
  });

  const answers = Array.isArray(evaluation?.surveyData?.answers)
    ? evaluation.surveyData.answers
    : [];
  const answersByQuestion: Record<string, any> = {};
  answers.forEach((a: any) => {
    if (a?.questionId) answersByQuestion[a.questionId] = a.value;
  });

  const orderedQuestions = surveySections
    .flatMap((section: any) =>
      surveyQuestions
        .filter((q: any) => q.section_id === section.id)
        .sort((a: any, b: any) => (a.order ?? 0) - (b.order ?? 0)),
    )
    .concat(
      surveyQuestions
        .filter((q: any) => !surveySections.find((s) => s.id === q.section_id)),
    );

  if (!orderedQuestions.length && answers.length) {
    orderedQuestions.push(
      ...answers.map((a: any, idx: number) => ({
        id: a.questionId,
        title: questionMap.get(a.questionId)?.title || `Pergunta ${idx + 1}`,
        section_id: null,
        order: idx,
      })),
    );
  }

  const detectTag = (title: string) => {
    const t = (title || "").toUpperCase();
    if (/R_REL|RETORNO|RELACIONAMENTO|\bR2\b/.test(t)) return "R_REL";
    if (/\bS\b|\bS\.\b|SAUDA[CÇ][AÃ]O/.test(t)) return "S";
    if (/\bE\b|\bE\.\b|EXPLORAC[AÃ]O/.test(t)) return "E";
    if (/\bR\b|\bR\.\b|RECOMENDA/.test(t)) return "R";
    if (/\bV\b|\bV\.\b|VALORIZA/.test(t)) return "V";
    if (/\bI\b|\bI\.\b|IMPLEMENTA/.test(t)) return "I";
    if (/\bG\b|\bG\.\b|DISPONIBILIDADE/.test(t)) return "G";
    if (/\bO\b|\bO\.\b|ATEN[CÇ][AÃ]O/.test(t)) return "O";
    if (/\bL\b|\bL\.\b|COMPREENS/.test(t)) return "L";
    if (/\bD\b|\bD\.\b|PROATIV/.test(t)) return "D";
    if (/\bAG\b|ASPECTOS GERAIS/.test(t)) return "AG";
    return null;
  };

  const pillarAnswers: Record<string, string[]> = { S: [], E: [], R: [], V: [], I: [], R_REL: [] };
  const agRows: { title: string; answer: string }[] = [];

  orderedQuestions.forEach((q: any, idx: number) => {
    const tag = detectTag(q.title || "");
    const value = answersByQuestion[q.id];
    const display = `Q${idx + 1}. ${q.title || "Pergunta"} — ${formatAnswer(value)}`;
    if (tag && pillarAnswers[tag as keyof typeof pillarAnswers]) {
      pillarAnswers[tag as keyof typeof pillarAnswers].push(display);
    }
    if (tag === "AG") {
      agRows.push({ title: q.title || "-", answer: formatAnswer(value) });
    }
  });

  // Distribuir oportunidades por pilar para o detalhamento
  const improvements = Array.isArray(analysis?.improvements) ? analysis.improvements : [];
  const servirOrder = ["S", "E", "R", "V", "I", "R_REL"];
  const opportunitiesByPillar: Record<string, string[]> = { S: [], E: [], R: [], V: [], I: [], R_REL: [] };
  improvements.forEach((item: string, idx: number) => {
    const key = servirOrder[idx % servirOrder.length];
    opportunitiesByPillar[key].push(item);
  });

  // Logo
  const drawLogo = async () => {
    try {
      let logoBytes: Uint8Array | null = null;
      const companyLogoPath = (company as any)?.logoPath || (company as any)?.logo_path || null;

      if (companyLogoPath) {
        const downloadRes = await supabase.storage.from(BUCKET_NAME).download(companyLogoPath);
        if (!downloadRes.error && downloadRes.data) {
          logoBytes = new Uint8Array(await downloadRes.data.arrayBuffer());
        }
      }

      if (!logoBytes) {
        logoBytes = await getLogoBytes();
      }
      if (!logoBytes) return;

      let img: any = null;
      try {
        img = await doc.embedPng(logoBytes);
      } catch (_) {
        try {
          img = await doc.embedJpg(logoBytes);
        } catch (_) {
          return;
        }
      }

      const scale = Math.min(50 / img.height, 120 / img.width);
      page.drawImage(img, {
        x: pageWidth - margin - img.width * scale,
        y: pageHeight - margin - img.height * scale,
        width: img.width * scale,
        height: img.height * scale,
      });
    } catch (_) {
      // ignora falha de logo
    }
  };

  // Cabeçalho
  const drawHeader = async () => {
    const pillWidth = drawPill("SERVIR + GOLD", margin, y);
    await drawLogo();
    y -= 32;
    let companyName = company?.name || company?.company?.name || evaluation?.companyName || "";
    if (!companyName && evaluation?.companyId) {
      try {
        const kvCompany = await kv.get(`companies:${evaluation.companyId}`);
        if (kvCompany?.name) companyName = kvCompany.name;
      } catch (_) {
        // ignore
      }
    }
    page.drawText(companyName || "Empresa", { x: margin, y, size: 20, font: bold, color: colors.dark });
    y -= 20;

    const visitDate = formatDateLong(evaluation?.scheduledDate);
    const voucher = evaluation?.voucherCode || "-";
    const visitLine = `Visita em ${visitDate}${evaluation?.period ? ` • ${evaluation.period}` : ""} • Voucher ${voucher}`;
    page.drawText(visitLine, { x: margin, y, size: 11, font, color: colors.muted });
    y -= 16;
    const start = formatHour(evaluation?.visitData?.startTime);
    const end = formatHour(evaluation?.visitData?.endTime);
    let evaluatorName = evaluation?.evaluatorName || evaluation?.evaluatorId || "-";
    if ((!evaluation?.evaluatorName) && evaluation?.evaluatorId) {
      try {
        const ev = await kv.get(`evaluators:${evaluation.evaluatorId}`);
        if (ev?.name) evaluatorName = ev.name;
      } catch (_) { /* ignore */ }
    }
    const sellerIds = asArray(evaluation?.visitData?.sellers);
    let sellers = "-";
    if (sellerIds.length) {
      const names: string[] = [];
      for (const sid of sellerIds) {
        const id = String(sid || "").trim();
        if (!id) continue;
        try {
          const partner = await kv.get(`partners:${id}`);
          const label = partner?.name || partner?.email || id;
          names.push(String(label));
        } catch (_) {
          names.push(id);
        }
      }
      sellers = names.filter(Boolean).join(", ") || "-";
    } else {
      sellers = asArray(evaluation?.visitData?.vendors).join(", ") || "-";
    }
    page.drawText(`Início: ${start}  •  Fim: ${end}`, { x: margin, y, size: 11, font, color: colors.muted });
    y -= 14;
    page.drawText(`Avaliador: ${evaluatorName}`, { x: margin, y, size: 11, font, color: colors.muted });
    y -= 14;
    page.drawText(`Vendedores: ${sellers}`, { x: margin, y, size: 11, font, color: colors.muted });
    y -= 20;
  };

  await drawHeader();

  // Cartões métricos principais
  const drawMetricCards = () => {
    const normalize10 = (val: any) => {
      if (typeof val !== "number" || !Number.isFinite(val)) return null;
      if (val > 10) return Math.min(10, val / 10);
      if (val < 0) return 0;
      return val;
    };
    const labels = [
      { title: "Pontuação Geral", value: normalize10(analysis?.overallScore ?? analysis?.servirAvg) },
      { title: "ASPECTOS GERAIS", value: normalize10(analysis?.agScore) },
      { title: "NPS", value: normalize10(analysis?.npsScore) },
    ];
    const width = (pageWidth - margin * 2 - 20) / 3;
    const height = 78;
    labels.forEach((item, idx) => {
      const x = margin + idx * (width + 10);
      page.drawRectangle({
        x,
        y: y - height,
        width,
        height,
        color: rgb(1, 1, 1),
        borderColor: colors.border,
        borderWidth: 1,
        borderRadius: 10,
      });
      page.drawText(item.title, { x: x + 12, y: y - 16, size: 10, font: bold, color: colors.muted });
      page.drawText(formatNumber(item.value), { x: x + 12, y: y - 38, size: 24, font: bold, color: colors.dark });
      const barWidth = width - 24;
      page.drawRectangle({ x: x + 12, y: y - 54, width: barWidth, height: 8, color: rgb(0.92, 0.96, 0.99), borderRadius: 4 });
      const valueNorm = typeof item.value === "number" ? Math.max(0, Math.min(1, item.value / 10)) : 0;
      page.drawRectangle({ x: x + 12, y: y - 54, width: barWidth * valueNorm, height: 8, color: colors.primary, borderRadius: 4 });
      if (item.title === "NPS") {
        const nps = typeof item.value === "number" ? item.value : null;
        const label = nps === null ? "" : nps >= 9 ? "Promotor" : nps >= 7 ? "Neutro" : "Detrator";
        if (label) {
          page.drawText(label, { x: x + 12, y: y - 66, size: 9, font, color: colors.danger });
        }
      }
    });
    y -= height + 16;
  };
  drawMetricCards();

  // Sumário executivo
  const drawSummary = () => {
    y -= 6;
    const keyPoints = asList(analysis?.satisfactions);
    const labels = [
      { title: "Pontos-chave", items: keyPoints.length ? keyPoints : asList(analysis?.strengths) },
      { title: "Forças", items: asList(analysis?.strengths) },
      { title: "Fragilidades", items: asList(analysis?.improvements) },
    ];
    const colWidth = (pageWidth - margin * 2 - 20) / 3;
    const headerHeight = 28;
    const contentHeights = labels.map((col) => {
      const lines = (col.items || [])
        .slice(0, 8)
        .flatMap((item) => wrapText(`• ${item}`, colWidth - 12, 10));
      return 18 + lines.length * 13;
    });
    const contentMax = Math.max(...contentHeights, 40);
    const boxHeight = headerHeight + 12 + contentMax + 12;
    ensureSpace(boxHeight + 10);
    page.drawRectangle({
      x: margin,
      y: y - boxHeight,
      width: pageWidth - margin * 2,
      height: boxHeight,
      color: rgb(0.98, 0.99, 1),
      borderColor: colors.border,
      borderWidth: 1,
      borderRadius: 12,
    });
    page.drawRectangle({
      x: margin,
      y: y - headerHeight,
      width: pageWidth - margin * 2,
      height: headerHeight,
      color: colors.tableHeader,
      borderRadius: 12,
    });
    page.drawText("Sumário executivo", { x: margin + 12, y: y - 16, size: 12, font: bold, color: colors.dark });

    const startY = y - headerHeight - 8;
    labels.forEach((col, idx) => {
      const x = margin + 10 + idx * (colWidth + 5);
      page.drawText(col.title, { x, y: startY + 2, size: 11, font: bold, color: colors.dark });
      let yy = startY - 12;
      (col.items || []).slice(0, 8).forEach((item) => {
        const lines = wrapText(`• ${item}`, colWidth - 12, 10);
        lines.forEach((ln) => {
          page.drawText(ln, { x, y: yy, size: 10, font, color: colors.muted });
          yy -= 13;
        });
      });
    });
    y -= boxHeight + 14;
  };
  drawSummary();

  // Tabela SERVIR
  const drawServirTable = () => {
    const rows = [
      { label: "S – Saudação Estratégica", key: "S", val: analysis?.pillarScores?.S ?? null },
      { label: "E – Exploração de Preferências", key: "E", val: analysis?.pillarScores?.E ?? null },
      { label: "R – Recomendação Personalizada", key: "R", val: analysis?.pillarScores?.R ?? null },
      { label: "V – Valorização da Experiência", key: "V", val: analysis?.pillarScores?.V ?? null },
      { label: "I – Implementação impecável", key: "I", val: analysis?.pillarScores?.I ?? null },
      { label: "R_REL – Retorno & Relacionamento", key: "R_REL", val: analysis?.pillarScores?.R_REL ?? null },
    ];
    const headerHeight = 22;
    const rowHeight = 22;
    const tableHeight = headerHeight + rows.length * rowHeight;
    ensureSpace(tableHeight + 20);
    page.drawText("Etapas do SERVIR", { x: margin, y, size: 12, font: bold, color: colors.dark });
    y -= 14;
    const tableWidth = pageWidth - margin * 2;
    const colWidths = [
      tableWidth * 0.55, // Etapa
      tableWidth * 0.25, // Acerto
      tableWidth * 0.20, // Status
    ];
    const x0 = margin;
    const headers = ["Etapa", "Acerto (%)", "Status"];
    // Header
    page.drawRectangle({
      x: x0,
      y: y - headerHeight,
      width: tableWidth,
      height: headerHeight,
      color: colors.tableHeader,
      borderColor: colors.border,
      borderWidth: 1,
      borderRadius: 8,
    });
    let x = x0 + 10;
    headers.forEach((h, idx) => {
      page.drawText(h, { x, y: y - 12, size: 10, font: bold, color: colors.dark });
      x += colWidths[idx];
    });
    y -= headerHeight;

    rows.forEach((row) => {
      ensureSpace(rowHeight + 2);
      const status = statusFromScore(typeof row.val === "number" ? row.val : null);
      const percent = typeof row.val === "number" ? `${Math.round(row.val * 10)}%` : "—";
      page.drawRectangle({
        x: x0,
        y: y - rowHeight,
        width: tableWidth,
        height: rowHeight,
        color: rgb(1, 1, 1),
        borderColor: colors.border,
        borderWidth: 1,
      });
      let xx = x0 + 10;
      page.drawText(row.label, { x: xx, y: y - 13, size: 10, font, color: colors.muted });
      xx += colWidths[0];
      page.drawText(percent, { x: xx + 8, y: y - 13, size: 10, font, color: colors.dark });
      xx += colWidths[1];
      drawBadge(status.label, xx + 8, y - 4, status.variant);
      y -= rowHeight;
    });
    y -= 12;
  };
  drawServirTable();

  // GOLD cards
  const drawGoldCards = () => {
    const gold = analysis?.goldScores || {};
    const items = [
      { label: "G – Disponibilidade", val: gold.G },
      { label: "O – Atenção", val: gold.O },
      { label: "L – Compreensão", val: gold.L },
      { label: "D – Proatividade", val: gold.D },
    ];
    const width = (pageWidth - margin * 2 - 24) / 4;
    const height = 74;
    ensureSpace(height + 14);
    y -= 4;
    items.forEach((item, idx) => {
      const x = margin + idx * (width + 8);
      page.drawRectangle({
        x,
        y: y - height,
        width,
        height,
        color: rgb(1, 1, 1),
        borderColor: colors.border,
        borderWidth: 1,
        borderRadius: 10,
      });
      page.drawText(item.label, { x: x + 12, y: y - 16, size: 10, font: bold, color: colors.muted });
      page.drawText(formatNumber(item.val), { x: x + 12, y: y - 36, size: 22, font: bold, color: colors.dark });
      const barWidth = width - 24;
      page.drawRectangle({ x: x + 12, y: y - 52, width: barWidth, height: 7, color: rgb(0.92, 0.96, 0.99), borderRadius: 4 });
      const norm = typeof item.val === "number" ? Math.max(0, Math.min(1, item.val / 10)) : 0;
      page.drawRectangle({ x: x + 12, y: y - 52, width: barWidth * norm, height: 7, color: colors.primary, borderRadius: 4 });
    });
    y -= height + 14;
  };
  drawGoldCards();

  // Recomendações práticas
  const drawRecommendations = () => {
    const sections = [
      { title: "Para o Vendedor", items: asList(analysis?.recommendationsSeller) },
      { title: "Para o Gestor", items: asList(analysis?.recommendationsManager) },
    ];
    ensureSpace(26);
    page.drawText("Recomendações práticas", { x: margin, y, size: 12, font: bold, color: colors.dark });
    y -= 14;
    sections.forEach((section) => {
      const boxWidth = pageWidth - margin * 2;
      const contentLines = (section.items.length ? section.items : ["—"]).flatMap((item) =>
        wrapText(`• ${item}`, boxWidth - 24, 10)
      );
      const heightGuess = Math.max(72, 34 + contentLines.length * 13);
      ensureSpace(heightGuess);
      const topY = y;
      page.drawRectangle({
        x: margin,
        y: topY - heightGuess,
        width: boxWidth,
        height: heightGuess,
        color: rgb(1, 1, 1),
        borderColor: colors.border,
        borderWidth: 1,
        borderRadius: 12,
      });
      page.drawText(section.title, { x: margin + 12, y: topY - 14, size: 11, font: bold, color: colors.dark });
      let yy = topY - 30;
      contentLines.forEach((ln) => {
        page.drawText(ln, { x: margin + 12, y: yy, size: 10, font, color: colors.muted });
        yy -= 12;
      });
      y = yy - 12;
    });
  };
  drawRecommendations();

  // Plano de ação
  const drawActionPlan = () => {
    const plan = analysis?.actionPlan || {};
    const rows = [
      { prazo: "Até 7 dias", actions: asList(plan["7dias"] || plan["7Dias"] || plan["7"]) },
      { prazo: "Até 30 dias", actions: asList(plan["30dias"] || plan["30Dias"] || plan["30"]) },
      { prazo: "Até 90 dias", actions: asList(plan["90dias"] || plan["90Dias"] || plan["90"]) },
    ];
    const headerHeight = 22;
    const colWidths = [100, pageWidth - margin * 2 - 100];
    ensureSpace(26);
    y -= 24; // add breathing room from bloco anterior
    page.drawText("Plano de ação", { x: margin, y, size: 12, font: bold, color: colors.dark });
    y -= 14;
    page.drawRectangle({
      x: margin,
      y: y - headerHeight,
      width: pageWidth - margin * 2,
      height: headerHeight,
      color: colors.tableHeader,
      borderColor: colors.border,
      borderWidth: 1,
      borderRadius: 8,
    });
    page.drawText("Prazo", { x: margin + 10, y: y - 12, size: 10, font: bold, color: colors.dark });
    page.drawText("Ações sugeridas", { x: margin + colWidths[0] + 10, y: y - 12, size: 10, font: bold, color: colors.dark });
    y -= headerHeight;

    rows.forEach((row) => {
      const actionsList = row.actions.length ? row.actions : ["—"];
      const actionsText = actionsList.map((a: string) => `• ${a}`).join("  ");
      const actionsHeight = measureHeight(actionsText, colWidths[1] - 16, 10, false, 3);
      const rowHeight = Math.max(actionsHeight + 14, 28);
      ensureSpace(rowHeight + 2);
      page.drawRectangle({
        x: margin,
        y: y - rowHeight,
        width: pageWidth - margin * 2,
        height: rowHeight,
        color: rgb(1, 1, 1),
        borderColor: colors.border,
        borderWidth: 1,
      });
      page.drawText(row.prazo, { x: margin + 10, y: y - 14, size: 10, font, color: colors.muted });
      const { bottomY } = drawFixedBlock(actionsText, margin + colWidths[0] + 10, y - 12, 10, colors.muted, false, colWidths[1] - 20, 3);
      y = Math.min(y - rowHeight, bottomY - 4);
    });
    y -= 10;
  };
  drawActionPlan();

  // Aspectos gerais
  const drawAspects = () => {
    if (!agRows.length) return;
    const headerHeight = 22;
    const colWidths = [pageWidth - margin * 2 - 110, 110];
    ensureSpace(26);
    page.drawText("Aspectos gerais", { x: margin, y, size: 12, font: bold, color: colors.dark });
    y -= 14;
    page.drawRectangle({
      x: margin,
      y: y - headerHeight,
      width: pageWidth - margin * 2,
      height: headerHeight,
      color: colors.tableHeader,
      borderColor: colors.border,
      borderWidth: 1,
      borderRadius: 8,
    });
    page.drawText("Notas detalhadas", { x: margin + 10, y: y - 12, size: 10, font: bold, color: colors.dark });
    y -= headerHeight;

    agRows.forEach((row) => {
      const titleHeight = measureHeight(row.title, colWidths[0] - 20, 10, false, 2);
      const answerParts = row.answer.split(";").map((s) => s.trim()).filter(Boolean);
      const ansText = answerParts.map((p) => `• ${p}`).join("\n");
      const ansHeight = measureHeight(ansText, colWidths[1] - 16, 10, false, 2);
      const rowHeight = Math.max(28, titleHeight, ansHeight) + 6;
      ensureSpace(rowHeight + 2);
      page.drawRectangle({
        x: margin,
        y: y - rowHeight,
        width: pageWidth - margin * 2,
        height: rowHeight,
        color: rgb(1, 1, 1),
        borderColor: colors.border,
        borderWidth: 1,
      });
      drawFixedBlock(row.title, margin + 10, y - 12, 10, colors.muted, false, colWidths[0] - 20, 2);
      drawFixedBlock(ansText, margin + colWidths[0] + 10, y - 12, 10, colors.dark, false, colWidths[1] - 16, 2);
      y -= rowHeight;
    });
    y -= 16;
  };
  drawAspects();

  // Satisfação / Frustração / Conclusão / Insights
  const drawNarratives = () => {
    const blocks = [
      { title: "Satisfações", items: asList(analysis?.satisfactions) },
      { title: "Frustrações", items: asList(analysis?.frustrations) },
      { title: "Conclusão", items: analysis?.conclusion ? [analysis.conclusion] : asList(analysis?.summary || "-") },
      { title: "Insights estratégicos", items: asList(analysis?.strategicInsights) },
    ];
    blocks.forEach((block) => {
      const content = (block.items.length ? block.items : ["—"]).join(" ");
      const height = measureHeight(content, pageWidth - margin * 2 - 20, 10, false, 4) + 30;
      ensureSpace(height + 6);
      page.drawRectangle({
        x: margin,
        y: y - height,
        width: pageWidth - margin * 2,
        height,
        color: colors.tableHeader,
        borderRadius: 12,
      });
      page.drawText(block.title, { x: margin + 12, y: y - 14, size: 11, font: bold, color: colors.dark });
      drawFixedBlock(content, margin + 12, y - 30, 10, colors.muted, false, pageWidth - margin * 2 - 24, 4);
      y -= height + 8;
    });
  };
  drawNarratives();

  // Rodapé da página de resumo
  const drawFooter = () => {
    const ts = new Date();
    const footerText = `Relatório gerado automaticamente pela IA SuperSeller — SERVIR + GOLD    ${ts.toUTCString()}`;
    page.drawText(footerText, { x: margin, y: margin, size: 8, font, color: colors.muted });
  };
  drawFooter();

  // Nova página para detalhamento SERVIR
  const newPage = () => {
    page = doc.addPage([pageWidth, pageHeight]);
    y = pageHeight - margin;
  };
  newPage();

  const drawServirDetail = () => {
    const tableWidth = pageWidth - margin * 2;
    const columns = [
      { title: "Etapa", width: tableWidth * 0.38 },
      { title: "Impacto na experiência", width: tableWidth * 0.22 },
      { title: "Oportunidades", width: tableWidth * 0.40 },
    ];
    const headerHeight = 26;

    page.drawText("Detalhamento SERVIR", { x: margin, y, size: 12, font: bold, color: colors.dark });
    y -= 14;

    const drawHeaderRow = () => {
      page.drawRectangle({
        x: margin,
        y: y - headerHeight,
        width: tableWidth,
        height: headerHeight,
        color: colors.tableHeader,
        borderColor: colors.border,
        borderWidth: 1,
        borderRadius: 8,
      });
      let xx = margin + 10;
      columns.forEach((c) => {
        page.drawText(c.title, { x: xx, y: y - 14, size: 10, font: bold, color: colors.dark });
        xx += c.width;
      });
      y -= headerHeight;
    };
    drawHeaderRow();

    const servirLabels: Record<string, string> = {
      S: "S – Saudação Estratégica",
      E: "E – Exploração de Preferências",
      R: "R – Recomendação Personalizada",
      V: "V – Valorização da Experiência",
      I: "I – Implementação impecável",
      R_REL: "R2 – Retorno & Relacionamento",
    };

    const rows = servirOrder.map((key) => {
      const score = analysis?.pillarScores?.[key] ?? null;
      const status = statusFromScore(typeof score === "number" ? score : null);
      const obs = pillarAnswers[key] && pillarAnswers[key].length
        ? pillarAnswers[key].slice(0, 12)
        : [];
      const opps = opportunitiesByPillar[key].length ? opportunitiesByPillar[key] : improvements.slice(0, 3);
      return {
        etapa: servirLabels[key] || key,
        observacoes: obs,
        impacto: `${status.label}${score !== null ? ` (${formatNumber(score)}/10)` : ""}`,
        statusVariant: status.variant,
        oportunidades: opps.length ? opps : ["—"],
      };
    });

    rows.forEach((row) => {
      const etapaLines = wrapText(
        [row.etapa, row.observacoes.length ? `Obs: ${row.observacoes.join("  ")}` : ""].filter(Boolean).join("\n"),
        columns[0].width - 12,
        10,
      );
      const impactLines = wrapText(row.impacto, columns[1].width - 14, 10);
      const oppLines = wrapText(row.oportunidades.join("  "), columns[2].width - 14, 10);
      const heights = [
        etapaLines.length * 12,
        impactLines.length * 12,
        oppLines.length * 12,
      ];
      const rowHeight = Math.max(...heights, 38);
      if (y - rowHeight < margin + 30) {
        newPage();
        drawHeaderRow();
      }
      page.drawRectangle({
        x: margin,
        y: y - rowHeight,
        width: tableWidth,
        height: rowHeight,
        color: rgb(1, 1, 1),
        borderColor: colors.border,
        borderWidth: 1,
      });
      let xx = margin + 10;
      drawFixedBlock(etapaLines.join("\n"), xx, y - 12, 10, colors.muted, false, columns[0].width - 10, 3);
      xx += columns[0].width;
      // Impact badge
      const badgeText = impactLines[0] || "-";
      const badgeY = y - 10;
      drawBadge(badgeText, xx + 4, badgeY, row.statusVariant as any);
      if (impactLines.length > 1) {
        drawFixedBlock(impactLines.slice(1).join(" "), xx + 4, badgeY - 16, 9, colors.muted, false, columns[1].width - 12, 3);
      }
      xx += columns[1].width;
      drawFixedBlock(oppLines.join(" "), xx + 2, y - 12, 10, colors.muted, false, columns[2].width - 12, 3);
      y -= rowHeight;
    });
    y -= 10;
  };
  drawServirDetail();

  // Respostas completas do avaliador
  const drawAnswersTable = () => {
    const answered = orderedQuestions
      .map((q: any, idx: number) => ({
        title: `Q${idx + 1}. ${q.title || "Pergunta"}`,
        answer: formatAnswer(answersByQuestion[q.id]),
      }))
      .filter((row) => row.answer !== "—" || row.title);
    if (!answered.length) return;

    // Inicia respostas sempre em uma nova página
    newPage();

    const columns = [
      { title: "", width: pageWidth - margin * 2 - 180 },
      { title: "", width: 180 },
    ];
    const lineGap = 3;
    const minRowHeight = 26;

    const ensureNewPage = (rowHeight: number) => {
      if (y - rowHeight < margin + 30) {
        newPage();
        page.drawText("Respostas do avaliador", { x: margin, y, size: 12, font: bold, color: colors.dark });
        y -= 14;
      }
    };

    answered.forEach((row, idx) => {
      const qHeight = measureHeight(row.title, columns[0].width - 12, 10, false, lineGap);
      const aHeight = measureHeight(row.answer, columns[1].width - 12, 10, false, lineGap);
      const rowHeight = Math.max(minRowHeight, qHeight, aHeight) + 8;
      ensureNewPage(rowHeight);
      if (idx === 0 && y === pageHeight - margin) {
        page.drawText("Respostas do avaliador", { x: margin, y, size: 12, font: bold, color: colors.dark });
        y -= 14;
      }
      page.drawRectangle({
        x: margin,
        y: y - rowHeight,
        width: columns.reduce((a, b) => a + b.width, 0),
        height: rowHeight,
        color: rgb(1, 1, 1),
        borderColor: colors.border,
        borderWidth: 1,
      });
      drawFixedBlock(row.title, margin + 8, y - 12, 10, colors.muted, false, columns[0].width - 16, lineGap);
      drawFixedBlock(row.answer, margin + columns[0].width + 8, y - 12, 10, colors.dark, false, columns[1].width - 16, lineGap);
      y -= rowHeight;
    });
  };
  drawAnswersTable();

  // Anexos (comprovante, fotos, áudio)
  const drawAttachments = async () => {
    const receipt = evaluation?.attachments?.receipt;
    const photos = Array.isArray(evaluation?.attachments?.photos) ? evaluation.attachments.photos : [];
    const audioUrl = evaluation?.audioUrl || evaluation?.attachments?.audioUrl;
    if (!receipt && !photos.length) return;

    newPage();
    page.drawText("Anexos", { x: margin, y, size: 12, font: bold, color: colors.dark });
    y -= 14;

    if (receipt?.url || receipt?.path) {
      page.drawText("Comprovante:", { x: margin, y, size: 10, font: bold, color: colors.muted });
      y -= 12;
      const img = await embedImageFromUrl(receipt.url || receipt.path);
      if (img) {
        drawImageFitted(img, pageWidth - margin * 2, 320);
      } else {
        page.drawText(receipt.name || receipt.url || receipt.path || "Comprovante", { x: margin, y, size: 10, font, color: colors.primary });
        y -= 16;
      }
    }

    if (photos.length) {
      page.drawText("Fotos:", { x: margin, y, size: 10, font: bold, color: colors.muted });
      y -= 12;
      for (let i = 0; i < photos.length; i++) {
        const p = photos[i];
        const img = await embedImageFromUrl(p.url || p.path || "");
        if (img) {
          drawImageFitted(img, pageWidth - margin * 2, 260);
        } else if (p.url || p.path) {
          page.drawText(p.name || p.url || p.path, { x: margin, y, size: 10, font, color: colors.primary });
          y -= 14;
        }
      }
    }
  };
  await drawAttachments();

  return await doc.save();
}

// ===== AUTH ROUTES =====

// Initial admin signup (no auth required)
app.post("/make-server-7946999d/auth/initial-signup", async (c) => {
  try {
    console.log("=== Initial signup request received ===");

    // Check if any users exist
    const existingUsers = await kv.getByPrefix("users:");
    console.log(`Existing users count: ${existingUsers.length}`);

    if (existingUsers.length > 0) {
      console.log("Users already exist, blocking initial signup");
      return c.json(
        {
          error:
            "Sistema já possui usuários cadastrados. Use o login normal.",
        },
        400,
      );
    }

    const body = await c.req.json();
    const { email, password, name } = body;

    console.log(
      `Creating user - email: ${email}, name: ${name}, password length: ${password?.length}`,
    );

    if (!email || !password || !name) {
      console.log("Missing required fields");
      return c.json({ error: "Email, senha e nome são obrigatórios" }, 400);
    }

    if (password.length < 6) {
      console.log("Password too short");
      return c.json({ error: "A senha deve ter no mínimo 6 caracteres" }, 400);
    }

    console.log("Calling supabase.auth.admin.createUser...");
    console.log(`Using Supabase URL: ${supabaseUrl}`);

    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      user_metadata: { name, role: "admin", cpf: "" },
      email_confirm: true, // Auto-confirm since email server not configured
    });

    if (error) {
      console.log(`Supabase error creating user: ${JSON.stringify(error)}`);
      return c.json(
        { error: `Erro do Supabase: ${error.message}` },
        400,
      );
    }

    if (!data?.user) {
      console.log("No user data returned from createUser");
      return c.json(
        { error: "Erro ao criar usuário: resposta inválida do Supabase" },
        500,
      );
    }

    console.log(`User created successfully with ID: ${data.user.id}`);

    // Store user data in KV
    try {
      await kv.set(`users:${email}`, {
        id: data.user.id,
        email,
        name,
        role: "admin",
        createdAt: new Date().toISOString(),
      });
      console.log("User data stored in KV successfully");
    } catch (kvError) {
      console.log(`Error storing user in KV: ${JSON.stringify(kvError)}`);
      return c.json(
        { error: "Usuário criado mas erro ao salvar dados no banco" },
        500,
      );
    }

    console.log("=== Initial signup completed successfully ===");
    return c.json({
      success: true,
      message: "Usuário administrador criado com sucesso!",
    });
  } catch (error) {
    console.log(
      `Unexpected error during initial signup: ${JSON.stringify(error)}`,
    );
    console.log(`Error stack: ${error.stack}`);
    return c.json(
      { error: `Erro interno: ${error.message || String(error)}` },
      500,
    );
  }
});

// Sign up
app.post("/make-server-7946999d/auth/signup", async (c) => {
  try {
    const { email, password, name, role, cpf } = await c.req.json();

    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      user_metadata: { name, role, cpf },
      email_confirm: true, // Auto-confirm since email server not configured
    });

    if (error) {
      console.log(`Error creating user during signup: ${error.message}`);
      return c.json({ error: error.message }, 400);
    }

    // Store user data in KV
    await kv.set(`users:${email}`, {
      id: data.user.id,
      email,
      name,
      role,
      cpf,
      createdAt: new Date().toISOString(),
    });

    return c.json({ success: true, user: data.user });
  } catch (error) {
    console.log(`Unexpected error during signup: ${error}`);
    return c.json(
      { error: "Internal server error during signup" },
      500,
    );
  }
});

// Sign in
app.post("/make-server-7946999d/auth/signin", async (c) => {
  try {
    const { email, password } = await c.req.json();

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      console.log(`Error during sign in: ${error.message}`);
      return c.json({ error: error.message }, 400);
    }

    // Get user data from KV
    const userData = await kv.get(`users:${email}`);

    return c.json({
      success: true,
      accessToken: data.session.access_token,
      user: userData,
    });
  } catch (error) {
    console.log(`Unexpected error during signin: ${error}`);
    return c.json(
      { error: "Internal server error during signin" },
      500,
    );
  }
});

// Get current user
app.get("/make-server-7946999d/auth/me", async (c) => {
  const { error, user } = await verifyAuth(c.req.raw);
  if (error || !user) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const userData = await kv.get(`users:${user.email}`);
  return c.json({ user: userData });
});

// Update current user (basic profile)
app.put("/make-server-7946999d/auth/me", async (c) => {
  const { error, user } = await verifyAuth(c.req.raw);
  if (error || !user) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  try {
    const updates = await c.req.json();
    const existing = await kv.get(`users:${user.email}`);
    if (!existing) {
      return c.json({ error: "User not found" }, 404);
    }
    const allowed = (({ name, phone }) => ({ name, phone }))(updates || {});
    const updated = { ...existing, ...allowed, updatedAt: new Date().toISOString() };
    await kv.set(`users:${user.email}`, updated);
    return c.json({ success: true, user: updated });
  } catch (err) {
    console.log(`Error updating user: ${err}`);
    return c.json({ error: "Erro ao atualizar perfil" }, 500);
  }
});

// ===== COMPANY ROUTES =====

app.post("/make-server-7946999d/companies", async (c) => {
  const auth = await requireAuthWithUserData(c.req.raw);
  if (auth.error || !auth.user) return c.json({ error: "Unauthorized" }, 401);
  const { user, role } = auth;
  if (isCompanyScopedRole(role)) return c.json({ error: "Forbidden" }, 403);

  try {
    const companyData = await c.req.json();
    const id = crypto.randomUUID();

    const company = {
      id,
      ...companyData,
      createdAt: new Date().toISOString(),
      createdBy: user.id,
    };

    await kv.set(`companies:${id}`, company);
    await kv.set(`companies:index:${id}`, { id, name: company.name });

    return c.json({ success: true, company });
  } catch (error) {
    console.log(`Error creating company: ${error}`);
    return c.json({ error: "Error creating company" }, 500);
  }
});

app.get("/make-server-7946999d/companies", async (c) => {
  const auth = await requireAuthWithUserData(c.req.raw);
  if (auth.error || !auth.user) return c.json({ error: "Unauthorized" }, 401);
  const { role, companyId } = auth;

  try {
    const withLogoUrl = async (company: any) => {
      const logoPath = company?.logoPath || company?.logo_path;
      if (!company || !logoPath) return company;
      const signed = await supabase.storage.from(BUCKET_NAME).createSignedUrl(String(logoPath), 60 * 60);
      if (signed.error) return company;
      return { ...company, logoUrl: signed.data?.signedUrl || company.logoUrl };
    };

    if (isCompanyScopedRole(role)) {
      if (!companyId) {
        return c.json({ error: "Usuário sem empresa vinculada" }, 403);
      }
      const company = await kv.get(`companies:${companyId}`);
      const hydrated = company ? await withLogoUrl(company) : null;
      return c.json({ companies: hydrated ? [hydrated] : [] });
    }

    const companies = await kv.getByPrefix("companies:");
    const filteredCompanies = companies
      .filter(
        (item) =>
          item.key.startsWith("companies:") &&
          !item.key.includes(":index:"),
      )
      .map((item) => item.value);

    const hydratedCompanies = await Promise.all(filteredCompanies.map(withLogoUrl));
    return c.json({ companies: hydratedCompanies });
  } catch (error) {
    console.log(`Error fetching companies: ${error}`);
    return c.json({ error: "Error fetching companies" }, 500);
  }
});

app.get("/make-server-7946999d/companies/:id", async (c) => {
  const auth = await requireAuthWithUserData(c.req.raw);
  if (auth.error || !auth.user) return c.json({ error: "Unauthorized" }, 401);
  const { role, companyId } = auth;

  try {
    const id = c.req.param("id");
    if (isCompanyScopedRole(role)) {
      if (!companyId) return c.json({ error: "Usuário sem empresa vinculada" }, 403);
      if (id !== companyId) return c.json({ error: "Forbidden" }, 403);
    }
    const company = await kv.get(`companies:${id}`);

    if (!company) {
      return c.json({ error: "Company not found" }, 404);
    }

    const logoPath = company?.logoPath || company?.logo_path;
    if (!logoPath) return c.json({ company });
    const signed = await supabase.storage.from(BUCKET_NAME).createSignedUrl(String(logoPath), 60 * 60);
    if (signed.error) return c.json({ company });
    return c.json({ company: { ...company, logoUrl: signed.data?.signedUrl || company.logoUrl } });
  } catch (error) {
    console.log(`Error fetching company: ${error}`);
    return c.json({ error: "Error fetching company" }, 500);
  }
});

app.put("/make-server-7946999d/companies/:id", async (c) => {
  const auth = await requireAuthWithUserData(c.req.raw);
  if (auth.error || !auth.user) return c.json({ error: "Unauthorized" }, 401);
  const { role, companyId } = auth;

  try {
    const id = c.req.param("id");
    if (isCompanyScopedRole(role)) {
      if (!companyId) return c.json({ error: "Usuário sem empresa vinculada" }, 403);
      if (id !== companyId) return c.json({ error: "Forbidden" }, 403);
    }
    const updates = await c.req.json();
    const existing = await kv.get(`companies:${id}`);

    if (!existing) {
      return c.json({ error: "Company not found" }, 404);
    }

    const company = {
      ...existing,
      ...updates,
      id,
      updatedAt: new Date().toISOString(),
    };

    await kv.set(`companies:${id}`, company);
    await kv.set(`companies:index:${id}`, { id, name: company.name });

    return c.json({ success: true, company });
  } catch (error) {
    console.log(`Error updating company: ${error}`);
    return c.json({ error: "Error updating company" }, 500);
  }
});

app.delete("/make-server-7946999d/companies/:id", async (c) => {
  const auth = await requireAuthWithUserData(c.req.raw);
  if (auth.error || !auth.user) return c.json({ error: "Unauthorized" }, 401);
  const { role, companyId } = auth;

  try {
    const id = c.req.param("id");
    if (isCompanyScopedRole(role)) {
      if (!companyId) return c.json({ error: "Usuário sem empresa vinculada" }, 403);
      if (id !== companyId) return c.json({ error: "Forbidden" }, 403);
    }
    await kv.del(`companies:${id}`);
    await kv.del(`companies:index:${id}`);

    return c.json({ success: true });
  } catch (error) {
    console.log(`Error deleting company: ${error}`);
    return c.json({ error: "Error deleting company" }, 500);
  }
});

// ===== PARTNER ROUTES =====

app.post("/make-server-7946999d/partners", async (c) => {
  const auth = await requireAuthWithUserData(c.req.raw);
  if (auth.error || !auth.user) return c.json({ error: "Unauthorized" }, 401);
  const { user, role: requesterRole, companyId: requesterCompanyId } = auth;

  try {
    const partnerData = await c.req.json();
    const id = crypto.randomUUID();

    const role = normalizeRole(partnerData.role || "partner");
    if (!canManagePartnerRole(requesterRole, role)) {
      return c.json({ error: "Forbidden" }, 403);
    }
    const requestedCompanyId = (partnerData.companyId || "").toString().trim();

    if (isCompanyScopedRole(requesterRole)) {
      if (!requesterCompanyId) {
        return c.json({ error: "Usuário sem empresa vinculada" }, 403);
      }
      if (requestedCompanyId && requestedCompanyId !== requesterCompanyId) {
        return c.json({ error: "Forbidden" }, 403);
      }
    }

    const companyId = isCompanyScopedRole(requesterRole) ? requesterCompanyId : requestedCompanyId;

    if (isCompanyScopedRole(role)) {
      if (!companyId) {
        return c.json({ error: "Empresa é obrigatória para este perfil" }, 400);
      }
      const company = await kv.get(`companies:${companyId}`);
      if (!company) {
        return c.json({ error: "Empresa não encontrada" }, 400);
      }
    }

    // Create auth user for partner
    const password = partnerData.cpf.substring(0, 6);
    const { data: authData, error: authError } =
      await supabase.auth.admin.createUser({
        email: partnerData.email,
        password,
        user_metadata: {
          name: partnerData.name,
          role: partnerData.role || "partner",
          cpf: partnerData.cpf,
          companyId: companyId || null,
        },
        email_confirm: true,
      });

    if (authError) {
      console.log(
        `Error creating partner auth user: ${authError.message}`,
      );
      return c.json({ error: authError.message }, 400);
    }

    const partner = {
      id,
      ...partnerData,
      companyId: companyId || null,
      userId: authData.user.id,
      createdAt: new Date().toISOString(),
      createdBy: user.id,
    };

    await kv.set(`partners:${id}`, partner);
    await kv.set(`partners:index:${id}`, { id, name: partner.name });
    await kv.set(`users:${partnerData.email}`, {
      id: authData.user.id,
      email: partnerData.email,
      name: partnerData.name,
      role: partnerData.role || "partner",
      cpf: partnerData.cpf,
      partnerId: id,
      companyId: companyId || null,
      createdAt: new Date().toISOString(),
    });

    return c.json({ success: true, partner });
  } catch (error) {
    console.log(`Error creating partner: ${error}`);
    return c.json({ error: "Error creating partner" }, 500);
  }
});

app.get("/make-server-7946999d/partners", async (c) => {
  const auth = await requireAuthWithUserData(c.req.raw);
  if (auth.error || !auth.user) return c.json({ error: "Unauthorized" }, 401);
  const { role, companyId } = auth;

  try {
    if (isSellerRole(role)) {
      return c.json({ error: "Forbidden" }, 403);
    }
    const partners = await kv.getByPrefix("partners:");
    const filteredPartners = partners
      .filter(
        (item) =>
          item.key.startsWith("partners:") &&
          !item.key.includes(":index:"),
      )
      .map((item) => item.value)
      .filter((p) => {
        if (!isCompanyScopedRole(role)) return true;
        if (!companyId) return false;
        return p?.companyId === companyId;
      })
      .filter((p) => {
        if (isManagerRole(role)) return isSellerRole(p?.role || "");
        if (isCompanyRole(role)) return isSellerRole(p?.role || "") || isManagerRole(p?.role || "");
        return true;
      });

    return c.json({ partners: filteredPartners });
  } catch (error) {
    console.log(`Error fetching partners: ${error}`);
    return c.json({ error: "Error fetching partners" }, 500);
  }
});

app.get("/make-server-7946999d/partners/:id", async (c) => {
  const auth = await requireAuthWithUserData(c.req.raw);
  if (auth.error || !auth.user) return c.json({ error: "Unauthorized" }, 401);
  const { role, companyId } = auth;

  try {
    const id = c.req.param("id");
    const partner = await kv.get(`partners:${id}`);

    if (!partner) {
      return c.json({ error: "Partner not found" }, 404);
    }
    if (isCompanyScopedRole(role)) {
      if (!companyId) return c.json({ error: "Usuário sem empresa vinculada" }, 403);
      if (partner.companyId !== companyId) return c.json({ error: "Forbidden" }, 403);
    }
    if (isSellerRole(role)) {
      return c.json({ error: "Forbidden" }, 403);
    }
    if (!canManagePartnerRole(role, partner.role || "")) {
      return c.json({ error: "Forbidden" }, 403);
    }

    return c.json({ partner });
  } catch (error) {
    console.log(`Error fetching partner: ${error}`);
    return c.json({ error: "Error fetching partner" }, 500);
  }
});

app.put("/make-server-7946999d/partners/:id", async (c) => {
  const auth = await requireAuthWithUserData(c.req.raw);
  if (auth.error || !auth.user) return c.json({ error: "Unauthorized" }, 401);
  const { role: requesterRole, companyId: requesterCompanyId } = auth;

  try {
    const id = c.req.param("id");
    const updates = await c.req.json();
    const existing = await kv.get(`partners:${id}`);

    if (!existing) {
      return c.json({ error: "Partner not found" }, 404);
    }
    if (!canManagePartnerRole(requesterRole, existing.role || "")) {
      return c.json({ error: "Forbidden" }, 403);
    }

    const normalizedCompanyId =
      (isCompanyScopedRole(requesterRole)
        ? (requesterCompanyId || "")
        : (updates.companyId ?? existing.companyId ?? ""))
        .toString()
        .trim() || null;

    const partner = {
      ...existing,
      ...updates,
      id,
      companyId: normalizedCompanyId,
      updatedAt: new Date().toISOString(),
    };

    if (isCompanyScopedRole(requesterRole)) {
      if (!requesterCompanyId) return c.json({ error: "Usuário sem empresa vinculada" }, 403);
      if (existing.companyId !== requesterCompanyId) return c.json({ error: "Forbidden" }, 403);
    }
    if (!canManagePartnerRole(requesterRole, partner.role || "")) {
      return c.json({ error: "Forbidden" }, 403);
    }

    const role = normalizeRole(partner.role || "partner");
    if (isCompanyScopedRole(role)) {
      if (!partner.companyId) {
        return c.json({ error: "Empresa é obrigatória para este perfil" }, 400);
      }
      const company = await kv.get(`companies:${partner.companyId}`);
      if (!company) {
        return c.json({ error: "Empresa não encontrada" }, 400);
      }
    }

    await kv.set(`partners:${id}`, partner);
    await kv.set(`partners:index:${id}`, { id, name: partner.name });

    // Mantém o usuário do KV em sincronia (para /auth/me e filtros por empresa)
    if (partner.email) {
      const existingUser = await kv.get(`users:${partner.email}`);
      await kv.set(`users:${partner.email}`, {
        ...(existingUser || {}),
        id: existingUser?.id || partner.userId,
        email: partner.email,
        name: partner.name,
        role: partner.role,
        cpf: partner.cpf,
        partnerId: id,
        companyId: partner.companyId || null,
        updatedAt: new Date().toISOString(),
      });
    }

    return c.json({ success: true, partner });
  } catch (error) {
    console.log(`Error updating partner: ${error}`);
    return c.json({ error: "Error updating partner" }, 500);
  }
});

app.delete("/make-server-7946999d/partners/:id", async (c) => {
  const auth = await requireAuthWithUserData(c.req.raw);
  if (auth.error || !auth.user) return c.json({ error: "Unauthorized" }, 401);
  const { role, companyId } = auth;

  try {
    const id = c.req.param("id");
    const partner = await kv.get(`partners:${id}`);
    if (!partner) return c.json({ error: "Partner not found" }, 404);
    if (isCompanyScopedRole(role)) {
      if (!companyId) return c.json({ error: "Usuário sem empresa vinculada" }, 403);
      if (partner.companyId !== companyId) return c.json({ error: "Forbidden" }, 403);
    }
    if (isSellerRole(role)) {
      return c.json({ error: "Forbidden" }, 403);
    }
    if (!canManagePartnerRole(role, partner.role || "")) {
      return c.json({ error: "Forbidden" }, 403);
    }
    await kv.del(`partners:${id}`);
    await kv.del(`partners:index:${id}`);

    return c.json({ success: true });
  } catch (error) {
    console.log(`Error deleting partner: ${error}`);
    return c.json({ error: "Error deleting partner" }, 500);
  }
});

// ===== EVALUATOR ROUTES =====

app.post("/make-server-7946999d/evaluators", async (c) => {
  const { error, user } = await verifyAuth(c.req.raw);
  if (error || !user) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  try {
    const evaluatorData = await c.req.json();
    const id = crypto.randomUUID();

    // Create auth user for evaluator if email provided
    if (evaluatorData.email) {
      const password = crypto.randomUUID().substring(0, 8);
      const { data: authData, error: authError } =
        await supabase.auth.admin.createUser({
          email: evaluatorData.email,
          password,
          user_metadata: {
            name: evaluatorData.name,
            role: "evaluator",
          },
          email_confirm: true,
        });

      if (!authError && authData) {
        evaluatorData.userId = authData.user.id;
        evaluatorData.initialPassword = password;

        await kv.set(`users:${evaluatorData.email}`, {
          id: authData.user.id,
          email: evaluatorData.email,
          name: evaluatorData.name,
          role: "evaluator",
          evaluatorId: id,
          createdAt: new Date().toISOString(),
        });
      }
    }

    const evaluator = {
      id,
      ...evaluatorData,
      score: 0, // Initial score
      totalEvaluations: 0,
      createdAt: new Date().toISOString(),
      createdBy: user.id,
    };

    await kv.set(`evaluators:${id}`, evaluator);
    await kv.set(`evaluators:index:${id}`, { id, name: evaluator.name });

    return c.json({ success: true, evaluator });
  } catch (error) {
    console.log(`Error creating evaluator: ${error}`);
    return c.json({ error: "Error creating evaluator" }, 500);
  }
});

app.get("/make-server-7946999d/evaluators", async (c) => {
  const { error, user } = await verifyAuth(c.req.raw);
  if (error || !user) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  try {
    const evaluators = await kv.getByPrefix("evaluators:");
    const filteredEvaluators = evaluators
      .filter(
        (item) =>
          item.key.startsWith("evaluators:") &&
          !item.key.includes(":index:"),
      )
      .map((item) => item.value);

    return c.json({ evaluators: filteredEvaluators });
  } catch (error) {
    console.log(`Error fetching evaluators: ${error}`);
    return c.json({ error: "Error fetching evaluators" }, 500);
  }
});

app.get("/make-server-7946999d/evaluators/:id", async (c) => {
  const { error, user } = await verifyAuth(c.req.raw);
  if (error || !user) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  try {
    const id = c.req.param("id");
    const evaluator = await kv.get(`evaluators:${id}`);

    if (!evaluator) {
      return c.json({ error: "Evaluator not found" }, 404);
    }

    return c.json({ evaluator });
  } catch (error) {
    console.log(`Error fetching evaluator: ${error}`);
    return c.json({ error: "Error fetching evaluator" }, 500);
  }
});

app.put("/make-server-7946999d/evaluators/:id", async (c) => {
  const { error, user } = await verifyAuth(c.req.raw);
  if (error || !user) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  try {
    const id = c.req.param("id");
    const updates = await c.req.json();
    const existing = await kv.get(`evaluators:${id}`);

    if (!existing) {
      return c.json({ error: "Evaluator not found" }, 404);
    }

    const evaluator = {
      ...existing,
      ...updates,
      id,
      updatedAt: new Date().toISOString(),
    };

    await kv.set(`evaluators:${id}`, evaluator);
    await kv.set(`evaluators:index:${id}`, { id, name: evaluator.name });

    return c.json({ success: true, evaluator });
  } catch (error) {
    console.log(`Error updating evaluator: ${error}`);
    return c.json({ error: "Error updating evaluator" }, 500);
  }
});

app.delete("/make-server-7946999d/evaluators/:id", async (c) => {
  const { error, user } = await verifyAuth(c.req.raw);
  if (error || !user) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  try {
    const id = c.req.param("id");
    await kv.del(`evaluators:${id}`);
    await kv.del(`evaluators:index:${id}`);

    return c.json({ success: true });
  } catch (error) {
    console.log(`Error deleting evaluator: ${error}`);
    return c.json({ error: "Error deleting evaluator" }, 500);
  }
});

// ===== EVALUATION ROUTES =====

app.post("/make-server-7946999d/evaluations", async (c) => {
  const auth = await requireAuthWithUserData(c.req.raw);
  if (auth.error || !auth.user) return c.json({ error: "Unauthorized" }, 401);
  const { user, role, companyId } = auth;

  try {
    const evaluationData = await c.req.json();
    if (isCompanyScopedRole(role)) {
      if (!companyId) return c.json({ error: "Usuário sem empresa vinculada" }, 403);
      if (evaluationData.companyId && evaluationData.companyId !== companyId) {
        return c.json({ error: "Forbidden" }, 403);
      }
      evaluationData.companyId = companyId;
    }
    const id = crypto.randomUUID();

    const evaluation = {
      id,
      ...evaluationData,
      status: "scheduled", // scheduled, in_progress, completed, cancelled
      voucherCode: crypto.randomUUID().substring(0, 8).toUpperCase(),
      voucherValidated: false,
      surveyId: evaluationData.surveyId || null,
      createdAt: new Date().toISOString(),
      createdBy: user.id,
    };

    await kv.set(`evaluations:${id}`, evaluation);

    // Index by evaluator and company for easy querying
    await kv.set(
      `evaluations:by_evaluator:${evaluation.evaluatorId}:${id}`,
      { id },
    );
    await kv.set(
      `evaluations:by_company:${evaluation.companyId}:${id}`,
      { id },
    );
    await kv.set(
      `evaluations:by_voucher:${evaluation.voucherCode}`,
      { id },
    );

    return c.json({ success: true, evaluation });
  } catch (error) {
    console.log(`Error creating evaluation: ${error}`);
    return c.json({ error: "Error creating evaluation" }, 500);
  }
});

app.get("/make-server-7946999d/evaluations", async (c) => {
  const auth = await requireAuthWithUserData(c.req.raw);
  if (auth.error || !auth.user) return c.json({ error: "Unauthorized" }, 401);
  const { role, companyId: scopedCompanyId, userData } = auth;

  try {
    const evaluatorId = c.req.query("evaluatorId");
    const companyId = c.req.query("companyId");

    let evaluations = [];

    const partnerPortalRole = isPartnerPortalRole(role);
    const sellerRole = isSellerRole(role);
    if (isCompanyScopedRole(role) || partnerPortalRole) {
      if (!scopedCompanyId) {
        return c.json({ error: "Usuário sem empresa vinculada" }, 403);
      }
      if (companyId && companyId !== scopedCompanyId) {
        return c.json({ error: "Forbidden" }, 403);
      }
      const keys = await kv.getByPrefix(
        `evaluations:by_company:${scopedCompanyId}:`,
      );
      const ids = keys.map((k) => k.value.id);
      evaluations = await Promise.all(
        ids.map((id) => kv.get(`evaluations:${id}`)),
      );
      if (evaluatorId) {
        evaluations = evaluations.filter((e) => e?.evaluatorId === evaluatorId);
      }
    } else if (evaluatorId) {
      const keys = await kv.getByPrefix(
        `evaluations:by_evaluator:${evaluatorId}:`,
      );
      const ids = keys.map((k) => k.value.id);
      evaluations = await Promise.all(
        ids.map((id) => kv.get(`evaluations:${id}`)),
      );
    } else if (companyId) {
      const keys = await kv.getByPrefix(
        `evaluations:by_company:${companyId}:`,
      );
      const ids = keys.map((k) => k.value.id);
      evaluations = await Promise.all(
        ids.map((id) => kv.get(`evaluations:${id}`)),
      );
    } else {
      const allEvals = await kv.getByPrefix("evaluations:");
      evaluations = allEvals
        .filter(
          (item) =>
            item.key.startsWith("evaluations:") &&
            !item.key.includes(":by_"),
        )
        .map((item) => item.value);
    }

    let filtered = evaluations.filter((e) => e !== null);

    // Parceiros: apenas avaliações concluídas (e sempre escopadas à empresa vinculada)
    if (partnerPortalRole) {
      filtered = filtered.filter((e: any) => e?.status === "completed");
    }

    // Vendedores: apenas avaliações atribuídas ao vendedor
    if (sellerRole) {
      const sellerId = (userData?.partnerId || "").toString().trim();
      if (!sellerId) {
        filtered = [];
      } else {
        const partner = await kv.get(`partners:${sellerId}`);
        const sellerLabels = new Set(
          [sellerId, partner?.name, partner?.email]
            .filter(Boolean)
            .map((v) => String(v).trim().toLowerCase()),
        );

        filtered = filtered.filter((e: any) => {
          const sellers = asStringArray(e?.visitData?.sellers).map((v) => String(v));
          if (sellers.includes(sellerId)) return true;
          const vendors = asStringArray(e?.visitData?.vendors).map((v) => String(v).trim().toLowerCase());
          return vendors.some((v) => sellerLabels.has(v));
        });
      }
    }

    return c.json({ evaluations: filtered });
  } catch (error) {
    console.log(`Error fetching evaluations: ${error}`);
    return c.json({ error: "Error fetching evaluations" }, 500);
  }
});

app.get("/make-server-7946999d/evaluations/:id", async (c) => {
  const auth = await requireAuthWithUserData(c.req.raw);
  if (auth.error || !auth.user) return c.json({ error: "Unauthorized" }, 401);
  const { role, companyId, userData } = auth;

  try {
    const id = c.req.param("id");
    let evaluation = await kv.get(`evaluations:${id}`);

    if (!evaluation) {
      return c.json({ error: "Evaluation not found" }, 404);
    }
    const partnerPortalRole = isPartnerPortalRole(role);
    const sellerRole = isSellerRole(role);
    if (isCompanyScopedRole(role) || partnerPortalRole) {
      if (!companyId) return c.json({ error: "Usuário sem empresa vinculada" }, 403);
      if (evaluation.companyId !== companyId) return c.json({ error: "Forbidden" }, 403);
    }
    if (partnerPortalRole && evaluation.status !== "completed") {
      return c.json({ error: "Forbidden" }, 403);
    }
    if (sellerRole) {
      const sellerId = (userData?.partnerId || "").toString().trim();
      if (!sellerId) return c.json({ error: "Forbidden" }, 403);

      const partner = await kv.get(`partners:${sellerId}`);
      const sellerLabels = new Set(
        [sellerId, partner?.name, partner?.email]
          .filter(Boolean)
          .map((v) => String(v).trim().toLowerCase()),
      );
      const sellers = asStringArray(evaluation?.visitData?.sellers).map((v) => String(v));
      const vendorTokens = asStringArray(evaluation?.visitData?.vendors).map((v) => String(v).trim().toLowerCase());
      const assigned =
        sellers.includes(sellerId) || vendorTokens.some((v) => sellerLabels.has(v));
      if (!assigned) return c.json({ error: "Forbidden" }, 403);
    }

    // Fallback: se não houver surveyData mas existir surveyResponseId, buscar no Postgres
    if (!evaluation.surveyData && evaluation.surveyResponseId) {
      const { data: resp } = await supabase
        .from("survey_responses")
        .select("id, raw_answers, sections_score")
        .eq("id", evaluation.surveyResponseId)
        .maybeSingle();
      if (resp) {
        evaluation = {
          ...evaluation,
          surveyData: {
            answers: resp.raw_answers || [],
            sectionsScore: resp.sections_score || [],
          },
        };
      }
    }

    return c.json({ evaluation });
  } catch (error) {
    console.log(`Error fetching evaluation: ${error}`);
    return c.json({ error: "Error fetching evaluation" }, 500);
  }
});

// Dashboard summary (médias e contagens) com filtros
app.get("/make-server-7946999d/dashboard/summary", async (c) => {
  const auth = await requireAuthWithUserData(c.req.raw);
  if (auth.error || !auth.user) return c.json({ error: "Unauthorized" }, 401);
  const { role, companyId: scopedCompanyId, userData, user } = auth;

  let companyId = c.req.query("companyId");
  let sellerId = c.req.query("sellerId");
  const managerId = c.req.query("managerId");
  const statusFilter = c.req.query("status"); // completed, scheduled, late
  const fromDate = c.req.query("from");
  const toDate = c.req.query("to");

  if (isCompanyScopedRole(role)) {
    if (!scopedCompanyId) return c.json({ error: "Usuário sem empresa vinculada" }, 403);
    if (companyId && companyId !== scopedCompanyId) return c.json({ error: "Forbidden" }, 403);
    companyId = scopedCompanyId;
  }

  // Vendedores: força filtro para o próprio vendedor (independe do client)
  if (isSellerRole(role)) {
    const enforcedSellerId = (userData?.partnerId || user?.id || "").toString().trim();
    if (!enforcedSellerId) return c.json({ error: "Usuário vendedor sem vínculo" }, 403);
    sellerId = enforcedSellerId;
  }

  const avg = (arr: number[]) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null);
  const parseDateVal = (val: string | undefined | null) => {
    if (!val) return null;
    // se vier timestamp numérico
    if (!isNaN(Number(val))) {
      const d = new Date(Number(val));
      if (!isNaN(d.getTime())) return d;
    }
    // corta hora se houver
    const [datePart] = val.split(/[ T]/);
    // tenta ISO direto
    let d = new Date(val);
    if (!isNaN(d.getTime())) return d;
    d = new Date(datePart);
    if (!isNaN(d.getTime())) return d;
    // tenta dd/mm/yyyy ou dd-mm-yyyy
    const m = datePart.match(/^(\d{2})[\/\-](\d{2})[\/\-](\d{4})$/);
    if (m) {
      const iso = `${m[3]}-${m[2]}-${m[1]}`;
      d = new Date(iso);
      if (!isNaN(d.getTime())) return d;
    }
    return null;
  };

  try {
    // Carrega avaliações do KV (apenas as principais)
    const all = await kv.getByPrefix("evaluations:");
    let evaluations = all
      .filter((item) => item.key.startsWith("evaluations:") && !item.key.includes(":by_"))
      .map((item) => item.value)
      .filter(Boolean);

    // Filtro por empresa
    if (companyId) {
      evaluations = evaluations.filter((e: any) => e.companyId === companyId);
    }
    // Filtro por vendedor/avaliador
    if (sellerId) {
      const normalizeToken = (value: any) =>
        String(value || "")
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .toLowerCase()
          .trim();
      const stopwords = new Set(["da", "de", "do", "dos", "das", "e"]);
      const tokenWords = (value: any) =>
        normalizeToken(value)
          .split(/\s+/)
          .filter((w) => w && !stopwords.has(w));

      const partner = await kv.get(`partners:${sellerId}`);
      const fallbackName = userData?.name || (user as any)?.user_metadata?.name || "";
      const fallbackEmail = userData?.email || user?.email || "";
      const sellerIdCandidates = [sellerId, userData?.partnerId, user?.id]
        .filter(Boolean)
        .map((v) => String(v).trim())
        .filter(Boolean);
      const sellerLabels = new Set(
        [sellerIdCandidates, partner?.name, partner?.email, fallbackName, fallbackEmail]
          .flat()
          .filter(Boolean)
          .map(normalizeToken),
      );
      const sellerNameWords = tokenWords(partner?.name || fallbackName);

      evaluations = evaluations.filter((e: any) => {
        const sellers = asStringArray(e?.visitData?.sellers).map((v) => String(v));
        if (sellerIdCandidates.some((id) => sellers.includes(id))) return true;

        const vendors = asStringArray(e?.visitData?.vendors).map((v) => String(v));
        for (const raw of vendors) {
          const tokenKey = normalizeToken(raw);
          if (tokenKey && sellerLabels.has(tokenKey)) return true;
          const words = tokenWords(raw);
          if (sellerNameWords.length && words.length && words.every((w) => sellerNameWords.includes(w))) return true;
        }
        return false;
      });
    }
    // Filtro por gerente (se existir campo managerId)
    if (managerId) {
      evaluations = evaluations.filter((e: any) => e.managerId === managerId);
    }
    // Filtro por período (usa scheduledDate)
    if (fromDate) {
      const from = parseDateVal(fromDate);
      evaluations = evaluations.filter((e: any) => {
        const d = parseDateVal(e.scheduledDate) || parseDateVal(e.createdAt);
        return d && from && d >= from;
      });
    }
    if (toDate) {
      const to = parseDateVal(toDate);
      evaluations = evaluations.filter((e: any) => {
        const d = parseDateVal(e.scheduledDate) || parseDateVal(e.createdAt);
        return d && to && d <= to;
      });
    }

    const today = new Date().toISOString().slice(0, 10);
    const isLate = (e: any) => e.status !== "completed" && e.scheduledDate && e.scheduledDate < today;

    // Filtro por status
    if (statusFilter === "completed") {
      evaluations = evaluations.filter((e: any) => e.status === "completed");
    } else if (statusFilter === "scheduled") {
      evaluations = evaluations.filter((e: any) => e.status !== "completed" && !isLate(e));
    } else if (statusFilter === "late") {
      evaluations = evaluations.filter((e: any) => isLate(e));
    }

    const completed = evaluations.filter((e: any) => e.status === "completed");
    const scheduled = evaluations.filter((e: any) => e.status !== "completed" && !isLate(e));
    const late = evaluations.filter((e: any) => isLate(e));

    const overallArr = completed.map((e: any) => e.aiAnalysis?.overallScore).filter((n: any) => typeof n === "number");
    const servirArr = completed.map((e: any) => e.aiAnalysis?.servirAvg).filter((n: any) => typeof n === "number");
    const goldArr = completed.map((e: any) => e.aiAnalysis?.goldAvg).filter((n: any) => typeof n === "number");
    const npsArr = completed.map((e: any) => e.aiAnalysis?.npsScore).filter((n: any) => typeof n === "number");
    const agArr = completed.map((e: any) => e.aiAnalysis?.agScore).filter((n: any) => typeof n === "number");

    const pillarKeys = ["S", "E", "R", "V", "I", "R_REL"];
    const goldKeys = ["G", "O", "L", "D"];
    const pillarScores: Record<string, number | null> = {};
    pillarKeys.forEach((k) => {
      const arr = completed
        .map((e: any) => e.aiAnalysis?.pillarScores?.[k])
        .filter((n: any) => typeof n === "number");
      pillarScores[k] = avg(arr);
    });
    const goldScores: Record<string, number | null> = {};
    goldKeys.forEach((k) => {
      const arr = completed
        .map((e: any) => e.aiAnalysis?.goldScores?.[k])
        .filter((n: any) => typeof n === "number");
      goldScores[k] = avg(arr);
    });

    // Linha do tempo (por data agendada)
    const seriesMap: Record<string, { overall: number[]; servir: number[]; gold: number[] }> = {};
    completed.forEach((e: any) => {
      const dObj = parseDateVal(e.scheduledDate) || parseDateVal(e.createdAt);
      if (!dObj) return;
      const dKey = dObj.toISOString().slice(0, 10);
      if (!seriesMap[dKey]) seriesMap[dKey] = { overall: [], servir: [], gold: [] };
      const a = e.aiAnalysis || {};
      if (typeof a.overallScore === "number") seriesMap[dKey].overall.push(a.overallScore * 10); // 0-100
      if (typeof a.servirAvg === "number") seriesMap[dKey].servir.push(a.servirAvg);
      if (typeof a.goldAvg === "number") seriesMap[dKey].gold.push(a.goldAvg);
    });
    let timeline = Object.entries(seriesMap)
      .map(([date, vals]) => ({
        date,
        overall: avg(vals.overall),
        servir: avg(vals.servir),
        gold: avg(vals.gold),
      }))
      .filter((t) => t.overall !== null || t.servir !== null || t.gold !== null)
      .sort((a, b) => (a.date < b.date ? -1 : 1));

    // Fallback: se não conseguimos plotar nada, gera pontos por mês com base nas concluídas
    if (timeline.length === 0 && completed.length > 0) {
      const monthMap: Record<string, { overall: number[]; servir: number[]; gold: number[] }> = {};
      completed.forEach((e: any) => {
        const dObj = parseDateVal(e.scheduledDate) || parseDateVal(e.createdAt);
        if (!dObj) return;
        const ym = `${dObj.getFullYear()}-${String(dObj.getMonth() + 1).padStart(2, "0")}`;
        if (!monthMap[ym]) monthMap[ym] = { overall: [], servir: [], gold: [] };
        const a = e.aiAnalysis || {};
        if (typeof a.overallScore === "number") monthMap[ym].overall.push(a.overallScore * 10);
        if (typeof a.servirAvg === "number") monthMap[ym].servir.push(a.servirAvg);
        if (typeof a.goldAvg === "number") monthMap[ym].gold.push(a.goldAvg);
      });
      timeline = Object.entries(monthMap)
        .map(([ym, vals]) => ({
          date: ym + "-01",
          overall: avg(vals.overall),
          servir: avg(vals.servir),
          gold: avg(vals.gold),
        }))
        .filter((t) => t.overall !== null || t.servir !== null || t.gold !== null)
        .sort((a, b) => (a.date < b.date ? -1 : 1));

      // Se ainda ficar vazio, gera uma sequência indexada
      if (timeline.length === 0) {
        timeline = completed
          .map((e: any, idx: number) => {
            const a = e.aiAnalysis || {};
            const ov = typeof a.overallScore === "number" ? a.overallScore * 10 : null;
            const se = typeof a.servirAvg === "number" ? a.servirAvg : null;
            const go = typeof a.goldAvg === "number" ? a.goldAvg : null;
            if (ov === null && se === null && go === null) return null;
            return {
              date: `Ponto-${idx + 1}`,
              overall: ov,
              servir: se,
              gold: go,
            };
          })
          .filter(Boolean) as any[];
      }
    }

    // Contagens de empresas e avaliadores (KV)
    let companiesCount = (await kv.getByPrefix("companies:")).filter(
      (i) => i.key.startsWith("companies:") && !i.key.includes(":index")
    ).length;
    let evaluatorsCount = (await kv.getByPrefix("evaluators:")).filter(
      (i) => i.key.startsWith("evaluators:") && !i.key.includes(":index")
    ).length;

    if (isCompanyScopedRole(role)) {
      companiesCount = companyId ? 1 : 0;
      evaluatorsCount = new Set(
        (evaluations as any[]).map((e) => e?.evaluatorId).filter(Boolean),
      ).size;
    }

    // Lista resumida (últimas 10)
    const recent = completed
      .sort((a: any, b: any) => (a.completedAt || "").localeCompare(b.completedAt || ""))
      .slice(-10)
      .map((e: any) => ({
        id: e.id,
        companyId: e.companyId,
        scheduledDate: e.scheduledDate,
        status: e.status,
        overall: e.aiAnalysis?.overallScore ?? null,
        servir: e.aiAnalysis?.servirAvg ?? null,
        gold: e.aiAnalysis?.goldAvg ?? null,
        nps: e.aiAnalysis?.npsScore ?? null,
        sellerLabel: (e.visitData?.vendors || "").toString().trim() || null,
      }));

    return c.json({
      counts: {
        totalEvaluations: evaluations.length,
        completed: completed.length,
        scheduled: scheduled.length,
        late: late.length,
        companies: companiesCount,
        evaluators: evaluatorsCount,
      },
      averages: {
        overall: avg(overallArr),
        servir: avg(servirArr),
        gold: avg(goldArr),
        nps: avg(npsArr),
        ag: avg(agArr),
      },
      pillars: pillarScores,
      goldPillars: goldScores,
      timeline,
      recentEvaluations: recent,
    });
  } catch (err) {
    console.log(`Error building dashboard summary: ${err}`);
    return c.json({ error: "Error building summary" }, 500);
  }
});

// Seed com dados fictícios para testes de dashboard (apenas admin/parceiro)
app.post("/make-server-7946999d/seed-fake-data", async (c) => {
  const { error, user } = await verifyAuth(c.req.raw);
  if (error || !user) return c.json({ error: "Unauthorized" }, 401);
  const kvUser = user.email ? await kv.get(`users:${user.email}`) : null;
  const rawRole =
    (user as any).role ||
    (user as any).user_metadata?.role ||
    (user as any).app_metadata?.role ||
    kvUser?.role ||
    "";
  const role = String(rawRole).toLowerCase();
  const isAdminEmail = user.email && user.email.toLowerCase() === "admin@sistema.com";
  if (!isAdminEmail && !["admin", "parceiro", "partner"].includes(role)) {
    return c.json({ error: "Forbidden" }, 403);
  }
  try {
    const body = await c.req.json().catch(() => ({}));
    const evalCount = Number(body.count) || 40;

    const companies = Array.from({ length: 5 }).map((_, i) => ({
      id: crypto.randomUUID(),
      name: `Empresa ${i + 1}`,
      createdAt: new Date().toISOString(),
      createdBy: user.id,
    }));
    for (const cpy of companies) {
      await kv.set(`companies:${cpy.id}`, cpy);
      await kv.set(`companies:index:${cpy.id}`, { id: cpy.id, name: cpy.name });
    }

    const evaluators = Array.from({ length: 10 }).map((_, i) => ({
      id: crypto.randomUUID(),
      name: `Avaliador ${i + 1}`,
      email: `avaliador${i + 1}@demo.com`,
      createdAt: new Date().toISOString(),
      createdBy: user.id,
    }));
    for (const ev of evaluators) {
      await kv.set(`evaluators:${ev.id}`, ev);
      await kv.set(`evaluators:index:${ev.id}`, { id: ev.id, name: ev.name });
    }

    // Gera avaliações distribuídas nos últimos 60 dias e próximos 30
    const today = new Date();
    const rand = (min: number, max: number) => Math.random() * (max - min) + min;
    const pick = <T,>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)];

    for (let i = 0; i < evalCount; i++) {
      const id = crypto.randomUUID();
      const company = pick(companies);
      const evaluator = pick(evaluators);
      const dayOffset = Math.floor(rand(-60, 30));
      const scheduledDate = new Date(today.getTime() + dayOffset * 86400000).toISOString().slice(0, 10);
      const status = dayOffset < 0 ? "completed" : "scheduled";

      const pillarScores = {
        S: Math.round(rand(4, 9) * 10) / 10,
        E: Math.round(rand(3, 9) * 10) / 10,
        R: Math.round(rand(3, 9) * 10) / 10,
        V: Math.round(rand(4, 9) * 10) / 10,
        I: Math.round(rand(4, 9) * 10) / 10,
        R_REL: Math.round(rand(3, 9) * 10) / 10,
      };
      const goldScores = {
        G: Math.round(rand(3, 9) * 10) / 10,
        O: Math.round(rand(3, 9) * 10) / 10,
        L: Math.round(rand(3, 9) * 10) / 10,
        D: Math.round(rand(3, 9) * 10) / 10,
      };
      const servirAvg = Object.values(pillarScores).reduce((a, b) => a + b, 0) / 6;
      const goldAvg = Object.values(goldScores).reduce((a, b) => a + b, 0) / 4;

      const evaluation = {
        id,
        companyId: company.id,
        evaluatorId: evaluator.id,
        surveyId: null,
        scheduledDate,
        period: ["manhã", "tarde", "noite"][Math.floor(Math.random() * 3)],
        status,
        voucherCode: crypto.randomUUID().substring(0, 8).toUpperCase(),
        voucherValidated: status === "completed",
        visitData: {
          startTime: "10:00",
          endTime: "11:00",
          sellers: [evaluator.id],
        },
        createdAt: new Date().toISOString(),
        createdBy: user.id,
      };

      if (status === "completed") {
        evaluation["aiAnalysis"] = {
          overallScore: Math.round(((servirAvg + goldAvg) / 2) * 10) / 10,
          servirAvg: Math.round(servirAvg * 10) / 10,
          goldAvg: Math.round(goldAvg * 10) / 10,
          npsScore: Math.round(rand(0, 10)),
          agScore: Math.round(rand(4, 9) * 10) / 10,
          pillarScores,
          goldScores,
          summary: "Atendimento simulado para testes do dashboard.",
          strengths: ["Simulação: saudação cordial", "Simulação: recomendações coerentes"],
          improvements: ["Simulação: explorar preferências", "Simulação: proatividade"],
          recommendationsSeller: ["Aprimorar descoberta de necessidades", "Ajustar abordagem consultiva"],
          recommendationsManager: ["Treinar equipe em O.A.R.", "Revisar script de saudação"],
          actionPlan: {
            "7dias": ["Reunião de feedback com equipe"],
            "30dias": ["Implementar checklist de recomendação"],
            "90dias": ["Avaliar progresso e novos treinamentos"],
          },
          generatedAt: new Date().toISOString(),
        };
        evaluation["completedAt"] = scheduledDate + "T10:00:00.000Z";
      }

      await kv.set(`evaluations:${id}`, evaluation);
      await kv.set(`evaluations:by_evaluator:${evaluation.evaluatorId}:${id}`, { id });
      await kv.set(`evaluations:by_company:${evaluation.companyId}:${id}`, { id });
      await kv.set(`evaluations:by_voucher:${evaluation.voucherCode}`, { id });
    }

    return c.json({ success: true, companies: companies.length, evaluators: evaluators.length, evaluations: evalCount });
  } catch (err) {
    console.log(`Error seeding data: ${err}`);
    return c.json({ error: "Error seeding data" }, 500);
  }
});
// Gera PDF da avaliação concluída seguindo modelo SERVIR+GOLD
app.post("/make-server-7946999d/evaluations/:id/pdf", async (c) => {
  const auth = await requireAuthWithUserData(c.req.raw);
  if (auth.error || !auth.user) return c.json({ error: "Unauthorized" }, 401);
  const { role, companyId } = auth;
  try {
    const id = c.req.param("id");
    const evaluation = await kv.get(`evaluations:${id}`);
    if (!evaluation) return c.json({ error: "Evaluation not found" }, 404);
    if (isCompanyScopedRole(role)) {
      if (!companyId) return c.json({ error: "Usuário sem empresa vinculada" }, 403);
      if (evaluation.companyId !== companyId) return c.json({ error: "Forbidden" }, 403);
    }
    if (evaluation.status !== "completed") {
      return c.json({ error: "Only completed evaluations can generate PDF" }, 400);
    }

    let company: any = {};
    try {
      company = (await kv.get(`companies:${evaluation.companyId}`)) || {};
    } catch (_) {
      company = {};
    }
    if (!company || Object.keys(company).length === 0) {
      const { data: companyRow } = await supabase
        .from("companies")
        .select("*")
        .eq("id", evaluation.companyId || "")
        .maybeSingle();
      company = companyRow || {};
    }
    const analysis = evaluation.aiAnalysis || {};

    try {
      const pdfBytes = await generateEvaluationPdf({ evaluation, company, analysis });
      const path = `reports/${id}.pdf`;
      const pdfBuffer = pdfBytes instanceof Uint8Array ? pdfBytes : new Uint8Array(pdfBytes);
      const uploadRes = await supabase.storage.from(BUCKET_NAME).upload(path, pdfBuffer, {
        contentType: "application/pdf",
        upsert: true,
      });
      if (uploadRes.error) {
        throw new Error(`Upload failed: ${uploadRes.error.message}`);
      }
      const signedRes = await supabase.storage.from(BUCKET_NAME).createSignedUrl(path, 60 * 60);
      if (signedRes.error) {
        throw new Error(`Signed URL failed: ${signedRes.error.message}`);
      }
      await kv.set(`evaluations:${id}`, { ...evaluation, reportUrl: signedRes.data?.signedUrl || null });
      return c.json({ url: signedRes.data?.signedUrl });
    } catch (err: any) {
      console.log("PDF generation error:", err);
      return c.json({ error: err?.message || "Error generating PDF" }, 500);
    }
  } catch (err) {
    console.log(`Error generating PDF: ${err}`);
    return c.json({ error: "Error generating PDF" }, 500);
  }
});

// Reprocess IA manually (admin/manager)
app.post("/make-server-7946999d/evaluations/:id/reanalyze", async (c) => {
  const auth = await requireAuthWithUserData(c.req.raw);
  if (auth.error || !auth.user) return c.json({ error: "Unauthorized" }, 401);
  const { user, role, companyId } = auth;
  console.log("[reanalyze] user:", user.email, "role:", role || "(none)");
  try {
    const id = c.req.param("id");
    const evaluation = await kv.get(`evaluations:${id}`);
    if (!evaluation) return c.json({ error: "Evaluation not found" }, 404);
    if (isCompanyScopedRole(role)) {
      if (!companyId) return c.json({ error: "Usuário sem empresa vinculada" }, 403);
      if (evaluation.companyId !== companyId) return c.json({ error: "Forbidden" }, 403);
    }
    if (!evaluation.surveyData?.answers || !evaluation.surveyId) {
      return c.json({ error: "Evaluation missing survey data" }, 400);
    }
    await analyzeEvaluationAI({
      evaluationId: id,
      companyId: evaluation.companyId,
      surveyId: evaluation.surveyId,
      answers: evaluation.surveyData.answers,
      visitData: evaluation.visitData,
      sectionsScore: evaluation.surveyData.sectionsScore,
    });
    return c.json({ success: true });
  } catch (err) {
    console.log(`Error reanalyzing evaluation: ${err}`);
    return c.json({ error: "Error reprocessing AI" }, 500);
  }
});

app.put("/make-server-7946999d/evaluations/:id", async (c) => {
  const auth = await requireAuthWithUserData(c.req.raw);
  if (auth.error || !auth.user) return c.json({ error: "Unauthorized" }, 401);
  const { role, companyId } = auth;

  try {
    const id = c.req.param("id");
    const updates = await c.req.json();
    const existing = await kv.get(`evaluations:${id}`);

    if (!existing) {
      return c.json({ error: "Evaluation not found" }, 404);
    }

    // Bloqueia alteração do vendedor avaliado (admin apenas, em avaliações concluídas)
    const requestedVisitData = updates?.visitData;
    const wantsSellerChange =
      requestedVisitData &&
      (requestedVisitData.sellers !== undefined || requestedVisitData.vendors !== undefined);
    if (wantsSellerChange) {
      if (role !== "admin" || existing.status !== "completed") {
        return c.json({ error: "Forbidden" }, 403);
      }
    }

    if (isCompanyScopedRole(role)) {
      if (!companyId) return c.json({ error: "Usuário sem empresa vinculada" }, 403);
      if (existing.companyId !== companyId) return c.json({ error: "Forbidden" }, 403);
      if (updates.companyId && updates.companyId !== companyId) return c.json({ error: "Forbidden" }, 403);
    }

    const evaluation = {
      ...existing,
      ...updates,
      id,
      companyId: isCompanyScopedRole(role) ? existing.companyId : (updates.companyId ?? existing.companyId),
      updatedAt: new Date().toISOString(),
    };

    await kv.set(`evaluations:${id}`, evaluation);

    return c.json({ success: true, evaluation });
  } catch (error) {
    console.log(`Error updating evaluation: ${error}`);
    return c.json({ error: "Error updating evaluation" }, 500);
  }
});

// Admin: alterar vendedor avaliado em avaliação concluída
app.put("/make-server-7946999d/evaluations/:id/evaluated-seller", async (c) => {
  const auth = await requireAuthWithUserData(c.req.raw);
  if (auth.error || !auth.user) return c.json({ error: "Unauthorized" }, 401);
  const { role } = auth;

  try {
    if (role !== "admin") return c.json({ error: "Forbidden" }, 403);

    const id = c.req.param("id");
    const body = await c.req.json();
    const sellerId = (body?.sellerId || "").toString().trim();
    if (!sellerId) return c.json({ error: "sellerId obrigatório" }, 400);

    const evaluation = await kv.get(`evaluations:${id}`);
    if (!evaluation) return c.json({ error: "Evaluation not found" }, 404);
    if (evaluation.status !== "completed") {
      return c.json({ error: "Apenas avaliações concluídas podem ser editadas" }, 400);
    }

    const partner = await kv.get(`partners:${sellerId}`);
    if (!partner) return c.json({ error: "Membro não encontrado" }, 400);
    if (!partner.companyId || partner.companyId !== evaluation.companyId) {
      return c.json({ error: "Membro não pertence à empresa desta avaliação" }, 400);
    }
    const partnerRole = normalizeRole(partner.role || "");
    if (!["vendedor", "seller", "gerente", "manager"].includes(partnerRole)) {
      return c.json({ error: "Membro inválido" }, 400);
    }

    const visitData = { ...(evaluation.visitData || {}) } as any;
    visitData.sellers = [sellerId];
    visitData.vendors = partner.name || partner.email || sellerId;

    const updated = {
      ...evaluation,
      visitData,
      updatedAt: new Date().toISOString(),
    };
    await kv.set(`evaluations:${id}`, updated);

    return c.json({ success: true, evaluation: updated });
  } catch (error) {
    console.log(`Error updating evaluated seller: ${error}`);
    return c.json({ error: "Error updating evaluated seller" }, 500);
  }
});

// Delete evaluation
app.delete("/make-server-7946999d/evaluations/:id", async (c) => {
  try {
    const auth = await requireAuthWithUserData(c.req.raw);
    if (auth.error || !auth.user) return c.json({ error: "Unauthorized" }, 401);
    const { user, role: requesterRole, companyId: requesterCompanyId } = auth;

    const { id } = c.req.param();
    const evaluation = await kv.get(`evaluations:${id}`);
    if (!evaluation) return c.json({ error: "Evaluation not found" }, 404);

    if (isCompanyScopedRole(requesterRole)) {
      if (!requesterCompanyId) return c.json({ error: "Usuário sem empresa vinculada" }, 403);
      if (evaluation.companyId !== requesterCompanyId) return c.json({ error: "Forbidden" }, 403);
    }

    const userData = user.email ? await kv.get(`users:${user.email}`) : null;
    const rawRole =
      (user as any).role ||
      (user as any).user_metadata?.role ||
      (user as any).app_metadata?.role ||
      userData?.role;
    const role = (rawRole || "").toString().toLowerCase();
    const isAdminEmail = user.email === "admin@sistema.com";
    const isCreator = evaluation.createdBy && evaluation.createdBy === user.id;
    if (!isAdminEmail && !isCreator && !["admin", "parceiro", "partner"].includes(role)) {
      return c.json({ error: "Forbidden" }, 403);
    }

    // Best-effort deletion: não falha se algum índice já não existir
    if (evaluation.evaluatorId) {
      try {
        await kv.del(`evaluations:by_evaluator:${evaluation.evaluatorId}:${id}`);
      } catch (idxErr) {
        console.log("Warn: delete eval by_evaluator idx", idxErr);
      }
    }
    if (evaluation.companyId) {
      try {
        await kv.del(`evaluations:by_company:${evaluation.companyId}:${id}`);
      } catch (idxErr) {
        console.log("Warn: delete eval by_company idx", idxErr);
      }
    }
    if (evaluation.voucherCode) {
      try {
        await kv.del(`evaluations:by_voucher:${evaluation.voucherCode}`);
      } catch (idxErr) {
        console.log("Warn: delete eval by_voucher idx", idxErr);
      }
    }

    try {
      await kv.del(`evaluations:${id}`);
    } catch (delErr) {
      console.log("Warn: delete evaluation record", delErr);
    }

    return c.json({ success: true });
  } catch (err) {
    console.log("Error deleting evaluation:", err);
    // mesmo com erro inesperado, não queremos quebrar em lote; retorna sucesso parcial
    return c.json({ success: true, warning: "Algumas avaliações podem não ter sido removidas" });
  }
});

// Find evaluation by voucher code
app.get(
  "/make-server-7946999d/evaluations/by-voucher/:code",
  async (c) => {
    const auth = await requireAuthWithUserData(c.req.raw);
    if (auth.error || !auth.user) return c.json({ error: "Unauthorized" }, 401);
    const { role, companyId } = auth;

    try {
      const code = c.req.param("code").toUpperCase();
      let evalRef = await kv.get(`evaluations:by_voucher:${code}`);
      let evaluation = evalRef
        ? await kv.get(`evaluations:${evalRef.id}`)
        : null;

      // Fallback: search all evaluations (in case older records have no index)
      if (!evaluation) {
        const allEvals = await kv.getByPrefix("evaluations:");
        evaluation = allEvals
          .filter(
            (item) =>
              item.key.startsWith("evaluations:") &&
              !item.key.includes(":by_"),
          )
          .map((item) => item.value)
          .find((e) => e?.voucherCode?.toUpperCase() === code);
      }

      if (!evaluation) {
        return c.json({ error: "Voucher não encontrado" }, 404);
      }
      if (isCompanyScopedRole(role)) {
        if (!companyId) return c.json({ error: "Usuário sem empresa vinculada" }, 403);
        if (evaluation.companyId !== companyId) return c.json({ error: "Forbidden" }, 403);
      }

      const company = await kv.get(`companies:${evaluation.companyId}`);
      const evaluator = await kv.get(
        `evaluators:${evaluation.evaluatorId}`,
      );

      return c.json({ evaluation, company, evaluator });
    } catch (err) {
      console.log(`Error fetching by voucher: ${err}`);
      return c.json({ error: "Erro ao buscar voucher" }, 500);
    }
  },
);

app.post(
  "/make-server-7946999d/evaluations/:id/validate-voucher",
  async (c) => {
    const auth = await requireAuthWithUserData(c.req.raw);
    if (auth.error || !auth.user) return c.json({ error: "Unauthorized" }, 401);
    const { user, role, companyId } = auth;

    try {
      const id = c.req.param("id");
      const { managerRating, managerNotes } = await c.req.json();
      const evaluation = await kv.get(`evaluations:${id}`);

      if (!evaluation) {
        return c.json({ error: "Evaluation not found" }, 404);
      }
      if (isCompanyScopedRole(role)) {
        if (!companyId) return c.json({ error: "Usuário sem empresa vinculada" }, 403);
        if (evaluation.companyId !== companyId) return c.json({ error: "Forbidden" }, 403);
      }

      evaluation.voucherValidated = true;
      evaluation.voucherValidatedAt = new Date().toISOString();
      evaluation.voucherValidatedBy = user.id;
      evaluation.managerRating = managerRating;
      evaluation.managerNotes = managerNotes;
      evaluation.status = "in_progress";
      evaluation.updatedAt = new Date().toISOString();

      await kv.set(`evaluations:${id}`, evaluation);

      return c.json({ success: true, evaluation });
    } catch (error) {
      console.log(`Error validating voucher: ${error}`);
      return c.json({ error: "Error validating voucher" }, 500);
    }
  },
);

// ===== FILE UPLOAD ROUTES =====

app.post("/make-server-7946999d/upload", async (c) => {
  const { error, user } = await verifyAuth(c.req.raw);
  if (error || !user) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  try {
    const formData = await c.req.formData();
    const file = formData.get("file") as File;
    const folder = (formData.get("folder") as string) || "general";

    if (!file) {
      return c.json({ error: "No file provided" }, 400);
    }

    const isLogoUpload = folder === "company-logos" || folder.startsWith("company-logos/");
    if (isLogoUpload) {
      if (!file.type?.startsWith("image/")) {
        return c.json({ error: "Logomarca deve ser uma imagem (PNG/JPG/WEBP)" }, 400);
      }
      if (typeof (file as any).size === "number" && (file as any).size > 5 * 1024 * 1024) {
        return c.json({ error: "Imagem muito grande (máx 5MB)" }, 400);
      }
    }

    const fileName = `${folder}/${crypto.randomUUID()}-${file.name}`;
    const arrayBuffer = await file.arrayBuffer();
    const buffer = new Uint8Array(arrayBuffer);

    const { data, error: uploadError } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(fileName, buffer, {
        contentType: file.type,
      });

    if (uploadError) {
      console.log(`Error uploading file: ${uploadError.message}`);
      return c.json({ error: uploadError.message }, 500);
    }

    // Create signed URL (valid for 1 year)
    const { data: urlData } = await supabase.storage
      .from(BUCKET_NAME)
      .createSignedUrl(fileName, 31536000);

    return c.json({
      success: true,
      path: fileName,
      url: urlData?.signedUrl,
    });
  } catch (error) {
    console.log(`Error in file upload: ${error}`);
    return c.json({ error: "Error uploading file" }, 500);
  }
});

app.get("/make-server-7946999d/file/:path", async (c) => {
  const { error, user } = await verifyAuth(c.req.raw);
  if (error || !user) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  try {
    const path = c.req.param("path");

    const { data: urlData, error: urlError } = await supabase.storage
      .from(BUCKET_NAME)
      .createSignedUrl(path, 3600); // 1 hour

    if (urlError) {
      console.log(`Error creating signed URL: ${urlError.message}`);
      return c.json({ error: urlError.message }, 500);
    }

    return c.json({ url: urlData.signedUrl });
  } catch (error) {
    console.log(`Error getting file URL: ${error}`);
    return c.json({ error: "Error getting file URL" }, 500);
  }
});

// ===== MATCHING ALGORITHM =====

app.get(
  "/make-server-7946999d/match-evaluators/:companyId",
  async (c) => {
    const auth = await requireAuthWithUserData(c.req.raw);
    if (auth.error || !auth.user) return c.json({ error: "Unauthorized" }, 401);
    const { role, companyId: scopedCompanyId } = auth;

    try {
      const companyId = c.req.param("companyId");
      const allowRepeats = c.req.query("allowRepeats") === "true";

      if (isCompanyScopedRole(role)) {
        if (!scopedCompanyId) return c.json({ error: "Usuário sem empresa vinculada" }, 403);
        if (companyId !== scopedCompanyId) return c.json({ error: "Forbidden" }, 403);
      }

      const company = await kv.get(`companies:${companyId}`);
      if (!company) {
        return c.json({ error: "Company not found" }, 404);
      }

      // Get all evaluators
      const evaluatorsData = await kv.getByPrefix("evaluators:");
      let evaluators = evaluatorsData
        .filter(
          (item) =>
            item.key.startsWith("evaluators:") &&
            !item.key.includes(":index:"),
        )
        .map((item) => item.value);

      // Filter out evaluators who have already evaluated this company (if not allowing repeats)
      if (!allowRepeats) {
        const companyEvaluations = await kv.getByPrefix(
          `evaluations:by_company:${companyId}:`,
        );
        const evaluatedEvaluatorIds = new Set();

        for (const evalRef of companyEvaluations) {
          const evaluation = await kv.get(
            `evaluations:${evalRef.value.id}`,
          );
          if (evaluation) {
            evaluatedEvaluatorIds.add(evaluation.evaluatorId);
          }
        }

        evaluators = evaluators.filter(
          (e) => !evaluatedEvaluatorIds.has(e.id),
        );
      }

      // Calculate match score based on socioeconomic profile
      evaluators = evaluators.map((evaluator) => {
        let matchScore = evaluator.score || 0;

        // Add matching logic based on socioeconomic profile
        if (company.socioeconomicProfile && evaluator.socioeconomicData) {
          // Simple matching - can be enhanced
          const profileMatch = Object.keys(company.socioeconomicProfile)
            .reduce((score, key) => {
              if (
                evaluator.socioeconomicData[key] ===
                  company.socioeconomicProfile[key]
              ) {
                return score + 10;
              }
              return score;
            }, 0);
          matchScore += profileMatch;
        }

        return { ...evaluator, matchScore };
      });

      // Sort by match score descending
      evaluators.sort((a, b) => b.matchScore - a.matchScore);

      return c.json({ evaluators });
    } catch (error) {
      console.log(`Error matching evaluators: ${error}`);
      return c.json({ error: "Error matching evaluators" }, 500);
    }
  },
);

// ===== ANALYTICS & REPORTS =====

app.get(
  "/make-server-7946999d/analytics/company/:companyId",
  async (c) => {
    const auth = await requireAuthWithUserData(c.req.raw);
    if (auth.error || !auth.user) return c.json({ error: "Unauthorized" }, 401);
    const { role, companyId: scopedCompanyId } = auth;

    try {
      const companyId = c.req.param("companyId");

      if (isCompanyScopedRole(role)) {
        if (!scopedCompanyId) return c.json({ error: "Usuário sem empresa vinculada" }, 403);
        if (companyId !== scopedCompanyId) return c.json({ error: "Forbidden" }, 403);
      }

      // Get all evaluations for this company
      const evaluationRefs = await kv.getByPrefix(
        `evaluations:by_company:${companyId}:`,
      );
      const evaluations = await Promise.all(
        evaluationRefs.map((ref) => kv.get(`evaluations:${ref.value.id}`)),
      );

      const completedEvaluations = evaluations.filter(
        (e) => e && e.status === "completed",
      );

      // Calculate statistics
      const totalEvaluations = evaluations.length;
      const completedCount = completedEvaluations.length;
      const averageManagerRating =
        completedEvaluations.reduce(
          (sum, e) => sum + (e.managerRating || 0),
          0,
        ) / (completedCount || 1);

      // Group by period
      const byPeriod = completedEvaluations.reduce((acc, e) => {
        const period = e.period || "unknown";
        acc[period] = (acc[period] || 0) + 1;
        return acc;
      }, {});

      return c.json({
        totalEvaluations,
        completedCount,
        averageManagerRating,
        byPeriod,
        evaluations: completedEvaluations,
      });
    } catch (error) {
      console.log(`Error fetching analytics: ${error}`);
      return c.json({ error: "Error fetching analytics" }, 500);
    }
  },
);

// ===== AI ANALYSIS =====

app.post(
  "/make-server-7946999d/analyze-evaluation/:id",
  async (c) => {
    const auth = await requireAuthWithUserData(c.req.raw);
    if (auth.error || !auth.user) return c.json({ error: "Unauthorized" }, 401);
    const { role, companyId } = auth;

    try {
      const id = c.req.param("id");
      const evaluation = await kv.get(`evaluations:${id}`);

      if (!evaluation) {
        return c.json({ error: "Evaluation not found" }, 404);
      }
      if (isCompanyScopedRole(role)) {
        if (!companyId) return c.json({ error: "Usuário sem empresa vinculada" }, 403);
        if (evaluation.companyId !== companyId) return c.json({ error: "Forbidden" }, 403);
      }

      // Simple analysis based on form responses
      // In a real implementation, this would use an AI API
      const analysis = {
        overallScore: evaluation.formResponses
          ? Object.values(evaluation.formResponses).reduce(
            (sum: number, val: any) => {
              if (typeof val === "number") return sum + val;
              return sum;
            },
            0,
          ) / Object.keys(evaluation.formResponses).length
          : 0,
        strengths: ["Atendimento cordial", "Ambiente limpo"],
        improvements: ["Tempo de espera", "Conhecimento do produto"],
        summary: `Avaliação ${
          evaluation.status === "completed" ? "completa" : "pendente"
        } realizada em ${
          new Date(evaluation.scheduledDate).toLocaleDateString("pt-BR")
        }.`,
        generatedAt: new Date().toISOString(),
      };

      // Update evaluation with analysis
      evaluation.aiAnalysis = analysis;
      evaluation.updatedAt = new Date().toISOString();
      await kv.set(`evaluations:${id}`, evaluation);

      return c.json({ success: true, analysis });
    } catch (error) {
      console.log(`Error analyzing evaluation: ${error}`);
      return c.json({ error: "Error analyzing evaluation" }, 500);
    }
  },
);

// ===== SURVEY BUILDER (CUSTOM FORMS) =====

// Create survey with sections/questions (admin only)
app.post("/make-server-7946999d/surveys", async (c) => {
  const { error, user } = await requireAdmin(c.req.raw);
  if (error || !user) {
    return c.json({ error: error === "Forbidden" ? "Forbidden" : "Unauthorized" }, error === "Forbidden" ? 403 : 401);
  }

  try {
    const payload = await c.req.json();
    const surveyId = crypto.randomUUID();
    const now = new Date().toISOString();

    await supabase.from("surveys").insert({
      id: surveyId,
      title: payload.title,
      description: payload.description || "",
      status: payload.status || "draft",
      created_by: user.id,
      created_at: now,
      updated_at: now,
    });

    if (Array.isArray(payload.sections)) {
      for (const section of payload.sections) {
        const sectionId = crypto.randomUUID();
        await supabase.from("survey_sections").insert({
          id: sectionId,
          survey_id: surveyId,
          title: section.title || "",
          "order": section.order ?? 0,
          weight: section.weight ?? 1,
          scoring_mode: section.scoring_mode || "soma",
          meta: section.meta || {},
        });

        if (Array.isArray(section.questions)) {
          const rows = section.questions.map((q: any, idx: number) => ({
            id: crypto.randomUUID(),
            survey_id: surveyId,
            section_id: sectionId,
            type: q.type,
            title: q.title,
            description: q.description || "",
            required: !!q.required,
            "order": q.order ?? idx,
            config: q.config || {},
            scoring: q.scoring || {},
            logic: q.logic || {},
            created_at: now,
          }));
          if (rows.length) {
            await supabase.from("survey_questions").insert(rows);
          }
        }
      }
    }

    return c.json({ success: true, surveyId });
  } catch (err) {
    console.log(`Error creating survey: ${err}`);
    return c.json({ error: "Erro ao criar questionário" }, 500);
  }
});

// Get survey with sections/questions
app.get("/make-server-7946999d/surveys/:id", async (c) => {
  const { error, user } = await verifyAuth(c.req.raw);
  if (error || !user) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  try {
    const id = c.req.param("id");
    const { data: survey } = await supabase.from("surveys").select("*").eq("id", id).maybeSingle();
    if (!survey) return c.json({ error: "Not found" }, 404);

    const { data: sections } = await supabase
      .from("survey_sections")
      .select("*")
      .eq("survey_id", id)
      .order("order", { ascending: true });

    const { data: questions } = await supabase
      .from("survey_questions")
      .select("*")
      .eq("survey_id", id)
      .order("order", { ascending: true });

    const grouped = (sections || []).map((s) => ({
      ...s,
      questions: (questions || []).filter((q) => q.section_id === s.id),
    }));

    return c.json({ survey, sections: grouped });
  } catch (err) {
    console.log(`Error fetching survey: ${err}`);
    return c.json({ error: "Erro ao buscar questionário" }, 500);
  }
});

// List surveys (admin only)
app.get("/make-server-7946999d/surveys", async (c) => {
  const { error, user } = await requireAdmin(c.req.raw);
  if (error || !user) {
    return c.json({ error: error === "Forbidden" ? "Forbidden" : "Unauthorized" }, error === "Forbidden" ? 403 : 401);
  }

  try {
    const { data } = await supabase
      .from("surveys")
      .select("*")
      .order("created_at", { ascending: false });
    return c.json({ surveys: data || [] });
  } catch (err) {
    console.log(`Error listing surveys: ${err}`);
    return c.json({ error: "Erro ao listar questionários" }, 500);
  }
});

// Delete survey
app.delete("/make-server-7946999d/surveys/:id", async (c) => {
  const { error, user } = await requireAdmin(c.req.raw);
  if (error || !user) {
    return c.json({ error: error === "Forbidden" ? "Forbidden" : "Unauthorized" }, error === "Forbidden" ? 403 : 401);
  }
  try {
    const id = c.req.param("id");
    await supabase.from("survey_questions").delete().eq("survey_id", id);
    await supabase.from("survey_sections").delete().eq("survey_id", id);
    await supabase.from("surveys").delete().eq("id", id);
    return c.json({ success: true });
  } catch (err) {
    console.log(`Error deleting survey: ${err}`);
    return c.json({ error: "Erro ao excluir questionário" }, 500);
  }
});

// Update survey (replace sections/questions)
app.put("/make-server-7946999d/surveys/:id", async (c) => {
  const { error, user } = await requireAdmin(c.req.raw);
  if (error || !user) {
    return c.json({ error: error === "Forbidden" ? "Forbidden" : "Unauthorized" }, error === "Forbidden" ? 403 : 401);
  }

  try {
    const surveyId = c.req.param("id");
    const payload = await c.req.json();
    const now = new Date().toISOString();

    await supabase.from("surveys")
      .update({
        title: payload.title,
        description: payload.description || "",
        status: payload.status || "draft",
        updated_at: now,
      })
      .eq("id", surveyId);

    // Remove existing sections/questions
    await supabase.from("survey_questions").delete().eq("survey_id", surveyId);
    await supabase.from("survey_sections").delete().eq("survey_id", surveyId);

    if (Array.isArray(payload.sections)) {
      for (const section of payload.sections) {
        const sectionId = crypto.randomUUID();
        await supabase.from("survey_sections").insert({
          id: sectionId,
          survey_id: surveyId,
          title: section.title || "",
          order: section.order ?? 0,
          weight: section.weight ?? 1,
          scoring_mode: section.scoring_mode || "soma",
          meta: section.meta || {},
        });

        if (Array.isArray(section.questions)) {
          const rows = section.questions.map((q: any, idx: number) => ({
            id: crypto.randomUUID(),
            survey_id: surveyId,
            section_id: sectionId,
            type: q.type,
            title: q.title,
            description: q.description || "",
            required: !!q.required,
            order: q.order ?? idx,
            config: q.config || {},
            scoring: q.scoring || {},
            logic: q.logic || {},
            created_at: now,
          }));
          if (rows.length) {
            await supabase.from("survey_questions").insert(rows);
          }
        }
      }
    }

    return c.json({ success: true, surveyId });
  } catch (err) {
    console.log(`Error updating survey: ${err}`);
    return c.json({ error: "Erro ao atualizar questionário" }, 500);
  }
});

// Import SurveyMonkey survey by ID (admin)
app.post("/make-server-7946999d/surveys/import", async (c) => {
  const { error, user } = await requireAdmin(c.req.raw);
  if (error || !user) {
    return c.json({ error: error === "Forbidden" ? "Forbidden" : "Unauthorized" }, error === "Forbidden" ? 403 : 401);
  }

  try {
    const body = await c.req.json();
    const surveyId = body.surveyId;
    const token = body.token;
    if (!surveyId || !token) {
      return c.json({ error: "Informe surveyId e token do SurveyMonkey" }, 400);
    }

    const smRes = await fetch(`https://api.surveymonkey.com/v3/surveys/${surveyId}/details`, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });
    const smData = await smRes.json();
    if (!smRes.ok) {
      return c.json({ error: smData.error || "Erro ao buscar survey no SurveyMonkey" }, 400);
    }

    const surveyTitle = smData.title || `SurveyMonkey ${surveyId}`;
    const surveyDescription = smData.custom_variables?.description || "";
    const now = new Date().toISOString();
    const newSurveyId = crypto.randomUUID();

    await supabase.from("surveys").insert({
      id: newSurveyId,
      title: surveyTitle,
      description: surveyDescription,
      status: "draft",
      created_by: user.id,
      created_at: now,
      updated_at: now,
    });

    function mapQuestion(smQ: any, order: number) {
      const family = smQ.family;
      const subtype = smQ.subtype;
      const required = smQ.required || false;
      const heading = smQ.headings?.[0]?.heading || "Pergunta";
      const description = smQ.headings?.[1]?.heading || "";
      let type = "text";
      const config: any = {};
      const answers = smQ.answers || {};
      const optsRaw = answers.choices || answers.options || [];
      const opts = Array.isArray(optsRaw) ? optsRaw.map((c: any) => c.text || c.label).filter(Boolean) : [];

      if (family === "single_choice") {
        // Dropdown, radio etc. tratamos como múltipla escolha de opção única
        type = subtype === "dropdown" ? "dropdown" : "multiple_choice";
        config.options = opts;
        config.allowOther = !!answers.other;
      } else if (family === "multiple_choice") {
        type = "checkbox";
        config.options = opts;
        config.allowOther = !!answers.other;
      } else if (family === "matrix") {
        type = "matrix";
        config.rows = (answers.rows || []).map((r: any) => r.text).filter(Boolean);
        config.cols = (answers.cols || []).map((r: any) => r.text).filter(Boolean);
      } else if (family === "rating") {
        // Pode representar estrelas ou slider; usamos estrela com max pelo número de choices
        type = "star_rating";
        config.max = answers?.choices?.length || 5;
      } else if (family === "nps") {
        type = "nps";
        config.min = 0;
        config.max = 10;
      } else if (family === "ranking") {
        type = "ranking";
        config.options = opts;
      } else if (family === "datetime") {
        type = "text";
      } else if (family === "file_upload") {
        type = "file_upload";
        config.maxSizeMB = 15;
      } else {
        type = "text";
      }

      return {
        id: crypto.randomUUID(),
        survey_id: newSurveyId,
        section_id: "",
        type,
        title: heading,
        description,
        required,
        order,
        config,
        scoring: { weight: 1 },
        logic: {},
        created_at: now,
      };
    }

    let sectionOrder = 0;
    for (const page of smData.pages || []) {
      const sectionId = crypto.randomUUID();
      await supabase.from("survey_sections").insert({
        id: sectionId,
        survey_id: newSurveyId,
        title: page.title || `Seção ${sectionOrder + 1}`,
        order: sectionOrder,
        weight: 1,
        scoring_mode: "soma",
        meta: {},
      });
      let qOrder = 0;
      const toInsert: any[] = [];
      for (const q of page.questions || []) {
        const mapped = mapQuestion(q, qOrder);
        mapped.section_id = sectionId;
        toInsert.push(mapped);
        qOrder += 1;
      }
      if (toInsert.length) {
        await supabase.from("survey_questions").insert(toInsert);
      }
      sectionOrder += 1;
    }

    return c.json({ success: true, surveyId: newSurveyId, title: surveyTitle });
  } catch (err) {
    console.log(`Error importing survey: ${err}`);
    return c.json({ error: "Erro ao importar questionário" }, 500);
  }
});

// Submit survey responses (for evaluator)
app.post("/make-server-7946999d/surveys/:id/responses", async (c) => {
  const { error, user } = await verifyAuth(c.req.raw);
  if (error || !user) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  try {
    const surveyId = c.req.param("id");
    const body = await c.req.json();
    const answers = Array.isArray(body.answers) ? body.answers : [];
    const evaluationId = body.evaluationId || null;
    const visitData = body.visitData || null;
    const receipt = body.receipt || null;
    const photos = Array.isArray(body.photos) ? body.photos : [];
    const now = new Date().toISOString();
    const responseId = crypto.randomUUID();

    const { data: sections } = await supabase
      .from("survey_sections")
      .select("*")
      .eq("survey_id", surveyId);
    const { data: questions } = await supabase
      .from("survey_questions")
      .select("*")
      .eq("survey_id", surveyId);

    const questionMap = new Map((questions || []).map((q) => [q.id, q]));

    // Compute scores by section (simple numeric scoring)
    const sectionScores: Record<string, { total: number; count: number; mode: string; weight: number }> = {};
    for (const section of sections || []) {
      sectionScores[section.id] = {
        total: 0,
        count: 0,
        mode: section.scoring_mode || "soma",
        weight: section.weight ?? 1,
      };
    }

    for (const ans of answers) {
      const q = questionMap.get(ans.questionId);
      if (!q) continue;
      const sectionId = q.section_id;
      const scoring = q.scoring || {};

      let score = 0;
      const weight = scoring.weight ?? 1;

      const type = q.type;
      const val = ans.value;

      const optionScores = scoring.optionScores || {};

      if (type === "star_rating" || type === "slider" || type === "nps") {
        if (typeof val === "number") score = val * weight;
      } else if (type === "multiple_choice" || type === "dropdown") {
        if (typeof val === "string" && optionScores[val] !== undefined) {
          score = optionScores[val] * weight;
        }
      } else if (type === "checkbox") {
        if (Array.isArray(val)) {
          for (const v of val) {
            if (optionScores[v] !== undefined) score += optionScores[v] * weight;
          }
        }
      } else if (type === "matrix") {
        // val expected as { rowId: colId }
        if (val && typeof val === "object") {
          for (const key of Object.keys(val)) {
            const sel = val[key];
            if (optionScores[key]?.[sel] !== undefined) {
              score += optionScores[key][sel] * weight;
            }
          }
        }
      }

      const sectionScore = sectionScores[sectionId];
      if (sectionScore) {
        sectionScore.total += score;
        sectionScore.count += 1;
      }
    }

    const sectionResults = Object.entries(sectionScores).map(([sectionId, data]) => {
      const base = data.mode === "media" && data.count > 0 ? data.total / data.count : data.total;
      return { sectionId, score: base * data.weight };
    });

    await supabase.from("survey_responses").insert({
      id: responseId,
      survey_id: surveyId,
      evaluation_id: evaluationId,
      user_id: user.id,
      created_at: now,
      sections_score: sectionResults,
      raw_answers: answers,
    });

    if (answers.length) {
      const answerRows = answers.map((ans: any) => ({
        id: crypto.randomUUID(),
        response_id: responseId,
        question_id: ans.questionId,
        value: ans.value,
      }));
      await supabase.from("survey_answers").insert(answerRows);
    }

    // Persist info on evaluation record (kv) for leitura posterior
    if (evaluationId) {
      const evalData = await kv.get(`evaluations:${evaluationId}`);
      if (evalData) {
        const updatedEval = {
          ...evalData,
          surveyResponseId: responseId,
          surveyData: {
            answers,
            sectionsScore: sectionResults,
          },
          visitData,
          attachments: {
            receipt,
            photos,
          },
          stage: "survey_submitted",
          updatedAt: now,
        };
        await kv.set(`evaluations:${evaluationId}`, updatedEval);

        // Dispara análise de IA logo após o envio
        try {
          await analyzeEvaluationAI({
            evaluationId,
            companyId: evalData.companyId,
            surveyId,
            answers,
            visitData,
            sectionsScore: sectionResults,
          });
        } catch (err) {
          console.log(`Failed to run AI analysis: ${err}`);
        }
      }
    }

    return c.json({ success: true, responseId, sectionResults });
  } catch (err) {
    console.log(`Error submitting survey: ${err}`);
    return c.json({ error: "Erro ao enviar respostas" }, 500);
  }
});

// Health check
app.get("/make-server-7946999d/health", (c) => {
  return c.json({ status: "ok", timestamp: new Date().toISOString() });
});

// ===== IA Helpers =====
async function analyzeEvaluationAI(payload: {
  evaluationId: string;
  companyId?: string;
  surveyId: string;
  answers: any[];
  visitData?: any;
  sectionsScore?: any[];
}) {
  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) {
    console.log("OPENAI_API_KEY não configurada; pulando análise IA.");
    return;
  }

  try {
    console.log(`IA: iniciando análise para evaluation ${payload.evaluationId}`);
    // Se não há respostas, não faz sentido rodar IA agora
    if (!payload.answers || payload.answers.length === 0) {
      console.log("IA: answers vazias, adiando análise.");
      return;
    }

    // Carrega config da empresa (modelo/temp) se existir
    const { data: cfgRow } = await supabase
      .from("ai_configs")
      .select("*")
      .eq("empresa_id", payload.companyId || "")
      .maybeSingle();

    const model = cfgRow?.modelo || "gpt-4o-mini";
    const temperature = cfgRow?.temp ?? 0.2;

    // Busca metadados das perguntas para mapear pilares e etiquetas
    const { data: questionsMeta } = await supabase
      .from("survey_questions")
      .select("id,title,description")
      .eq("survey_id", payload.surveyId);

    const pillarMap: Record<string, any> = {};
    const goldMap: Record<string, any> = {};
    const agScores: number[] = [];
    const npsScores: number[] = [];

    // Score helper conforme regras
    const scoreValue = (val: any) => {
      if (typeof val === "number") {
        if (val >= 0 && val <= 1) return val;
        if (val >= 0 && val <= 10) return Math.min(1, Math.max(0, val / 10));
        return 0;
      }
      const norm = String(val || "")
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .trim();
      if (!norm) return null;
      if (["sim","yes"].includes(norm)) return 1;
      if (["nao","não","no"].includes(norm)) return 0;
      if (["ruim"].includes(norm)) return 0;
      if (["bom","regular","ok"].includes(norm)) return 0.5;
      if (["otimo","ótimo","excelente","muito bom"].includes(norm)) return 1;
      return null;
    };

    const pushScore = (map: Record<string, any>, key: string, val: number | null) => {
      if (val === null || isNaN(val)) return;
      if (!map[key]) map[key] = [];
      map[key].push(val);
    };

    // Mapear respostas por pilar (S,E,R,V,I,R_REL) e GOLD (G,O,L,D)
    for (const ans of payload.answers) {
      const meta = questionsMeta?.find((q) => q.id === ans.questionId);
      const title = (meta?.title || "").trim();
      // extrai prefixos antes do espaço (ex: "S/G.3)" -> ["S","G"])
      const prefixRaw = title.split(/\s+/)[0];
      const cleaned = prefixRaw.replace(/[^A-Za-z/_-]/g, "").toUpperCase(); // remove números e pontuação
      const tokens = cleaned
        .split(/[\/]/)
        .flatMap((t) => t.split(/[-_]/))
        .filter((t) => t.length > 0);
      const mainToken = tokens[0] || "";

      let pillar: string | null = null;
      if (cleaned.startsWith("R_REL")) {
        pillar = "R_REL";
      } else if (["S","E","R","V","I","AG","NPS"].includes(mainToken)) pillar = mainToken;
      else if (mainToken.startsWith("R")) pillar = "R";

      const goldTags = tokens.slice(1).filter((t) => ["G","O","L","D"].includes(t));

      const sc = scoreValue(ans.value);
      // NPS especial por título, caso não venha com prefixo
      const titleLower = title.toLowerCase();
      if (!pillar && titleLower.includes("probabilidade de você recomendar nossa empresa para um amigo ou colega")) {
        pillar = "NPS";
      }
      if (pillar === "AG") {
        pushScore(pillarMap, "AG", sc ?? 0);
        agScores.push(sc ?? 0);
        continue;
      }
      if (pillar === "NPS") {
        const npsVal = typeof ans.value === "number" ? ans.value : parseFloat(ans.value);
        if (!isNaN(npsVal)) npsScores.push(npsVal);
        continue;
      }
      if (pillar) pushScore(pillarMap, pillar, sc ?? 0);
      goldTags.forEach((g) => pushScore(goldMap, g, sc ?? 0));
    }

    const avg = (arr: number[]) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null);
    const pillarScores: Record<string, number | null> = {};
    ["S","E","R","V","I","R_REL"].forEach((p) => {
      pillarScores[p] = pillarMap[p] ? avg(pillarMap[p]) : null;
    });
    const goldScores: Record<string, number | null> = {};
    ["G","O","L","D"].forEach((g) => {
      goldScores[g] = goldMap[g] ? avg(goldMap[g]) : null;
    });
    const servirAvg = avg(Object.values(pillarScores).filter((v) => v !== null) as number[]);
    const goldAvg = avg(Object.values(goldScores).filter((v) => v !== null) as number[]);
    const agAvg = avg(agScores);
    const npsAvg = avg(npsScores);
    const overallComputed = avg([servirAvg, goldAvg].filter((v) => v !== null) as number[]);

    const answersText = payload.answers
      .map((a: any, idx: number) => {
        const meta = questionsMeta?.find((q) => q.id === a.questionId);
        return `Q${idx + 1} (${meta?.title || a.questionId}): ${JSON.stringify(a.value)}`;
      })
      .join("\n");

    const prompt = `
Você é um analista de atendimento. Responda **exclusivamente em JSON** (objeto único) conforme os campos abaixo.
Regras de cálculo:
- Notas: Sim=1, Não=0, Ruim=0, Bom=0.5, Ótimo/Excelente=1. Números 0-10 normalizados para 0-1.
- Prefixos de pilares: S (Saudação Estratégica), E (Exploração de Preferências), R (Recomendação Personalizada),
  V (Valorização da Experiência), I (Implementação impecável), R_REL (Retorno & Relacionamento),
  AG (Aspectos Gerais), NPS (Net Promoter Score).
- GOLD: tags G,O,L,D indicam Disponibilidade, Atenção, Compreensão, Proatividade.
- Cada pilar: média das perguntas do pilar. SERVIR = média de S,E,R,V,I,R_REL. GOLD = média de G,O,L,D.
- Nota final = média entre SERVIR e GOLD. AG e NPS são separadas.

Campos do JSON de saída (obrigatório conter todos):
{
  "summary": string,
  "strengths": string[],
  "improvements": string[],
  "recommendationsSeller": string[],
  "recommendationsManager": string[],
  "actionPlan": { "7dias": string[], "30dias": string[], "90dias": string[] },
  "satisfactions": string[],
  "frustrations": string[],
  "strategicInsights": string[],
  "pillarScores": { "S": number|null, "E": number|null, "R": number|null, "V": number|null, "I": number|null, "R_REL": number|null },
  "goldScores": { "G": number|null, "O": number|null, "L": number|null, "D": number|null },
  "servirAvg": number|null,
  "goldAvg": number|null,
  "overallScore": number|null,  // escalar 0-10
  "agScore": number|null,       // 0-10
  "npsScore": number|null       // 0-10
}

Dados para análise:
- EmpresaId: ${payload.companyId || "n/d"}
- EvaluationId: ${payload.evaluationId}
- Início: ${payload.visitData?.startTime || "n/d"} | Fim: ${payload.visitData?.endTime || "n/d"}
- Respostas:
${answersText}
    `;

    const aiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        temperature,
        messages: [
          { role: "system", content: "Você gera análises curtas e objetivas e DEVE responder apenas em JSON." },
          { role: "user", content: prompt },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!aiRes.ok) {
      console.log(`AI call failed: ${aiRes.status} ${await aiRes.text()}`);
      return;
    }
    const aiJson = await aiRes.json();
    let parsed: any = {};
    try {
      parsed = JSON.parse(aiJson.choices[0].message.content);
    } catch (_) {
      parsed = { summary: aiJson.choices[0].message.content };
    }

    // Se o modelo não devolver nota, calcula uma média simples das seções ou respostas numéricas
    let computedScore: number | null = null;
    if (payload.sectionsScore && Array.isArray(payload.sectionsScore)) {
      const nums = payload.sectionsScore
        .map((s: any) => s?.score)
        .filter((n: any) => typeof n === "number");
      if (nums.length) {
        computedScore = nums.reduce((a: number, b: number) => a + b, 0) / nums.length;
      }
    }
    if (computedScore === null) {
      const numericAnswers = (payload.answers || [])
        .map((a: any) => a?.value)
        .filter((v: any) => typeof v === "number");
      if (numericAnswers.length) {
        computedScore = numericAnswers.reduce((a: number, b: number) => a + b, 0) / numericAnswers.length;
      }
    }

    // Atualiza avaliação com análise
    const evalData = await kv.get(`evaluations:${payload.evaluationId}`);
    if (evalData) {
      // Normaliza para escala 0-10
      const normalizedPillars = Object.fromEntries(
        Object.entries(pillarScores).map(([k, v]) => [k, v === null ? null : Math.round(v * 10 * 10) / 10])
      );
      const normalizedGold = Object.fromEntries(
        Object.entries(goldScores).map(([k, v]) => [k, v === null ? null : Math.round(v * 10 * 10) / 10])
      );
      const finalScore =
        overallComputed !== null
          ? overallComputed * 10
          : computedScore !== null
            ? computedScore * 10
            : null;
      const updated = {
        ...evalData,
        aiAnalysis: {
          overallScore: typeof finalScore === "number" ? Math.round(finalScore * 10) / 10 : null,
          summary: parsed.summary || "",
          strengths: parsed.strengths || [],
          improvements: parsed.improvements || [],
          recommendationsSeller: parsed.recommendationsSeller || [],
          recommendationsManager: parsed.recommendationsManager || [],
          actionPlan: parsed.actionPlan || {},
          satisfactions: parsed.satisfactions || [],
          frustrations: parsed.frustrations || [],
          strategicInsights: parsed.strategicInsights || [],
          pillarScores: normalizedPillars,
          goldScores: normalizedGold,
          servirAvg: servirAvg !== null ? Math.round(servirAvg * 10 * 10) / 10 : null,
          goldAvg: goldAvg !== null ? Math.round(goldAvg * 10 * 10) / 10 : null,
          agScore: agAvg !== null ? Math.round(agAvg * 10 * 10) / 10 : null,
          npsScore: npsAvg !== null ? Math.round(npsAvg * 10) : null,
          generatedAt: new Date().toISOString(),
        },
        updatedAt: new Date().toISOString(),
      };
      await kv.set(`evaluations:${payload.evaluationId}`, updated);
      console.log(`IA: análise salva em evaluation ${payload.evaluationId}`);
    }

    // Opcional: gravar histórico em tabela ai_analises se existir
    try {
      const payloadInsert: any = {
        created_at: new Date().toISOString(),
        empresa_id: payload.companyId || null,
        metodo: cfgRow?.metodo || "livre",
        job_id: crypto.randomUUID(),
        voucher: null,
        user_email: null,
        data: new Date().toISOString(),
        avaliado: null,
        pilares_json: parsed.pilares || normalizedPillars || null,
        atributos_gold_json: parsed.atributosGold || normalizedGold || null,
        media:
          overallComputed !== null
            ? overallComputed * 10
            : computedScore !== null
              ? computedScore * 10
              : null,
        aspectos_gerais: parsed.summary || null,
        nps: npsAvg !== null ? npsAvg : parsed.nps || null,
        pontos_fortes: parsed.strengths || null,
        pontos_fracos: parsed.improvements || null,
        plano_acao: parsed.planoAcao || parsed.actionPlan || null,
        pdf_url: null,
      };
      await supabase.from("ai_analises").insert(payloadInsert);
    } catch (err) {
      console.log(`ai_analises insert skipped/failed: ${err}`);
    }
  } catch (err) {
    console.log(`Error in analyzeEvaluationAI: ${err}`);
  }
}
Deno.serve(app.fetch);
