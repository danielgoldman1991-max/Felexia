import { notFound } from "next/navigation";
import { ModulePage } from "@/components/erp/module-page";
import { SupplierPaymentDetail } from "@/components/purchases/supplier-payment-detail";
import { getSupplierPaymentDetail } from "@/lib/purchases";
import { getEntryWithLinesBySource } from "@/lib/accounting";
import { getActiveWorkspace } from "@/lib/auth";
import { hasFullErpAccess } from "@/lib/launch-access";
import { isOperatorRole } from "@/lib/auth/operator-access";
import { isReadOnlyRole } from "@/lib/auth/roles";

export const dynamic = "force-dynamic";

export default async function SupplierPaymentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { payment, allocations } = await getSupplierPaymentDetail(id);
  if (!payment) notFound();

  const workspace = await getActiveWorkspace();
  const orgId = workspace?.organization.id;
  const fullAccess = orgId && !isOperatorRole(workspace?.role) ? await hasFullErpAccess(orgId) : false;
  const accountingEntry = orgId ? await getEntryWithLinesBySource(orgId, "supplier_payment", id) : null;

  return (
    <ModulePage>
      <SupplierPaymentDetail fullAccess={fullAccess} canPostAccounting={!isOperatorRole(workspace?.role) && !isReadOnlyRole(workspace?.role)} payment={payment} allocations={allocations} accountingEntry={accountingEntry} />
    </ModulePage>
  );
}
