/**
 * Retenue à la source sur un règlement fournisseur, calcul préparatoire.
 * La retenue de TVA reprend l'article 117 du CGI : 75 % de la TVA lorsque
 * le fournisseur ne remet pas une attestation de régularité fiscale.
 * Les taux sur honoraires sont ceux saisis par l'entreprise (10 % ou 30 %
 * du hors taxes). Ce n'est pas une déclaration fiscale.
 */
export type WithholdingKind = "none" | "vat_attestation" | "fees_10" | "fees_30";

export type WithholdingInput = {
  kind: WithholdingKind;
  amountHt?: number;
  vatAmount?: number;
};

export type WithholdingResult = {
  kind: WithholdingKind;
  rate: number;
  base: number;
  withheld: number;
  legalBasis: string;
};

function money(value: number) {
  return Math.round((Math.max(0, value) + Number.EPSILON) * 100) / 100;
}

export function computeWithholding(input: WithholdingInput): WithholdingResult {
  if (input.kind === "vat_attestation") {
    const base = money(input.vatAmount ?? 0);
    return {
      kind: input.kind,
      rate: 75,
      base,
      withheld: money(base * 0.75),
      legalBasis: "CGI art. 117 — 75 % de la TVA sans attestation de régularité fiscale.",
    };
  }
  if (input.kind === "fees_10" || input.kind === "fees_30") {
    const rate = input.kind === "fees_10" ? 10 : 30;
    const base = money(input.amountHt ?? 0);
    return {
      kind: input.kind,
      rate,
      base,
      withheld: money(base * rate / 100),
      legalBasis: input.kind === "fees_10"
        ? "Retenue de 10 % sur honoraires ou commissions, base hors taxes confirmée par l'entreprise."
        : "Retenue de 30 % sur rémunérations de tiers non identifiés fiscalement, base hors taxes confirmée par l'entreprise.",
    };
  }
  return { kind: "none", rate: 0, base: 0, withheld: 0, legalBasis: "Aucune retenue." };
}
