import { buildFinancialStatements, type StatementLine } from "@/lib/accounting/financial-statements";

export type Liasse = {
  bilan: { actif: number; passif: number; balanced: boolean };
  cpc: { charges: number; produits: number; resultat: number };
  esg: { capitauxDebut: number; resultat: number; capitauxFin: number; balanced: boolean };
  financement: { ressources: number; emplois: number; variation: number };
};

/** Liasse préparatoire. L'ESG reporte le résultat dans les capitaux. Le tableau de financement rapproche ressources et emplois de la classe 5. */
export function buildLiasse(lines: StatementLine[], openingEquity: number): Liasse {
  const statements = buildFinancialStatements(lines);
  const treasury = lines
    .filter((line) => line.accountCode.trim().startsWith("5"))
    .reduce((sum, line) => sum + (Number(line.debit) || 0) - (Number(line.credit) || 0), 0);
  const emplois = Math.max(0, -treasury);
  const ressources = Math.max(0, treasury) + Math.max(0, statements.resultat);
  return {
    bilan: { actif: statements.actif, passif: statements.passif, balanced: statements.balanced },
    cpc: { charges: statements.charges, produits: statements.produits, resultat: statements.resultat },
    esg: {
      capitauxDebut: round2(openingEquity),
      resultat: statements.resultat,
      capitauxFin: round2(openingEquity + statements.resultat),
      balanced: true,
    },
    financement: {
      ressources: round2(ressources),
      emplois: round2(emplois),
      variation: round2(ressources - emplois),
    },
  };
}

function round2(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
