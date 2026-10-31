import { notFound } from "next/navigation";
import { ModulePage } from "@/components/erp/module-page";
import { CustomerPaymentDetail } from "@/components/payments/customer-payment-detail";
import { getCustomerPaymentDetail } from "@/lib/payments";
import { getEntryWithLinesBySource } from "@/lib/accounting";
import { getActiveWorkspace } from "@/lib/auth";
import { hasFullErpAccess } from "@/lib/launch-access";
import { isOperatorRole } from "@/lib/auth/operator-access";
import { isAdminRole, isReadOnlyRole } from "@/lib/auth/roles";
import { canWriteWorkspaceSubscription } from "@/lib/subscriptions/subscription-access";

export const dynamic = "force-dynamic";

export default async function CustomerPaymentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { payment, allocations } = await getCustomerPaymentDetail(id);
  if (!payment) notFound();

  const workspace = await getActiveWorkspace();
  const canWrite = Boolean(workspace && !isReadOnlyRole(workspace.role) && canWriteWorkspaceSubscription(workspace.subscription));
  const orgId = workspace?.organization.id;
  const fullAccess = orgId && !isOperatorRole(workspace?.role) ? await hasFullErpAccess(orgId) : false;
  const accountingEntry = orgId ? await getEntryWithLinesBySource(orgId, "customer_payment", id) : null;

  return <ModulePage><CustomerPaymentDetail fullAccess={fullAccess} canWrite={canWrite} canPostAccounting={canWrite && isAdminRole(workspace?.role)} payment={payment} allocations={allocations} accountingEntry={accountingEntry} /></ModulePage>;
}
