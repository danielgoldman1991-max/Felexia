import Link from "next/link";
import { ModulePage } from "@/components/erp/module-page";
import { PageHeader } from "@/components/erp/page-header";
import { SupplierInvoiceScanImporter } from "@/components/purchases/supplier-invoice-scan";
import { requireActiveWorkspace } from "@/lib/auth";
import { listPurchaseSuppliers } from "@/lib/purchases";
import { ocrIsConfigured } from "@/lib/purchases/supplier-invoice-ocr-provider";

export const dynamic = "force-dynamic";

export default async function ImportSupplierInvoicePage() {
  const workspace = await requireActiveWorkspace({ module: "achats", level: "write" });
  const suppliers = await listPurchaseSuppliers();
  return (
    <ModulePage>
      <PageHeader title="Importer une facture fournisseur" description="L’analyse préremplit un brouillon. Vous corrigez, puis vous enregistrez. Aucune écriture comptable n’est passée." />
      <SupplierInvoiceScanImporter configured={ocrIsConfigured()} organizationId={workspace.organization.id} suppliers={suppliers.map((supplier) => ({ id: supplier.id, name: supplier.name, ice: supplier.ice }))} />
      <Link href="/achats/factures" className="text-sm font-medium text-[var(--primary)] hover:underline">Retour aux factures</Link>
    </ModulePage>
  );
}
