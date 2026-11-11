import type { OcrInvoiceLine, OcrSupplierInvoice } from "@/lib/purchases/supplier-invoice-ocr";

export type TextToken = { text: string; x: number; y: number; w: number; h: number };

const MONTHS: Record<string, number> = {
  janvier: 1, fevrier: 2, février: 2, mars: 3, avril: 4, mai: 5, juin: 6,
  juillet: 7, aout: 8, août: 8, septembre: 9, octobre: 10, novembre: 11, decembre: 12, décembre: 12,
};

const LABEL = /^(ice|i\.f|if|r\.c|rc|patente|cnss|facture|date|éch[ée]ance|echeance|client|acheteur|adresse|t[ée]l|email|e-mail|total|tva|d[ée]signation|qt[ée]|montant|n°)/i;

export function parseFrAmount(raw: string): number | null {
  const trimmed = raw.replace(/\u00a0/g, " ").trim();
  const match = trimmed.match(/-?\d[\d\s.]*[,.]?\d*/);
  if (!match) return null;
  let value = match[0].replace(/\s/g, "");
  if (value.includes(",") && value.includes(".")) value = value.replace(/\./g, "").replace(",", ".");
  else if (value.includes(",")) value = value.replace(",", ".");
  const parsed = Number(value);
  return Number.isFinite(parsed) ? round2(parsed) : null;
}

export function parseFrenchDate(raw: string): string {
  const numeric = raw.match(/(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})/);
  if (numeric) return iso(Number(numeric[3]), Number(numeric[2]), Number(numeric[1]));
  const written = raw.match(/(\d{1,2})\s+([A-Za-zÀ-ÿ]+)\s+(\d{4})/);
  if (!written) return "";
  const month = MONTHS[fold(written[2])];
  return month ? iso(Number(written[3]), month, Number(written[1])) : "";
}

export function parseInvoiceText(text: string, buyerIce?: string): OcrSupplierInvoice {
  const tokens = text.split(/\n/).map((line, index) => ({ text: line.trim(), x: 40, y: index * 18, w: 480, h: 12 })).filter((token) => token.text);
  return parseInvoiceDocument(tokens, { buyerIce });
}

export function parseInvoiceDocument(tokens: TextToken[], options?: { buyerIce?: string }): OcrSupplierInvoice {
  const invoice = emptyInvoice();
  const lines = groupLines(tokens.filter((token) => token.text.trim()));
  const blocks = lines.flatMap(splitColumns);
  const joined = lines.map(lineText).join("\n");
  const buyerIce = (options?.buyerIce ?? "").replace(/\D/g, "");
  const ices = findIces(blocks).filter((item) => item.value !== buyerIce);
  const sellerIce = ices[0];
  if (sellerIce) setField(invoice, "ice", sellerIce.value, 0.92);
  const sellerX = sellerIce?.x ?? lines[0]?.tokens[0]?.x ?? 0;
  const buyerPoints = findIces(blocks).filter((item) => item.value === buyerIce);
  const name = sellerName(blocks, sellerX, buyerPoints);
  if (name) setField(invoice, "supplierName", name, 0.86);
  const scoped = blocks.filter((line) => !isBuyerLine(line, buyerPoints));
  const text = scoped.map(lineText).join("\n");
  const source = text || joined;
  capture(invoice, "ifNumber", source.match(/\bI\.?\s*F\.?\s*[:\-]?\s*([0-9]{5,12})/i)?.[1] ?? "", 0.9);
  capture(invoice, "rc", source.match(/\bR\.?\s*C\.?\s*[:\-]?\s*([0-9A-Z][0-9A-Z\/-]{2,})/i)?.[1] ?? "", 0.9);
  capture(invoice, "patente", source.match(/patente\s*[:\-]?\s*([0-9A-Z]{4,})/i)?.[1] ?? "", 0.88);
  capture(invoice, "cnss", source.match(/CNSS\s*[:\-]?\s*([0-9]{4,})/i)?.[1] ?? "", 0.88);
  capture(invoice, "address", source.match(/adresse\s*[:\-]\s*(.+)/i)?.[1]?.trim() ?? "", 0.8);
  capture(invoice, "phone", source.match(/(?:t[ée]l[ée]phone|t[ée]l\.?|mobile)\s*[:\-]\s*(\+?[0-9][0-9 .\-()]{5,})/i)?.[1]?.trim() ?? "", 0.8);
  capture(invoice, "email", source.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] ?? "", 0.9);
  if (!invoice.ice) {
    const shortIce = source.match(/ICE\s*[:\-]?\s*([0-9][0-9\s]{0,30})/i)?.[1]?.replace(/\D/g, "") ?? "";
    if (shortIce) setField(invoice, "ice", shortIce, 0.3);
  }
  const labeledName = source.match(/(?:fournisseur|raison sociale)\s*[:\-]\s*(.+)/i)?.[1]?.trim();
  if (labeledName) setField(invoice, "supplierName", cleanName(labeledName), 0.9);
  const number = source.match(/(?:facture|n[°o])\s*(?:n[°o])?\s*[:\-]?\s*([A-Z0-9][A-Z0-9\-/]{2,})/i)?.[1];
  if (number && !/^(n|no|numero)$/i.test(number)) setField(invoice, "invoiceNumber", number, 0.9);
  const dateLine = scoped.find((line) => /^date\b/i.test(lineText(line)) && !/[ée]ch[ée]ance/i.test(lineText(line)));
  const dueLine = scoped.find((line) => /[ée]ch[ée]ance/i.test(lineText(line)));
  const invoiceDate = parseFrenchDate(dateLine ? lineText(dateLine) : source);
  const dueDate = parseFrenchDate(dueLine ? lineText(dueLine) : "");
  if (invoiceDate) setField(invoice, "invoiceDate", invoiceDate, 0.9);
  if (dueDate) setField(invoice, "dueDate", dueDate, 0.88);
  if (/\b(MAD|DHS|DH)\b/i.test(joined)) invoice.currency = "MAD";
  else if (/\bEUR\b/.test(joined)) invoice.currency = "EUR";
  invoice.lines = tableLines(lines);
  if (!invoice.lines.length) invoice.lines = pipeLines(joined);
  readTotals(invoice, scoped.map(lineText));
  applyCrossChecks(invoice);
  return invoice;
}

function emptyInvoice(): OcrSupplierInvoice {
  return {
    supplierName: "", ice: "", ifNumber: "", rc: "", patente: "", cnss: "", address: "", phone: "", email: "",
    invoiceNumber: "", invoiceDate: "", dueDate: "", currency: "MAD", lines: [], totalHt: null, vatByRate: [], totalVat: null, totalTtc: null,
    confidence: { supplierName: 0, ice: 0, ifNumber: 0, rc: 0, patente: 0, cnss: 0, address: 0, phone: 0, email: 0, invoiceNumber: 0, invoiceDate: 0, dueDate: 0, totalHt: 0, totalVat: 0, totalTtc: 0 },
  };
}

function setField(invoice: OcrSupplierInvoice, key: "supplierName" | "ice" | "ifNumber" | "rc" | "patente" | "cnss" | "address" | "phone" | "email" | "invoiceNumber" | "invoiceDate" | "dueDate", value: string, confidence: number) {
  if (!value) return;
  invoice[key] = value;
  invoice.confidence[key] = confidence;
}

function capture(invoice: OcrSupplierInvoice, key: "ifNumber" | "rc" | "patente" | "cnss" | "address" | "phone" | "email", value: string, confidence: number) {
  setField(invoice, key, value, confidence);
}

function groupLines(tokens: TextToken[]) {
  const sorted = [...tokens].sort((a, b) => a.y - b.y || a.x - b.x);
  const lines: { y: number; tokens: TextToken[] }[] = [];
  for (const token of sorted) {
    const current = lines.at(-1);
    const tolerance = Math.max(6, token.h * 0.7);
    if (current && Math.abs(token.y - current.y) <= tolerance) current.tokens.push(token);
    else lines.push({ y: token.y, tokens: [token] });
  }
  for (const line of lines) line.tokens.sort((a, b) => a.x - b.x);
  return lines;
}

function lineText(line: { tokens: TextToken[] }) {
  return line.tokens.map((token) => token.text.trim()).filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
}

function splitColumns(line: { y: number; tokens: TextToken[] }) {
  const sorted = [...line.tokens].sort((a, b) => a.x - b.x);
  const groups: { y: number; tokens: TextToken[] }[] = [];
  for (const token of sorted) {
    const current = groups.at(-1);
    const previous = current?.tokens.at(-1);
    if (current && previous && token.x - (previous.x + previous.w) < 70) current.tokens.push(token);
    else groups.push({ y: line.y, tokens: [token] });
  }
  return groups;
}

function findIces(lines: { y: number; tokens: TextToken[] }[]) {
  const found: { value: string; x: number; y: number }[] = [];
  for (const line of lines) {
    for (const token of line.tokens) {
      for (const match of token.text.matchAll(/(?:\d[\s.]*){15}/g)) {
        const value = match[0].replace(/\D/g, "").slice(0, 15);
        if (value.length === 15) found.push({ value, x: token.x, y: line.y });
      }
    }
  }
  return found;
}

function sellerName(lines: { y: number; tokens: TextToken[] }[], sellerX: number, buyerPoints: { x: number; y: number }[]) {
  const candidates = lines.filter((line) => {
    const text = lineText(line);
    if (!text || LABEL.test(text) || findIces([line]).length) return false;
    if (isBuyerLine(line, buyerPoints)) return false;
    return Math.abs((line.tokens[0]?.x ?? 0) - sellerX) < 180;
  });
  const named = candidates.find((line) => /sarl|sa\b|au\b|sas|ste\b|société|societe/i.test(lineText(line))) ?? candidates[0];
  return named ? cleanName(lineText(named)) : "";
}

function isBuyerLine(line: { y: number; tokens: TextToken[] }, buyerPoints: { x: number; y: number }[]) {
  if (!buyerPoints.length) return false;
  const x = line.tokens[0]?.x ?? 0;
  return buyerPoints.some((point) => Math.abs(x - point.x) < 50 && Math.abs(line.y - point.y) < 100);
}

function cleanName(value: string) {
  return value.replace(/^(fournisseur|raison sociale)\s*[:\-]\s*/i, "").trim();
}

function tableLines(lines: { y: number; tokens: TextToken[] }[]): OcrInvoiceLine[] {
  const headerIndex = lines.findIndex((line) => /d[ée]signation|libell[ée]/i.test(lineText(line)) && /qt[ée]|quantit|prix|montant/i.test(lineText(line)));
  if (headerIndex < 0) return [];
  const header = lines[headerIndex].tokens;
  const columns = [
    { key: "description", x: xOf(header, /d[ée]signation|libell[ée]/i) },
    { key: "quantity", x: xOf(header, /qt[ée]|quantit/i) },
    { key: "price", x: xOf(header, /p\.?\s*u|prix/i) },
    { key: "vat", x: xOf(header, /tva/i) },
    { key: "amount", x: xOf(header, /montant|total/i) },
  ].filter((column) => column.x != null) as { key: string; x: number }[];
  const rows: OcrInvoiceLine[] = [];
  for (const line of lines.slice(headerIndex + 1)) {
    const text = lineText(line);
    if (/total\s+ht|total\s+ttc|^tva\b/i.test(text)) break;
    const cells: Record<string, string> = {};
    for (const token of line.tokens) {
      const column = nearest(columns, token.x);
      if (!column) continue;
      cells[column.key] = `${cells[column.key] ?? ""} ${token.text}`.trim();
    }
    const quantity = parseFrAmount(cells.quantity ?? "");
    const unitPriceHt = parseFrAmount(cells.price ?? "");
    const vatRate = parseFrAmount((cells.vat ?? "").replace("%", ""));
    if (!cells.description || quantity == null || unitPriceHt == null) continue;
    rows.push({ description: cells.description, quantity, unitPriceHt, vatRate: vatRate ?? 20, confidence: 0.84 });
  }
  return rows;
}

function pipeLines(text: string): OcrInvoiceLine[] {
  const rows: OcrInvoiceLine[] = [];
  for (const raw of text.split(/\n/)) {
    const cells = raw.split("|").map((cell) => cell.trim()).filter(Boolean);
    if (cells.length < 4 || /d[ée]signation|total/i.test(cells[0])) continue;
    const quantity = parseFrAmount(cells[1]);
    const unitPriceHt = parseFrAmount(cells[2]);
    const vatRate = parseFrAmount(cells[3].replace("%", ""));
    if (quantity == null || unitPriceHt == null || vatRate == null) continue;
    rows.push({ description: cells[0], quantity, unitPriceHt, vatRate, confidence: 0.7 });
  }
  return rows;
}

function readTotals(invoice: OcrSupplierInvoice, lines: string[]) {
  for (const line of lines) {
    const ht = line.match(/total\s+ht\s*[:\-]?\s*([0-9][0-9\s.,]*)/i);
    const ttc = line.match(/total\s+ttc\s*[:\-]?\s*([0-9][0-9\s.,]*)/i);
    const vat = line.match(/tva\s*(20|14|10|7)\s*%?\s*[:\-]?\s*([0-9][0-9\s.,]*)/i);
    if (ht) { invoice.totalHt = parseFrAmount(ht[1]); invoice.confidence.totalHt = 0.86; }
    if (ttc) { invoice.totalTtc = parseFrAmount(ttc[1]); invoice.confidence.totalTtc = 0.86; }
    if (vat) {
      const amount = parseFrAmount(vat[2]);
      if (amount != null) invoice.vatByRate.push({ rate: Number(vat[1]), amount });
    }
  }
  if (invoice.vatByRate.length) {
    invoice.totalVat = round2(invoice.vatByRate.reduce((sum, item) => sum + item.amount, 0));
    invoice.confidence.totalVat = 0.86;
  }
}

function applyCrossChecks(invoice: OcrSupplierInvoice) {
  const totals = invoice.lines.reduce((sum, line) => {
    const ht = round2(line.quantity * line.unitPriceHt);
    const vat = round2(ht * line.vatRate / 100);
    return { ht: round2(sum.ht + ht), vat: round2(sum.vat + vat), ttc: round2(sum.ttc + ht + vat) };
  }, { ht: 0, vat: 0, ttc: 0 });
  if (invoice.lines.length && invoice.totalHt != null) invoice.confidence.totalHt = Math.abs(totals.ht - invoice.totalHt) <= 0.05 ? 0.97 : 0.45;
  const vat = invoice.totalVat ?? (invoice.vatByRate.length ? round2(invoice.vatByRate.reduce((sum, item) => sum + item.amount, 0)) : null);
  if (invoice.totalHt != null && vat != null && invoice.totalTtc != null) {
    const coherent = Math.abs(round2(invoice.totalHt + vat) - invoice.totalTtc) <= 0.05;
    invoice.confidence.totalTtc = coherent ? 0.97 : 0.4;
    invoice.confidence.totalVat = coherent ? 0.95 : 0.4;
  }
  if (invoice.ice && !/^\d{15}$/.test(invoice.ice)) invoice.confidence.ice = 0.3;
  for (const line of invoice.lines) {
    if (![0, 7, 10, 14, 20].includes(line.vatRate)) line.confidence = Math.min(line.confidence, 0.4);
  }
}

function xOf(tokens: TextToken[], pattern: RegExp) {
  return tokens.find((token) => pattern.test(token.text))?.x ?? null;
}

function nearest(columns: { key: string; x: number }[], x: number) {
  return columns.reduce((best, column) => Math.abs(column.x - x) < Math.abs(best.x - x) ? column : best);
}

function iso(year: number, month: number, day: number) {
  if (month < 1 || month > 12 || day < 1 || day > 31) return "";
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function round2(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function fold(value: string) {
  return value.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}
