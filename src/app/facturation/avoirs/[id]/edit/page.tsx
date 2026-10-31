import { notFound } from "next/navigation";
import { ModulePage } from "@/components/erp/module-page";
import { PageHeader } from "@/components/erp/page-header";
import { EmptyState } from "@/components/erp/empty-state";
import { CustomerCreditNoteForm } from "@/components/credit-notes/customer-credit-note-form";
import { getCustomerCreditNoteDetail } from "@/lib/credit-notes";
import { updateCustomerCreditNote } from "@/lib/credit-note-actions";
import { listInvoiceCustomers, listInvoiceProducts, listInvoiceTaxRates, listInvoiceUnits } from "@/lib/invoices";
import type { InvoiceLineFormValue } from "@/lib/invoice-types";

export const dynamic = "force-dynamic";

export default async function EditCreditNotePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { creditNote, lines } = await getCustomerCreditNoteDetail(id);
  if (!creditNote) notFound();
  if (creditNote.status !== "draft") return <ModulePage><PageHeader title="Modifier l’avoir" description={creditNote.credit_note_number} /><EmptyState title="Cet avoir est validé" description="Les lignes d’un avoir validé sont conservées. Corrigez ses affectations ou créez un document de correction." /></ModulePage>;
  const [customers, products, units, taxRates] = await Promise.all([listInvoiceCustomers(),listInvoiceProducts(),listInvoiceUnits(),listInvoiceTaxRates()]);
  const initialLines: InvoiceLineFormValue[] = lines.map((line) => ({...line,mode:line.product_id ? "product" : "free",product_id:line.product_id || "",product_name:line.product_name || "",unit_id:line.unit_id || "",unit_name:line.unit_name || "",tax_rate_id:line.tax_rate_id || "",source_line_id:line.source_invoice_line_id || undefined}));
  return <ModulePage><PageHeader title="Modifier l’avoir" description={`${creditNote.credit_note_number} · Son numéro est conservé.`} /><CustomerCreditNoteForm action={updateCustomerCreditNote} creditNote={creditNote} customers={customers} products={products} units={units} taxRates={taxRates} initialCustomerId={creditNote.customer_id} sourceInvoiceId={creditNote.source_invoice_id || ""} sourceReturnId={creditNote.source_return_id || ""} sourceType={creditNote.source_type} defaultReason={creditNote.reason || ""} initialLines={initialLines} /></ModulePage>;
}
