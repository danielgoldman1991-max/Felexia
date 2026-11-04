import Link from "next/link";
import { requireActiveWorkspace } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { letterAccountingLines, unletterAccountingLines } from "@/lib/accounting-actions";
import { ModulePage } from "@/components/erp/module-page";
import { PageHeader } from "@/components/erp/page-header";
import { LetteringForm } from "@/components/accounting/lettering-form";
import { formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";

type LetterLine = {
  id: string;
  account_code: string;
  account_label: string | null;
  debit: number;
  credit: number;
  label: string | null;
  lettering_code: string | null;
  lettering_date: string | null;
};

export default async function LetteringPage({ searchParams }: { searchParams: Promise<{ vue?: string }> }) {
  const { vue } = await searchParams;
  const lettered = vue === "lettrees";
  const workspace = await requireActiveWorkspace();
  const supabase = await createClient();
  const base = supabase
    .from("accounting_entry_lines")
    .select("id, account_code, account_label, debit, credit, label, lettering_code, lettering_date")
    .eq("organization_id", workspace.organization.id)
    .or("account_code.like.3421%,account_code.like.4411%")
    .order("account_code")
    .limit(200);
  const filtered = lettered ? base.not("lettering_code", "is", null) : base.is("lettering_code", null);
  const { data, error } = await filtered;
  const lines = (data ?? []) as LetterLine[];

  return (
    <ModulePage>
      <PageHeader
        title="Lettrage"
        description="Lettres les lignes 3421 Clients et 4411 Fournisseurs dont le débit égale le crédit. Le code et la date restent visibles dans le grand livre et les écritures."
      />
      <div className="mb-4 flex gap-2 text-sm">
        <Link className={`rounded-full px-3 py-1 ${lettered ? "text-[var(--muted)]" : "bg-[var(--primary)] text-white"}`} href="/comptabilite/lettrage">À lettrer</Link>
        <Link className={`rounded-full px-3 py-1 ${lettered ? "bg-[var(--primary)] text-white" : "text-[var(--muted)]"}`} href="/comptabilite/lettrage?vue=lettrees">Lettrées</Link>
      </div>
      {error ? (
        <p className="text-sm text-amber-800">Le lettrage attend les colonnes lettering_code et lettering_date.</p>
      ) : (
        <LetteringForm
          action={lettered ? unletterAccountingLines : letterAccountingLines}
          lines={lines.map((line) => ({ ...line, lettering_date_label: line.lettering_date ? formatDate(line.lettering_date) : null }))}
          mode={lettered ? "lettered" : "open"}
        />
      )}
    </ModulePage>
  );
}
