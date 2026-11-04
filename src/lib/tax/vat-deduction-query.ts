import { createClient } from "@/lib/supabase/server";
import { countedPayment, type DeductionInvoice, type DeductionPayment } from "@/lib/tax/vat-deduction-report";

type PaymentRow = { payment_date?: string | null; payment_method?: string | null; status?: string | null };

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
  const allocations = ids.length
    ? await supabase.from("supplier_payment_allocations").select("invoice_id, payment:payment_id(payment_date, payment_method, status)").eq("organization_id", organizationId).in("invoice_id", ids).is("cancelled_at", null)
    : { data: [], error: null };
  if (allocations.error) throw new Error(allocations.error.message);
  const payments = new Map<string, DeductionPayment[]>();
  for (const row of allocations.data ?? []) {
    const payment = (Array.isArray(row.payment) ? row.payment[0] : row.payment) as PaymentRow | null;
    if (!countedPayment(payment?.status)) continue;
    const list = payments.get(String(row.invoice_id)) ?? [];
    list.push({ date: payment?.payment_date ?? null, mode: payment?.payment_method ?? null });
    payments.set(String(row.invoice_id), list);
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
