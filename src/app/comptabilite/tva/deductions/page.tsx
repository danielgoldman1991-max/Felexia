import Link from "next/link";
import { ModulePage } from "@/components/erp/module-page";
import { PageHeader } from "@/components/erp/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const dynamic = "force-dynamic";

export default async function VatDeductionsPage({ searchParams }: { searchParams?: Promise<{ from?: string; to?: string }> }) {
  const query = await searchParams;
  const from = query?.from ?? "";
  const to = query?.to ?? "";
  const ready = /^\d{4}-\d{2}-\d{2}$/.test(from) && /^\d{4}-\d{2}-\d{2}$/.test(to) && from <= to;
  const params = new URLSearchParams({ from, to });
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
        {ready ? <Button variant="secondary" asChild><Link href={`/comptabilite/tva/deductions/export?${params}&format=csv`}>CSV</Link></Button> : null}
        {ready ? <Button variant="secondary" asChild><Link href={`/comptabilite/tva/deductions/export?${params}&format=xlsx`}>Excel</Link></Button> : null}
      </form>
    </ModulePage>
  );
}
