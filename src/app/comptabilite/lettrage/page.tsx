import { requireActiveWorkspace } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { letterAccountingLines } from "@/lib/accounting-actions";
import { ModulePage } from "@/components/erp/module-page";
import { PageHeader } from "@/components/erp/page-header";
import { LetteringForm } from "@/components/accounting/lettering-form";

export const dynamic = "force-dynamic";

export default async function LetteringPage() {
  const workspace = await requireActiveWorkspace();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("accounting_entry_lines")
    .select("id, account_code, account_label, debit, credit, label, lettering_code")
    .eq("organization_id", workspace.organization.id)
    .or("account_code.like.3421%,account_code.like.4411%")
    .is("lettering_code", null)
    .order("account_code")
    .limit(200);

  return (
    <ModulePage>
      <PageHeader
        title="Lettrage"
        description="Lettres les lignes 3421 Clients et 4411 Fournisseurs dont le débit égale le crédit."
      />
      {error ? (
        <p className="text-sm text-amber-800">Le lettrage attend la colonne lettering_code. Appliquez la migration 112 avant d’utiliser cet écran.</p>
      ) : (
        <LetteringForm action={letterAccountingLines} lines={data ?? []} />
      )}
    </ModulePage>
  );
}
