import type { SimplLine } from "@/lib/accounting/edi-simpl";
import type { BdsEmployee } from "@/lib/hr/bds";
import type { AnnualIrRow } from "@/lib/hr/etat-9421";

const RATE_BY_CODE: Record<string, number> = { "080": 0.2, "092": 0.1, "100": 0.14, "110": 0.07 };

/** Transforme les lignes de déclaration en paires base/taxe du fichier SIMPL préparatoire. */
export function declarationToSimplLines(lines: Array<{ code: string; amountMad: number }>): SimplLine[] {
  const amounts = new Map(lines.map((line) => [line.code, Number(line.amountMad) || 0]));
  const pairs: SimplLine[] = [
    { code: "080", base: amounts.get("080") ?? 0, tax: amounts.get("080T") ?? 0 },
    { code: "092", base: amounts.get("092") ?? 0, tax: amounts.get("092T") ?? 0 },
    { code: "100", base: amounts.get("100") ?? 0, tax: amounts.get("100T") ?? 0 },
    { code: "110", base: amounts.get("110") ?? 0, tax: amounts.get("110T") ?? 0 },
    { code: "130", base: 0, tax: amounts.get("130") ?? 0 },
    { code: "190", base: 0, tax: amounts.get("190") ?? 0 },
  ];
  return pairs.filter((line) => line.base !== 0 || line.tax !== 0);
}

export function validateSimpl(ice: string, period: string, lines: SimplLine[]): string[] {
  const issues: string[] = [];
  if (!/^\d{15}$/.test(ice)) issues.push("ICE absent ou différent de 15 chiffres.");
  if (!/^\d{6}$/.test(period)) issues.push("Période attendue au format AAAAMM.");
  for (const line of lines) {
    const rate = RATE_BY_CODE[line.code];
    if (!rate || line.base === 0) continue;
    const expected = Math.round(line.base * rate * 100) / 100;
    if (Math.abs(expected - line.tax) > 0.05) issues.push(`Ligne ${line.code} : la taxe ${line.tax.toFixed(2)} s'écarte de ${expected.toFixed(2)}.`);
  }
  return issues;
}

export function buildIsFile(ice: string, year: number, accountingResult: number, ratePercent: number | null): string {
  const result = round2(accountingResult);
  const rate = ratePercent === null ? null : round2(ratePercent);
  const tax = rate === null ? null : round2(Math.max(0, result) * rate / 100);
  return [
    "IS;PREPARATOIRE",
    `ICE;${ice || "A_COMPLETER"}`,
    `ANNEE;${year}`,
    `RESULTAT_COMPTABLE;${result.toFixed(2)}`,
    `TAUX_POURCENT;${rate === null ? "NON_RENSEIGNE" : rate.toFixed(3)}`,
    `IS_ESTIME;${tax === null ? "NON_CALCULE" : tax.toFixed(2)}`,
    "DEPOT;MANUEL",
    "",
  ].join("\n");
}

export function bdsIssues(rows: BdsEmployee[], ceiling: number): string[] {
  return rows.flatMap((row, index) => {
    const issues: string[] = [];
    const line = index + 1;
    if (!/^\d{6,10}$/.test(row.cnssNumber)) issues.push(`Ligne ${line} : numéro CNSS incomplet.`);
    if (row.days < 0 || row.days > 26) issues.push(`Ligne ${line} : les jours doivent être entre 0 et 26.`);
    if (row.gross < 0 || row.capped < 0) issues.push(`Ligne ${line} : montant négatif.`);
    if (row.capped - row.gross > 0.01) issues.push(`Ligne ${line} : le plafonné dépasse le brut.`);
    if (row.capped - ceiling > 0.01) issues.push(`Ligne ${line} : le plafonné dépasse le plafond CNSS.`);
    return issues;
  });
}

export function irIssues(rows: AnnualIrRow[]): string[] {
  return rows.flatMap((row, index) => {
    const issues: string[] = [];
    const line = index + 1;
    if (!row.fullName.trim()) issues.push(`Ligne ${line} : nom manquant.`);
    if (row.cin && !/^[A-Za-z]{1,2}\d{3,8}$/.test(row.cin.replace(/\s/g, ""))) issues.push(`Ligne ${line} : CIN inhabituelle.`);
    if (row.taxable < 0 || row.irWithheld < 0) issues.push(`Ligne ${line} : montant négatif.`);
    if (row.irWithheld - row.taxable > 0.01) issues.push(`Ligne ${line} : l'IR retenu dépasse le revenu imposable.`);
    return issues;
  });
}

export function controlTrailer(issues: string[]): string {
  if (issues.length === 0) return "CONTROLE;0\n";
  return `CONTROLE;${issues.length};${issues.join(" | ")}\n`;
}

function round2(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
