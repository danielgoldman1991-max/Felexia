"use server";

import { createClient } from "@/lib/supabase/server";
import { requireActiveWorkspace } from "@/lib/auth";

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
}

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
    .not("status", "in", "(draft,cancelled)");

  const revenue = (revenueData ?? []).reduce((sum, row) => sum + (Number(row.total_ttc) || 0), 0);

  // ── 2. Encaissements (paiements clients du mois courant) ──
  const { data: collectionsData } = await supabase
    .from("customer_payments")
    .select("amount")
    .eq("organization_id", orgId)
    .gte("payment_date", monthStart)
    .lte("payment_date", monthEnd)
    .not("status", "in", "(cancelled)");

  const collections = (collectionsData ?? []).reduce((sum, row) => sum + (Number(row.amount) || 0), 0);

  // ── 3. Impayés (factures validées non payées) ──
  const { data: unpaidData } = await supabase
    .from("customer_invoices")
    .select("remaining_amount")
    .eq("organization_id", orgId)
    .not("status", "in", "(draft,cancelled)")
    .gt("remaining_amount", 0);

  const unpaidAmount = (unpaidData ?? []).reduce((sum, row) => sum + (Number(row.remaining_amount) || 0), 0);

  // ── 4. Trésorerie disponible ──
  const { data: treasuryData } = await supabase
    .from("treasury_accounts")
    .select("balance")
    .eq("organization_id", orgId)
    .eq("status", "active");

  const availableCash = (treasuryData ?? []).reduce((sum, row) => sum + (Number(row.balance) || 0), 0);

  // ── 5. Devis en attente (quotes draft/sent) ──
  const { data: quotesData } = await supabase
    .from("sales_documents")
    .select("total_ttc")
    .eq("organization_id", orgId)
    .eq("document_type", "quote")
    .in("status", ["draft", "sent"])
    .is("archived_at", null);

  const pendingQuotesCount = quotesData?.length ?? 0;
  const pendingQuotesAmount = (quotesData ?? []).reduce((sum, row) => sum + (Number(row.total_ttc) || 0), 0);

  // ── 6. Commandes en cours (orders non cancelled/delivered) ──
  const { data: ordersData } = await supabase
    .from("sales_documents")
    .select("total_ttc")
    .eq("organization_id", orgId)
    .eq("document_type", "order")
    .not("status", "in", "(cancelled,delivered)")
    .is("archived_at", null);

  const activeOrdersCount = ordersData?.length ?? 0;
  const activeOrdersAmount = (ordersData ?? []).reduce((sum, row) => sum + (Number(row.total_ttc) || 0), 0);

  // ── 7. Livraisons à faire (delivery_notes non delivered/cancelled) ──
  const { data: deliveriesData } = await supabase
    .from("sales_documents")
    .select("total_ttc")
    .eq("organization_id", orgId)
    .eq("document_type", "delivery_note")
    .not("status", "in", "(cancelled,delivered)")
    .is("archived_at", null);

  const deliveriesToDoCount = deliveriesData?.length ?? 0;
  const deliveriesToDoAmount = (deliveriesData ?? []).reduce((sum, row) => sum + (Number(row.total_ttc) || 0), 0);

  // ── 8. Stocks faibles ──
  const { data: lowStockData } = await supabase
    .from("products")
    .select("id, stock_alert_threshold")
    .eq("organization_id", orgId)
    .gt("stock_alert_threshold", 0)
    .is("archived_at", null);

  let lowStockCount = 0;
  if (lowStockData && lowStockData.length > 0) {
    const productIds = lowStockData.map((p) => p.id);
    const { data: stockData } = await supabase
      .from("stock_levels")
      .select("product_id, quantity")
      .in("product_id", productIds);

    const stockMap = new Map((stockData ?? []).map((s) => [s.product_id, Number(s.quantity) || 0]));
    lowStockCount = lowStockData.filter((p) => {
      const qty = stockMap.get(p.id) ?? 0;
      return qty <= Number(p.stock_alert_threshold);
    }).length;
  }

  // ── 9. Évolution du CA (12 derniers mois) ──
  const revenueSeries: { label: string; value: number }[] = [];
  for (let i = 11; i >= 0; i--) {
    const m = new Date(currentYear, currentMonth - i, 1);
    const mStart = new Date(m.getFullYear(), m.getMonth(), 1).toISOString();
    const mEnd = new Date(m.getFullYear(), m.getMonth() + 1, 0).toISOString();
    const { data: monthInvoices } = await supabase
      .from("customer_invoices")
      .select("total_ttc")
      .eq("organization_id", orgId)
      .gte("invoice_date", mStart)
      .lte("invoice_date", mEnd)
      .not("status", "in", "(draft,cancelled)");

    const monthRevenue = (monthInvoices ?? []).reduce((sum, row) => sum + (Number(row.total_ttc) || 0), 0);
    revenueSeries.push({ label: formatMonthLabel(mStart), value: monthRevenue });
  }

  // ── 10. Répartition des ventes par catégorie de produit ──
  const { data: invoiceLines } = await supabase
    .from("customer_invoice_lines")
    .select("total_ttc, product:product_id(category_id)")
    .eq("organization_id", orgId)
    .gte("created_at", yearStart);

  const categoryMap = new Map<string, number>();
  for (const line of invoiceLines ?? []) {
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
  const { data: topClientData } = await supabase
    .from("customer_invoices")
    .select("customer_id, customer_name, total_ttc")
    .eq("organization_id", orgId)
    .gte("invoice_date", yearStart)
    .not("status", "in", "(draft,cancelled)");

  const clientMap = new Map<string, { name: string; amount: number }>();
  for (const row of topClientData ?? []) {
    const key = row.customer_id;
    const existing = clientMap.get(key);
    if (existing) {
      existing.amount += Number(row.total_ttc) || 0;
    } else {
      clientMap.set(key, { name: row.customer_name ?? "Client inconnu", amount: Number(row.total_ttc) || 0 });
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
  };
}