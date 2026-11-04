import type { ExpertReconciliationView } from "@/lib/treasury/reconciliation-types";

export function buildReconciliationExcel(view: ExpertReconciliationView) {
  const rows = [
    ["Compte", view.accountName],
    ["Solde du relevé", view.balances.statement ?? ""],
    ["Solde comptable", view.balances.book ?? ""],
    ["Écart", view.balances.gap ?? ""],
    [],
    ["Date", "Libellé", "Sens", "Montant", "Score", "Groupe", "Proposition", "Motif"],
    ...view.lines.map((line) => [line.date, line.label, line.direction === "in" ? "Crédit" : "Débit", line.amount, line.score, line.band, line.summary, line.reason]),
  ];
  const body = rows.map((row) => `<tr>${row.map((cell) => `<td>${escapeCell(cell)}</td>`).join("")}</tr>`).join("");
  return `<html><head><meta charset="utf-8"></head><body><table>${body}</table></body></html>`;
}

function escapeCell(value: unknown) {
  return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;");
}
