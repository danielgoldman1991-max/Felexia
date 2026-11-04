import { ModulePage } from "@/components/erp/module-page";
import { PageHeader } from "@/components/erp/page-header";
import { MoneyDisplay } from "@/components/erp/money-display";
import { Table, Td, Th } from "@/components/ui/table";
import { requireActiveWorkspace } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { daysSalesOutstanding } from "@/lib/sales/collection";
import { summarizeAging, type AgingBucket } from "@/lib/sales/aged-receivables";

export const dynamic = "force-dynamic";

const labels: Record<AgingBucket, string> = {
  not_due: "Non échu",
  "1_30": "0 à 30 jours",
  "31_60": "31 à 60 jours",
  "61_90": "61 à 90 jours",
  over_90: "Plus de 90 jours",
  no_due: "Sans échéance",
};

export default async function AgedReceivablesPage() {
  const workspace = await requireActiveWorkspace();
  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);
  const { data } = await supabase
    .from("customer_invoices")
    .select("id, invoice_number, customer_name, due_date, remaining_amount, status")
    .eq("organization_id", workspace.organization.id)
    .gt("remaining_amount", 0)
    .not("status", "in", "(draft,cancelled)");
  const summary = summarizeAging((data ?? []).map((row) => ({
    id: row.id as string,
    number: row.invoice_number as string,
    customer: (row.customer_name as string | null) ?? "Client",
    dueDate: (row.due_date as string | null) ?? null,
    remaining: Number(row.remaining_amount ?? 0),
  })), today);
  const [year, month, day] = today.split("-").map(Number);
  const periodStart = new Date(Date.UTC(year, month - 1, day) - 90 * 86_400_000).toISOString().slice(0, 10);
  const sales = await supabase.from("customer_invoices").select("total_ttc").eq("organization_id", workspace.organization.id).gte("invoice_date", periodStart).not("status", "in", "(draft,cancelled)").is("archived_at", null);
  const periodSales = (sales.data ?? []).reduce((sum, row) => sum + Number(row.total_ttc ?? 0), 0);
  const dso = daysSalesOutstanding(summary.total, periodSales, 90);
  const overdue = summary.total - summary.totals.not_due - summary.totals.no_due;

  return (
    <ModulePage>
      <PageHeader title="Balance âgée clients" description="Créances ouvertes par ancienneté d'échéance, en MAD. Le DSO est un indicateur de gestion sur 90 jours, pas un ratio certifié." />
      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--card)] p-3"><p className="text-xs text-[var(--muted)]">Encours</p><p className="mt-1 font-semibold"><MoneyDisplay value={summary.total} /></p></div>
        <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--card)] p-3"><p className="text-xs text-[var(--muted)]">Retard</p><p className="mt-1 font-semibold"><MoneyDisplay value={overdue} /></p></div>
        <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--card)] p-3"><p className="text-xs text-[var(--muted)]">DSO 90 jours</p><p className="mt-1 font-semibold">{dso === null ? "—" : `${dso} j`}</p></div>
      </div>
      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {(Object.keys(labels) as AgingBucket[]).map((bucket) => (
          <div key={bucket} className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--card)] p-3">
            <p className="text-xs text-[var(--muted)]">{labels[bucket]}</p>
            <p className="mt-1 font-semibold tabular-nums"><MoneyDisplay value={summary.totals[bucket]} /></p>
          </div>
        ))}
      </div>
      <div className="mt-4 overflow-x-auto">
        <Table>
          <thead><tr><Th>Facture</Th><Th>Client</Th><Th>Échéance</Th><Th>Ancienneté</Th><Th className="text-right">Reste</Th></tr></thead>
          <tbody>
            {summary.rows.length === 0 ? <tr><Td colSpan={5}>Aucune créance ouverte.</Td></tr> : summary.rows.map((row) => (
              <tr key={row.id}><Td>{row.number}</Td><Td>{row.customer}</Td><Td>{row.dueDate ?? "—"}</Td><Td>{labels[row.bucket]}</Td><Td className="text-right"><MoneyDisplay value={row.remaining} /></Td></tr>
            ))}
          </tbody>
        </Table>
      </div>
    </ModulePage>
  );
}
