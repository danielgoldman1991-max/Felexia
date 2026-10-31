import { requireActiveWorkspace } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getEntryWithLinesBySource } from "@/lib/accounting";
import { calculateInvoiceLine } from "@/lib/invoice-calculations";
import { listInvoiceTaxRates, listInvoiceUnits } from "@/lib/invoices";
import { listPurchaseProducts, listPurchaseSuppliers } from "@/lib/purchases";
import { pageRows, readAllPages, searchText } from "@/lib/listing";
import type { InvoiceCustomerOption, InvoiceLineFormValue, InvoiceProductOption } from "@/lib/invoice-types";
import type { SupplierCreditNoteApplicationRecord, SupplierCreditNoteLineRecord, SupplierCreditNoteOpenInvoice, SupplierCreditNoteRecord } from "@/lib/supplier-credit-note-types";

const SELECT = "*,supplier:supplier_id(name),source_invoice:source_invoice_id(invoice_number,supplier_invoice_number)";
const object = (value: unknown): Record<string, unknown> => (Array.isArray(value) ? value[0] : value) as Record<string, unknown> ?? {};
const num = (value: unknown) => Number(value ?? 0);
function mapNote(value: unknown): SupplierCreditNoteRecord {
  const row = object(value); const supplier = object(row.supplier); const source = object(row.source_invoice);
  return {
    ...row, supplier_name: supplier.name ?? null, source_invoice_number: source.supplier_invoice_number ?? source.invoice_number ?? null,
    subtotal_ht: num(row.subtotal_ht), discount_total: num(row.discount_total), tax_total: num(row.tax_total), total_ttc: num(row.total_ttc),
    applied_amount: num(row.applied_amount), available_amount: num(row.available_amount),
  } as SupplierCreditNoteRecord;
}
function mapLine(value: unknown): SupplierCreditNoteLineRecord {
  const row = object(value);
  return {
    ...row, id: String(row.id), organization_id: String(row.organization_id ?? ""), credit_note_id: String(row.credit_note_id ?? ""),
    mode: row.product_id ? "product" : "free", product_id: String(row.product_id ?? ""), product_name: String(row.product_name ?? ""),
    description: String(row.description ?? ""), quantity: num(row.quantity), unit_id: String(row.unit_id ?? ""), unit_name: String(row.unit_name ?? ""),
    unit_price_ht: num(row.unit_price_ht), discount_rate: num(row.discount_rate), tax_rate_id: String(row.tax_rate_id ?? ""), tax_rate: num(row.tax_rate),
    subtotal_ht: num(row.subtotal_ht), discount_amount: num(row.discount_amount), tax_amount: num(row.tax_amount), total_ttc: num(row.total_ttc),
    source_invoice_line_id: row.source_invoice_line_id ? String(row.source_invoice_line_id) : null,
  };
}
export async function listSupplierCreditNoteExportRows(q?: string): Promise<SupplierCreditNoteRecord[]> {
  const workspace = await requireActiveWorkspace(); const db = await createClient();
  const records = await readAllPages((from, to) => db.from("supplier_credit_notes").select(SELECT)
    .eq("organization_id", workspace.organization.id).is("archived_at", null).order("credit_note_date", { ascending: false }).order("id").range(from, to));
  const query = searchText(q);
  return records.map(mapNote).filter(row => !query || searchText([row.credit_note_number, row.supplier_credit_note_number, row.supplier_name, row.source_invoice_number].join(" ")).includes(query));
}
export async function listSupplierCreditNotes(filters: { q?: string; page?: number } = {}) {
  const rows = await listSupplierCreditNoteExportRows(filters.q);
  return pageRows(rows, filters.page ?? 1, 25);
}
export async function getSupplierCreditNoteDetail(id: string) {
  const workspace = await requireActiveWorkspace(); const db = await createClient(); const org = workspace.organization.id;
  const { data: note, error } = await db.from("supplier_credit_notes").select(SELECT).eq("organization_id", org).eq("id", id).is("archived_at", null).maybeSingle();
  if (error) throw new Error("Impossible de charger l’avoir fournisseur. Réessayez dans quelques instants.");
  if (!note) return { creditNote: null, lines: [] as SupplierCreditNoteLineRecord[], applications: [] as SupplierCreditNoteApplicationRecord[], openInvoices: [] as SupplierCreditNoteOpenInvoice[], accountingEntry: null };
  const creditNote = mapNote(note);
  const [rawLines, rawApplications, rawInvoices, accountingEntry] = await Promise.all([
    readAllPages((from, to) => db.from("supplier_credit_note_lines").select("*").eq("organization_id", org).eq("credit_note_id", id).order("line_order").order("id").range(from, to)),
    readAllPages((from, to) => db.from("supplier_credit_note_applications").select("*,invoice:invoice_id(invoice_number,supplier_invoice_number)").eq("organization_id", org).eq("credit_note_id", id).order("created_at").order("id").range(from, to)),
    readAllPages((from, to) => db.from("supplier_invoices").select("id,invoice_number,supplier_invoice_number,invoice_date,total_ttc,remaining_amount").eq("organization_id", org).eq("supplier_id", creditNote.supplier_id).is("archived_at", null).in("status", ["validated", "partially_paid"]).eq("currency", creditNote.currency).gt("remaining_amount", 0).order("invoice_date").order("id").range(from, to)),
    getEntryWithLinesBySource(org, "supplier_credit_note", id),
  ]);
  const applications = rawApplications.map(value => {
    const row = object(value); const invoice = object(row.invoice);
    return { ...row, amount: num(row.amount), invoice_number: invoice.supplier_invoice_number ?? invoice.invoice_number ?? null } as SupplierCreditNoteApplicationRecord;
  });
  const openInvoices = rawInvoices.map(value => {
    const row = object(value); return { ...row, remaining_amount: num(row.remaining_amount), total_ttc: num(row.total_ttc) } as SupplierCreditNoteOpenInvoice;
  });
  const entry = accountingEntry?.entry;
  const mappedAccountingEntry = entry ? { entry: { ...entry, id: String(entry.id), entry_number: String(entry.entry_number), status: String(entry.status) }, lines: accountingEntry.lines } : null;
  return { creditNote, lines: rawLines.map(mapLine), applications, openInvoices, accountingEntry: mappedAccountingEntry };
}
export async function getSupplierCreditNoteFormData(options: { sourceInvoiceId?: string; creditNoteId?: string } = {}) {
  const workspace = await requireActiveWorkspace(); const db = await createClient(); const org = workspace.organization.id;
  const [suppliers, purchaseProducts, units, taxRates] = await Promise.all([listPurchaseSuppliers(), listPurchaseProducts(), listInvoiceUnits(), listInvoiceTaxRates()]);
  const products: InvoiceProductOption[] = purchaseProducts.map(product => ({ ...product, type: product.type === "service" ? "service" : "product", sale_price_ht: product.purchase_price_ht }));
  if (options.creditNoteId) {
    const detail = await getSupplierCreditNoteDetail(options.creditNoteId);
    return { suppliers: suppliers as InvoiceCustomerOption[], products, units, taxRates, creditNote: detail.creditNote ?? undefined, initialSupplierId: detail.creditNote?.supplier_id ?? "", sourceInvoiceId: detail.creditNote?.source_invoice_id ?? "", initialLines: detail.lines as InvoiceLineFormValue[] };
  }
  let initialSupplierId = ""; let sourceInvoiceId = ""; let initialLines: InvoiceLineFormValue[] = [];
  if (options.sourceInvoiceId) {
    const { data: invoice, error } = await db.from("supplier_invoices").select("id,supplier_id,status,currency").eq("organization_id", org).eq("id", options.sourceInvoiceId).is("archived_at", null).maybeSingle();
    if (error) throw new Error("Impossible de charger la facture source.");
    if (invoice && invoice.status !== "draft" && invoice.status !== "cancelled" && invoice.currency === "MAD") {
      initialSupplierId = invoice.supplier_id; sourceInvoiceId = invoice.id;
      const lines = await readAllPages((from, to) => db.from("supplier_invoice_lines").select("*").eq("organization_id", org).eq("invoice_id", invoice.id).order("line_order").order("id").range(from, to));
      initialLines = lines.map(value => {
        const row = object(value); return { ...calculateInvoiceLine(mapLine(row)), source_invoice_line_id: String(row.id) };
      });
    }
  }
  return { suppliers: suppliers as InvoiceCustomerOption[], products, units, taxRates, creditNote: undefined, initialSupplierId, sourceInvoiceId, initialLines };
}
