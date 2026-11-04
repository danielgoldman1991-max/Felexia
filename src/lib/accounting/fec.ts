export type FecEntry = {
  journalCode: string;
  journalLabel: string;
  entryNumber: string;
  entryDate: string;
  account: string;
  accountLabel: string;
  auxiliaryNumber?: string | null;
  auxiliaryLabel?: string | null;
  piece: string;
  pieceDate: string;
  label: string;
  debit: number;
  credit: number;
  letter?: string | null;
  letterDate?: string | null;
};

const HEADER = [
  "JournalCode",
  "JournalLib",
  "EcritureNum",
  "EcritureDate",
  "CompteNum",
  "CompteLib",
  "CompteAuxNum",
  "CompteAuxLib",
  "PieceRef",
  "PieceDate",
  "EcritureLib",
  "Debit",
  "Credit",
  "Lettrage",
  "DateLettrage",
];

/**
 * Export de type FEC, séparateur tabulation, dates AAAAMMJJ. Préparatoire, pas un dépôt.
 * Les lignes sont triées par date d'écriture, puis par numéro.
 * Le numéro de journal est attribué à la comptabilisation, dans le mois de la date :
 * il ne suit pas forcément l'ordre chronologique des jours à l'intérieur du mois.
 */
export function buildFec(entries: FecEntry[]): string {
  const sorted = [...entries].sort((left, right) =>
    left.entryDate.localeCompare(right.entryDate)
    || left.entryNumber.localeCompare(right.entryNumber, "fr")
    || left.account.localeCompare(right.account),
  );
  const rows = sorted.map((entry) => [
    entry.journalCode,
    entry.journalLabel,
    entry.entryNumber,
    entry.entryDate.replaceAll("-", ""),
    entry.account,
    entry.accountLabel,
    entry.auxiliaryNumber ?? "",
    entry.auxiliaryLabel ?? "",
    entry.piece,
    entry.pieceDate.replaceAll("-", ""),
    entry.label,
    entry.debit.toFixed(2),
    entry.credit.toFixed(2),
    entry.letter ?? "",
    (entry.letterDate ?? "").replaceAll("-", ""),
  ].join("\t"));
  return [HEADER.join("\t"), ...rows, ""].join("\n");
}
