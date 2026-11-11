import Link from "next/link";
import { ModulePage } from "@/components/erp/module-page";
import { PageHeader } from "@/components/erp/page-header";
import { SupplierInvoiceScanImporter } from "@/components/purchases/supplier-invoice-scan";
import { requireActiveWorkspace } from "@/lib/auth";
import { listPurchaseSuppliers } from "@/lib/purchases";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function ImportSupplierInvoicePage() {
  const workspace = await requireActiveWorkspace({ module: "achats", level: "write" });
  const supabase = await createClient();
  const [{ data: company }, suppliers] = await Promise.all([
    supabase.from("company_settings").select("ice").eq("organization_id", workspace.organization.id).maybeSingle(),
    listPurchaseSuppliers(),
  ]);
  return (
    <ModulePage>
      <PageHeader title="Importer une facture fournisseur" description="L’analyse préremplit un brouillon dans votre navigateur. Vous corrigez, puis vous enregistrez. Aucune écriture comptable n’est passée." />
      <SupplierInvoiceScanImporter organizationId={workspace.organization.id} buyerIce={company?.ice ?? ""} suppliers={suppliers.map((supplier) => ({ id: supplier.id, name: supplier.name, ice: supplier.ice }))} />
      <Link href="/achats/factures" className="text-sm font-medium text-[var(--primary)] hover:underline">Retour aux factures</Link>
    </ModulePage>
  );
}
