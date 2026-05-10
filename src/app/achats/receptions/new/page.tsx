import { redirect } from "next/navigation";
import { ModulePage } from "@/components/erp/module-page";
import { SupplierReceiptForm } from "@/components/purchases/supplier-receipt-form";
import { listReceivableSupplierOrders, getSupplierReceiptPreparation } from "@/lib/purchases";

export const dynamic = "force-dynamic";

export default async function NewSupplierReceiptPage({ searchParams }: { searchParams: Promise<{ orderId?: string }> }) {
  const { orderId } = await searchParams;

  if (orderId) {
    const order = await getSupplierReceiptPreparation(orderId);
    if (!order) return <ModulePage><p className="text-sm text-red-600">Commande non trouvee ou deja entierement recue.</p></ModulePage>;
    return <ModulePage><SupplierReceiptForm order={order} /></ModulePage>;
  }

  const orders = await listReceivableSupplierOrders();
  if (orders.length === 0) {
    return (
      <ModulePage>
        <p className="text-sm text-[var(--muted)]">Aucune commande fournisseur en attente de reception.</p>
      </ModulePage>
    );
  }

  if (orders.length === 1) {
    redirect(`/achats/receptions/new?orderId=${orders[0].id}`);
  }

  return (
    <ModulePage>
      <h1 className="text-xl font-semibold mb-4">Selectionner une commande a receptionner</h1>
      <div className="space-y-2">
        {orders.map((o) => (
          <a key={o.id} href={`/achats/receptions/new?orderId=${o.id}`} className="block rounded-lg border border-border p-4 hover:bg-accent transition">
            <p className="font-medium">{o.document_number}</p>
            <p className="text-sm text-[var(--muted)]">{o.supplier_name} - {o.lines.length} lignes</p>
          </a>
        ))}
      </div>
    </ModulePage>
  );
}
