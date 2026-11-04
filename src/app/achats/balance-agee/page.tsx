import Link from "next/link";
import { ModulePage } from "@/components/erp/module-page";
import { ModuleUpgradePage } from "@/components/erp/module-upgrade-page";
import { MoneyDisplay } from "@/components/erp/money-display";
import { PageHeader } from "@/components/erp/page-header";
import { Table, Td, Th } from "@/components/ui/table";
import { requireActiveWorkspace } from "@/lib/auth";
import { hasFullErpAccess } from "@/lib/launch-access";
import { summarizeAging, type AgingBucket } from "@/lib/sales/aged-receivables";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const labels: Record<AgingBucket, string> = {
  not_due: "Non échu",
  "1_30": "1 à 30 jours",
  "31_60": "31 à 60 jours",
  "61_90": "61 à 90 jours",
  over_90: "Plus de 90 jours",
  no_due: "Sans échéance",
};

export default async function SupplierAgingPage() {
  const workspace = await requireActiveWorkspace();
  if (!(await hasFullErpAccess(workspace.organization.id))) return <ModulePage><ModuleUpgradePage /></ModulePage>;
  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);
  const { data } = await supabase
    .from("supplier_invoices")
    .select("id, invoice_number, supplier_id, due_date, remaining_amount, status")
    .eq("organization_id", workspace.organization.id)
    .gt("remaining_amount", 0)
    .not("status", "in", "(draft,cancelled)");
  const supplierIds = [...new Set((data ?? []).map((row) => row.supplier_id).filter(Boolean))] as string[];
  const { data: suppliers } = supplierIds.length
    ? await supabase.from("third_parties").select("id, name").in("id", supplierIds)
    : { data: [] };
  const names = new Map((suppliers ?? []).map((supplier) => [supplier.id as string, supplier.name as string]));
  const summary = summarizeAging((data ?? []).map((row) => ({
    id: row.id as string,
    number: (row.invoice_number as string | null) ?? "Facture",
    customer: names.get(row.supplier_id as string) ?? "Fournisseur",
    dueDate: (row.due_date as string | null) ?? null,
    remaining: Number(row.remaining_amount ?? 0),
  })), today);

  return (
    <ModulePage>
      <PageHeader title="Balance âgée fournisseurs" description="Dettes ouvertes par ancienneté d'échéance, en MAD." />
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
          <thead><tr><Th>Facture</Th><Th>Fournisseur</Th><Th>Échéance</Th><Th>Ancienneté</Th><Th className="text-right">Reste</Th></tr></thead>
          <tbody>
            {summary.rows.length === 0 ? <tr><Td colSpan={5}>Aucune dette ouverte.</Td></tr> : summary.rows.map((row) => (
              <tr key={row.id}>
                <Td><Link className="font-medium text-[var(--primary)]" href={`/achats/factures/${row.id}`}>{row.number}</Link></Td>
                <Td>{row.customer}</Td>
                <Td>{row.dueDate ?? "—"}</Td>
                <Td>{labels[row.bucket]}</Td>
                <Td className="text-right"><MoneyDisplay value={row.remaining} /></Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </div>
    </ModulePage>
  );
}
