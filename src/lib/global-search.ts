import { requireActiveWorkspace } from "@/lib/auth";
import { searchStaticRegistry, type GlobalSearchResult } from "@/lib/global-search-registry";
import { createClient } from "@/lib/supabase/server";
import { formatMoney } from "@/lib/format";

function obj(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function str(value: unknown, fallback = "") {
  return value === null || value === undefined ? fallback : String(value);
}

function cleanQuery(query: string) {
  return query.trim().replaceAll(",", " ").slice(0, 80);
}

function orFilter(query: string, columns: string[]) {
  const value = cleanQuery(query);
  return columns.map((column) => `${column}.ilike.%${value}%`).join(",");
}

function typeLabel(types: unknown, primaryType: unknown) {
  const list = Array.isArray(types) ? types.map(String) : [];
  const main = String(primaryType ?? list[0] ?? "");
  if (main === "customer" || list.includes("customer")) return "Client";
  if (main === "supplier" || list.includes("supplier")) return "Fournisseur";
  if (main === "prospect" || list.includes("prospect")) return "Prospect";
  return "Tiers";
}

function salesHref(type: string, id: string) {
  if (type === "quote") return `/vente/devis/${id}`;
  if (type === "order") return `/vente/commandes/${id}`;
  if (type === "delivery_note") return `/vente/livraisons/${id}`;
  if (type === "return_note") return `/vente/retours/${id}`;
  return `/vente`;
}

function salesTypeLabel(type: string) {
  if (type === "quote") return "Devis";
  if (type === "order") return "Commande client";
  if (type === "delivery_note") return "Bon de livraison";
  if (type === "return_note") return "Bon de retour";
  return "Document vente";
}

function purchaseHref(type: string, id: string) {
  if (type === "supplier_order") return `/achats/commandes/${id}`;
  if (type === "supplier_receipt") return `/achats/receptions/${id}`;
  return "/achats";
}

async function safe<T>(task: PromiseLike<T>, fallback: T): Promise<T> {
  try {
    return await task;
  } catch {
    return fallback;
  }
}

async function safeRows(task: PromiseLike<{ data: unknown }>): Promise<Record<string, unknown>[]> {
  const result = await safe(task, { data: [] });
  return Array.isArray(result.data) ? result.data as Record<string, unknown>[] : [];
}

async function findThirdPartyIds(orgId: string, query: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("third_parties")
    .select("id")
    .eq("organization_id", orgId)
    .is("archived_at", null)
    .or(orFilter(query, ["name", "commercial_name", "email", "phone", "mobile", "ice", "city"]))
    .limit(20);
  return (data ?? []).map((row) => row.id as string);
}

export async function globalSearch(query: string): Promise<GlobalSearchResult[]> {
  const q = cleanQuery(query);
  const staticResults = searchStaticRegistry(q, 12);
  if (q.length < 2) return staticResults;

  const workspace = await requireActiveWorkspace();
  const orgId = workspace.organization.id;
  const supabase = await createClient();
  const thirdPartyIds = await safe(findThirdPartyIds(orgId, q), []);
  const results: GlobalSearchResult[] = [...staticResults];

  const [tiers, products, salesDocs, customerInvoices, customerPayments, purchaseDocs, supplierInvoices, supplierPayments, warehouses, treasuryAccounts, treasuryTransactions, bankImports] = await Promise.all([
    safeRows(
      supabase.from("third_parties").select("id, name, primary_type, types, city, ice, email, phone").eq("organization_id", orgId).is("archived_at", null).or(orFilter(q, ["name", "commercial_name", "email", "phone", "mobile", "ice", "city"])).limit(5),
    ),
    safeRows(
      supabase.from("products").select("id, name, sku, barcode, description, type").eq("organization_id", orgId).is("archived_at", null).or(orFilter(q, ["name", "sku", "barcode", "description"])).limit(5),
    ),
    safeRows(
      thirdPartyIds.length > 0
        ? supabase.from("sales_documents").select("id, document_type, document_number, total_ttc, customer:customer_id(name)").eq("organization_id", orgId).is("archived_at", null).or(`document_number.ilike.%${q}%,customer_id.in.(${thirdPartyIds.join(",")})`).limit(5)
        : supabase.from("sales_documents").select("id, document_type, document_number, total_ttc, customer:customer_id(name)").eq("organization_id", orgId).is("archived_at", null).ilike("document_number", `%${q}%`).limit(5),
    ),
    safeRows(
      thirdPartyIds.length > 0
        ? supabase.from("customer_invoices").select("id, invoice_number, total_ttc, customer:customer_id(name)").eq("organization_id", orgId).is("archived_at", null).or(`invoice_number.ilike.%${q}%,customer_id.in.(${thirdPartyIds.join(",")})`).limit(5)
        : supabase.from("customer_invoices").select("id, invoice_number, total_ttc, customer:customer_id(name)").eq("organization_id", orgId).is("archived_at", null).ilike("invoice_number", `%${q}%`).limit(5),
    ),
    safeRows(
      thirdPartyIds.length > 0
        ? supabase.from("customer_payments").select("id, payment_number, reference, amount, customer:third_party_id(name)").eq("organization_id", orgId).is("archived_at", null).or(`payment_number.ilike.%${q}%,reference.ilike.%${q}%,third_party_id.in.(${thirdPartyIds.join(",")})`).limit(5)
        : supabase.from("customer_payments").select("id, payment_number, reference, amount, customer:third_party_id(name)").eq("organization_id", orgId).is("archived_at", null).or(orFilter(q, ["payment_number", "reference"])).limit(5),
    ),
    safeRows(
      thirdPartyIds.length > 0
        ? supabase.from("purchase_documents").select("id, document_type, document_number, total_ttc, supplier:supplier_id(name)").eq("organization_id", orgId).is("archived_at", null).or(`document_number.ilike.%${q}%,supplier_id.in.(${thirdPartyIds.join(",")})`).limit(5)
        : supabase.from("purchase_documents").select("id, document_type, document_number, total_ttc, supplier:supplier_id(name)").eq("organization_id", orgId).is("archived_at", null).ilike("document_number", `%${q}%`).limit(5),
    ),
    safeRows(
      thirdPartyIds.length > 0
        ? supabase.from("supplier_invoices").select("id, invoice_number, supplier_invoice_number, total_ttc, supplier:supplier_id(name)").eq("organization_id", orgId).is("archived_at", null).or(`invoice_number.ilike.%${q}%,supplier_invoice_number.ilike.%${q}%,supplier_id.in.(${thirdPartyIds.join(",")})`).limit(5)
        : supabase.from("supplier_invoices").select("id, invoice_number, supplier_invoice_number, total_ttc, supplier:supplier_id(name)").eq("organization_id", orgId).is("archived_at", null).or(orFilter(q, ["invoice_number", "supplier_invoice_number"])).limit(5),
    ),
    safeRows(
      thirdPartyIds.length > 0
        ? supabase.from("supplier_payments").select("id, payment_number, reference, amount, supplier:supplier_id(name)").eq("organization_id", orgId).is("archived_at", null).or(`payment_number.ilike.%${q}%,reference.ilike.%${q}%,supplier_id.in.(${thirdPartyIds.join(",")})`).limit(5)
        : supabase.from("supplier_payments").select("id, payment_number, reference, amount, supplier:supplier_id(name)").eq("organization_id", orgId).is("archived_at", null).or(orFilter(q, ["payment_number", "reference"])).limit(5),
    ),
    safeRows(supabase.from("warehouses").select("id, name, code, location_type, city").eq("organization_id", orgId).is("archived_at", null).or(orFilter(q, ["name", "code", "city"])).limit(5)),
    safeRows(supabase.from("treasury_accounts").select("id, name, code, account_type, bank_name").eq("organization_id", orgId).is("archived_at", null).or(orFilter(q, ["name", "code", "bank_name"])).limit(5)),
    safeRows(supabase.from("treasury_transactions").select("id, label, reference, amount, direction, transaction_date").eq("organization_id", orgId).is("archived_at", null).or(orFilter(q, ["label", "reference"])).limit(5)),
    safeRows(supabase.from("bank_statement_imports").select("id, import_code, file_name, imported_lines_count").eq("organization_id", orgId).is("archived_at", null).or(orFilter(q, ["import_code", "file_name"])).limit(5)),
  ]);

  for (const row of tiers) {
    const id = str(row.id);
    results.push({ id: `third-party-${id}`, title: str(row.name, "Tiers"), subtitle: [typeLabel(row.types, row.primary_type), str(row.city), row.ice ? `ICE ${str(row.ice)}` : null].filter(Boolean).join(" · "), href: `/tiers/${id}`, category: "Tiers", type: "record" });
  }
  for (const row of products) {
    const id = str(row.id);
    results.push({ id: `product-${id}`, title: str(row.name, "Article"), subtitle: [row.type === "service" ? "Service" : "Article", str(row.sku)].filter(Boolean).join(" · "), href: `/articles/${id}`, category: "Articles", type: "record" });
  }
  for (const row of salesDocs) {
    const customer = obj(row.customer);
    const id = str(row.id);
    results.push({ id: `sales-${id}`, title: str(row.document_number, "Document vente"), subtitle: [salesTypeLabel(str(row.document_type)), str(customer?.name), formatMoney(Number(row.total_ttc ?? 0))].filter(Boolean).join(" · "), href: salesHref(str(row.document_type), id), category: "Vente", type: "record" });
  }
  for (const row of customerInvoices) {
    const customer = obj(row.customer);
    const id = str(row.id);
    results.push({ id: `invoice-${id}`, title: str(row.invoice_number, "Facture client"), subtitle: ["Facture client", str(customer?.name), formatMoney(Number(row.total_ttc ?? 0))].filter(Boolean).join(" · "), href: `/facturation/factures/${id}`, category: "Facturation", type: "record" });
  }
  for (const row of customerPayments) {
    const customer = obj(row.customer);
    const id = str(row.id);
    results.push({ id: `payment-${id}`, title: str(row.payment_number, "Paiement client"), subtitle: ["Paiement client", str(customer?.name), formatMoney(Number(row.amount ?? 0))].filter(Boolean).join(" · "), href: `/facturation/paiements/${id}`, category: "Facturation", type: "record" });
  }
  for (const row of purchaseDocs) {
    const supplier = obj(row.supplier);
    const id = str(row.id);
    results.push({ id: `purchase-${id}`, title: str(row.document_number, "Document achat"), subtitle: [str(row.document_type) === "supplier_receipt" ? "Reception fournisseur" : "Commande fournisseur", str(supplier?.name), formatMoney(Number(row.total_ttc ?? 0))].filter(Boolean).join(" · "), href: purchaseHref(str(row.document_type), id), category: "Achats", type: "record" });
  }
  for (const row of supplierInvoices) {
    const supplier = obj(row.supplier);
    const id = str(row.id);
    results.push({ id: `supplier-invoice-${id}`, title: str(row.invoice_number || row.supplier_invoice_number, "Facture fournisseur"), subtitle: ["Facture fournisseur", str(supplier?.name), formatMoney(Number(row.total_ttc ?? 0))].filter(Boolean).join(" · "), href: `/achats/factures/${id}`, category: "Achats", type: "record" });
  }
  for (const row of supplierPayments) {
    const supplier = obj(row.supplier);
    const id = str(row.id);
    results.push({ id: `supplier-payment-${id}`, title: str(row.payment_number, "Paiement fournisseur"), subtitle: ["Paiement fournisseur", str(supplier?.name), formatMoney(Number(row.amount ?? 0))].filter(Boolean).join(" · "), href: `/achats/paiements/${id}`, category: "Achats", type: "record" });
  }
  for (const row of warehouses) {
    const id = str(row.id);
    results.push({ id: `warehouse-${id}`, title: str(row.name, "Emplacement stock"), subtitle: [str(row.code), str(row.location_type), str(row.city)].filter(Boolean).join(" · "), href: `/stock/emplacements/${id}`, category: "Stock", type: "record" });
  }
  for (const row of treasuryAccounts) {
    const id = str(row.id);
    results.push({ id: `treasury-account-${id}`, title: str(row.name, "Compte tresorerie"), subtitle: [str(row.account_type), str(row.bank_name), str(row.code)].filter(Boolean).join(" · "), href: `/tresorerie/comptes/${id}`, category: "Tresorerie", type: "record" });
  }
  for (const row of treasuryTransactions) {
    const id = str(row.id);
    results.push({ id: `treasury-transaction-${id}`, title: str(row.label, "Mouvement tresorerie"), subtitle: [row.direction === "in" ? "Entree" : "Sortie", str(row.transaction_date), formatMoney(Number(row.amount ?? 0))].filter(Boolean).join(" · "), href: `/tresorerie/mouvements/${id}`, category: "Tresorerie", type: "record" });
  }
  for (const row of bankImports) {
    const id = str(row.id);
    results.push({ id: `bank-import-${id}`, title: str(row.import_code || row.file_name, "Releve bancaire"), subtitle: ["Releve bancaire", `${Number(row.imported_lines_count ?? 0)} lignes`].join(" · "), href: `/tresorerie/releves/${id}`, category: "Tresorerie", type: "record" });
  }

  return results.slice(0, 30);
}
