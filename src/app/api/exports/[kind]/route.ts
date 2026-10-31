import { requireActiveWorkspace } from "@/lib/auth";
import { csvResponse } from "@/lib/listing";
import { listCustomerInvoiceExportRows } from "@/lib/invoices";
import { listSupplierInvoiceExportRows } from "@/lib/purchases";
import { filtersFromSearchParams, listThirdPartyExportRows } from "@/lib/third-parties";
import { listTreasuryConsultationFlows, listTreasuryTransactions } from "@/lib/treasury";
import { getPaymentMethodLabel } from "@/lib/payment-terms";
import { listSupplierCreditNoteExportRows } from "@/lib/supplier-credit-notes";

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ kind: string }> }) {
  await requireActiveWorkspace();
  const { kind } = await params;
  const sp = new URL(request.url).searchParams;
  const filters = { query: sp.get("q") || undefined, status: sp.get("status") || undefined, paymentStatus: sp.get("paymentStatus") || undefined, dateFrom: sp.get("dateFrom") || undefined, dateTo: sp.get("dateTo") || undefined };
  try {
    if (kind === "supplier-credits") {
      const rows = await listSupplierCreditNoteExportRows(sp.get("q") || undefined);
      return csvResponse("avoirs-fournisseurs", ["Numéro", "Référence fournisseur", "Fournisseur", "Facture source", "Date", "Statut", "HT", "TVA", "TTC", "Affecté", "Disponible", "Devise"], rows.map(row => [row.credit_note_number, row.supplier_credit_note_number, row.supplier_name, row.source_invoice_number, row.credit_note_date, row.status, row.subtotal_ht, row.tax_total, row.total_ttc, row.applied_amount, row.available_amount, row.currency]));
    }
    if (kind === "sales") {
      const rows = await listCustomerInvoiceExportRows(filters);
      return csvResponse("factures-clients", ["Numéro", "Client", "Date", "Échéance", "Statut", "Règlement", "HT", "TVA", "TTC", "Réglé", "Avoir", "Reste", "Devise"], rows.map((r) => [r.invoice_number, r.customer_name, r.invoice_date, r.due_date, r.status, r.payment_status, r.subtotal_ht, r.tax_total, r.total_ttc, r.paid_amount, r.credit_amount, r.remaining_amount, r.currency]));
    }
    if (kind === "purchases") {
      const rows = await listSupplierInvoiceExportRows(filters);
      return csvResponse("factures-fournisseurs", ["Numéro", "Référence fournisseur", "Fournisseur", "Date", "Échéance", "Statut", "Règlement", "HT avant remise", "Remise", "TVA", "TTC", "Réglé", "Avoirs déduits", "Reste", "Devise"], rows.map((r) => [r.invoice_number, r.supplier_invoice_number, r.supplier_name, r.invoice_date, r.due_date, r.status, r.payment_status, r.subtotal_ht, r.discount_total, r.tax_total, r.total_ttc, r.paid_amount, r.credit_amount, r.remaining_amount, r.currency]));
    }
    if (kind === "contacts") {
      const rows = await listThirdPartyExportRows(filtersFromSearchParams(Object.fromEntries(sp)));
      return csvResponse("clients-fournisseurs", ["Code", "Nom", "Types", "ICE", "Email", "Téléphone", "Adresse", "Ville", "Pays", "Statut"], rows.map((r) => [r.code, r.name, (r.types ?? []).join(", "), r.ice, r.email, r.mobile || r.phone, r.address, r.city, r.country, r.status]));
    }
    if (kind === "treasury") {
      const rows = await listTreasuryTransactions({ accountId: sp.get("accountId") || undefined, direction: sp.get("direction") || undefined, type: sp.get("type") || undefined, status: sp.get("status") || undefined, dateFrom: sp.get("dateFrom") || undefined, dateTo: sp.get("dateTo") || undefined, q: sp.get("q") || undefined });
      return csvResponse("mouvements-tresorerie", ["Date", "Compte", "Type", "Sens", "Montant", "Devise", "Libellé", "Référence", "Rapprochement"], rows.map((r) => [r.transaction_date, r.account_name, r.transaction_type, r.direction, r.amount, r.currency, r.label, r.reference, r.reconciliation_status]));
    }
    if (kind === "treasury-ledger") {
      const result = await listTreasuryConsultationFlows(Object.fromEntries(sp), true);
      return csvResponse("consultation-tresorerie", ["Date", "Compte", "Sens", "Montant", "Devise", "Tiers", "Libellé", "Référence", "Mode de règlement", "Comptabilisation", "Écriture"], result.rows.map((r) => [r.transaction_date, r.account_name, r.direction, r.amount, r.currency, r.third_party_name, r.label, r.reference, getPaymentMethodLabel(r.payment_method), r.accounting_status, r.accounting_entry_number]));
    }
    return Response.json({ error: "Export introuvable." }, { status: 404 });
  } catch {
    return Response.json({ error: "L’export n’a pas pu être généré. Réessayez ou contactez l’assistance." }, { status: 503 });
  }
}
