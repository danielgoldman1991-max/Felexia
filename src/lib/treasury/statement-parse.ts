import { createHash } from "node:crypto";
import { inflateRawSync } from "node:zlib";
import { MOROCCAN_BANKS } from "@/lib/treasury/moroccan-banks";
import { looksLikeOfx, parseOfx } from "@/lib/treasury/ofx";

export { MOROCCAN_BANKS };

export type ColumnRole = "date" | "valueDate" | "label" | "reference" | "debit" | "credit" | "amount" | "direction" | "balance";

/** En-têtes mémorisés, pas des index : un relevé plus large reste lisible. */
export type ColumnMapping = {
  date: string;
  valueDate: string | null;
  label: string;
  reference: string | null;
  debit: string | null;
  credit: string | null;
  amount: string | null;
  direction: string | null;
  balance: string | null;
  delimiter: string;
  bankCode: string | null;
};

export type ParsedRow = {
  operation_date: string;
  value_date: string | null;
  label: string;
  reference: string | null;
  debit_amount: number;
  credit_amount: number;
  amount: number;
  direction: "in" | "out";
  balance_after: number | null;
};

export type ParsedStatementFile = {
  fileType: "ofx" | "csv" | "xlsx";
  rows: ParsedRow[];
  needsMapping: boolean;
  headers: string[];
  sample: string[][];
  suggested: ColumnMapping | null;
  bankCode: string | null;
  error?: string;
};

const HEADER_SYNONYMS: Record<ColumnRole, string[]> = {
  date: ["date operation", "date d operation", "date op", "date comptable", "date", "operation date"],
  valueDate: ["date de valeur", "date valeur", "valeur", "value date"],
  label: ["libelle operation", "libelle", "description", "detail", "details", "intitule", "narration"],
  reference: ["reference", "ref", "n piece", "piece", "n cheque", "cheque"],
  debit: ["debit", "montant debit", "sortie", "decaissement"],
  credit: ["credit", "montant credit", "entree", "encaissement"],
  amount: ["montant", "amount", "somme"],
  direction: ["sens", "debit credit", "d c", "dc"],
  balance: ["solde", "solde apres operation", "balance"],
};

export function foldText(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
}

export function parseMoroccanAmount(value: string | number | null | undefined): number {
  if (typeof value === "number") return Number.isFinite(value) ? round2(value) : 0;
  let raw = String(value ?? "").trim();
  if (!raw || raw === "-" || raw === "—") return 0;
  let sign = 1;
  if (/^\(.*\)$/.test(raw)) {
    sign = -1;
    raw = raw.slice(1, -1);
  }
  if (raw.endsWith("-")) {
    sign = -1;
    raw = raw.slice(0, -1);
  }
  raw = raw.replace(/mad/ig, "").replace(/[\s\u00a0\u202f]/g, "");
  const comma = raw.lastIndexOf(",");
  const dot = raw.lastIndexOf(".");
  if (comma >= 0 && dot >= 0) raw = comma > dot ? raw.replace(/\./g, "").replace(",", ".") : raw.replace(/,/g, "");
  else if (comma >= 0) raw = raw.replace(",", ".");
  const parsed = Number(raw.replace(/[^\d.-]/g, ""));
  return Number.isFinite(parsed) ? round2(sign * parsed) : 0;
}

export function parseMoroccanDate(value: string | number | null | undefined): string {
  if (typeof value === "number" && value > 20_000 && value < 80_000) {
    const utc = Date.UTC(1899, 11, 30) + Math.round(value) * 86_400_000;
    return new Date(utc).toISOString().slice(0, 10);
  }
  const raw = String(value ?? "").trim();
  if (/^\d{5}(\.\d+)?$/.test(raw)) {
    const serial = Number(raw);
    if (serial > 20_000 && serial < 80_000) return parseMoroccanDate(serial);
  }
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const local = raw.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})/);
  if (!local) return "";
  const day = local[1].padStart(2, "0");
  const month = local[2].padStart(2, "0");
  let year = Number(local[3]);
  if (year < 100) year += year >= 70 ? 1900 : 2000;
  if (Number(month) < 1 || Number(month) > 12 || Number(day) < 1 || Number(day) > 31) return "";
  return `${year}-${month}-${day}`;
}

export function statementLineHash(accountId: string, row: ParsedRow) {
  const parts = [
    accountId,
    row.operation_date,
    row.value_date,
    row.label,
    row.reference,
    row.direction,
    row.amount.toFixed(2),
    row.debit_amount.toFixed(2),
    row.credit_amount.toFixed(2),
    row.balance_after ?? "",
  ].map((part) => String(part ?? "").trim().toLowerCase().replace(/\s+/g, " "));
  return createHash("sha256").update(parts.join("|")).digest("hex");
}

export function parseBankFile(input: {
  fileName: string;
  text: string;
  bytes?: Buffer;
  mapping?: ColumnMapping | null;
}): ParsedStatementFile {
  const name = input.fileName.toLowerCase();
  if (name.endsWith(".xls") && !name.endsWith(".xlsx")) {
    return empty("xlsx", "Le format Excel .xls n'est pas lu. Enregistrez le relevé en .xlsx ou en CSV.");
  }
  if (looksLikeOfx(input.fileName, input.text)) {
    const rows = parseOfx(input.text).map((row) => toRow({
      date: row.date,
      valueDate: row.value_date,
      label: row.label,
      reference: row.reference,
      debit: row.debit,
      credit: row.credit,
      balance: row.balance,
    })).filter(isUsable);
    return { fileType: "ofx", rows, needsMapping: false, headers: [], sample: [], suggested: null, bankCode: null };
  }
  const xlsx = name.endsWith(".xlsx") || (input.bytes && input.bytes.length > 2 && input.bytes[0] === 0x50 && input.bytes[1] === 0x4b);
  if (xlsx) {
    if (!input.bytes) return empty("xlsx", "Le fichier Excel n'a pas pu être lu.");
    const grid = readXlsxGrid(input.bytes);
    if (grid.length === 0) return empty("xlsx", "La première feuille du classeur est vide.");
    return fromGrid(grid, ",", input.mapping ?? null, "xlsx");
  }
  const grid = parseDelimited(input.text);
  if (grid.length === 0) return empty("csv", "Le fichier ne contient aucune ligne.");
  const delimiter = detectDelimiter(input.text.split(/\r?\n/).find((line) => line.trim()) ?? "");
  return fromGrid(grid, delimiter, input.mapping ?? null, "csv");
}

export function readXlsxGrid(bytes: Buffer): string[][] {
  const files = unzip(bytes);
  const sheetName = [...files.keys()].find((name) => /xl\/worksheets\/sheet1\.xml$/i.test(name));
  const sheet = sheetName ? files.get(sheetName) : undefined;
  if (!sheet) return [];
  const shared = readSharedStrings(files.get("xl/sharedStrings.xml"));
  const xml = sheet.toString("utf8");
  const cells = new Map<string, string>();
  let maxRow = 0;
  let maxCol = 0;
  for (const match of xml.matchAll(/<c\b([^>]*)>([\s\S]*?)<\/c>/g)) {
    const attrs = match[1] ?? "";
    const body = match[2] ?? "";
    const ref = attrs.match(/\br="([A-Z]+)(\d+)"/);
    if (!ref) continue;
    const col = columnIndex(ref[1]);
    const row = Number(ref[2]);
    const type = attrs.match(/\bt="([^"]+)"/)?.[1] ?? "";
    const value = body.match(/<v>([\s\S]*?)<\/v>/)?.[1] ?? "";
    const inline = body.match(/<t[^>]*>([\s\S]*?)<\/t>/)?.[1] ?? "";
    let text = "";
    if (type === "s") text = shared[Number(value)] ?? "";
    else if (type === "inlineStr") text = decodeXml(inline);
    else text = decodeXml(value);
    cells.set(`${row}:${col}`, text);
    maxRow = Math.max(maxRow, row);
    maxCol = Math.max(maxCol, col);
  }
  const grid: string[][] = [];
  for (let row = 1; row <= maxRow; row += 1) {
    const line: string[] = [];
    for (let col = 0; col <= maxCol; col += 1) line.push(cells.get(`${row}:${col}`) ?? "");
    if (line.some((cell) => cell.trim())) grid.push(line);
  }
  return grid;
}

export function suggestMapping(headers: string[], delimiter: string): { mapping: ColumnMapping | null; bankCode: string | null } {
  const folded = headers.map(foldText);
  const bank = MOROCCAN_BANKS.find((item) => folded.some((header) => item.hints.some((hint) => header.includes(hint))));
  const used = new Set<number>();
  function pick(role: ColumnRole, required = false) {
    const index = folded.findIndex((header, position) => !used.has(position) && HEADER_SYNONYMS[role].includes(header));
    if (index < 0) return required ? "" : null;
    used.add(index);
    return headers[index] ?? null;
  }
  const date = pick("date", true);
  const label = pick("label", true);
  const debit = pick("debit");
  const credit = pick("credit");
  const amount = pick("amount");
  if (!date || !label || (!debit && !credit && !amount)) return { mapping: null, bankCode: bank?.code ?? null };
  return {
    bankCode: bank?.code ?? null,
    mapping: {
      date,
      valueDate: pick("valueDate"),
      label,
      reference: pick("reference"),
      debit,
      credit,
      amount,
      direction: pick("direction"),
      balance: pick("balance"),
      delimiter,
      bankCode: bank?.code ?? null,
    },
  };
}

function fromGrid(grid: string[][], delimiter: string, mapping: ColumnMapping | null, fileType: "csv" | "xlsx"): ParsedStatementFile {
  const headers = grid[0].map((cell) => cell.trim());
  const sample = grid.slice(1, 6);
  const suggested = mapping ?? suggestMapping(headers, delimiter).mapping;
  const bankCode = mapping?.bankCode ?? suggestMapping(headers, delimiter).bankCode;
  if (!suggested) {
    return { fileType, rows: [], needsMapping: true, headers, sample, suggested: null, bankCode };
  }
  const indexes = resolveMapping(headers, suggested);
  if (!indexes) {
    return { fileType, rows: [], needsMapping: true, headers, sample, suggested, bankCode };
  }
  const rows = grid.slice(1).map((cells) => toRow({
    date: cells[indexes.date] ?? "",
    valueDate: indexes.valueDate === null ? "" : cells[indexes.valueDate] ?? "",
    label: cells[indexes.label] ?? "",
    reference: indexes.reference === null ? "" : cells[indexes.reference] ?? "",
    debit: indexes.debit === null ? "" : cells[indexes.debit] ?? "",
    credit: indexes.credit === null ? "" : cells[indexes.credit] ?? "",
    amount: indexes.amount === null ? "" : cells[indexes.amount] ?? "",
    direction: indexes.direction === null ? "" : cells[indexes.direction] ?? "",
    balance: indexes.balance === null ? "" : cells[indexes.balance] ?? "",
  })).filter(isUsable);
  return { fileType, rows, needsMapping: false, headers, sample, suggested, bankCode };
}

function resolveMapping(headers: string[], mapping: ColumnMapping) {
  const indexOf = (name: string | null) => {
    if (!name) return null;
    const wanted = foldText(name);
    const index = headers.findIndex((header) => foldText(header) === wanted);
    return index < 0 ? null : index;
  };
  const date = indexOf(mapping.date);
  const label = indexOf(mapping.label);
  const debit = indexOf(mapping.debit);
  const credit = indexOf(mapping.credit);
  const amount = indexOf(mapping.amount);
  if (date === null || label === null || (debit === null && credit === null && amount === null)) return null;
  return {
    date,
    label,
    debit,
    credit,
    amount,
    valueDate: indexOf(mapping.valueDate),
    reference: indexOf(mapping.reference),
    direction: indexOf(mapping.direction),
    balance: indexOf(mapping.balance),
  };
}

function toRow(input: { date: string; valueDate?: string; label: string; reference?: string; debit?: string; credit?: string; amount?: string; direction?: string; balance?: string }): ParsedRow {
  const debit = Math.abs(parseMoroccanAmount(input.debit));
  const credit = Math.abs(parseMoroccanAmount(input.credit));
  const signed = parseMoroccanAmount(input.amount);
  const sens = foldText(input.direction ?? "");
  let direction: "in" | "out";
  let amount = 0;
  if (credit > 0 && debit > 0) {
    direction = credit >= debit ? "in" : "out";
    amount = round2(Math.abs(credit - debit)) || Math.max(credit, debit);
  } else if (credit > 0 && debit === 0) {
    direction = "in";
    amount = credit;
  } else if (debit > 0 && credit === 0) {
    direction = "out";
    amount = debit;
  } else if (sens.startsWith("c") || sens.includes("credit") || sens.includes("entree")) {
    direction = "in";
    amount = Math.abs(signed) || credit;
  } else if (sens.startsWith("d") || sens.includes("debit") || sens.includes("sortie")) {
    direction = "out";
    amount = Math.abs(signed) || debit;
  } else if (signed < 0) {
    direction = "out";
    amount = Math.abs(signed);
  } else {
    direction = "in";
    amount = Math.abs(signed);
  }
  const balanceRaw = String(input.balance ?? "").trim();
  return {
    operation_date: parseMoroccanDate(input.date),
    value_date: parseMoroccanDate(input.valueDate ?? "") || null,
    label: String(input.label ?? "").trim() || "Opération bancaire",
    reference: String(input.reference ?? "").trim() || null,
    debit_amount: direction === "out" ? amount : 0,
    credit_amount: direction === "in" ? amount : 0,
    amount,
    direction,
    balance_after: balanceRaw ? parseMoroccanAmount(balanceRaw) : null,
  };
}

function isUsable(row: ParsedRow) {
  return Boolean(row.operation_date) && row.amount > 0;
}

export function parseDelimited(text: string, delimiter?: string): string[][] {
  const source = text.replace(/^\uFEFF/, "");
  const lines = source.split(/\r?\n/).filter((line) => line.trim());
  if (lines.length === 0) return [];
  const chosen = delimiter ?? detectDelimiter(lines[0]);
  return lines.map((line) => splitDelimitedLine(line, chosen));
}

export function detectDelimiter(line: string) {
  const counts = { ";": 0, ",": 0, "\t": 0 };
  let quoted = false;
  for (const char of line) {
    if (char === '"') quoted = !quoted;
    else if (!quoted && char in counts) counts[char as ";" | "," | "\t"] += 1;
  }
  return (Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[1] ?? 0) > 0
    ? (Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0])
    : ",";
}

function splitDelimitedLine(line: string, delimiter: string) {
  const cells: string[] = [];
  let current = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') {
      if (quoted && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else quoted = !quoted;
    } else if (char === delimiter && !quoted) {
      cells.push(current.trim());
      current = "";
    } else current += char;
  }
  cells.push(current.trim());
  return cells;
}

function empty(fileType: ParsedStatementFile["fileType"], error: string): ParsedStatementFile {
  return { fileType, rows: [], needsMapping: false, headers: [], sample: [], suggested: null, bankCode: null, error };
}

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

function columnIndex(letters: string) {
  return [...letters].reduce((total, letter) => total * 26 + letter.charCodeAt(0) - 64, 0) - 1;
}

function decodeXml(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)));
}

function readSharedStrings(file: Buffer | undefined) {
  if (!file) return [];
  const xml = file.toString("utf8");
  const items: string[] = [];
  for (const item of xml.matchAll(/<si>([\s\S]*?)<\/si>/g)) {
    const texts = [...(item[1] ?? "").matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((match) => decodeXml(match[1] ?? ""));
    items.push(texts.join(""));
  }
  return items;
}

function unzip(bytes: Buffer) {
  const files = new Map<string, Buffer>();
  let offset = 0;
  while (offset + 30 <= bytes.length && bytes.readUInt32LE(offset) === 0x04034b50) {
    const method = bytes.readUInt16LE(offset + 8);
    const compressedSize = bytes.readUInt32LE(offset + 18);
    const nameLength = bytes.readUInt16LE(offset + 26);
    const extraLength = bytes.readUInt16LE(offset + 28);
    const name = bytes.slice(offset + 30, offset + 30 + nameLength).toString("utf8");
    const start = offset + 30 + nameLength + extraLength;
    const compressed = bytes.slice(start, start + compressedSize);
    if (method === 0) files.set(name, compressed);
    else if (method === 8) files.set(name, inflateRawSync(compressed));
    offset = start + compressedSize;
  }
  return files;
}
