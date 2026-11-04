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

export type IsPreviewInput = {
  turnover?: number | null;
  priorYearTax?: number | null;
};

const MINIMUM_CONTRIBUTION = 3000;
const MINIMUM_CONTRIBUTION_RATE = 0.0025;

/** Cotisation minimale : 0,25 % du chiffre d'affaires, plancher 3 000 MAD. */
export function minimumContribution(turnover: number) {
  return round2(Math.max(MINIMUM_CONTRIBUTION, Math.max(0, turnover) * MINIMUM_CONTRIBUTION_RATE));
}

/** Quatre acomptes de 25 % de l'impôt de référence. Le dernier absorbe l'arrondi. */
export function quarterlyInstallments(referenceTax: number) {
  const total = round2(Math.max(0, referenceTax));
  const slice = round2(total / 4);
  const last = round2(total - slice * 3);
  return [slice, slice, slice, last];
}

export function buildIsFile(ice: string, year: number, accountingResult: number, ratePercent: number | null, options: IsPreviewInput = {}): string {
  const result = round2(accountingResult);
  const rate = ratePercent === null ? null : round2(ratePercent);
  const tax = rate === null ? null : round2(Math.max(0, result) * rate / 100);
  const turnover = options.turnover === null || options.turnover === undefined ? null : round2(options.turnover);
  const contribution = turnover === null ? null : minimumContribution(turnover);
  const due = tax === null ? null : round2(Math.max(tax, contribution ?? 0));
  const reference = options.priorYearTax === null || options.priorYearTax === undefined ? tax : round2(Math.max(0, options.priorYearTax));
  const installments = reference === null ? null : quarterlyInstallments(reference);
  const installmentBase = options.priorYearTax === null || options.priorYearTax === undefined ? "IS_ESTIME_EXERCICE" : "IS_N_MOINS_1";
  return [
    "IS;PREPARATOIRE",
    `ICE;${ice || "A_COMPLETER"}`,
    `ANNEE;${year}`,
    `RESULTAT_COMPTABLE;${result.toFixed(2)}`,
    `TAUX_POURCENT;${rate === null ? "NON_RENSEIGNE" : rate.toFixed(3)}`,
    `IS_ESTIME;${tax === null ? "NON_CALCULE" : tax.toFixed(2)}`,
    `CHIFFRE_AFFAIRES;${turnover === null ? "NON_RENSEIGNE" : turnover.toFixed(2)}`,
    `COTISATION_MINIMALE;${contribution === null ? "NON_CALCULE" : contribution.toFixed(2)}`,
    "COTISATION_MINIMALE_REGLE;0,25% du CA, minimum 3000 MAD",
    `IS_DU;${due === null ? "NON_CALCULE" : due.toFixed(2)}`,
    `ACOMPTE_BASE;${installments === null ? "NON_CALCULE" : installmentBase}`,
    `ACOMPTE_1_MARS;${installments === null ? "NON_CALCULE" : installments[0].toFixed(2)}`,
    `ACOMPTE_2_JUIN;${installments === null ? "NON_CALCULE" : installments[1].toFixed(2)}`,
    `ACOMPTE_3_SEPTEMBRE;${installments === null ? "NON_CALCULE" : installments[2].toFixed(2)}`,
    `ACOMPTE_4_DECEMBRE;${installments === null ? "NON_CALCULE" : installments[3].toFixed(2)}`,
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
