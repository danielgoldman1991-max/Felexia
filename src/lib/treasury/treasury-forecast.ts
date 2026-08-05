import type { SupabaseClient } from "@supabase/supabase-js";

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
  const parsed = typeof value === "number" ? value : Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export function addDays(dateString: string, days: number): string {
  const date = new Date(`${dateString}T00:00:00`);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

export function formatForecastDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function eachDay(from: string, to: string): string[] {
  const days: string[] = [];
  const cursor = new Date(`${from}T00:00:00`);
  const end = new Date(`${to}T00:00:00`);
  while (cursor <= end) {
    days.push(formatForecastDate(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return days;
}

function scenarioProbability(probability: number, direction: "inflow" | "outflow", scenario: TreasuryForecastScenario): number {
  if (scenario === "prudent") return direction === "inflow" ? probability * 0.7 : 1;
  if (scenario === "optimistic") return direction === "inflow" ? 1 : probability;
  return probability;
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
  const {
    from,
    to,
    scenario = "realistic",
    includeOverdue = true,
    includeManualItems = true,
    treasuryAccountId = null,
    direction = "all",
  } = options;

  let accountQuery = supabase
    .from("treasury_accounts")
    .select("id, name, current_balance, status")
    .eq("organization_id", organizationId)
    .eq("status", "active")
    .is("archived_at", null);
  if (treasuryAccountId) accountQuery = accountQuery.eq("id", treasuryAccountId);
  const { data: accounts } = await accountQuery;
  const accountRows = (accounts ?? []) as Array<{ id: string; name: string; current_balance: number | string | null; status: string }>;
  const openingBalance = round2(accountRows.reduce((sum, account) => sum + toNumber(account.current_balance), 0));
  const accountName = treasuryAccountId ? (accountRows[0]?.name ?? null) : null;

  const [customerResult, supplierResult, manualResult] = await Promise.all([
    supabase
      .from("customer_invoices")
      .select("id, invoice_number, status, due_date, invoice_date, remaining_amount, total_ttc, currency, customer:customer_id (name)")
      .eq("organization_id", organizationId)
      .is("archived_at", null)
      .in("status", CUSTOMER_OPEN_STATUSES)
      .gt("remaining_amount", 0),
    supabase
      .from("supplier_invoices")
      .select("id, invoice_number, supplier_invoice_number, status, due_date, invoice_date, remaining_amount, total_ttc, currency, supplier:supplier_id (name)")
      .eq("organization_id", organizationId)
      .is("archived_at", null)
      .in("status", SUPPLIER_OPEN_STATUSES)
      .gt("remaining_amount", 0),
    includeManualItems
      ? supabase
          .from("treasury_forecast_items")
          .select("*")
          .eq("organization_id", organizationId)
          .is("archived_at", null)
          .not("status", "in", '("cancelled","ignored")')
          .gte("forecast_date", from)
          .lte("forecast_date", to)
      : Promise.resolve({ data: null, error: null }),
  ]);

  if (customerResult.error) throw new Error(customerResult.error.message);
  if (supplierResult.error) throw new Error(supplierResult.error.message);

  // The forecast_items table may not exist yet in some environments (migration pending):
  // degrade gracefully to zero manual items instead of crashing the whole forecast.
  let manualRows: ManualForecastRow[] = [];
  if (manualResult.error) {
    if (manualResult.error.message.includes("does not exist") || manualResult.error.message.includes("schema cache")) {
      console.warn("[treasury-forecast] treasury_forecast_items table missing, manual items skipped");
    } else {
      throw new Error(manualResult.error.message);
    }
  } else {
    manualRows = (manualResult.data ?? []) as ManualForecastRow[];
  }

  const customerRows = (customerResult.data ?? []) as CustomerInvoiceRow[];
  const supplierRows = (supplierResult.data ?? []) as SupplierInvoiceRow[];

  let invoiceWithoutDueDateCount = 0;
  const items: TreasuryForecastItem[] = [];

  for (const row of customerRows) {
    const remaining = toNumber(row.remaining_amount);
    if (remaining <= 0) continue;
    const dueDate = row.due_date ?? addDays(row.invoice_date, 30);
    if (!row.due_date) invoiceWithoutDueDateCount += 1;
    const isOverdue = row.due_date ? row.due_date < from : false;
    if (isOverdue && !includeOverdue) continue;
    const probability = isOverdue ? 70 : 100;
    const item: TreasuryForecastItem = {
      id: `customer_invoice:${row.id}`,
      sourceType: "customer_invoice",
      sourceId: row.id,
      direction: "inflow",
      label: `Facture ${row.invoice_number}`,
      thirdPartyName: row.customer_name ?? null,
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
    if (!row.due_date) invoiceWithoutDueDateCount += 1;
    const isOverdue = row.due_date ? row.due_date < from : false;
    if (isOverdue && !includeOverdue) continue;
    const item: TreasuryForecastItem = {
      id: `supplier_invoice:${row.id}`,
      sourceType: "supplier_invoice",
      sourceId: row.id,
      direction: "outflow",
      label: `Facture ${row.invoice_number}`,
      thirdPartyName: row.supplier_name ?? null,
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

  const itemsOnDay = (day: string) =>
    items.filter((item) => placeDay(item.dueDate) === day && (direction === "all" || item.direction === direction));

  for (const day of days) {
    const dayItems = itemsOnDay(day);
    const dayInflows = dayItems
      .filter((item) => item.direction === "inflow")
      .reduce((sum, item) => sum + item.weightedAmount, 0);
    const dayOutflows = dayItems
      .filter((item) => item.direction === "outflow")
      .reduce((sum, item) => sum + item.weightedAmount, 0);
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

  return {
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
