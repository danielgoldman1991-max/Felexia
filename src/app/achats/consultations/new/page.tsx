import { ModulePage } from "@/components/erp/module-page";
import { PageHeader } from "@/components/erp/page-header";
import { createPurchaseRfq } from "@/lib/purchases/procurement-actions";
import { PurchaseRfqForm } from "./form";

export default function NewPurchaseRfqPage() {
  return (
    <ModulePage>
      <PageHeader title="Nouvelle consultation" description="Saisissez au moins deux offres. Le classement est calculé à l'enregistrement." />
      <PurchaseRfqForm action={createPurchaseRfq} />
    </ModulePage>
  );
}
