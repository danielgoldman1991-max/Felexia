import { getAccountByNumber, getJournalByCode, getOrCreateAccountId } from "@/lib/accounting";
import { financialErrorMessage } from "@/lib/financial-errors";
import { createClient } from "@/lib/supabase/server";

type SlipAmounts = {
  id: string;
  payslipNumber: string;
  employeeName: string;
  gross: number;
  employerCost: number;
  cnssEmployee: number;
  cnssEmployer: number;
  amoEmployee: number;
  amoEmployer: number;
  ir: number;
  advances: number;
  loans: number;
  netToPay: number;
  date: string;
};

function round2(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/** Écriture de paie à l'encaissement : charges, organismes, net dû, puis règlement banque. */
export async function postPayrollPaymentEntry(organizationId: string, slip: SlipAmounts) {
  const supabase = await createClient();
  const existing = await supabase
    .from("accounting_entries")
    .select("id, entry_number")
    .eq("organization_id", organizationId)
    .eq("reference", slip.payslipNumber)
    .eq("source_module", "hr")
    .neq("status", "cancelled")
    .maybeSingle();
  if (existing.data?.id) return { success: true as const, entryNumber: String(existing.data.entry_number ?? "") };
  const journal = await getJournalByCode(organizationId, "OD") ?? await getJournalByCode(organizationId, "PA");
  if (!journal) return { success: false as const, error: "Le journal des opérations diverses est introuvable." };
  const employerCharges = round2(Math.max(0, slip.employerCost - slip.gross));
  const training = round2(Math.max(0, employerCharges - slip.cnssEmployer - slip.amoEmployer));
  const social = round2(slip.cnssEmployee + slip.cnssEmployer + slip.amoEmployee + slip.amoEmployer + training);
  const net = round2(slip.netToPay);
  const advances = round2(slip.advances + slip.loans);
  const [charge, socialCharge, cnss, irAccount, due, advanceAccount, bank] = await Promise.all([
    getOrCreateAccountId(organizationId, "6171"),
    getOrCreateAccountId(organizationId, "6174"),
    getOrCreateAccountId(organizationId, "4441"),
    getAccountByNumber(organizationId, "4457").then((row) => row?.id ?? getOrCreateAccountId(organizationId, "4452")),
    getOrCreateAccountId(organizationId, "4432"),
    getOrCreateAccountId(organizationId, "3431"),
    getOrCreateAccountId(organizationId, "5141"),
  ]);
  const lines = [
    { account_id: charge, debit: round2(slip.gross), credit: 0, label: `Salaires ${slip.payslipNumber}` },
    { account_id: socialCharge, debit: employerCharges, credit: 0, label: `Charges sociales ${slip.payslipNumber}` },
    { account_id: cnss, debit: 0, credit: social, label: `CNSS et AMO ${slip.employeeName}` },
    { account_id: irAccount, debit: 0, credit: round2(slip.ir), label: `IR salaire ${slip.employeeName}` },
    { account_id: due, debit: 0, credit: net, label: `Rémunération due ${slip.employeeName}` },
    { account_id: due, debit: net, credit: 0, label: `Règlement salaire ${slip.payslipNumber}` },
    { account_id: bank, debit: 0, credit: net, label: `Paiement salaire ${slip.payslipNumber}` },
  ];
  if (advances > 0.009) lines.splice(5, 0, { account_id: advanceAccount, debit: 0, credit: advances, label: `Avances et prêts ${slip.employeeName}` });
  const kept = lines.filter((line) => line.debit > 0.009 || line.credit > 0.009);
  const debit = round2(kept.reduce((sum, line) => sum + line.debit, 0));
  const credit = round2(kept.reduce((sum, line) => sum + line.credit, 0));
  if (Math.abs(debit - credit) > 0.05) {
    return { success: false as const, error: "L'écriture de paie n'est pas équilibrée. Vérifiez le brut, les cotisations et le net." };
  }
  const saved = await supabase.rpc("save_accounting_entry_atomic", {
    p_organization_id: organizationId,
    p_entry_id: null,
    p_header: {
      journal_id: journal.id,
      entry_date: slip.date,
      label: `Paie ${slip.payslipNumber} · ${slip.employeeName}`,
      reference: slip.payslipNumber,
      status: "posted",
      source_module: "hr",
      notes: `hr_payslip:${slip.id}`,
    },
    p_lines: kept,
  });
  if (saved.error) return { success: false as const, error: financialErrorMessage(saved.error) };
  return { success: true as const, entryNumber: "" };
}
