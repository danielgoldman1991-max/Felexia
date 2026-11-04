import { ModulePage } from "@/components/erp/module-page";
import { PageHeader } from "@/components/erp/page-header";
import { MoneyDisplay } from "@/components/erp/money-display";
import { requireActiveWorkspace } from "@/lib/auth";
import { compareVatToLedger } from "@/lib/accounting/vat-control";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function VatControlPage() {
  const workspace = await requireActiveWorkspace();
  const supabase = await createClient();
  const orgId = workspace.organization.id;
  const [customers, credits, suppliers, lines] = await Promise.all([
    supabase.from("customer_invoices").select("tax_total, status").eq("organization_id", orgId).is("archived_at", null).in("status", ["validated", "sent", "partially_paid", "paid", "overdue"]).limit(2000),
    supabase.from("customer_credit_notes").select("tax_total, status").eq("organization_id", orgId).in("status", ["validated", "applied", "partially_applied"]).limit(2000),
    supabase.from("supplier_invoices").select("tax_total, status").eq("organization_id", orgId).is("archived_at", null).in("status", ["validated", "partially_paid", "paid"]).limit(2000),
    supabase.from("accounting_entry_lines").select("account_code, debit, credit").eq("organization_id", orgId).or("account_code.like.4455%,account_code.like.3455%").limit(5000),
  ]);
  const sum = (rows: Array<{ tax_total?: number | null }> | null) => (rows ?? []).reduce((total, row) => total + Number(row.tax_total ?? 0), 0);
  let collectedLedger = 0;
  let deductibleLedger = 0;
  for (const line of lines.data ?? []) {
    const code = String(line.account_code ?? "");
    const net = Number(line.debit ?? 0) - Number(line.credit ?? 0);
    if (code.startsWith("4455")) collectedLedger += -net;
    if (code.startsWith("3455")) deductibleLedger += net;
  }
  const checks = compareVatToLedger({
    invoiceCollected: sum(customers.data) - sum(credits.error ? [] : credits.data),
    ledgerCollected: collectedLedger,
    invoiceDeductible: sum(suppliers.data),
    ledgerDeductible: deductibleLedger,
  });
  return (
    <ModulePage>
      <PageHeader title="Contrôle TVA" description="Compare la TVA des factures validées au solde des comptes 4455 (collectée) et 3455 (récupérable)." />
      <ul className="grid gap-4 md:grid-cols-2">
        {checks.map((check) => (
          <li key={check.label} className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--card)] p-4">
            <p className="font-semibold">{check.label}</p>
            <p className="mt-2 text-sm">Factures <MoneyDisplay value={check.invoice} /> · Comptes <MoneyDisplay value={check.ledger} /></p>
            <p className={`mt-2 text-sm font-medium ${check.ok ? "text-[var(--success)]" : "text-[var(--danger)]"}`}>{check.ok ? "Écart nul." : `Écart ${check.gap.toFixed(2)} MAD.`}</p>
          </li>
        ))}
      </ul>
    </ModulePage>
  );
}
