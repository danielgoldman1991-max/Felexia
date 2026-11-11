import type { OcrInvoiceLine, OcrSupplierInvoice } from "@/lib/purchases/supplier-invoice-ocr";

export type TextToken = { text: string; x: number; y: number; w: number; h: number };

const MONTHS: Record<string, number> = {
  janvier: 1, fevrier: 2, février: 2, mars: 3, avril: 4, mai: 5, juin: 6,
  juillet: 7, aout: 8, août: 8, septembre: 9, octobre: 10, novembre: 11, decembre: 12, décembre: 12,
};

const LABEL = /^(?:ice|i\.f|if|r\.c|rc|patente|cnss|facture|date|éch[ée]ance|echeance|client|acheteur|adresse|t[ée]l|email|e-mail|total|tva|d[ée]signation|qt[ée]|montant|n°)\b/i;

export function parseFrAmount(raw: string): number | null {
  const source = raw.replace(/\u00a0/g, " ").replace(/\b(MAD|DHS|DH)\b/gi, " ");
  const match = source.match(/-?\d{1,3}(?: \d{3})+(?:[.,]\d{1,2})|-?\d{1,3}(?:\.\d{3})+(?:,\d{1,2})|-?\d+(?:[.,]\d{1,2})?/);
  if (!match) return null;
  let value = match[0].replace(/[\s]/g, "");
  const comma = value.lastIndexOf(",");
  const dot = value.lastIndexOf(".");
  if (comma >= 0 && dot >= 0) value = comma > dot ? value.replace(/\./g, "").replace(",", ".") : value.replace(/,/g, "");
  else if (comma >= 0) value = value.replace(",", ".");
  else if (/^\d{1,3}(\.\d{3})+$/.test(value)) value = value.replace(/\./g, "");
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
  capture(invoice, "ifNumber", source.match(/(?:identifiant\s+fiscal|\bI\.?\s*F\.?)\s*[:\-]?\s*(\d{7,8})\b/i)?.[1] ?? "", 0.9);
  capture(invoice, "rc", source.match(/\bR\.?\s*C\.?\s*[:\-]?\s*([0-9A-Z][0-9A-Z\/-]{2,})/i)?.[1] ?? "", 0.9);
  capture(invoice, "patente", source.match(/(?:patente|taxe\s+professionnelle|\bTP)\s*[:\-]?\s*([0-9A-Z]{4,})/i)?.[1] ?? "", 0.88);
  capture(invoice, "cnss", source.match(/CNSS\s*[:\-]?\s*([0-9]{4,})/i)?.[1] ?? "", 0.88);
  capture(invoice, "address", source.match(/adresse\s*[:\-]\s*(.+)/i)?.[1]?.trim() ?? "", 0.8);
  capture(invoice, "phone", source.match(/(?:t[ée]l[ée]phone|t[ée]l\.?|mobile)\s*[:\-]\s*(\+?[0-9][0-9 .\-()]{5,})/i)?.[1]?.trim() ?? "", 0.8);
  capture(invoice, "email", source.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] ?? "", 0.9);
  if (!invoice.ice) {
    const shortIce = source.match(/ICE\s*[:\-]?\s*([0-9][0-9\s]{0,30})/i)?.[1]?.replace(/\D/g, "") ?? "";
    if (shortIce) setField(invoice, "ice", shortIce, 0.3);
  }
  const labeledName = source.match(/(?:fournisseur|raison sociale)\s*[:\-]\s*(.+)/i)?.[1]?.trim();
  if (labeledName && !/au\s+capital\s+de/i.test(labeledName)) setField(invoice, "supplierName", cleanName(labeledName), 0.9);
  applyLegalFooter(invoice, lines);
  const number = extractInvoiceNumber(joinedLines(lines));
  if (number) setField(invoice, "invoiceNumber", number, 0.9);
  const dateLine = scoped.find((line) => /date\s+(?:de\s+)?facture|^date\b/i.test(lineText(line)) && !dueLabel(lineText(line)));
  const cityDate = scoped.find((line) => /\ble,?\s*\d{1,2}[\/.\-]\d{1,2}[\/.\-]\d{4}/i.test(lineText(line)) && !dueLabel(lineText(line)));
  const dueLine = scoped.find((line) => dueLabel(lineText(line)));
  const invoiceDate = parseFrenchDate(dateLine ? lineText(dateLine) : cityDate ? lineText(cityDate) : "");
  const dueDate = dueLine ? parseFrenchDate(lineText(dueLine)) : "";
  if (invoiceDate) setField(invoice, "invoiceDate", invoiceDate, 0.9);
  if (dueDate) setField(invoice, "dueDate", dueDate, 0.88);
  if (/\b(MAD|DHS|DH)\b/i.test(joined)) invoice.currency = "MAD";
  else if (/\bEUR\b/.test(joined)) invoice.currency = "EUR";
  invoice.lines = tableLines(lines);
  if (!invoice.lines.length) invoice.lines = inferAmountLines(lines);
  if (!invoice.lines.length) invoice.lines = pipeLines(joined);
  readTotals(invoice, lines.map(lineText).filter((line) => !/arr[êe]t[ée].{0,12}somme|somme de/i.test(line)));
  fillMissingTotals(invoice);
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

const REJECTED_NUMBER = /^(tes|num|ref|n|no|numero|facture|date|ht|ttc|tva|mad|dh|dhs|ice|if|rc)$/i;

function dueLabel(text: string) {
  return /[ée]ch[ée]ance|payable\s+le/i.test(text);
}

function joinedLines(lines: { y: number; tokens: TextToken[] }[]) {
  const merged: { y: number; tokens: TextToken[] }[] = [];
  for (const line of lines) {
    const previous = merged.at(-1);
    if (previous && /^n\s*[°oº]$/i.test(lineText(previous)) && line.y - previous.y < 24) previous.tokens.push(...line.tokens);
    else merged.push({ y: line.y, tokens: [...line.tokens] });
  }
  return merged.map(lineText).join("\n");
}

function applyLegalFooter(invoice: OcrSupplierInvoice, lines: { y: number; tokens: TextToken[] }[]) {
  const index = lines.findIndex((line) => /au\s+capital\s+de|(?:SARL|SAS|SA|STE)\s+AU\s+capital\s+de/i.test(lineText(line)));
  if (index < 0) return;
  const own = lineText(lines[index]);
  const prefix = legalNameBeforeCapital(own);
  const start = prefix.length < 8 ? Math.max(0, index - 1) : index;
  const blob = lines.slice(start, index + 4).map(lineText).join(" ");
  const name = legalNameBeforeCapital(blob) || companyBeforeCapital(blob.split(/au\s+capital\s+de/i)[0] ?? "");
  if (name) setField(invoice, "supplierName", name, 0.95);
  const ice = blob.match(/ICE\s*[:\-]?\s*((?:\d[\s.]*){15})/i)?.[1]?.replace(/\D/g, "").slice(0, 15);
  if (ice && ice.length === 15) setField(invoice, "ice", ice, 0.96);
  const fiscal = blob.match(/(?:identifiant\s+fiscal|\bIF)\s*[:\-]?\s*(\d{7,8})\b/i)?.[1];
  if (fiscal) setField(invoice, "ifNumber", fiscal, 0.93);
  const rc = blob.match(/\bRC\s*[:\-]?\s*(\d{4,8})\b/i)?.[1];
  if (rc) setField(invoice, "rc", rc, 0.93);
  const cnss = blob.match(/CNSS\s*[:\-]?\s*(\d{5,10})\b/i)?.[1];
  if (cnss) setField(invoice, "cnss", cnss, 0.93);
  const address = blob.match(/adresse\s*[:\-]\s*(.+?)(?=\s+-\s*t[ée]l|\s+t[ée]l\b|\s+if\b|$)/i)?.[1]?.trim();
  if (address) setField(invoice, "address", address.replace(/\s+/g, " "), 0.84);
  const phone = blob.match(/(?:t[ée]l(?:[ée]phone)?\.?)\s*[:\-]?\s*((?:\+212|0)(?:[\s.]?\d){8,})/i)?.[1]?.trim();
  if (phone) setField(invoice, "phone", phone, 0.86);
  const email = blob.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0];
  if (email) setField(invoice, "email", email, 0.9);
}

function legalNameBeforeCapital(text: string) {
  const match = text.match(/(.*?\b(?:SARL|S\.A\.R\.L|SAS|SA|STE|SOCI[ÉE]T[ÉE])(?:\s+AU)?)\s+(?:au\s+)?capital\s+de/i);
  return match?.[1]?.replace(/\s+/g, " ").trim() ?? "";
}

function companyBeforeCapital(before: string) {
  const cleaned = before.replace(/[0-9][0-9\s.,]*/g, " ").replace(/\s+/g, " ").trim();
  const form = cleaned.match(/(SARL|S\.A\.R\.L|SAS|S\.A\.S|SA|STE|SOCI[ÉE]T[ÉE])(?:\s+AU)?\s*$/i);
  const stop = /^(montant|total|tva|ht|ttc|dh|en|de|adresse|facture|date|ice|net|a|à|payer)$/i;
  if (!form || form.index == null) return cleaned.split(/\s+/).filter((word) => !stop.test(word)).slice(-6).join(" ");
  const kept: string[] = [];
  for (const word of cleaned.slice(0, form.index).trim().split(/\s+/).reverse()) {
    if (!word || stop.test(word)) break;
    kept.unshift(word);
    if (kept.length >= 6) break;
  }
  return [...kept, form[0].trim()].join(" ").replace(/\s+/g, " ").trim();
}

function extractInvoiceNumber(text: string) {
  const patterns = [
    /n\s*[°oº]\s*(?:de\s*)?facture\s*[:\-]?\s*([A-Z0-9][A-Z0-9./-]{2,})/gi,
    /facture\s*n\s*[°oº]?\s*[:\-]?\s*([A-Z0-9][A-Z0-9./-]{2,})/gi,
    /facture\s+([A-Z]{1,6}\d[A-Z0-9./-]{3,})/gi,
    /r[ée]f(?:[ée]rence)?\s*[:\-]?\s*([A-Z0-9][A-Z0-9./-]{2,})/gi,
    /facture\s*[:\-]\s*([A-Z0-9][A-Z0-9./-]{2,})/gi,
  ];
  const found: string[] = [];
  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) found.push(match[1].replace(/[.:]+$/, ""));
  }
  return found.map(normalizeInvoiceNumber).find((value) => plausibleInvoiceNumber(value)) ?? "";
}

function normalizeInvoiceNumber(value: string) {
  return value.replace(/(?<=\d)[Oo]|[Oo](?=\d)/g, "0");
}

function plausibleInvoiceNumber(value: string) {
  if (REJECTED_NUMBER.test(value)) return false;
  if (/^[A-Za-z]+$/.test(value) && value.length < 5) return false;
  if (!/\d/.test(value)) return false;
  return value.length >= 3;
}

function tableLines(lines: { y: number; tokens: TextToken[] }[]): OcrInvoiceLine[] {
  const headerIndex = lines.findIndex((line) => /d[ée]signation|libell[ée]|article|description|produit/i.test(lineText(line)) && /qt[ée]|quantit|prix|montant|p\.?\s*u/i.test(lineText(line)));
  if (headerIndex < 0) return [];
  const header = headerTokens(lines[headerIndex]);
  const columns = [
    { key: "description", x: xOf(header, /d[ée]signation|libell[ée]|article|description|produit/i) },
    { key: "quantity", x: xOf(header, /qt[ée]|quantit/i) },
    { key: "price", x: xOf(header, /p\.?\s*u|prix/i) },
    { key: "vat", x: xOf(header, /^tva$|tva\s*%/i) },
    { key: "amount", x: xOf(header, /montant|total/i) },
  ].filter((column) => column.x != null) as { key: string; x: number }[];
  if (columns.length < 2) return [];
  const rows: OcrInvoiceLine[] = [];
  let pending: string[] = [];
  for (const line of lines.slice(headerIndex + 1)) {
    const text = lineText(line);
    if (/d[ée]signation/i.test(text) && /qt[ée]|quantit|prix|montant/i.test(text)) continue;
    if (/montant(?:\s+\w+){0,4}\s+h\.?\s*t\b|total\s+h\.?\s*t\b|total\s+ttc|net\s+[àa]\s+payer|^tva\b|arr[êe]t[ée]/i.test(text)) break;
    const cells: Record<string, string> = {};
    for (const token of line.tokens) {
      const column = nearest(columns, token.x);
      if (!column) continue;
      cells[column.key] = `${cells[column.key] ?? ""} ${token.text}`.trim();
    }
    const quantity = parseFrAmount(cells.quantity ?? "");
    const amount = parseFrAmount(cells.amount ?? "");
    let unitPriceHt = parseFrAmount(cells.price ?? "");
    if ((quantity == null || unitPriceHt == null) && cells.description) {
      pending.push(cells.description);
      continue;
    }
    if (unitPriceHt == null && amount != null && quantity) unitPriceHt = round2(amount / quantity);
    const vatRate = parseFrAmount((cells.vat ?? "").replace("%", ""));
    const description = [...pending, cells.description].filter(Boolean).join(" ");
    pending = [];
    if (!description || quantity == null || unitPriceHt == null) continue;
    rows.push({ description, quantity, unitPriceHt, vatRate: vatRate ?? 20, confidence: 0.84 });
  }
  return rows;
}

function inferAmountLines(lines: { y: number; tokens: TextToken[] }[]): OcrInvoiceLine[] {
  const rows: OcrInvoiceLine[] = [];
  for (const line of lines) {
    const text = lineText(line);
    if (/montant(?:\s+\w+){0,4}\s+h\.?\s*t\b|total\s+h\.?\s*t\b|arr[êe]t[ée]/i.test(text)) break;
    const found = [...text.matchAll(/\d{1,3}(?: \d{3})+(?:[.,]\d{1,2})|\d+(?:[.,]\d{1,2})?/g)];
    if (found.length < 2) {
      const extra = text.replace(/^\*/, "").trim();
      if (rows.length && extra && extra.length < 40 && !/ice|facture|capital/i.test(extra)) rows[rows.length - 1].description = `${rows[rows.length - 1].description} ${extra}`.trim();
      continue;
    }
    const priceMatch = found[found.length - 2];
    const totalMatch = found[found.length - 1];
    const unitPriceHt = parseFrAmount(priceMatch[0]);
    const total = parseFrAmount(totalMatch[0]);
    const quantity = unitPriceHt ? round2((total ?? 0) / unitPriceHt) : 0;
    if (!unitPriceHt || !Number.isInteger(quantity) || quantity < 1 || quantity > 9999) continue;
    const description = `${text.slice(0, priceMatch.index ?? 0)} ${text.slice((totalMatch.index ?? 0) + totalMatch[0].length)}`.replace(/[|*]/g, " ").replace(/\s+/g, " ").trim();
    if (description.length < 3) continue;
    rows.push({ description, quantity, unitPriceHt, vatRate: 20, confidence: 0.66 });
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

function headerTokens(line: { tokens: TextToken[] }) {
  if (line.tokens.length !== 1 || !/\s/.test(line.tokens[0].text)) return line.tokens;
  const token = line.tokens[0];
  const words = token.text.split(/\s+/).filter(Boolean);
  const width = Math.max(token.w, words.join(" ").length * 6);
  return words.map((word, index) => ({ ...token, text: word, x: token.x + (index / Math.max(words.length, 1)) * width, w: width / words.length }));
}

function readTotals(invoice: OcrSupplierInvoice, lines: string[]) {
  for (const line of lines) {
    const amount = lastAmount(line);
    const rated = line.match(/tva\s*(20|14|10|7)\s*%?/i);
    if (/montant(?:\s+\w+){0,4}\s+h\.?\s*t\b|total\s+h\.?\s*t\b|sous[-\s]?total/i.test(line) && amount != null) {
      invoice.totalHt = amount;
      invoice.confidence.totalHt = 0.9;
    }
    if (rated && amount != null && amount !== Number(rated[1])) {
      invoice.vatByRate.push({ rate: Number(rated[1]), amount });
    } else if (/total\s+tva|montant\s+tva/i.test(line) && amount != null) {
      invoice.totalVat = amount;
      invoice.confidence.totalVat = 0.88;
    }
    if (/montant(?:\s+\w+){0,4}\s+t\.?\s*t\.?\s*c\b|total\s+ttc|net\s+[àa]\s+payer/i.test(line) && amount != null) {
      invoice.totalTtc = amount;
      invoice.confidence.totalTtc = 0.9;
    }
  }
  if (invoice.vatByRate.length && invoice.totalVat == null) {
    invoice.totalVat = round2(invoice.vatByRate.reduce((sum, item) => sum + item.amount, 0));
    invoice.confidence.totalVat = 0.86;
  }
}

function fillMissingTotals(invoice: OcrSupplierInvoice) {
  const ht = invoice.totalHt;
  const vat = invoice.totalVat;
  const ttc = invoice.totalTtc;
  if (ht != null && vat != null && ttc == null) { invoice.totalTtc = round2(ht + vat); invoice.confidence.totalTtc = 0.74; }
  if (ht != null && ttc != null && vat == null) { invoice.totalVat = round2(ttc - ht); invoice.confidence.totalVat = 0.74; }
  if (vat != null && ttc != null && ht == null) { invoice.totalHt = round2(ttc - vat); invoice.confidence.totalHt = 0.74; }
}

function lastAmount(line: string) {
  const matches = [...line.replace(/\u00a0/g, " ").matchAll(/\d{1,3}(?: \d{3})+(?:[.,]\d{1,2})|\d{1,3}(?:\.\d{3})+(?:,\d{1,2})|\d+(?:[.,]\d{1,2})?/g)];
  return matches.length ? parseFrAmount(matches[matches.length - 1][0]) : null;
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
  const ordered = [...columns].sort((a, b) => a.x - b.x);
  for (let index = 0; index < ordered.length; index += 1) {
    const next = ordered[index + 1];
    if (!next || x < ordered[index].x + (next.x - ordered[index].x) * 0.62) return ordered[index];
  }
  return ordered[ordered.length - 1];
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
