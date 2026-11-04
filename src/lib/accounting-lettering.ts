import { roundInvoice2 } from "@/lib/invoice-calculations";

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

/** Next unused lettrage code: A…Z, then AA…ZZ. */
export function nextLetteringCode(existing: Array<string | null | undefined>): string {
  const used = new Set(existing.map((code) => (code ?? "").trim().toUpperCase()).filter(Boolean));
  for (const letter of LETTERS) {
    if (!used.has(letter)) return letter;
  }
  for (const first of LETTERS) {
    for (const second of LETTERS) {
      const code = `${first}${second}`;
      if (!used.has(code)) return code;
    }
  }
  return "L1";
}

export type LetteringCandidate = {
  id: string;
  accountCode: string;
  debit: number;
  credit: number;
  label: string;
  partyKey: string | null;
  partyName: string | null;
};

/** Pairs an open debit with an open credit of the same account, third party and amount. */
export function suggestLetteringMatches(lines: LetteringCandidate[]): LetteringCandidate[][] {
  const open = lines.filter((line) => (line.debit > 0) !== (line.credit > 0));
  const used = new Set<string>();
  const groups: LetteringCandidate[][] = [];
  for (const debitLine of open.filter((line) => line.debit > 0)) {
    if (used.has(debitLine.id)) continue;
    const match = open.find((line) =>
      !used.has(line.id)
      && line.id !== debitLine.id
      && line.credit > 0
      && line.accountCode === debitLine.accountCode
      && (debitLine.partyKey == null || line.partyKey == null || line.partyKey === debitLine.partyKey)
      && Math.abs(line.credit - debitLine.debit) < 0.02,
    );
    if (!match) continue;
    if (!canLetterLines([
      { accountCode: debitLine.accountCode, debit: debitLine.debit, credit: debitLine.credit },
      { accountCode: match.accountCode, debit: match.debit, credit: match.credit },
    ])) continue;
    used.add(debitLine.id);
    used.add(match.id);
    groups.push([debitLine, match]);
    if (groups.length >= 8) break;
  }
  return groups;
}

export function canLetterLines(lines: Array<{ accountCode: string; debit: number; credit: number }>) {
  if (lines.length < 2) return false;
  const accounts = new Set(lines.map((line) => line.accountCode));
  if (accounts.size !== 1) return false;
  const accountCode = [...accounts][0] ?? "";
  if (!accountCode.startsWith("3421") && !accountCode.startsWith("4411")) return false;
  const debit = roundInvoice2(lines.reduce((sum, line) => sum + Number(line.debit || 0), 0));
  const credit = roundInvoice2(lines.reduce((sum, line) => sum + Number(line.credit || 0), 0));
  return debit === credit && debit > 0;
}
