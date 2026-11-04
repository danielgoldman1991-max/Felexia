import Link from "next/link";
import { ModulePage } from "@/components/erp/module-page";
import { PageHeader } from "@/components/erp/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, Td, Th } from "@/components/ui/table";
import { requireActiveWorkspace } from "@/lib/auth";
import { loadVatDeductionInvoices } from "@/lib/tax/vat-deduction-query";
import { DEDUCTION_HEADERS, deductionPeriod, deductionTable } from "@/lib/tax/vat-deduction-report";

export const dynamic = "force-dynamic";

export default async function VatDeductionsPage({ searchParams }: { searchParams?: Promise<{ from?: string; to?: string }> }) {
  const query = await searchParams;
  const from = query?.from ?? "";
  const to = query?.to ?? "";
  const period = deductionPeriod(from, to);
  const params = new URLSearchParams({ from, to });
  let preview: { rows: string[][]; error?: string } | null = null;
  if (period.ok) {
    try {
      const workspace = await requireActiveWorkspace({ modules: ["tva", "comptabilite"], level: "read" });
      const invoices = await loadVatDeductionInvoices(workspace.organization.id, period.from, period.to);
      preview = { rows: deductionTable(invoices).slice(1) };
    } catch (error) {
      const digest = error && typeof error === "object" ? (error as { digest?: string }).digest : undefined;
      if (typeof digest === "string" && digest.startsWith("NEXT_REDIRECT")) throw error;
      preview = { rows: [], error: error instanceof Error ? error.message : "Le relevé n'a pas pu être préparé." };
    }
  }
  return (
    <ModulePage>
      <PageHeader
        title="Relevé des déductions"
        description="Factures fournisseurs de la période : fournisseur, IF, ICE, numéro, date, HT, TVA, date et mode de paiement. Fichier préparatoire, sans dépôt DGI."
      />
      <form method="get" className="flex max-w-3xl flex-wrap items-end gap-3 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--card)] p-4">
        <label className="text-sm">Du<Input className="mt-1" type="date" name="from" defaultValue={from} required /></label>
        <label className="text-sm">Au<Input className="mt-1" type="date" name="to" defaultValue={to} required /></label>
        <Button type="submit">Préparer</Button>
        {period.ok ? <Button variant="secondary" asChild><Link href={`/comptabilite/tva/deductions/export?${params}&format=csv`}>CSV</Link></Button> : null}
        {period.ok ? <Button variant="secondary" asChild><Link href={`/comptabilite/tva/deductions/export?${params}&format=xlsx`}>Excel</Link></Button> : null}
      </form>
      {preview?.error ? <p className="mt-4 text-sm text-red-700">{preview.error}</p> : null}
      {preview && !preview.error ? (
        <div className="mt-4">
          {preview.rows.length === 0 ? <p className="text-sm text-[var(--muted)]">Aucune facture fournisseur sur cette période.</p> : (
            <Table>
              <thead><tr>{DEDUCTION_HEADERS.map((heading) => <Th key={heading}>{heading}</Th>)}</tr></thead>
              <tbody>
                {preview.rows.map((row) => (
                  <tr key={`${row[3]}-${row[4]}-${row[0]}`}>
                    {row.map((cell, index) => <Td key={`${row[3]}-${index}`}>{cell || "—"}</Td>)}
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </div>
      ) : null}
    </ModulePage>
  );
}
