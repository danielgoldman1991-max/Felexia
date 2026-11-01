import type { SupabaseClient } from "@supabase/supabase-js";
import { readAllPages } from "@/lib/listing";

export const FORECAST_CURRENCY = "MAD";
export const FORECAST_CURRENCY_SCOPE = "Prévision en MAD uniquement. Les comptes et factures dans une autre devise sont exclus, sans conversion. Les prévisions manuelles sans compte sont exprimées en MAD.";

export type TreasuryForecastScenario = "prudent" | "realistic" | "optimistic";
export type TreasuryForecastDirection = "inflow" | "outflow" | "all";
export type TreasuryForecastSourceType = "customer_invoice" | "supplier_invoice" | "manual" | "scheduled_payment" | "other";

export const FORECAST_CATEGORIES: Record<"inflow" | "outflow", string[]> = {
  inflow: ["Encaissement client", "Apport", "Credit bancaire", "Remboursement", "Autre entree"],
  outflow: ["Loyer", "Salaires", "Fournisseur", "Charges sociales", "Impot et taxes", "Credit / leasing", "Frais bancaires", "Autre sortie"],
};

export type TreasuryForecastItem = {
  id: string;
  sourceType: TreasuryForecastSourceType;
  sourceId?: string | null;
  direction: "inflow" | "outflow";
  label: string;
  thirdPartyName?: string | null;
  documentNumber?: string | null;
  dueDate: string;
  amount: number;
  remainingAmount: number;
  probability: number;
  weightedAmount: number;
  status: string;
  category?: string | null;
  href?: string | null;
  hasFallbackDate?: boolean;
};

export type TreasuryForecastDaily = {
  date: string;
  openingBalance: number;
  inflows: number;
  outflows: number;
  netFlow: number;
  closingBalance: number;
  isCritical: boolean;
};

export type TreasuryForecastAlert = {
  severity: "info" | "warning" | "danger";
  title: string;
  message: string;
  date?: string;
  amount?: number;
};

export type TreasuryForecastResult = {
  availableAccounts: Array<{ id: string; name: string }>;
  openingBalance: number;
  closingForecastBalance: number;
  totalExpectedInflows: number;
  totalExpectedOutflows: number;
  netCashFlow: number;
  lowestForecastBalance: number;
  criticalDaysCount: number;
  daily: TreasuryForecastDaily[];
  inflows: TreasuryForecastItem[];
  outflows: TreasuryForecastItem[];
  overdueInflows: TreasuryForecastItem[];
  overdueOutflows: TreasuryForecastItem[];
  alerts: TreasuryForecastAlert[];
  hypothesis: {
    scenario: TreasuryForecastScenario;
    from: string;
    to: string;
    includeOverdue: boolean;
    accountId: string | null;
    accountName: string | null;
    activeAccountCount: number;
    invoiceCount: number;
    supplierInvoiceCount: number;
    manualItemCount: number;
    invoiceWithoutDueDateCount: number;
    currency: "MAD";
    excludedAccountCount: number;
    excludedInvoiceCount: number;
    excludedManualItemCount: number;
  };
};

export type TreasuryForecastOptions = {
  from: string;
  to: string;
  scenario?: TreasuryForecastScenario;
  includeOverdue?: boolean;
  includeManualItems?: boolean;
  treasuryAccountId?: string | null;
  direction?: TreasuryForecastDirection;
};

type CustomerInvoiceRow = {
  id: string;
  invoice_number: string;
  status: string;
  due_date: string | null;
  invoice_date: string;
  remaining_amount: number | string | null;
  total_ttc: number | string | null;
  currency: string;
  customer_name?: string | null;
  customer?: { name?: string | null } | Array<{ name?: string | null }> | null;
};

type SupplierInvoiceRow = {
  id: string;
  invoice_number: string;
  supplier_invoice_number: string | null;
  status: string;
  due_date: string | null;
  invoice_date: string;
  remaining_amount: number | string | null;
  total_ttc: number | string | null;
  currency: string;
  supplier_name?: string | null;
  supplier?: { name?: string | null } | Array<{ name?: string | null }> | null;
};

type ManualForecastRow = {
  id: string;
  item_type: string;
  direction: "inflow" | "outflow";
  source_type: string | null;
  source_id: string | null;
  label: string;
  description: string | null;
  forecast_date: string;
  amount: number | string | null;
  probability: number | string | null;
  weighted_amount: number | string | null;
  status: string;
  category: string | null;
  treasury_account_id: string | null;
  is_manual: boolean;
  notes: string | null;
};

const CUSTOMER_OPEN_STATUSES = ["validated", "sent", "partially_paid", "overdue"];
const SUPPLIER_OPEN_STATUSES = ["validated", "partially_paid"];

function toNumber(value: number | string | null | undefined): number {
  if (value === null || value === undefined) return 0;
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) throw new Error("Un montant de la prévision est invalide. Vérifiez les données avant de poursuivre.");
  return parsed;
}

function relatedName(relation: { name?: string | null } | Array<{ name?: string | null }> | null | undefined): string | null {
  return (Array.isArray(relation) ? relation[0]?.name : relation?.name) ?? null;
}

function validateForecastOptions(options: TreasuryForecastOptions) {
  const validDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value)
    && Number.isFinite(Date.parse(`${value}T00:00:00Z`))
    && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
  if (!validDate(options.from) || !validDate(options.to) || options.from > options.to
    || (Date.parse(options.to) - Date.parse(options.from)) / 86_400_000 > 366) {
    throw new Error("Choisissez une période valide de 367 jours maximum pour la prévision.");
  }
  if (options.scenario && !["prudent", "realistic", "optimistic"].includes(options.scenario)) throw new Error("Le scénario de prévision est invalide.");
  if (options.direction && !["all", "inflow", "outflow"].includes(options.direction)) throw new Error("Le sens des flux est invalide.");
}

async function readForecastRows<T>(label: string, page: Parameters<typeof readAllPages<T>>[0]): Promise<T[]> {
  try {
    return await readAllPages<T>(page);
  } catch {
    throw new Error(`Impossible de charger ${label}. Aucune prévision partielle ne peut être affichée. Actualisez avant de poursuivre.`);
  }
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export function addDays(dateString: string, days: number): string {
  const date = new Date(`${dateString}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function formatForecastDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function eachDay(from: string, to: string): string[] {
  const days: string[] = [];
  const cursor = new Date(`${from}T00:00:00Z`);
  const end = new Date(`${to}T00:00:00Z`);
  while (cursor <= end) {
    days.push(formatForecastDate(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return days;
}

function scenarioProbability(probability: number, direction: "inflow" | "outflow", scenario: TreasuryForecastScenario): number {
  const normalized = Math.min(Math.max(probability, 0), 100) / 100;
  if (scenario === "prudent") return direction === "inflow" ? normalized * 0.7 : 1;
  if (scenario === "optimistic") return direction === "inflow" ? 1 : normalized;
  return normalized;
}

export function computeWeightedAmount(
  amount: number,
  probability: number,
  direction: "inflow" | "outflow",
  scenario: TreasuryForecastScenario,
): number {
  return round2(amount * scenarioProbability(probability, direction, scenario));
}

export async function getTreasuryForecast(
  supabase: SupabaseClient,
  organizationId: string,
  options: TreasuryForecastOptions,
): Promise<TreasuryForecastResult> {
  validateForecastOptions(options);
  const {
    from,
    to,
    scenario = "realistic",
    includeOverdue = true,
    includeManualItems = true,
    treasuryAccountId = null,
    direction = "all",
  } = options;

  type AccountRow = { id: string; name: string; current_balance: number | string | null; status: string; currency: string; archived_at: string | null };
  const allAccountRows = await readForecastRows<AccountRow>("les soldes de trésorerie", (start, end) => supabase
    .from("treasury_accounts")
    .select("id, name, current_balance, status, currency, archived_at")
    .eq("organization_id", organizationId)
    .order("id", { ascending: true }).range(start, end));
  const activeAccounts = allAccountRows.filter(account => account.status === "active" && !account.archived_at);
  if (treasuryAccountId && !activeAccounts.some(account => account.id === treasuryAccountId && account.currency === FORECAST_CURRENCY)) {
    throw new Error("Sélectionnez un compte actif en MAD pour consulter cette prévision.");
  }
  const accountRows = activeAccounts.filter(account => account.currency === FORECAST_CURRENCY && (!treasuryAccountId || account.id === treasuryAccountId));
  const excludedAccountCount = activeAccounts.filter(account => account.currency !== FORECAST_CURRENCY).length;
  const accountCurrencyById = new Map(allAccountRows.map(account => [account.id, account.currency]));
  const openingBalance = round2(accountRows.reduce((sum, account) => sum + toNumber(account.current_balance), 0));
  const accountName = treasuryAccountId ? (accountRows[0]?.name ?? null) : null;

  const [customerRows, supplierRows, manualRows] = await Promise.all([
    readForecastRows<CustomerInvoiceRow>("les factures clients", (start, end) => supabase
      .from("customer_invoices")
      .select("id, invoice_number, status, due_date, invoice_date, remaining_amount, total_ttc, currency, customer:customer_id (name)")
      .eq("organization_id", organizationId)
      .is("archived_at", null)
      .in("status", CUSTOMER_OPEN_STATUSES)
      .gt("remaining_amount", 0)
      .order("id", { ascending: true }).range(start, end)),
    readForecastRows<SupplierInvoiceRow>("les factures fournisseurs", (start, end) => supabase
      .from("supplier_invoices")
      .select("id, invoice_number, supplier_invoice_number, status, due_date, invoice_date, remaining_amount, total_ttc, currency, supplier:supplier_id (name)")
      .eq("organization_id", organizationId)
      .is("archived_at", null)
      .in("status", SUPPLIER_OPEN_STATUSES)
      .gt("remaining_amount", 0)
      .order("id", { ascending: true }).range(start, end)),
    includeManualItems
      ? readForecastRows<ManualForecastRow>("les prévisions manuelles", (start, end) => supabase
          .from("treasury_forecast_items")
          .select("*")
          .eq("organization_id", organizationId)
          .is("archived_at", null)
          .not("status", "in", '("cancelled","ignored")')
          .gte("forecast_date", from)
          .lte("forecast_date", to)
          .order("id", { ascending: true }).range(start, end))
      : Promise.resolve([] as ManualForecastRow[]),
  ]);

  let invoiceWithoutDueDateCount = 0;
  let excludedInvoiceCount = 0;
  let excludedManualItemCount = 0;
  const items: TreasuryForecastItem[] = [];

  for (const row of customerRows) {
    const remaining = toNumber(row.remaining_amount);
    if (remaining <= 0) continue;
    const dueDate = row.due_date ?? addDays(row.invoice_date, 30);
    if (dueDate > to) continue;
    const isOverdue = dueDate < from;
    if (isOverdue && !includeOverdue) continue;
    if (row.currency !== FORECAST_CURRENCY) { excludedInvoiceCount += 1; continue; }
    if (!row.due_date) invoiceWithoutDueDateCount += 1;
    const probability = isOverdue ? 70 : 100;
    const item: TreasuryForecastItem = {
      id: `customer_invoice:${row.id}`,
      sourceType: "customer_invoice",
      sourceId: row.id,
      direction: "inflow",
      label: `Facture ${row.invoice_number}`,
      thirdPartyName: relatedName(row.customer) ?? row.customer_name ?? null,
      documentNumber: row.invoice_number,
      dueDate,
      amount: round2(remaining),
      remainingAmount: round2(remaining),
      probability,
      weightedAmount: computeWeightedAmount(remaining, probability, "inflow", scenario),
      status: row.status,
      category: "Encaissement client",
      href: `/facturation/factures/${row.id}`,
      hasFallbackDate: !row.due_date,
    };
    items.push(item);
  }

  for (const row of supplierRows) {
    const remaining = toNumber(row.remaining_amount);
    if (remaining <= 0) continue;
    const dueDate = row.due_date ?? addDays(row.invoice_date, 30);
    if (dueDate > to) continue;
    const isOverdue = dueDate < from;
    if (isOverdue && !includeOverdue) continue;
    if (row.currency !== FORECAST_CURRENCY) { excludedInvoiceCount += 1; continue; }
    if (!row.due_date) invoiceWithoutDueDateCount += 1;
    const item: TreasuryForecastItem = {
      id: `supplier_invoice:${row.id}`,
      sourceType: "supplier_invoice",
      sourceId: row.id,
      direction: "outflow",
      label: `Facture ${row.invoice_number}`,
      thirdPartyName: relatedName(row.supplier) ?? row.supplier_name ?? null,
      documentNumber: row.supplier_invoice_number ?? row.invoice_number,
      dueDate,
      amount: round2(remaining),
      remainingAmount: round2(remaining),
      probability: 100,
      weightedAmount: computeWeightedAmount(remaining, 100, "outflow", scenario),
      status: row.status,
      category: "Echeance fournisseur",
      href: `/achats/factures/${row.id}`,
      hasFallbackDate: !row.due_date,
    };
    items.push(item);
  }

  for (const row of manualRows) {
    if (treasuryAccountId && row.treasury_account_id && row.treasury_account_id !== treasuryAccountId) continue;
    if (row.treasury_account_id && accountCurrencyById.get(row.treasury_account_id) !== FORECAST_CURRENCY) { excludedManualItemCount += 1; continue; }
    const amount = toNumber(row.amount);
    if (amount <= 0) continue;
    const probability = toNumber(row.probability);
    const item: TreasuryForecastItem = {
      id: `manual:${row.id}`,
      sourceType: row.item_type === "scheduled_payment" ? "scheduled_payment" : "manual",
      sourceId: row.id,
      direction: row.direction,
      label: row.label,
      dueDate: row.forecast_date,
      amount: round2(amount),
      remainingAmount: round2(amount),
      probability,
      weightedAmount: computeWeightedAmount(amount, probability, row.direction, scenario),
      status: row.status,
      category: row.category ?? null,
      href: `/tresorerie/previsions/${row.id}/edit`,
    };
    items.push(item);
  }

  const inflows = items
    .filter((item) => item.direction === "inflow" && (direction === "all" || direction === "inflow"))
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const outflows = items
    .filter((item) => item.direction === "outflow" && (direction === "all" || direction === "outflow"))
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));

  const overdueInflows = inflows.filter((item) => item.dueDate < from);
  const overdueOutflows = outflows.filter((item) => item.dueDate < from);

  const days = eachDay(from, to);
  const daily: TreasuryForecastDaily[] = [];
  let runningBalance = openingBalance;
  let totalInflows = 0;
  let totalOutflows = 0;
  let lowestForecastBalance = Infinity;
  let criticalDaysCount = 0;

  const placeDay = (dueDate: string): string => (dueDate < from ? from : dueDate);

  const flowsByDay = new Map<string, { inflows: number; outflows: number }>();
  for (const item of items) {
    if (direction !== "all" && item.direction !== direction) continue;
    const date = placeDay(item.dueDate);
    const flow = flowsByDay.get(date) ?? { inflows: 0, outflows: 0 };
    if (item.direction === "inflow") flow.inflows += item.weightedAmount;
    else flow.outflows += item.weightedAmount;
    flowsByDay.set(date, flow);
  }

  for (const day of days) {
    const dayInflows = flowsByDay.get(day)?.inflows ?? 0;
    const dayOutflows = flowsByDay.get(day)?.outflows ?? 0;
    totalInflows += dayInflows;
    totalOutflows += dayOutflows;
    const netFlow = round2(dayInflows - dayOutflows);
    const closing = round2(runningBalance + netFlow);
    const isCritical = closing < 0;
    if (isCritical) criticalDaysCount += 1;
    if (closing < lowestForecastBalance) lowestForecastBalance = closing;
    daily.push({
      date: day,
      openingBalance: round2(runningBalance),
      inflows: round2(dayInflows),
      outflows: round2(dayOutflows),
      netFlow,
      closingBalance: closing,
      isCritical,
    });
    runningBalance = closing;
  }

  if (lowestForecastBalance === Infinity) lowestForecastBalance = openingBalance;
  const netCashFlow = round2(totalInflows - totalOutflows);
  const closingForecastBalance = round2(openingBalance + netCashFlow);

  const alerts = buildAlerts({
    daily,
    openingBalance,
    netCashFlow,
    overdueInflows,
    overdueOutflows,
    totalExpectedOutflows: totalOutflows,
    activeAccountCount: accountRows.length,
    invoiceWithoutDueDateCount,
    from,
    to,
  });
  if (excludedAccountCount + excludedInvoiceCount + excludedManualItemCount > 0) alerts.unshift({
    severity: "warning",
    title: "Périmètre limité au MAD",
    message: `${excludedAccountCount} compte(s), ${excludedInvoiceCount} facture(s) et ${excludedManualItemCount} prévision(s) manuelle(s) hors périmètre MAD exclus. Aucun taux de change n'est appliqué.`,
  });

  return {
    availableAccounts: activeAccounts.filter(account => account.currency === FORECAST_CURRENCY).map(account => ({ id: account.id, name: account.name })),
    openingBalance,
    closingForecastBalance,
    totalExpectedInflows: round2(totalInflows),
    totalExpectedOutflows: round2(totalOutflows),
    netCashFlow,
    lowestForecastBalance,
    criticalDaysCount,
    daily,
    inflows,
    outflows,
    overdueInflows,
    overdueOutflows,
    alerts,
    hypothesis: {
      scenario,
      from,
      to,
      includeOverdue,
      accountId: treasuryAccountId ?? null,
      accountName,
      activeAccountCount: accountRows.length,
      invoiceCount: inflows.filter((item) => item.sourceType === "customer_invoice").length,
      supplierInvoiceCount: outflows.filter((item) => item.sourceType === "supplier_invoice").length,
      manualItemCount: items.filter((item) => item.sourceType === "manual" || item.sourceType === "scheduled_payment").length,
      invoiceWithoutDueDateCount,
      currency: FORECAST_CURRENCY,
      excludedAccountCount,
      excludedInvoiceCount,
      excludedManualItemCount,
    },
  };
}

function buildAlerts(params: {
  daily: TreasuryForecastDaily[];
  openingBalance: number;
  netCashFlow: number;
  overdueInflows: TreasuryForecastItem[];
  overdueOutflows: TreasuryForecastItem[];
  totalExpectedOutflows: number;
  activeAccountCount: number;
  invoiceWithoutDueDateCount: number;
  from: string;
  to: string;
}): TreasuryForecastAlert[] {
  const alerts: TreasuryForecastAlert[] = [];
  const {
    daily,
    openingBalance,
    netCashFlow,
    overdueInflows,
    overdueOutflows,
    totalExpectedOutflows,
    activeAccountCount,
    invoiceWithoutDueDateCount,
  } = params;

  const firstCritical = daily.find((day) => day.isCritical);
  if (firstCritical) {
    alerts.push({
      severity: "danger",
      title: "Risque de tension de tresorerie",
      message: `Solde previsionnel negatif le ${firstCritical.date} : ${Math.abs(firstCritical.closingBalance).toLocaleString("fr-FR")} MAD.`,
      date: firstCritical.date,
      amount: firstCritical.closingBalance,
    });
  }

  if (openingBalance > 0 && totalExpectedOutflows > 0) {
    const sevenDayOutflows = daily
      .slice(0, Math.min(7, daily.length))
      .reduce((sum, day) => sum + day.outflows, 0);
    if (sevenDayOutflows >= openingBalance * 0.3) {
      alerts.push({
        severity: "warning",
        title: "Sorties importantes sous 7 jours",
        message: `${sevenDayOutflows.toLocaleString("fr-FR")} MAD de sorties prevues dans les 7 prochains jours (${Math.round((sevenDayOutflows / Math.max(openingBalance, 1)) * 100)}% du solde actuel).`,
        amount: round2(sevenDayOutflows),
      });
    }
  }

  const overdueInflowTotal = round2(overdueInflows.reduce((sum, item) => sum + item.remainingAmount, 0));
  if (overdueInflows.length > 0) {
    alerts.push({
      severity: "warning",
      title: "Encaissements en retard",
      message: `${overdueInflows.length} facture(s) cliente(s) en retard pour ${overdueInflowTotal.toLocaleString("fr-FR")} MAD.`,
      amount: overdueInflowTotal,
    });
  }

  if (overdueInflows.length >= 5) {
    alerts.push({
      severity: "warning",
      title: "Nombre eleve de factures echues",
      message: `${overdueInflows.length} factures clients echue(s) non reglees. Lancez des relances.`,
    });
  }

  if (overdueOutflows.length > 0) {
    alerts.push({
      severity: "info",
      title: "Echeances fournisseurs en retard",
      message: `${overdueOutflows.length} facture(s) fournisseur(s) arrivee(s) a echeance.`,
      amount: round2(overdueOutflows.reduce((sum, item) => sum + item.remainingAmount, 0)),
    });
  }

  if (netCashFlow < 0) {
    alerts.push({
      severity: "warning",
      title: "Decaissements superieurs aux encaissements",
      message: `Flux de tresorerie previsionnel negatif de ${Math.abs(netCashFlow).toLocaleString("fr-FR")} MAD sur la periode.`,
      amount: netCashFlow,
    });
  }

  if (activeAccountCount === 0) {
    alerts.push({
      severity: "warning",
      title: "Aucun compte de tresorerie actif",
      message: "Creez un compte bancaire ou une caisse pour alimenter les previsions.",
    });
  }

  if (invoiceWithoutDueDateCount > 0) {
    alerts.push({
      severity: "info",
      title: "Factures sans echeance",
      message: `${invoiceWithoutDueDateCount} facture(s) sans date d'echeance : echeance estimee a 30 jours par defaut.`,
    });
  }

  return alerts;
}
