import Link from "next/link";
import { Archive, CheckCircle2, Package, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ModulePage } from "@/components/erp/module-page";
import { PageHeader } from "@/components/erp/page-header";
import { StatCard } from "@/components/erp/stat-card";
import { PurchaseDocumentsTable } from "@/components/purchases/purchase-documents-table";
import { listPurchaseDocuments, getPurchaseCounters } from "@/lib/purchases";

export const dynamic = "force-dynamic";

export default async function SupplierReceiptsPage() {
  const [{ rows }, counters] = await Promise.all([
    listPurchaseDocuments("supplier_receipt"),
    getPurchaseCounters(),
  ]);

  const validatedCount = rows.filter((r) => r.status === "validated").length;
  const stockUpdatedCount = rows.filter((r) => r.stock_updated_at).length;

  return (
    <ModulePage>
      <PageHeader
        title="Réceptions fournisseurs"
        description="Suivez les bons de réception, l'impact stock et la facturation associée."
        actions={<Link href="/achats/receptions/new"><Button><Truck className="h-4 w-4" /> Nouvelle réception</Button></Link>}
      />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard title="Brouillons" value={counters.draftReceipts} icon={<Package className="h-4 w-4" />} />
        <StatCard title="Validés" value={validatedCount} icon={<CheckCircle2 className="h-4 w-4" />} />
        <StatCard title="Stock mis à jour" value={stockUpdatedCount} icon={<Package className="h-4 w-4" />} />
        <StatCard title="Archivés" value={rows.length - counters.draftReceipts - validatedCount} icon={<Archive className="h-4 w-4" />} />
      </div>

      <Card><CardContent className="pt-6"><PurchaseDocumentsTable rows={rows} type="supplier_receipt" /></CardContent></Card>
    </ModulePage>
  );
}
