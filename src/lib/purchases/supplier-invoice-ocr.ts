export const SCAN_BUCKET = "supplier-invoice-scans";
export const SCAN_MAX_BYTES = 10 * 1024 * 1024;
export const SCAN_MAX_PAGES = 5;
export const OCR_NOT_CONFIGURED_MESSAGE = "OCR non configuré. L’analyse des factures n’est pas activée sur ce serveur. Aucune facture n’a été créée.";
export const UNCERTAIN_CONFIDENCE = 0.8;

const VAT_RATES = [0, 7, 10, 14, 20];

export type OcrInvoiceLine = {
  description: string;
  quantity: number;
  unitPriceHt: number;
  vatRate: number;
  confidence: number;
};

export type OcrSupplierInvoice = {
  supplierName: string;
  ice: string;
  ifNumber: string;
  rc: string;
  address: string;
  phone: string;
  email: string;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  currency: string;
  lines: OcrInvoiceLine[];
  totalHt: number | null;
  vatByRate: { rate: number; amount: number }[];
  totalVat: number | null;
  totalTtc: number | null;
  confidence: Record<"supplierName" | "ice" | "ifNumber" | "rc" | "address" | "phone" | "email" | "invoiceNumber" | "invoiceDate" | "dueDate" | "totalHt" | "totalVat" | "totalTtc", number>;
};

export type SupplierMatch =
  | { status: "matched"; id: string; via: "ice" | "name" }
  | { status: "ambiguous"; via: "ice" | "name" }
  | { status: "new" };

const EMPTY_CONFIDENCE: OcrSupplierInvoice["confidence"] = {
  supplierName: 0, ice: 0, ifNumber: 0, rc: 0, address: 0, phone: 0, email: 0, invoiceNumber: 0, invoiceDate: 0, dueDate: 0, totalHt: 0, totalVat: 0, totalTtc: 0,
};

export function inspectScanFile(input: { name: string; type: string; size: number; bytes?: Buffer }) {
  if (input.size <= 0) return "Sélectionnez un fichier.";
  if (input.size > SCAN_MAX_BYTES) return "Le fichier dépasse 10 Mo.";
  const mime = mimeFrom(input.type, input.name, input.bytes);
  if (!mime) return "Format non accepté. Utilisez un PDF, un JPG ou un PNG.";
  if (input.bytes && mime === "application/pdf" && pdfPageCount(input.bytes) > SCAN_MAX_PAGES) {
    return `Le PDF dépasse ${SCAN_MAX_PAGES} pages. Découpez-le avant l’analyse.`;
  }
  return null;
}

export function mimeFrom(type: string, name: string, bytes?: Buffer) {
  const normalized = type.toLowerCase();
  if (normalized === "application/pdf" || normalized === "image/jpeg" || normalized === "image/png") return normalized;
  const lower = name.toLowerCase();
  if (lower.endsWith(".pdf")) return "application/pdf";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".png")) return "image/png";
  if (bytes && bytes.subarray(0, 4).toString("ascii") === "%PDF") return "application/pdf";
  if (bytes && bytes[0] === 0xff && bytes[1] === 0xd8) return "image/jpeg";
  if (bytes && bytes.subarray(0, 8).toString("hex") === "89504e470d0a1a0a") return "image/png";
  return null;
}

export function pdfPageCount(bytes: Buffer) {
  const text = bytes.toString("latin1");
  const pages = text.match(/\/Type\s*\/Page(?!s)/g);
  return Math.max(pages?.length ?? 1, 1);
}

export function scanObjectPath(organizationId: string, kind: "pending" | "invoices", name: string) {
  return `organizations/${organizationId}/${kind}/${name}`;
}

export function assertPendingScanPath(path: string, organizationId: string) {
  const prefix = `organizations/${organizationId}/pending/`;
  if (!path.startsWith(prefix) || path.includes("..") || path.includes("//")) {
    throw new Error("Le document n’appartient pas à votre entreprise.");
  }
}

function fold(value: string) {
  return value.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/\s+/g, " ").trim();
}

function money(value: string) {
  const parsed = Number(value.replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(parsed) ? Math.round(parsed * 100) / 100 : null;
}

function isoDate(value: string) {
  const french = value.match(/(\d{2})[/-](\d{2})[/-](\d{4})/);
  if (french) return `${french[3]}-${french[2]}-${french[1]}`;
  const iso = value.match(/(\d{4})-(\d{2})-(\d{2})/);
  return iso ? `${iso[1]}-${iso[2]}-${iso[3]}` : "";
}

function blankInvoice(): OcrSupplierInvoice {
  return {
    supplierName: "", ice: "", ifNumber: "", rc: "", address: "", phone: "", email: "", invoiceNumber: "", invoiceDate: "", dueDate: "", currency: "MAD",
    lines: [], totalHt: null, vatByRate: [], totalVat: null, totalTtc: null, confidence: { ...EMPTY_CONFIDENCE },
  };
}

export function parseInvoiceText(text: string): OcrSupplierInvoice {
  const invoice = blankInvoice();
  const set = (key: keyof OcrSupplierInvoice["confidence"], value: string) => {
    if (!value) return;
    if (key === "supplierName") invoice.supplierName = value;
    if (key === "ice") invoice.ice = value;
    if (key === "ifNumber") invoice.ifNumber = value;
    if (key === "rc") invoice.rc = value;
    if (key === "address") invoice.address = value;
    if (key === "phone") invoice.phone = value;
    if (key === "email") invoice.email = value;
    if (key === "invoiceNumber") invoice.invoiceNumber = value;
    if (key === "invoiceDate") invoice.invoiceDate = value;
    if (key === "dueDate") invoice.dueDate = value;
    invoice.confidence[key] = 0.62;
  };
  const supplier = text.match(/(?:fournisseur|raison sociale)\s*[:\-]\s*(.+)/i);
  if (supplier) set("supplierName", supplier[1].trim());
  const ice = text.match(/ICE\s*[:\-]?\s*([0-9][0-9\s]*)/i);
  if (ice) set("ice", ice[1].replace(/\s/g, ""));
  const fiscal = text.match(/\bIF\s*[:\-]?\s*([A-Z0-9]+)/i);
  if (fiscal) set("ifNumber", fiscal[1]);
  const rc = text.match(/\bRC\s*[:\-]?\s*([A-Z0-9]+)/i);
  if (rc) set("rc", rc[1]);
  const address = text.match(/adresse\s*[:\-]\s*(.+)/i);
  if (address) set("address", address[1].trim());
  const phone = text.match(/(?:t[ée]l[ée]phone|t[ée]l|mobile)\s*[:\-]\s*(\+?[0-9][0-9 .\-()]{5,})/i);
  if (phone) set("phone", phone[1].trim());
  const email = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  if (email) set("email", email[0]);
  const number = text.match(/(?:facture|n[°o])\s*[:\-]?\s*([A-Z0-9][A-Z0-9\-/]{2,})/i);
  if (number) set("invoiceNumber", number[1]);
  const dates = [...text.matchAll(/(\d{2}[/-]\d{2}[/-]\d{4}|\d{4}-\d{2}-\d{2})/g)].map((item) => isoDate(item[1]));
  if (dates[0]) set("invoiceDate", dates[0]);
  if (/[ée]ch[ée]ance/i.test(text) && dates[1]) set("dueDate", dates[1]);
  const currency = text.match(/\b(MAD|DHS|EUR|USD)\b/i);
  invoice.currency = currency ? currency[1].toUpperCase().replace("DHS", "MAD") : "MAD";
  for (const row of text.split(/\n/)) {
    const cells = row.split("|").map((cell) => cell.trim()).filter(Boolean);
    if (cells.length < 4 || /d[ée]signation|total/i.test(cells[0])) continue;
    const quantity = money(cells[1]);
    const price = money(cells[2]);
    const rate = money(cells[3].replace("%", ""));
    if (quantity == null || price == null || rate == null) continue;
    invoice.lines.push({ description: cells[0], quantity, unitPriceHt: price, vatRate: rate, confidence: 0.62 });
  }
  const totalHt = text.match(/total\s+HT\s*[:\-]?\s*([\d\s]+[.,]\d{2})/i);
  const totalTtc = text.match(/total\s+TTC\s*[:\-]?\s*([\d\s]+[.,]\d{2})/i);
  if (totalHt) { invoice.totalHt = money(totalHt[1]); invoice.confidence.totalHt = 0.62; }
  if (totalTtc) { invoice.totalTtc = money(totalTtc[1]); invoice.confidence.totalTtc = 0.62; }
  for (const match of text.matchAll(/TVA\s*(20|14|10|7)\s*%?\s*[:\-]?\s*([\d\s]+[.,]\d{2})/gi)) {
    const amount = money(match[2]);
    if (amount != null) invoice.vatByRate.push({ rate: Number(match[1]), amount });
  }
  if (invoice.vatByRate.length) {
    invoice.totalVat = round2(invoice.vatByRate.reduce((sum, item) => sum + item.amount, 0));
    invoice.confidence.totalVat = 0.62;
  }
  return invoice;
}

function round2(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

export function normalizeOcrPayload(raw: unknown): OcrSupplierInvoice {
  const record = asRecord(raw);
  if (!record) return blankInvoice();
  const invoice = blankInvoice();
  const text = (key: string) => typeof record[key] === "string" ? record[key].trim() : "";
  const number = (key: string) => typeof record[key] === "number" ? round2(record[key]) : typeof record[key] === "string" && record[key].trim() ? money(record[key]) : null;
  invoice.supplierName = text("supplierName");
  invoice.ice = text("ice").replace(/\s/g, "");
  invoice.ifNumber = text("ifNumber");
  invoice.rc = text("rc");
  invoice.address = text("address");
  invoice.phone = text("phone");
  invoice.email = text("email");
  invoice.invoiceNumber = text("invoiceNumber");
  invoice.invoiceDate = isoDate(text("invoiceDate"));
  invoice.dueDate = isoDate(text("dueDate"));
  invoice.currency = (text("currency") || "MAD").toUpperCase().replace("DHS", "MAD");
  invoice.totalHt = number("totalHt");
  invoice.totalVat = number("totalVat");
  invoice.totalTtc = number("totalTtc");
  const lines = Array.isArray(record.lines) ? record.lines : [];
  invoice.lines = lines.flatMap((line) => {
    const row = asRecord(line);
    if (!row || typeof row.description !== "string") return [];
    return [{
      description: row.description.trim(),
      quantity: typeof row.quantity === "number" ? row.quantity : money(String(row.quantity ?? "")) ?? 0,
      unitPriceHt: typeof row.unitPriceHt === "number" ? row.unitPriceHt : money(String(row.unitPriceHt ?? "")) ?? 0,
      vatRate: typeof row.vatRate === "number" ? row.vatRate : money(String(row.vatRate ?? "")) ?? 0,
      confidence: 0.9,
    }];
  });
  const vat = Array.isArray(record.vatByRate) ? record.vatByRate : [];
  invoice.vatByRate = vat.flatMap((item) => {
    const row = asRecord(item);
    if (!row) return [];
    const rate = typeof row.rate === "number" ? row.rate : Number(row.rate);
    const amount = typeof row.amount === "number" ? row.amount : money(String(row.amount ?? ""));
    return Number.isFinite(rate) && amount != null ? [{ rate, amount }] : [];
  });
  (Object.keys(invoice.confidence) as (keyof OcrSupplierInvoice["confidence"])[]).forEach((key) => {
    const present = key === "totalHt" || key === "totalVat" || key === "totalTtc" ? invoice[key] != null : Boolean(invoice[key]);
    invoice.confidence[key] = present ? 0.9 : 0;
  });
  return invoice;
}

export function lineTotals(lines: OcrInvoiceLine[]) {
  return lines.reduce((sum, line) => {
    const ht = round2(line.quantity * line.unitPriceHt);
    const vat = round2(ht * line.vatRate / 100);
    return { ht: round2(sum.ht + ht), vat: round2(sum.vat + vat), ttc: round2(sum.ttc + ht + vat) };
  }, { ht: 0, vat: 0, ttc: 0 });
}

export function reviewOcrInvoice(invoice: OcrSupplierInvoice) {
  const warnings: string[] = [];
  if (invoice.ice && !/^\d{15}$/.test(invoice.ice)) warnings.push("L’ICE doit contenir exactement 15 chiffres.");
  if (invoice.currency && invoice.currency !== "MAD") warnings.push("La facture n’est pas en MAD. Les montants seront enregistrés tels quels, sans conversion.");
  for (const line of invoice.lines) {
    if (!VAT_RATES.includes(line.vatRate)) warnings.push(`Le taux de TVA ${line.vatRate} % n’est pas un taux marocain usuel (20, 14, 10 ou 7).`);
  }
  const totals = lineTotals(invoice.lines);
  if (invoice.totalHt != null && Math.abs(totals.ht - invoice.totalHt) > 0.05) {
    warnings.push(`La somme des lignes HT (${totals.ht.toFixed(2)}) ne correspond pas au total HT du document (${invoice.totalHt.toFixed(2)}).`);
  }
  const vat = invoice.totalVat ?? (invoice.vatByRate.length ? round2(invoice.vatByRate.reduce((sum, item) => sum + item.amount, 0)) : null);
  if (invoice.totalHt != null && vat != null && invoice.totalTtc != null && Math.abs(round2(invoice.totalHt + vat) - invoice.totalTtc) > 0.05) {
    warnings.push(`Le total HT plus la TVA (${round2(invoice.totalHt + vat).toFixed(2)}) ne correspond pas au TTC (${invoice.totalTtc.toFixed(2)}).`);
  }
  if (invoice.lines.length > 0 && invoice.totalTtc != null && Math.abs(totals.ttc - invoice.totalTtc) > 0.05) {
    warnings.push(`Les lignes donnent un TTC de ${totals.ttc.toFixed(2)} MAD. Le document indique ${invoice.totalTtc.toFixed(2)} MAD. L’enregistrement utilisera les lignes.`);
  }
  return { warnings, totals };
}

export function matchSupplier(input: { name: string; ice: string }, parties: { id: string; name: string; ice: string | null }[]): SupplierMatch {
  const ice = input.ice.replace(/\s/g, "");
  if (/^\d{15}$/.test(ice)) {
    const found = parties.filter((party) => (party.ice ?? "").replace(/\s/g, "") === ice);
    if (found.length === 1) return { status: "matched", id: found[0].id, via: "ice" };
    if (found.length > 1) return { status: "ambiguous", via: "ice" };
  }
  const name = fold(input.name);
  if (name) {
    const found = parties.filter((party) => fold(party.name) === name);
    if (found.length === 1) return { status: "matched", id: found[0].id, via: "name" };
    if (found.length > 1) return { status: "ambiguous", via: "name" };
  }
  return { status: "new" };
}

export function validateNewSupplier(input: { name: string; ice: string; email: string }) {
  if (!input.name.trim()) return "Le nom du fournisseur est obligatoire.";
  const ice = input.ice.replace(/\s/g, "");
  if (ice && !/^\d{15}$/.test(ice)) return "L’ICE doit contenir exactement 15 chiffres.";
  if (input.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email.trim())) return "L’adresse e-mail n’est pas valide.";
  return null;
}

export function uncertain(confidence: number) {
  return confidence < UNCERTAIN_CONFIDENCE;
}
