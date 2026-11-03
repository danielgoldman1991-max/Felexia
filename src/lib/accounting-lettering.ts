import { roundInvoice2 } from "@/lib/invoice-calculations";

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
