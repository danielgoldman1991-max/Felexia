import PDFDocument from "pdfkit";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import bidiFactory from "bidi-js";
import type { EInvoiceNormalizedSnapshot } from "./types";

type PdfLanguage = "fr" | "ar";
const ROOT = path.join(process.cwd(), "src/lib/e-invoicing/assets");
const WIDTH = 511;
const MARGIN = 42;
const NAVY = "#122B4A";
const BLUE = "#2457D6";
const INK = "#1F2937";
const MUTED = "#64748B";
const BORDER = "#DFE6EF";
const bidi = bidiFactory();
let fonts: Promise<{ latin: Buffer; arabic: Buffer }> | undefined;

function loadFonts() {
  fonts ??= (async () => {
    const manifest = JSON.parse(await readFile(path.join(ROOT, "font-manifest.json"), "utf8")) as { fonts: { file: string; sha256: string }[] };
    const result = await Promise.all(["notosans.ttf", "notonaskharabic.ttf"].map(async (name) => {
      const buffer = await readFile(path.join(ROOT, name));
      if (createHash("sha256").update(buffer).digest("hex") !== manifest.fonts.find(item => item.file === name)?.sha256) throw new Error("EINVOICE_FONT_INTEGRITY");
      return buffer;
    }));
    return { latin: result[0], arabic: result[1] };
  })();
  return fonts;
}

const STRINGS = {
  fr: { invoice: "FACTURE", credit: "AVOIR", issuer: "ÉMETTEUR", buyer: "CLIENT", date: "Date d’émission", due: "Échéance", number: "N° de document", original: "Facture d’origine", description: "Désignation", quantity: "Qté", unit: "P.U. HT", vat: "TVA", net: "HT net", total: "TTC", discount: "Remise", exempt: "Motif fiscal", payment: "Conditions de règlement", comments: "Informations complémentaires", subtotal: "Total HT net", tax: "Total TVA", gross: "TOTAL TTC", allowances: "Remises déjà incluses", unitCode: "Unité", taxBreakdown: "DÉTAIL DE TVA", taxable: "Base HT", profile: "Export UBL 2.1 générique · document non signé", statement: "Aucune transmission DGI attestée. Les règlements sont suivis séparément.", page: "Page", identity: "Empreinte de l’instantané", continuation: "Suite du document" },
  ar: { invoice: "فاتورة", credit: "إشعار دائن", issuer: "المُصدر", buyer: "العميل", date: "تاريخ الإصدار", due: "تاريخ الاستحقاق", number: "رقم الوثيقة", original: "الفاتورة الأصلية", description: "البيان", quantity: "الكمية", unit: "سعر الوحدة", vat: "الضريبة", net: "الصافي دون ضريبة", total: "المجموع", discount: "خصم", exempt: "السبب الضريبي", payment: "شروط الأداء", comments: "معلومات إضافية", subtotal: "المجموع دون ضريبة", tax: "مجموع الضريبة", gross: "المجموع شامل الضريبة", allowances: "الخصومات مشمولة مسبقاً", unitCode: "الوحدة", taxBreakdown: "تفاصيل الضريبة", taxable: "الأساس دون ضريبة", profile: "تصدير UBL 2.1 عام - وثيقة غير موقعة", statement: "لم يثبت أي إرسال إلى المديرية العامة للضرائب. تتم متابعة الأداءات بشكل منفصل.", page: "صفحة", identity: "بصمة النسخة المحفوظة", continuation: "تتمة الوثيقة" },
} satisfies Record<PdfLanguage, Record<string, string>>;

/** Real PDF bytes, generated exclusively from the same immutable snapshot as XML. */
export async function generateEInvoicePdf(snapshot: EInvoiceNormalizedSnapshot, options: { language?: PdfLanguage; snapshotSha256: string }): Promise<Buffer> {
  if (!/^[a-f0-9]{64}$/.test(options.snapshotSha256) || snapshot.lines.length > 500) throw new Error("EINVOICE_PDF_INPUT");
  const language = options.language === "ar" ? "ar" : "fr";
  const rtl = language === "ar";
  const s = STRINGS[language];
  const assets = await loadFonts();
  const issueTime = new Date(`${snapshot.issueDate}T00:00:00.000Z`);
  const doc = new PDFDocument({ size: "A4", margin: MARGIN, bufferPages: true, info: {
    Title: `${snapshot.sourceType === "customer_credit_note" ? s.credit : s.invoice} ${snapshot.number}`,
    Author: snapshot.seller.name, Subject: s.profile, Creator: "Felexia Pro", Producer: "Felexia Pro / PDFKit",
    CreationDate: issueTime, ModDate: issueTime,
  } });
  doc.registerFont("Latin", assets.latin);
  doc.registerFont("Arabic", assets.arabic);
  const chunks: Buffer[] = [];
  const completed = new Promise<Buffer>((resolve, reject) => {
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("error", reject);
    doc.on("end", () => resolve(Buffer.concat(chunks)));
  });
  const hasArabic = (value: string) => /[\u0600-\u06ff\u0750-\u077f\u08a0-\u08ff]/.test(value);
  type EmbeddedFont = { ascender: number; descender: number; unicode: number[][]; font: { layout: (value: string, features?: unknown, script?: unknown, language?: unknown, direction?: string) => unknown } };
  const embeddedFonts = new Set<EmbeddedFont>();
  let runDirection: "ltr" | "rtl" = "ltr";
  function applyFont(value: string, size = 9, direction: "ltr" | "rtl" = "ltr") {
    runDirection = direction;
    doc.font(hasArabic(value) || direction === "rtl" ? "Arabic" : "Latin").fontSize(size);
    // PDFKit 0.20 delegates shaping to Fontkit but exposes no run direction.
    // Adapt this document's font instances only; never modify a package/global.
    const embedded = (doc as unknown as { _font: EmbeddedFont })._font;
    if (!embeddedFonts.has(embedded)) {
      const layout = embedded.font.layout.bind(embedded.font);
      embedded.font.layout = (value, features, script, language, direction) => {
        const supplied = Array.isArray(features) ? Object.fromEntries(features.map(feature => [String(feature), true])) : features && typeof features === "object" ? features : {};
        // BiDi above already mirrors punctuation; Fontkit must not mirror twice.
        return layout(value, { ...supplied, rtlm: false }, script, language, direction ?? runDirection);
      };
      embeddedFonts.add(embedded);
    }
    return embedded;
  }
  type TextRun = { value: string; direction: "ltr" | "rtl"; width: number; ascent: number; descent: number };
  type TextLine = { value: string; runs: TextRun[]; width: number; ascent: number; height: number };
  const layoutCache = new Map<string, TextLine[]>();
  function runsFor(value: string, size: number): TextRun[] {
    if (!value) return [];
    // Content keeps its natural paragraph direction: Latin addresses and bank
    // references remain LTR inside an Arabic document, Arabic prose stays RTL.
    const levels = bidi.getEmbeddingLevels(value, "auto");
    const logical: { start: number; end: number; level: number }[] = [];
    for (let index = 0; index < value.length; index++) {
      const previous = logical[logical.length - 1];
      if (previous && previous.level === levels.levels[index]) previous.end = index + 1;
      else logical.push({ start: index, end: index + 1, level: levels.levels[index] });
    }
    const order = bidi.getReorderedIndices(value, levels);
    const seen = new Set<number>();
    const visual: TextRun[] = [];
    for (const index of order) {
      const runIndex = logical.findIndex(run => index >= run.start && index < run.end);
      if (seen.has(runIndex)) continue;
      seen.add(runIndex);
      const run = logical[runIndex];
      const direction = run.level % 2 ? "rtl" : "ltr";
      // Keep logical Arabic characters for Fontkit shaping. Only order the runs,
      // otherwise both BiDi and Fontkit would reverse the Arabic glyphs.
      const text = Array.from(value.slice(run.start, run.end), character => direction === "rtl" ? bidi.getMirroredCharacter(character) ?? character : character).join("").replace(/[\u200e\u200f\u202a-\u202e\u2066-\u2069]/g, "");
      if (!text) continue;
      const embedded = applyFont(text, size, direction);
      visual.push({ value: text, direction, width: doc.widthOfString(text, { features: [] }), ascent: embedded.ascender * size / 1000, descent: -embedded.descender * size / 1000 });
    }
    return visual;
  }
  function lineFor(value: string, size: number): TextLine {
    const runs = runsFor(value, size);
    const ascent = Math.max(size, ...runs.map(run => run.ascent));
    return { value, runs, width: runs.reduce((sum, run) => sum + run.width, 0), ascent, height: ascent + Math.max(size * 0.25, ...runs.map(run => run.descent)) + 2 };
  }
  function layout(value: string, width: number, size: number): TextLine[] {
    const key = JSON.stringify([value, width, size]);
    const cached = layoutCache.get(key);
    if (cached) return cached;
    const lines: TextLine[] = [];
    for (const paragraph of value.split("\n")) {
      let current = "";
      for (const token of paragraph.match(/\S+\s*/gu) ?? []) {
        if (lineFor(current + token.trimEnd(), size).width <= width) { current += token; continue; }
        if (current.trim()) { lines.push(lineFor(current.trimEnd(), size)); current = ""; }
        if (lineFor(token.trimEnd(), size).width <= width) { current = token; continue; }
        // Long references are wrapped at grapheme boundaries, never inside a
        // surrogate pair or an Arabic combining-mark cluster.
        for (const { segment } of new Intl.Segmenter(language, { granularity: "grapheme" }).segment(token)) {
          if (current && lineFor(current + segment, size).width > width) { lines.push(lineFor(current, size)); current = ""; }
          current += segment;
        }
      }
      lines.push(lineFor(current.trimEnd(), size));
    }
    layoutCache.set(key, lines);
    return lines;
  }
  function drawLine(line: TextLine, x: number, y: number, width: number, size: number, color: string, alignment: "left" | "right" | "center") {
    let cursor = x + (alignment === "right" ? width - line.width : alignment === "center" ? (width - line.width) / 2 : 0);
    doc.markContent("Span", { actual: line.value, lang: language === "ar" ? "ar-MA" : "fr-MA" });
    for (const run of line.runs) {
      applyFont(run.value, size, run.direction);
      doc.fillColor(color).text(run.value, cursor, y + line.ascent, { lineBreak: false, baseline: "alphabetic", features: [] });
      cursor += run.width;
    }
    doc.endMarkedContent();
  }
  function text(value: string, x: number, y: number, width: number, size = 9, color = INK, alignment?: "left" | "right" | "center") {
    for (const line of layout(value, width, size)) {
      drawLine(line, x, y, width, size, color, alignment ?? (rtl ? "right" : "left"));
      y += line.height;
    }
  }
  function height(value: string, width: number, size = 9) { return layout(value, width, size).reduce((sum, line) => sum + line.height, 0); }
  const rule = (y: number) => doc.lineWidth(0.6).strokeColor(BORDER).moveTo(MARGIN, y).lineTo(MARGIN + WIDTH, y).stroke();
  let y = MARGIN;
  function pageHeader(continuation = false) {
    doc.rect(0, 0, doc.page.width, 8).fill(BLUE);
    text("FELEXIA PRO", MARGIN, 23, 180, 9, BLUE, "left");
    text(continuation ? s.continuation : (snapshot.sourceType === "customer_credit_note" ? s.credit : s.invoice), MARGIN, 40, WIDTH, continuation ? 14 : 22, NAVY, rtl ? "right" : "left");
    text(snapshot.number, MARGIN, 73, WIDTH, 11, NAVY, rtl ? "right" : "left");
    y = 96;
    rule(y);
    y += 14;
  }
  function ensure(room: number) {
    if (y + room <= 744) return;
    newPage();
  }
  function newPage() {
    if (doc.bufferedPageRange().count >= 100) throw new Error("EINVOICE_PDF_PAGE_LIMIT");
    doc.addPage();
    pageHeader(true);
  }
  const date = (value: string | null | undefined) => value ? value.slice(0, 10).split("-").reverse().join("/") : "—";
  function identity(party: EInvoiceNormalizedSnapshot["seller"], label: string, x: number, top: number) {
    const w = 241;
    const addressText = [party.address, [party.postalCode, party.city, party.countryCode].filter(Boolean).join(" ")].filter(Boolean).join("\n");
    const identifiers = [party.ice ? `ICE  ${party.ice}` : "", party.ifNumber ? `IF  ${party.ifNumber}` : "", party.rc ? `RC  ${party.rc}` : ""].filter(Boolean);
    const identityHeight = 24 + height(party.name, w, 11.5) + height(addressText, w, 8) + identifiers.reduce((sum, item) => sum + height(item, w, 7.5) + 1, 0);
    if (top + identityHeight > 720) throw new Error("EINVOICE_PDF_IDENTITY_TOO_LONG");
    text(label, x, top, w, 8, MUTED, rtl ? "right" : "left");
    let cursor = top + 14;
    text(party.name, x, cursor, w, 11.5, NAVY);
    cursor += height(party.name, w, 11.5) + 4;
    const address = [party.address, [party.postalCode, party.city, party.countryCode].filter(Boolean).join(" ")].filter(Boolean).join("\n");
    text(address, x, cursor, w, 8, MUTED);
    cursor += height(address, w, 8) + 5;
    for (const item of [party.ice ? `ICE  ${party.ice}` : "", party.ifNumber ? `IF  ${party.ifNumber}` : "", party.rc ? `RC  ${party.rc}` : ""].filter(Boolean)) {
      text(item, x, cursor, w, 7.5, INK, rtl ? "right" : "left");
      cursor += height(item, w, 7.5) + 1;
    }
    return cursor;
  }
  pageHeader();
  const issuerX = rtl ? MARGIN + WIDTH - 241 : MARGIN;
  const buyerX = rtl ? MARGIN : MARGIN + WIDTH - 241;
  y = Math.max(identity(snapshot.seller, s.issuer, issuerX, y), identity(snapshot.buyer, s.buyer, buyerX, y)) + 9;
  rule(y);
  y += 9;
  const metadata = [[s.date, date(snapshot.issueDate)], [s.due, date(snapshot.dueDate)], ...(snapshot.originalInvoiceReference ? [[s.original, snapshot.originalInvoiceReference]] : [])];
  const metadataWidth = (WIDTH - 18 * (metadata.length - 1)) / metadata.length;
  let metadataHeight = 0;
  for (const [index, [label, value]] of metadata.entries()) {
    const x = MARGIN + (rtl ? metadata.length - index - 1 : index) * (metadataWidth + 18);
    const labelHeight = height(label, metadataWidth, 7.5);
    text(label, x, y, metadataWidth, 7.5, MUTED);
    text(value, x, y + labelHeight + 3, metadataWidth, 9, INK);
    metadataHeight = Math.max(metadataHeight, labelHeight + 3 + height(value, metadataWidth, 9));
  }
  y += metadataHeight + 9;
  type Column = { key: "description" | "quantity" | "unit" | "vat" | "net" | "total"; width: number; label: string };
  let columns: Column[] = [{ key: "description", width: 220, label: s.description }, { key: "quantity", width: 43, label: s.quantity }, { key: "unit", width: 70, label: s.unit }, { key: "vat", width: 42, label: s.vat }, { key: "net", width: 64, label: s.net }, { key: "total", width: 72, label: s.total }];
  if (rtl) columns = columns.reverse();
  function tableHeader() {
    const headerHeight = rtl ? 35 : 29;
    doc.roundedRect(MARGIN, y, WIDTH, headerHeight, 4).fill("#EDF3FA");
    let x = MARGIN;
    for (const column of columns) {
      text(column.label, x + 7, y + 7, column.width - 14, 7.5, NAVY, column.key === "description" ? (rtl ? "right" : "left") : "right");
      x += column.width;
    }
    y += headerHeight + 5;
  }
  ensure(70);
  tableHeader();
  for (const line of snapshot.lines) {
    // Technical information sits with its value. Fiscal reasons are stated in
    // the tax breakdown, avoiding the same paragraph on every exempt line.
    const values = { description: line.description, quantity: `${line.quantity}\n${line.unitCode}`, unit: [line.unitPriceHt, line.discountRate !== "0.00" ? `-${line.discountRate}%` : ""].filter(Boolean).join("\n"), vat: `${line.taxRate}%\n${line.taxCategory}`, net: line.subtotalHt, total: line.totalTtc };
    const sizes = Object.fromEntries(columns.map(column => {
      const value = values[column.key];
      let size = column.key === "description" ? 8 : 8.2;
      applyFont(value, size);
      while (column.key !== "description" && Math.max(...value.split("\n").map(part => doc.widthOfString(part))) > column.width - 14 && size > 6) { size -= 0.25; applyFont(value, size); }
      return [column.key, size];
    })) as Record<Column["key"], number>;
    const rowHeight = Math.max(30, ...columns.map(column => height(values[column.key], column.width - 14, sizes[column.key]) + 12));
    if (rowHeight > 560) throw new Error("EINVOICE_PDF_LINE_TOO_LONG");
    if (y + rowHeight > 744) { newPage(); tableHeader(); }
    let x = MARGIN;
    for (const column of columns) {
      const value = values[column.key];
      text(value, x + 7, y + 4, column.width - 14, sizes[column.key], column.key === "total" ? NAVY : INK, column.key === "description" ? (rtl ? "right" : "left") : "right");
      x += column.width;
    }
    y += rowHeight;
    rule(y - 3);
    y += 2;
  }
  y += 8;
  const totalsHeight = 38 + 43 + (snapshot.totals.discountTotal !== "0.00" ? 17 : 0);
  ensure(totalsHeight);
  for (const [label, value] of [[s.subtotal, snapshot.totals.subtotalHt], [s.tax, snapshot.totals.taxTotal]]) {
    text(label, MARGIN + 210, y, 170, 10, MUTED, rtl ? "right" : "left");
    text(`${value} ${snapshot.currency}`, MARGIN + 382, y, 129, 10, INK, "right");
    y += 19;
  }
  doc.roundedRect(MARGIN + 200, y, WIDTH - 200, 35, 5).fill(NAVY);
  text(s.gross, MARGIN + 212, y + 8, 155, 9, "#FFFFFF", rtl ? "right" : "left");
  text(`${snapshot.totals.totalTtc} ${snapshot.currency}`, MARGIN + 370, y + 7, 129, 12, "#FFFFFF", "right");
  y += 43;
  if (snapshot.totals.discountTotal !== "0.00") {
    text(`${s.allowances} : ${snapshot.totals.discountTotal} ${snapshot.currency}`, MARGIN, y, WIDTH, 8, MUTED, rtl ? "right" : "left");
    y += 17;
  }
  y += 2;
  ensure(36);
  text(s.taxBreakdown, MARGIN, y, WIDTH, 9, NAVY, rtl ? "right" : "left");
  text(`${s.taxable} / ${s.vat}`, rtl ? MARGIN : MARGIN + 285, y, WIDTH - 285, 7.5, MUTED, rtl ? "left" : "right");
  y += 19;
  for (const tax of snapshot.taxSubtotals) {
    const label = `${tax.category} · ${tax.rate}%${tax.exemptionReason ? ` · ${tax.exemptionReason}` : ""}`;
    const room = Math.max(16, height(label, 270, 7.5) + 4);
    ensure(room);
    text(label, MARGIN, y, 270, 7.5, MUTED);
    text(`${tax.taxableAmount} / ${tax.taxAmount} ${snapshot.currency}`, MARGIN + 285, y, WIDTH - 285, 7.5, INK, "right");
    y += room;
  }
  const informationBlocks: [string, string | null | undefined][] = [[s.payment, snapshot.paymentTerms], [s.comments, [snapshot.reason, snapshot.notes].filter(Boolean).join("\n")]];
  for (const [title, value] of informationBlocks) {
    if (!value) continue;
    const paragraphs = String(value).split("\n");
    y += 8;
    ensure(35);
    text(title, MARGIN, y, WIDTH, 9, NAVY, rtl ? "right" : "left");
    y += 17;
    for (const paragraph of paragraphs) {
      const paragraphLines = layout(paragraph, WIDTH, 8);
      for (const [index, line] of paragraphLines.entries()) {
        // Keep a paragraph's opening and final two lines together at page turns.
        const next = paragraphLines[index + 1];
        ensure(line.height + (next && (index === 0 || index >= paragraphLines.length - 2) ? next.height : 0) + 4);
        drawLine(line, MARGIN, y, WIDTH, 8, MUTED, rtl ? "right" : "left");
        y += line.height;
      }
      y += 4;
    }
  }
  const range = doc.bufferedPageRange();
  for (let index = 0; index < range.count; index++) {
    doc.switchToPage(range.start + index);
    rule(754);
    text(s.profile, MARGIN, 762, WIDTH - 70, 6.8, MUTED, rtl ? "right" : "left");
    text(`${s.page} ${index + 1}/${range.count}`, MARGIN + WIDTH - 65, 762, 65, 7, MUTED, "right");
    text(s.statement, MARGIN, 775, WIDTH, 6.5, MUTED, rtl ? "right" : "left");
    text(`SHA-256 ${options.snapshotSha256}`, MARGIN, 788, WIDTH, 5.7, MUTED, "left");
  }
  // Fontkit adds zero-advance mark components with no Unicode codepoint.
  // PDFKit would write invalid `<>` ToUnicode destinations for these glyphs.
  // A zero-width space is a valid mapping; /ActualText retains the full logical
  // source line for copy/paste and accessible readers without inventing text.
  for (const embedded of embeddedFonts) embedded.unicode = embedded.unicode.map(points => points.length ? points : [0x200B]);
  doc.end();
  const result = await completed;
  if (result.length > 2 * 1024 * 1024 || !result.subarray(0, 5).equals(Buffer.from("%PDF-"))) throw new Error("EINVOICE_PDF_LIMIT");
  return result;
}
