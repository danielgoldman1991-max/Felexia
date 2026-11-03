"use server";

import { createClient } from "@/lib/supabase/server";
import { requireActiveWorkspace } from "@/lib/auth";

export interface LightDashboardData {
  receivable: number;
  payable: number;
  cash: number;
  monthlySales: number;
  recentInvoices: { id: string; number: string; total: number; currency: string; status: string; type: "sale" | "purchase"; href: string }[];
}

/** Only invoices and cash accounts are read by the launch dashboard. */
export async function getLightDashboardData(): Promise<LightDashboardData | null> {
  const workspace = await requireActiveWorkspace();
  const supabase = await createClient();
  const orgId = workspace.organization.id;
  type InvoiceRow = { id: string; invoice_number: string; invoice_date: string; total_ttc: number; remaining_amount: number; currency: string; status: string; created_at: string };

  async function readInvoices(table: "customer_invoices" | "supplier_invoices") {
    const rows: InvoiceRow[] = [];
    // Paginate so totals are not truncated by PostgREST's default 1,000 row limit.
    for (let offset = 0; ; offset += 1000) {
      const result = await supabase.from(table)
        .select("id, invoice_number, invoice_date, total_ttc, remaining_amount, currency, status, created_at")
        .eq("organization_id", orgId).is("archived_at", null).neq("status", "cancelled")
        .order("id").range(offset, offset + 999);
      if (result.error) throw new Error(`${table}: ${result.error.code}`);
      rows.push(...(result.data ?? []) as InvoiceRow[]);
      if ((result.data?.length ?? 0) < 1000) return rows;
    }
  }

  try {
    const [sales, purchases, accounts] = await Promise.all([
      readInvoices("customer_invoices"), readInvoices("supplier_invoices"),
      supabase.from("treasury_accounts").select("current_balance")
        .eq("organization_id", orgId).eq("status", "active").ilike("currency", "MAD").is("archived_at", null),
    ]);
    if (accounts.error) throw new Error(`treasury_accounts: ${accounts.error.code}`);
    const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Casablanca", year: "numeric", month: "2-digit" }).formatToParts(new Date());
    const month = `${parts.find((part) => part.type === "year")?.value}-${parts.find((part) => part.type === "month")?.value}`;
    // Never add foreign-currency amounts to a value labelled MAD.
    const inMad = (row: InvoiceRow) => row.currency.trim().toUpperCase() === "MAD";
    const outstanding = (rows: InvoiceRow[]) => rows.reduce((sum, row) => row.status === "draft" || !inMad(row) ? sum : sum + Math.max(0, Number(row.remaining_amount) || 0), 0);
    const recentInvoices = [
      ...sales.map((row) => ({ ...row, type: "sale" as const, href: `/facturation/factures/${row.id}` })),
      ...purchases.map((row) => ({ ...row, type: "purchase" as const, href: `/achats/factures/${row.id}` })),
    ].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 5)
      .map((row) => ({ id: row.id, number: row.invoice_number, total: Number(row.total_ttc) || 0, currency: row.currency, status: row.status, type: row.type, href: row.href }));
    return {
      receivable: outstanding(sales), payable: outstanding(purchases),
      cash: (accounts.data ?? []).reduce((sum, row) => sum + (Number(row.current_balance) || 0), 0),
      monthlySales: sales.reduce((sum, row) => row.status !== "draft" && inMad(row) && row.invoice_date.startsWith(month) ? sum + (Number(row.total_ttc) || 0) : sum, 0),
      recentInvoices,
    };
  } catch (error) {
    console.error("[light-dashboard] Indicators unavailable", { organizationId: orgId, message: error instanceof Error ? error.message : "unknown" });
    return null;
  }
}

export interface DashboardData {
  revenue: number;
  collections: number;
  unpaidAmount: number;
  availableCash: number;
  pendingQuotesCount: number;
  pendingQuotesAmount: number;
  activeOrdersCount: number;
  activeOrdersAmount: number;
  deliveriesToDoCount: number;
  deliveriesToDoAmount: number;
  lowStockCount: number;
  revenueSeries: { label: string; value: number }[];
  salesBreakdown: { label: string; value: number; amount: string; color: string }[];
  recentActivities: { title: string; time: string; tone: "success" | "info" | "warning" }[];
  topClients: { name: string; amount: number; trend: string }[];
  indicatorsCapped: boolean;
}

const DASHBOARD_ROW_CAP = 2000;

function formatMonthLabel(dateStr: string): string {
  const date = new Date(dateStr);
  const months = ["Jan", "Fev", "Mar", "Avr", "Mai", "Juin", "Juil", "Aout", "Sept", "Oct", "Nov", "Dec"];
  return months[date.getMonth()] ?? "";
}

function formatMoney(value: number): string {
  return new Intl.NumberFormat("fr-MA", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
}

export async function getDashboardData(): Promise<DashboardData> {
  const workspace = await requireActiveWorkspace();
  const orgId = workspace.organization.id;
  const supabase = await createClient();

  let indicatorsCapped = false;
  const cap = <T,>(rows: T[] | null | undefined) => {
    const list = rows ?? [];
    if (list.length >= DASHBOARD_ROW_CAP) indicatorsCapped = true;
    return list;
  };

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();
  const monthStart = new Date(currentYear, currentMonth, 1).toISOString();
  const monthEnd = new Date(currentYear, currentMonth + 1, 0).toISOString();
  const yearStart = new Date(currentYear, 0, 1).toISOString();

  // ── 1. Chiffre d'affaires (factures validées/sent/partially_paid/paid du mois courant) ──
  const { data: revenueData } = await supabase
    .from("customer_invoices")
    .select("total_ttc")
    .eq("organization_id", orgId)
    .gte("invoice_date", monthStart)
    .lte("invoice_date", monthEnd)
    .not("status", "in", "(draft,cancelled)")
    .limit(DASHBOARD_ROW_CAP);

  const revenueRows = cap(revenueData);
  const revenue = revenueRows.reduce((sum, row) => sum + (Number(row.total_ttc) || 0), 0);

  // ── 2. Encaissements (paiements clients du mois courant) ──
  const { data: collectionsData } = await supabase
    .from("customer_payments")
    .select("amount")
    .eq("organization_id", orgId)
    .gte("payment_date", monthStart)
    .lte("payment_date", monthEnd)
    .not("status", "in", "(cancelled)")
    .limit(DASHBOARD_ROW_CAP);

  const collections = cap(collectionsData).reduce((sum, row) => sum + (Number(row.amount) || 0), 0);

  // ── 3. Impayés (factures validées non payées) ──
  const { data: unpaidData } = await supabase
    .from("customer_invoices")
    .select("remaining_amount")
    .eq("organization_id", orgId)
    .not("status", "in", "(draft,cancelled)")
    .gt("remaining_amount", 0)
    .limit(DASHBOARD_ROW_CAP);

  const unpaidAmount = cap(unpaidData).reduce((sum, row) => sum + (Number(row.remaining_amount) || 0), 0);

  // ── 4. Trésorerie disponible ──
  const { data: treasuryData } = await supabase
    .from("treasury_accounts")
    .select("current_balance")
    .eq("organization_id", orgId)
    .eq("status", "active")
    .is("archived_at", null);

  const availableCash = (treasuryData ?? []).reduce((sum, row) => sum + (Number(row.current_balance) || 0), 0);

  // ── 5. Devis en attente (quotes draft/sent) ──
  const { data: quotesData } = await supabase
    .from("sales_documents")
    .select("total_ttc")
    .eq("organization_id", orgId)
    .eq("document_type", "quote")
    .in("status", ["draft", "sent"])
    .is("archived_at", null)
    .limit(DASHBOARD_ROW_CAP);

  const quoteRows = cap(quotesData);
  const pendingQuotesCount = quoteRows.length;
  const pendingQuotesAmount = quoteRows.reduce((sum, row) => sum + (Number(row.total_ttc) || 0), 0);

  // ── 6. Commandes en cours (orders non cancelled/delivered) ──
  const { data: ordersData } = await supabase
    .from("sales_documents")
    .select("total_ttc")
    .eq("organization_id", orgId)
    .eq("document_type", "order")
    .not("status", "in", "(cancelled,delivered)")
    .is("archived_at", null)
    .limit(DASHBOARD_ROW_CAP);

  const orderRows = cap(ordersData);
  const activeOrdersCount = orderRows.length;
  const activeOrdersAmount = orderRows.reduce((sum, row) => sum + (Number(row.total_ttc) || 0), 0);

  // ── 7. Livraisons à faire (delivery_notes non delivered/cancelled) ──
  const { data: deliveriesData } = await supabase
    .from("sales_documents")
    .select("total_ttc")
    .eq("organization_id", orgId)
    .eq("document_type", "delivery_note")
    .not("status", "in", "(cancelled,delivered)")
    .is("archived_at", null)
    .limit(DASHBOARD_ROW_CAP);

  const deliveryRows = cap(deliveriesData);
  const deliveriesToDoCount = deliveryRows.length;
  const deliveriesToDoAmount = deliveryRows.reduce((sum, row) => sum + (Number(row.total_ttc) || 0), 0);

  // ── 8. Stocks faibles ──
  const { data: lowStockData } = await supabase
    .from("products")
    .select("id, stock_alert_threshold")
    .eq("organization_id", orgId)
    .gt("stock_alert_threshold", 0)
    .is("archived_at", null)
    .limit(DASHBOARD_ROW_CAP);

  let lowStockCount = 0;
  const lowStockRows = cap(lowStockData);
  if (lowStockRows.length > 0) {
    const productIds = lowStockRows.map((p) => p.id);
    const { data: stockData } = await supabase
      .from("stock_levels")
      .select("product_id, quantity")
      .in("product_id", productIds);

    const stockMap = new Map<string, number>();
    for (const stock of stockData ?? []) {
      stockMap.set(
        stock.product_id,
        (stockMap.get(stock.product_id) ?? 0) + (Number(stock.quantity) || 0),
      );
    }
    lowStockCount = lowStockRows.filter((p) => {
      const qty = stockMap.get(p.id) ?? 0;
      return qty <= Number(p.stock_alert_threshold);
    }).length;
  }

  // ── 9. Évolution du CA (12 derniers mois, une lecture plafonnée) ──
  const seriesStart = new Date(currentYear, currentMonth - 11, 1).toISOString();
  const { data: seriesInvoices } = await supabase
    .from("customer_invoices")
    .select("invoice_date, total_ttc")
    .eq("organization_id", orgId)
    .gte("invoice_date", seriesStart)
    .not("status", "in", "(draft,cancelled)")
    .limit(DASHBOARD_ROW_CAP);
  const seriesRows = cap(seriesInvoices);
  const revenueSeries: { label: string; value: number }[] = [];
  for (let i = 11; i >= 0; i--) {
    const m = new Date(currentYear, currentMonth - i, 1);
    const key = `${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, "0")}`;
    const monthRevenue = seriesRows.reduce((sum, row) => String(row.invoice_date).startsWith(key) ? sum + (Number(row.total_ttc) || 0) : sum, 0);
    revenueSeries.push({ label: formatMonthLabel(m.toISOString()), value: monthRevenue });
  }

  // ── 10. Répartition des ventes par catégorie de produit ──
  const { data: invoiceLines } = await supabase
    .from("customer_invoice_lines")
    .select("total_ttc, product:product_id(category_id)")
    .eq("organization_id", orgId)
    .gte("created_at", yearStart)
    .limit(DASHBOARD_ROW_CAP);

  const categoryMap = new Map<string, number>();
  for (const line of cap(invoiceLines)) {
    const amount = Number(line.total_ttc) || 0;
    const catId = (line.product as { category_id?: string } | null)?.category_id ?? "autre";
    categoryMap.set(catId, (categoryMap.get(catId) || 0) + amount);
  }

  let salesBreakdown: DashboardData["salesBreakdown"] = [];
  if (categoryMap.size > 0) {
    const catIds = Array.from(categoryMap.keys()).filter((id) => id !== "autre");
    const { data: categories } = catIds.length > 0
      ? await supabase.from("product_categories").select("id, name").in("id", catIds)
      : { data: [] };

    const catNameMap = new Map((categories ?? []).map((c) => [c.id, c.name]));
    const totalSales = Array.from(categoryMap.values()).reduce((a, b) => a + b, 0);
    const colors = ["#2563eb", "#22c55e", "#f59e0b", "#64748b", "#8b5cf6", "#ec4899"];

    salesBreakdown = Array.from(categoryMap.entries())
      .map(([catId, amount], index) => ({
        label: catNameMap.get(catId) ?? (catId === "autre" ? "Autres" : "Inconnu"),
        value: totalSales > 0 ? Math.round((amount / totalSales) * 100) : 0,
        amount: `${formatMoney(amount)} DH`,
        color: colors[index % colors.length] ?? "#64748b",
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);
  }

  // ── 11. Dernières activités ──
  const recentActivities: DashboardData["recentActivities"] = [];

  // Dernières factures
  const { data: recentInvoices } = await supabase
    .from("customer_invoices")
    .select("invoice_number, created_at, total_ttc")
    .eq("organization_id", orgId)
    .order("created_at", { ascending: false })
    .limit(3);

  for (const inv of recentInvoices ?? []) {
    recentActivities.push({
      title: `Facture ${inv.invoice_number} creee (${formatMoney(Number(inv.total_ttc))} DH)`,
      time: new Date(inv.created_at).toLocaleDateString("fr-FR"),
      tone: "info",
    });
  }

  // Derniers paiements
  const { data: recentPayments } = await supabase
    .from("customer_payments")
    .select("payment_number, payment_date, amount")
    .eq("organization_id", orgId)
    .not("status", "in", "(cancelled)")
    .order("payment_date", { ascending: false })
    .limit(2);

  for (const pay of recentPayments ?? []) {
    recentActivities.push({
      title: `Paiement recu ${formatMoney(Number(pay.amount))} DH`,
      time: new Date(pay.payment_date).toLocaleDateString("fr-FR"),
      tone: "success",
    });
  }

  // Derniers devis
  const { data: recentQuotes } = await supabase
    .from("sales_documents")
    .select("document_number, created_at, total_ttc")
    .eq("organization_id", orgId)
    .eq("document_type", "quote")
    .order("created_at", { ascending: false })
    .limit(2);

  for (const quote of recentQuotes ?? []) {
    recentActivities.push({
      title: `Devis ${quote.document_number} cree (${formatMoney(Number(quote.total_ttc))} DH)`,
      time: new Date(quote.created_at).toLocaleDateString("fr-FR"),
      tone: "warning",
    });
  }

  // Trier par date décroissante et limiter à 8
  recentActivities.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
  recentActivities.splice(8);

  // ── 12. Top 5 clients ──
  const { data: topClientData, error: topClientError } = await supabase
    .from("customer_invoices")
    .select("customer_id, total_ttc")
    .eq("organization_id", orgId)
    .gte("invoice_date", yearStart)
    .not("status", "in", "(draft,cancelled)")
    .limit(DASHBOARD_ROW_CAP);

  if (topClientError) {
    console.error("[dashboard] top clients invoice load failed", {
      code: topClientError.code,
    });
  }

  const topClientIds = [...new Set((topClientData ?? []).map((row) => row.customer_id).filter(Boolean))];
  const { data: topClientNames, error: topClientNamesError } = topClientIds.length > 0
    ? await supabase
        .from("third_parties")
        .select("id, name")
        .eq("organization_id", orgId)
        .in("id", topClientIds)
    : { data: [], error: null };

  if (topClientNamesError) {
    console.error("[dashboard] top clients names load failed", {
      code: topClientNamesError.code,
    });
  }

  const topClientNameById = new Map((topClientNames ?? []).map((row) => [row.id, row.name]));

  const clientMap = new Map<string, { name: string; amount: number }>();
  for (const row of cap(topClientData)) {
    const key = row.customer_id;
    const existing = clientMap.get(key);
    if (existing) {
      existing.amount += Number(row.total_ttc) || 0;
    } else {
      clientMap.set(key, { name: topClientNameById.get(key) ?? "Client inconnu", amount: Number(row.total_ttc) || 0 });
    }
  }

  const topClients = Array.from(clientMap.values())
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5)
    .map((client) => ({
      name: client.name,
      amount: client.amount,
      trend: "+",
    }));

  return {
    revenue,
    collections,
    unpaidAmount,
    availableCash,
    pendingQuotesCount,
    pendingQuotesAmount,
    activeOrdersCount,
    activeOrdersAmount,
    deliveriesToDoCount,
    deliveriesToDoAmount,
    lowStockCount,
    revenueSeries,
    salesBreakdown,
    recentActivities,
    topClients,
    indicatorsCapped,
  };
}
