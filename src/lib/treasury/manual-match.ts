export type ManualMatchLine = {
  id: string;
  direction: "in" | "out";
  remaining: number;
  amount: number;
};

export type ManualMatchDocument = ManualMatchLine & {
  kind: "transaction" | "customer_invoice" | "supplier_invoice";
};

export type ManualMatchPlan = {
  kind: "partial" | "grouped";
  partial: boolean;
  total: number;
  lines: { id: string; amount: number }[];
  documents: { id: string; type: ManualMatchDocument["kind"]; amount: number }[];
};

function money(value: number) {
  return Math.round(value * 100) / 100;
}

/** The two sides of one manual match must balance. Partial means an open remainder stays. */
export function planManualMatch(lines: ManualMatchLine[], documents: ManualMatchDocument[]): { ok: true; plan: ManualMatchPlan } | { ok: false; error: string } {
  if (lines.length === 0 || documents.length === 0) {
    return { ok: false, error: "Sélectionnez au moins une ligne de relevé et une pièce." };
  }
  if (new Set(lines.map((line) => line.id)).size !== lines.length) {
    return { ok: false, error: "Une ligne de relevé est sélectionnée deux fois." };
  }
  if (new Set(documents.map((document) => `${document.kind}:${document.id}`)).size !== documents.length) {
    return { ok: false, error: "Une pièce est sélectionnée deux fois." };
  }
  const direction = lines[0]?.direction;
  if (!direction || lines.some((line) => line.direction !== direction)) {
    return { ok: false, error: "Toutes les lignes doivent être du même sens, entrée ou sortie." };
  }
  let lineTotal = 0;
  const plannedLines = [];
  for (const line of lines) {
    const amount = money(line.amount);
    const remaining = money(line.remaining);
    if (!(amount > 0) || amount > remaining + 0.001) {
      return { ok: false, error: "Le montant d'une ligne dépasse son reste à rapprocher." };
    }
    lineTotal = money(lineTotal + amount);
    plannedLines.push({ id: line.id, amount });
  }
  let documentTotal = 0;
  const plannedDocuments = [];
  for (const document of documents) {
    if (document.direction !== direction) {
      return { ok: false, error: "Les pièces doivent avoir le même sens que les lignes du relevé." };
    }
    if (direction === "in" && document.kind === "supplier_invoice") {
      return { ok: false, error: "Une entrée se rapproche d'une facture client ou d'un encaissement." };
    }
    if (direction === "out" && document.kind === "customer_invoice") {
      return { ok: false, error: "Une sortie se rapproche d'une facture fournisseur ou d'un décaissement." };
    }
    const amount = money(document.amount);
    const remaining = money(document.remaining);
    if (!(amount > 0) || amount > remaining + 0.001) {
      return { ok: false, error: "Le montant d'une pièce dépasse son reste ouvert." };
    }
    documentTotal = money(documentTotal + amount);
    plannedDocuments.push({ id: document.id, type: document.kind, amount });
  }
  if (Math.abs(lineTotal - documentTotal) > 0.009) {
    return { ok: false, error: "Le total des lignes doit être égal au total des pièces." };
  }
  const grouped = lines.length > 1 || documents.length > 1;
  const partial = lines.some((line) => money(line.amount) + 0.009 < money(line.remaining))
    || documents.some((document) => money(document.amount) + 0.009 < money(document.remaining));
  return {
    ok: true,
    plan: {
      kind: grouped ? "grouped" : "partial",
      partial,
      total: lineTotal,
      lines: plannedLines,
      documents: plannedDocuments,
    },
  };
}

export function manualMatchError(code: string) {
  if (code.includes("MANUAL_MATCH_FORBIDDEN")) return "Votre rôle ne permet pas de rapprocher ce compte.";
  if (code.includes("MANUAL_MATCH_EMPTY")) return "Sélectionnez au moins une ligne de relevé et une pièce.";
  if (code.includes("MANUAL_MATCH_DUPLICATE")) return "Une ligne ou une pièce est sélectionnée deux fois.";
  if (code.includes("MANUAL_MATCH_DIRECTION")) return "Les lignes et les pièces doivent avoir le même sens.";
  if (code.includes("MANUAL_MATCH_AMOUNT")) return "Un montant dépasse le reste à rapprocher.";
  if (code.includes("MANUAL_MATCH_BALANCE")) return "Le total des lignes doit être égal au total des pièces.";
  if (code.includes("MANUAL_MATCH_LINE")) return "Une ligne du relevé n'est plus disponible. Actualisez la page.";
  if (code.includes("MANUAL_MATCH_DOCUMENT")) return "Une pièce n'est plus disponible. Actualisez la page.";
  if (code.includes("MANUAL_MATCH_MISSING")) return "Ce rapprochement est introuvable.";
  if (code.includes("PGRST202") || code.includes("42883") || code.includes("42P01")) {
    return "Le rapprochement manuel attend la migration 141. Aucune ligne n'a été modifiée.";
  }
  return "Le rapprochement manuel n'a pas abouti.";
}
