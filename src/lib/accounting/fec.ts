export type FecEntry = {
  journalCode: string;
  journalLabel: string;
  entryNumber: string;
  entryDate: string;
  account: string;
  accountLabel: string;
  piece: string;
  pieceDate: string;
  label: string;
  debit: number;
  credit: number;
  letter?: string | null;
};

const HEADER = ["JournalCode", "JournalLib", "EcritureNum", "EcritureDate", "CompteNum", "CompteLib", "PieceRef", "PieceDate", "EcritureLib", "Debit", "Credit", "Lettrage"];

/** Export de type FEC, séparateur tabulation, dates AAAAMMJJ. Préparatoire, pas un dépôt. */
export function buildFec(entries: FecEntry[]): string {
  const rows = entries.map((entry) => [
    entry.journalCode,
    entry.journalLabel,
    entry.entryNumber,
    entry.entryDate.replaceAll("-", ""),
    entry.account,
    entry.accountLabel,
    entry.piece,
    entry.pieceDate.replaceAll("-", ""),
    entry.label,
    entry.debit.toFixed(2),
    entry.credit.toFixed(2),
    entry.letter ?? "",
  ].join("\t"));
  return [HEADER.join("\t"), ...rows, ""].join("\n");
}
