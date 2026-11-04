export type OfxRow = {
  date: string;
  value_date: string;
  label: string;
  reference: string;
  debit: string;
  credit: string;
  balance: string;
};

/** OFX 1 (SGML) et OFX 2 (XML). Un montant négatif est un débit. */
export function parseOfx(content: string): OfxRow[] {
  const blocks = content.split(/<STMTTRN>/i).slice(1);
  const rows: OfxRow[] = [];
  for (const block of blocks) {
    const body = block.split(/<\/STMTTRN>/i)[0] ?? block;
    const amount = numberTag(body, "TRNAMT");
    const posted = dateTag(body, "DTPOSTED");
    if (!posted || !Number.isFinite(amount) || amount === 0) continue;
    const absolute = Math.abs(amount).toFixed(2);
    rows.push({
      date: posted,
      value_date: dateTag(body, "DTUSER") || posted,
      label: textTag(body, "NAME") || textTag(body, "MEMO") || "Opération bancaire",
      reference: textTag(body, "FITID") || textTag(body, "CHECKNUM") || "",
      debit: amount < 0 ? absolute : "0",
      credit: amount > 0 ? absolute : "0",
      balance: "",
    });
  }
  return rows;
}

export function looksLikeOfx(fileName: string, content: string) {
  const name = fileName.toLowerCase();
  return name.endsWith(".ofx") || name.endsWith(".qfx") || /<(OFX|STMTTRN)\b/i.test(content.slice(0, 4000));
}

function textTag(block: string, tag: string) {
  const match = block.match(new RegExp(`<${tag}>([^<\\r\\n]+)`, "i"));
  return match?.[1]?.trim() ?? "";
}

function numberTag(block: string, tag: string) {
  const raw = textTag(block, tag).replace(",", ".");
  const value = Number(raw);
  return Number.isFinite(value) ? value : Number.NaN;
}

function dateTag(block: string, tag: string) {
  const raw = textTag(block, tag).replace(/\D/g, "");
  if (raw.length < 8) return "";
  return `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;
}
