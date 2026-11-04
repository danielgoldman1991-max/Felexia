import { buildFinancialStatements, type StatementLine } from "@/lib/accounting/financial-statements";

export type LiassePoste = {
  section: "actif" | "passif" | "cpc" | "esg" | "annexe";
  code: string;
  label: string;
  amount: number;
};

export type Liasse = {
  bilan: { actif: number; passif: number; balanced: boolean };
  cpc: { charges: number; produits: number; resultat: number };
  esg: { capitauxDebut: number; resultat: number; capitauxFin: number; balanced: boolean };
  financement: { ressources: number; emplois: number; variation: number };
  postes: LiassePoste[];
};

const PREFIX_LABELS: Record<string, string> = {
  "21": "Immobilisations en non-valeurs",
  "22": "Immobilisations incorporelles",
  "23": "Immobilisations corporelles",
  "24": "Immobilisations financières",
  "25": "Immobilisations financières",
  "31": "Stocks",
  "34": "Créances de l'actif circulant",
  "35": "Titres et valeurs de placement",
  "51": "Trésorerie — actifs",
  "11": "Capitaux propres",
  "13": "Capitaux propres assimilés",
  "14": "Dettes de financement",
  "44": "Dettes du passif circulant",
  "45": "Autres provisions pour risques",
  "55": "Trésorerie — passif",
  "61": "Charges d'exploitation",
  "63": "Charges financières",
  "65": "Charges non courantes",
  "67": "Impôts sur les résultats",
  "71": "Produits d'exploitation",
  "73": "Produits financiers",
  "75": "Produits non courants",
};

/** Liasse de gestion CGNC. Ce n'est pas une liasse certifiée ni un dépôt fiscal. */
export function buildLiasse(lines: StatementLine[], openingEquity: number): Liasse {
  const statements = buildFinancialStatements(lines);
  // Variation de trésorerie = mouvement net des comptes de classe 5 (débit − crédit).
  // Elle doit égaler le solde de trésorerie lu sur les mêmes écritures, sans y ajouter le résultat.
  const treasury = round2(lines
    .filter((line) => line.accountCode.trim().startsWith("5"))
    .reduce((sum, line) => sum + (Number(line.debit) || 0) - (Number(line.credit) || 0), 0));
  const emplois = Math.max(0, -treasury);
  const ressources = Math.max(0, treasury);
  const postes = buildPostes(lines, openingEquity, statements.resultat);
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
    postes,
  };
}

export function buildLiasseExcel(liasse: Liasse): string {
  const rows = [
    ["Section", "Code", "Libellé", "Montant MAD"],
    ...liasse.postes.map((poste) => [poste.section, poste.code, poste.label, poste.amount.toFixed(2)]),
    [],
    ["Synthèse", "Actif", "", liasse.bilan.actif.toFixed(2)],
    ["Synthèse", "Passif", "", liasse.bilan.passif.toFixed(2)],
    ["Synthèse", "Résultat", "", liasse.cpc.resultat.toFixed(2)],
    ["Synthèse", "Capitaux de clôture", "", liasse.esg.capitauxFin.toFixed(2)],
  ];
  const body = rows.map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(String(cell))}</td>`).join("")}</tr>`).join("");
  return `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="utf-8"></head><body><table>${body}</table><p>Liasse de gestion Felexia. Ce n'est pas une liasse fiscale certifiée.</p></body></html>`;
}

function buildPostes(lines: StatementLine[], openingEquity: number, resultat: number): LiassePoste[] {
  const groups = new Map<string, LiassePoste>();
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
    const placed = placeAccount(code, amounts.debit, amounts.credit);
    if (!placed || Math.abs(placed.amount) < 0.005) continue;
    const prefix = code.slice(0, 2);
    const key = `${placed.section}:${prefix}`;
    const existing = groups.get(key) ?? {
      section: placed.section,
      code: prefix,
      label: PREFIX_LABELS[prefix] ?? `Comptes ${prefix}`,
      amount: 0,
    };
    existing.amount = round2(existing.amount + placed.amount);
    groups.set(key, existing);
    if (code.startsWith("3455") || code.startsWith("4455") || code.startsWith("3456")) {
      const annexKey = `annexe:${code}`;
      groups.set(annexKey, { section: "annexe", code, label: code.startsWith("3455") ? "État, TVA récupérable" : "État, TVA due ou facturée", amount: round2(amounts.debit - amounts.credit) });
    }
  }
  const postes = [...groups.values()];
  postes.push(
    { section: "esg", code: "ESG-O", label: "Capitaux propres à l'ouverture", amount: round2(openingEquity) },
    { section: "esg", code: "ESG-R", label: "Résultat net de l'exercice", amount: round2(resultat) },
    { section: "esg", code: "ESG-F", label: "Capitaux propres à la clôture", amount: round2(openingEquity + resultat) },
  );
  return postes.filter((poste) => Math.abs(poste.amount) >= 0.005 || poste.section === "esg");
}

function placeAccount(code: string, debit: number, credit: number): { section: LiassePoste["section"]; amount: number } | null {
  const balance = round2(debit - credit);
  const classe = code[0];
  if (classe === "2" || classe === "3") return { section: "actif", amount: balance };
  if (classe === "1") return { section: "passif", amount: round2(-balance) };
  if (classe === "4" || classe === "5") return balance >= 0 ? { section: "actif", amount: balance } : { section: "passif", amount: round2(-balance) };
  if (classe === "6" || classe === "7") return { section: "cpc", amount: classe === "6" ? balance : round2(-balance) };
  return null;
}

function round2(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function escapeHtml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
