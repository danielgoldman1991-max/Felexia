export type StatementBalanceLine = {
  balanceAfter: number | null;
  amount: number;
  direction: "in" | "out";
  fileOrder: number | null;
};

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

function previousBalance(line: StatementBalanceLine & { balanceAfter: number }) {
  const signed = line.direction === "in" ? line.amount : -line.amount;
  return round2(line.balanceAfter - signed);
}

/**
 * Solde de clôture : dernière ligne dans l'ordre du fichier.
 * Sans file_order (imports antérieurs), la dernière ligne est celle
 * dont le solde n'est le solde précédent d'aucune autre ligne.
 */
export function closingStatementBalance(lines: StatementBalanceLine[]): number | null {
  const withBalance = lines.filter((line): line is StatementBalanceLine & { balanceAfter: number } => line.balanceAfter != null && Number.isFinite(line.balanceAfter));
  if (withBalance.length === 0) return null;
  const ordered = withBalance.filter((line) => line.fileOrder != null);
  if (ordered.length > 0) {
    return ordered.reduce((best, line) => (line.fileOrder! > (best.fileOrder ?? -1) ? line : best)).balanceAfter;
  }
  const predecessors = new Set(withBalance.map((line) => previousBalance(line).toFixed(2)));
  const terminals = withBalance.filter((line) => !predecessors.has(round2(line.balanceAfter).toFixed(2)));
  if (terminals.length === 1) return terminals[0].balanceAfter;
  if (terminals.length > 1) return terminals[terminals.length - 1].balanceAfter;
  return withBalance[withBalance.length - 1].balanceAfter;
}
