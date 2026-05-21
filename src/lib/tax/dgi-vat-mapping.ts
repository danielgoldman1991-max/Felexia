import type { DgiVatDeclarationLine, DgiVatTaxBreakdown } from "@/lib/tax/dgi-vat-types";

export const DGI_VAT_SCHEMA_VERSION = "felexia-prep-1.0";

export const FELEXIA_DGI_VAT_DECLARATION_LINES = [
  { code: "010", label: "Chiffre d'affaires total HT" },
  { code: "020", label: "Opérations hors champ" },
  { code: "030", label: "Opérations exonérées sans droit à déduction" },
  { code: "040", label: "Opérations exonérées avec droit à déduction" },
  { code: "050", label: "Opérations en suspension" },
  { code: "060", label: "Chiffre d'affaires imposable HT" },
  { code: "080", label: "Base 20%" },
  { code: "080T", label: "TVA 20%" },
  { code: "092", label: "Base 10%" },
  { code: "092T", label: "TVA 10%" },
  { code: "100", label: "Base 14%" },
  { code: "100T", label: "TVA 14%" },
  { code: "130", label: "Total TVA exigible" },
  { code: "190", label: "Total TVA déductible" },
  { code: "200", label: "TVA due" },
  { code: "201", label: "Crédit à reporter" },
] as const;

export function roundMad(value: number) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

export function toMadAmount(value: unknown) {
  return roundMad(Number(value ?? 0) || 0);
}

export function buildDeclarationLines({
  salesBreakdowns,
  collectedVatMad,
  deductibleVatMad,
  vatDueMad,
  creditCarryForwardMad,
}: {
  salesBreakdowns: DgiVatTaxBreakdown[];
  collectedVatMad: number;
  deductibleVatMad: number;
  vatDueMad: number;
  creditCarryForwardMad: number;
}): DgiVatDeclarationLine[] {
  const baseTotal = roundMad(salesBreakdowns.reduce((sum, row) => sum + row.baseHtMad, 0));
  const taxableBase = roundMad(salesBreakdowns.filter((row) => row.taxRate > 0).reduce((sum, row) => sum + row.baseHtMad, 0));
  const byRate = new Map<number, { base: number; vat: number }>();

  for (const row of salesBreakdowns) {
    const current = byRate.get(row.taxRate) ?? { base: 0, vat: 0 };
    current.base += row.baseHtMad;
    current.vat += row.vatAmountMad;
    byRate.set(row.taxRate, current);
  }

  const amountFor = (code: string) => {
    if (code === "010") return baseTotal;
    if (code === "060") return taxableBase;
    if (code === "080") return byRate.get(20)?.base ?? 0;
    if (code === "080T") return byRate.get(20)?.vat ?? 0;
    if (code === "092") return byRate.get(10)?.base ?? 0;
    if (code === "092T") return byRate.get(10)?.vat ?? 0;
    if (code === "100") return byRate.get(14)?.base ?? 0;
    if (code === "100T") return byRate.get(14)?.vat ?? 0;
    if (code === "130") return collectedVatMad;
    if (code === "190") return deductibleVatMad;
    if (code === "200") return vatDueMad;
    if (code === "201") return creditCarryForwardMad;
    return 0;
  };

  return FELEXIA_DGI_VAT_DECLARATION_LINES.map((line) => ({
    ...line,
    amountMad: roundMad(amountFor(line.code)),
  }));
}

export function isCommonMoroccanVatRate(rate: number) {
  return [0, 7, 10, 14, 20].includes(roundMad(rate));
}
