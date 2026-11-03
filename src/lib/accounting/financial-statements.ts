export type StatementLine = {
  accountCode: string;
  debit: number;
  credit: number;
};

export type FinancialStatements = {
  actif: number;
  passif: number;
  charges: number;
  produits: number;
  resultat: number;
  balanced: boolean;
};

function round2(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function net(debit: number, credit: number) {
  return round2(debit - credit);
}

/** Classe CGNC : 2 et 3 à l'actif, 1 au passif, 4 selon le solde, 5 selon le solde, 6 charges, 7 produits. */
export function buildFinancialStatements(lines: StatementLine[]): FinancialStatements {
  let actif = 0;
  let passif = 0;
  let charges = 0;
  let produits = 0;
  const byAccount = new Map<string, { debit: number; credit: number }>();
  for (const line of lines) {
    const code = line.accountCode.trim();
    if (!code) continue;
    const current = byAccount.get(code) ?? { debit: 0, credit: 0 };
    current.debit += Number(line.debit) || 0;
    current.credit += Number(line.credit) || 0;
    byAccount.set(code, current);
  }
  for (const [code, amounts] of byAccount) {
    const classe = code[0];
    const balance = net(amounts.debit, amounts.credit);
    if (classe === "2" || classe === "3") actif += balance;
    else if (classe === "1") passif += -balance;
    else if (classe === "4" || classe === "5") {
      if (balance >= 0) actif += balance;
      else passif += -balance;
    } else if (classe === "6") charges += balance;
    else if (classe === "7") produits += -balance;
  }
  const resultat = round2(produits - charges);
  passif = round2(passif + resultat);
  actif = round2(actif);
  return {
    actif,
    passif,
    charges: round2(charges),
    produits: round2(produits),
    resultat,
    balanced: Math.abs(actif - passif) < 0.02,
  };
}
