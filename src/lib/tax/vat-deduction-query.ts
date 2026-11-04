import type { SupabaseClient } from "@supabase/supabase-js";
import { countedPayment, linkAllocationPayments, type AllocationPaymentLink, type DeductionInvoice, type DeductionPayment } from "@/lib/tax/vat-deduction-report";
import { createClient } from "@/lib/supabase/server";

type PaymentRow = { id?: string | null; payment_date?: string | null; payment_method?: string | null; status?: string | null; reference?: string | null };
type AllocationRow = { invoice_id?: string | null; payment_id?: string | null; amount?: number | null; allocation_date?: string | null };

/** Two reads. The live schema has payment_id and invoice_id without a foreign key, so an embed on payment_id is rejected. */
export async function loadSupplierAllocationPayments(supabase: SupabaseClient, organizationId: string, invoiceIds: string[]): Promise<AllocationPaymentLink[]> {
  if (invoiceIds.length === 0) return [];
  const allocations = await supabase
    .from("supplier_payment_allocations")
    .select("invoice_id, payment_id, amount, allocation_date")
    .eq("organization_id", organizationId)
    .in("invoice_id", invoiceIds)
    .is("cancelled_at", null);
  if (allocations.error) throw new Error(allocations.error.message);
  const rows = (allocations.data ?? []) as AllocationRow[];
  const paymentIds = [...new Set(rows.map((row) => row.payment_id).filter((id): id is string => Boolean(id)))];
  const payments = paymentIds.length
    ? await supabase.from("supplier_payments").select("id, payment_date, payment_method, status, reference").eq("organization_id", organizationId).in("id", paymentIds)
    : { data: [] as PaymentRow[], error: null };
  if (payments.error) throw new Error(payments.error.message);
  return linkAllocationPayments(rows, (payments.data ?? []) as PaymentRow[]);
}

export async function loadVatDeductionInvoices(organizationId: string, from: string, to: string): Promise<DeductionInvoice[]> {
  const supabase = await createClient();
  const invoices = await supabase
    .from("supplier_invoices")
    .select("id, invoice_number, supplier_invoice_number, invoice_date, subtotal_ht, tax_total, supplier:supplier_id(name, ice, if_number)")
    .eq("organization_id", organizationId)
    .is("archived_at", null)
    .gte("invoice_date", from)
    .lte("invoice_date", to)
    .not("status", "in", "(draft,cancelled)")
    .order("invoice_date", { ascending: true })
    .limit(2000);
  if (invoices.error) throw new Error(invoices.error.message);
  const ids = (invoices.data ?? []).map((row) => String(row.id));
  const links = await loadSupplierAllocationPayments(supabase, organizationId, ids);
  const payments = new Map<string, DeductionPayment[]>();
  for (const link of links) {
    if (!countedPayment(link.payment?.status)) continue;
    const list = payments.get(link.invoiceId) ?? [];
    list.push({ date: link.payment?.date ?? null, mode: link.payment?.mode ?? null });
    payments.set(link.invoiceId, list);
  }
  return (invoices.data ?? []).map((row) => {
    const supplier = (Array.isArray(row.supplier) ? row.supplier[0] : row.supplier) as { name?: string | null; ice?: string | null; if_number?: string | null } | null;
    return {
      supplier: supplier?.name || "Fournisseur",
      ifNumber: supplier?.if_number ?? null,
      ice: supplier?.ice ?? null,
      invoiceNumber: String(row.supplier_invoice_number || row.invoice_number || ""),
      invoiceDate: row.invoice_date ? String(row.invoice_date) : null,
      amountHt: Number(row.subtotal_ht ?? 0),
      vatAmount: Number(row.tax_total ?? 0),
      payments: payments.get(String(row.id)) ?? [],
    };
  });
}
