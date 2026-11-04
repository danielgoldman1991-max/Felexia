export type VatControlInput = {
  invoiceCollected: number;
  ledgerCollected: number;
  invoiceDeductible: number;
  ledgerDeductible: number;
};

export type VatControlRow = {
  label: string;
  invoice: number;
  ledger: number;
  gap: number;
  ok: boolean;
};

function round2(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/** TVA collectée des factures contre le solde créditeur 4455, et TVA récupérable contre le solde débiteur 3455. */
export function compareVatToLedger(input: VatControlInput): VatControlRow[] {
  const collectedGap = round2(input.invoiceCollected - input.ledgerCollected);
  const deductibleGap = round2(input.invoiceDeductible - input.ledgerDeductible);
  return [
    {
      label: "TVA collectée / 4455",
      invoice: round2(input.invoiceCollected),
      ledger: round2(input.ledgerCollected),
      gap: collectedGap,
      ok: Math.abs(collectedGap) < 0.02,
    },
    {
      label: "TVA récupérable / 3455",
      invoice: round2(input.invoiceDeductible),
      ledger: round2(input.ledgerDeductible),
      gap: deductibleGap,
      ok: Math.abs(deductibleGap) < 0.02,
    },
  ];
}
