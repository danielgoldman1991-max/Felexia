import { notFound } from "next/navigation";
import { ModulePage } from "@/components/erp/module-page";
import { PageHeader } from "@/components/erp/page-header";
import { CustomerPaymentForm } from "@/components/payments/customer-payment-form";
import { createPaymentAndAllocateToInvoice } from "@/lib/payment-actions";
import { getCustomerInvoiceDetail } from "@/lib/invoices";
import { getCustomerOpenItems, listPaymentCustomers } from "@/lib/payments";
import { getDefaultTreasuryAccountId, listActiveTreasuryAccounts } from "@/lib/treasury";

export const dynamic = "force-dynamic";

export default async function CreatePaymentFromInvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await getDefaultTreasuryAccountId();
  const [{ invoice }, customers, treasuryAccounts] = await Promise.all([getCustomerInvoiceDetail(id), listPaymentCustomers(), listActiveTreasuryAccounts()]);
  if (!invoice || invoice.status === "cancelled" || invoice.remaining_amount <= 0) notFound();
  const initialOpenItems = await getCustomerOpenItems(invoice.customer_id);
  return (
    <ModulePage>
      <PageHeader title="Enregistrer paiement" description={invoice.invoice_number} />
      <CustomerPaymentForm
        action={createPaymentAndAllocateToInvoice}
        customers={customers}
        treasuryAccounts={treasuryAccounts}
        initialOpenItems={initialOpenItems}
        initialCustomerId={invoice.customer_id}
        initialInvoiceId={invoice.id}
        initialAmount={invoice.remaining_amount}
        cancelHref={`/facturation/factures/${invoice.id}`}
      />
    </ModulePage>
  );
}
