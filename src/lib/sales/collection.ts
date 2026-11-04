import { summarizeAging, type AgingBucket } from "@/lib/sales/aged-receivables";

/** Nom lu comme sur les factures : third_parties.name via customer:customer_id, pas une colonne de customer_invoices. */
export function embeddedCustomerName(value: unknown, fallback = "Client") {
  const row = Array.isArray(value) ? value[0] : value;
  if (!row || typeof row !== "object") return fallback;
  const name = (row as { name?: unknown }).name;
  return typeof name === "string" && name.trim() ? name.trim() : fallback;
}

export function embeddedCustomerField(value: unknown, key: "email" | "phone" | "mobile") {
  const row = Array.isArray(value) ? value[0] : value;
  if (!row || typeof row !== "object") return null;
  const field = (row as Record<string, unknown>)[key];
  return typeof field === "string" && field.trim() ? field.trim() : null;
}
import { matchingReminderRule, type ReminderRuleMatch } from "@/lib/sales/reminder-schedule";

export type CollectionInvoice = {
  id: string;
  number: string;
  customerId: string;
  customerName: string;
  dueDate: string;
  invoiceDate?: string | null;
  remaining: number;
  total: number;
  email?: string | null;
  phone?: string | null;
};

export type CollectionRule = ReminderRuleMatch & {
  channel?: string | null;
  name?: string | null;
};

export type CollectionQueueItem = {
  invoice: CollectionInvoice;
  rule: CollectionRule;
  daysOverdue: number;
  subject: string;
  message: string;
};

const LEGAL_NOTICE = "Les délais de paiement entre professionnels sont encadrés, notamment par la loi n° 69-21, qui a réformé le dispositif issu de la loi n° 32-10. Toute pénalité dépend du contrat et des textes applicables. Ce message est un rappel de gestion : il ne constitue pas un conseil juridique.";

const ARABIC = [
  "نود تذكيركم بلطف بأن الفاتورة المذكورة لم تُسوَّ بعد. شكراً لثقتكم.",
  "نذكركم بأن أجل الأداء قد انقضى. نرجو تسوية المبلغ في أقرب الآجال.",
  "نرجو تسوية هذه الفاتورة دون مزيد من التأخير.",
  "هذه رسالة مطالبة بالأداء. هذه الصيغة لا تغني عن استشارة قانونية.",
];

export function daysOverdue(dueDate: string, today: string) {
  const due = Date.parse(`${dueDate}T00:00:00Z`);
  const now = Date.parse(`${today}T00:00:00Z`);
  if (Number.isNaN(due) || Number.isNaN(now)) return 0;
  return Math.floor((now - due) / 86_400_000);
}

export function daysSalesOutstanding(openAmount: number, periodSales: number, periodDays: number) {
  if (periodSales <= 0.009 || periodDays <= 0) return null;
  return Math.round((openAmount / periodSales) * periodDays);
}

export function collectionTotals(invoices: { dueDate: string | null; remaining: number; customer: string; id: string; number: string }[], today: string) {
  const summary = summarizeAging(invoices, today);
  const overdue = round2(summary.total - summary.totals.not_due - summary.totals.no_due);
  return { ...summary, overdue, buckets: summary.totals satisfies Record<AgingBucket, number> };
}

export function renderReminderMessage(input: {
  customerName: string;
  invoiceNumber: string;
  amount: number;
  dueDate: string;
  level: number;
  daysAfterDue: number;
  rib?: string | null;
  link?: string | null;
  template?: string | null;
  subjectTemplate?: string | null;
  arabic?: boolean;
}) {
  const amount = new Intl.NumberFormat("fr-MA", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(input.amount);
  const values: Record<string, string> = {
    client: input.customerName,
    facture: input.invoiceNumber,
    montant: `${amount} MAD`,
    echeance: input.dueDate,
    rib: input.rib || "le RIB indiqué sur la facture",
    lien: input.link || "la facture dans votre espace Felexia",
  };
  const fallback = defaultMessage(input.level, input.daysAfterDue);
  const subject = fill(input.subjectTemplate || fallback.subject, values);
  let message = fill(input.template || fallback.message, values);
  if (input.daysAfterDue >= 15 || input.level >= 3) message = `${message}\n\n${LEGAL_NOTICE}`;
  if (input.arabic) message = `${message}\n\n${ARABIC[Math.min(Math.max(input.level, 1), 4) - 1]}`;
  return { subject, message };
}

export function collectionQueue(input: {
  invoices: CollectionInvoice[];
  rules: CollectionRule[];
  today: string;
  sent?: { invoiceId: string; level: number }[];
  exclusions?: { customerId: string; until?: string | null }[];
  promises?: { customerId: string; invoiceId?: string | null; promisedOn: string }[];
  rib?: string | null;
  arabic?: boolean;
}): CollectionQueueItem[] {
  const sent = new Set((input.sent ?? []).map((item) => `${item.invoiceId}:${item.level}`));
  return input.invoices.flatMap((invoice) => {
    if (invoice.remaining <= 0.009 || !invoice.dueDate) return [];
    if (isExcluded(invoice.customerId, input.today, input.exclusions ?? [])) return [];
    if (hasPromise(invoice, input.today, input.promises ?? [])) return [];
    const late = daysOverdue(invoice.dueDate, input.today);
    const matched = matchingReminderRule(input.rules, late);
    const rule = matched ? input.rules.find((item) => item.id === matched.id) : null;
    if (!rule || sent.has(`${invoice.id}:${rule.level}`)) return [];
    const target = Date.parse(`${invoice.dueDate}T00:00:00Z`) + rule.daysAfterDue * 86_400_000;
    if (Date.parse(`${input.today}T00:00:00Z`) < target) return [];
    const rendered = renderReminderMessage({
      customerName: invoice.customerName,
      invoiceNumber: invoice.number,
      amount: invoice.remaining,
      dueDate: invoice.dueDate,
      level: rule.level,
      daysAfterDue: rule.daysAfterDue,
      rib: input.rib,
      template: rule.message,
      subjectTemplate: rule.subject,
      arabic: input.arabic,
    });
    return [{ invoice, rule, daysOverdue: late, ...rendered }];
  });
}

export function whatsAppLink(phone: string, text: string) {
  let digits = phone.replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.startsWith("0")) digits = `212${digits.slice(1)}`;
  if (!digits) return null;
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}

export const DEFAULT_COLLECTION_SCENARIOS = [
  { name: "Avant échéance", daysAfterDue: -3, level: 1, channel: "email", subject: "Échéance proche — facture {{facture}}", message: "Bonjour {{client}},\n\nLa facture {{facture}} de {{montant}} arrive à échéance le {{echeance}}. Vous pouvez la consulter ici : {{lien}}.\n\nRIB : {{rib}}.\n\nBien cordialement." },
  { name: "Premier rappel", daysAfterDue: 7, level: 2, channel: "email", subject: "Rappel — facture {{facture}}", message: "Bonjour {{client}},\n\nSauf erreur de notre part, la facture {{facture}} de {{montant}} reste ouverte depuis le {{echeance}}. Merci de nous indiquer la date de règlement, ou de nous signaler un désaccord.\n\nRIB : {{rib}}.\n\nBien cordialement." },
  { name: "Relance ferme", daysAfterDue: 15, level: 3, channel: "email", subject: "Relance — facture {{facture}} impayée", message: "Bonjour {{client}},\n\nLa facture {{facture}} de {{montant}} est impayée depuis le {{echeance}}. Merci de régulariser cette somme ou de nous confirmer un échéancier.\n\nRIB : {{rib}}." },
  { name: "Mise en demeure", daysAfterDue: 30, level: 4, channel: "letter", subject: "Mise en demeure — facture {{facture}}", message: "Bonjour {{client}},\n\nNous vous mettons en demeure de régler la facture {{facture}} de {{montant}}, échue le {{echeance}}. À défaut de règlement ou d’un accord écrit, nous nous réservons le droit de confier le dossier à notre conseil.\n\nRIB : {{rib}}." },
];

function defaultMessage(level: number, daysAfterDue: number) {
  const scenario = DEFAULT_COLLECTION_SCENARIOS.find((item) => item.level === level)
    ?? DEFAULT_COLLECTION_SCENARIOS.find((item) => item.daysAfterDue === daysAfterDue)
    ?? DEFAULT_COLLECTION_SCENARIOS[1];
  return { subject: scenario.subject, message: scenario.message };
}

function fill(template: string, values: Record<string, string>) {
  return template.replace(/\{\{\s*(client|facture|montant|echeance|rib|lien)\s*\}\}/g, (_, key: string) => values[key] ?? "");
}

function isExcluded(customerId: string, today: string, exclusions: { customerId: string; until?: string | null }[]) {
  return exclusions.some((item) => item.customerId === customerId && (!item.until || item.until >= today));
}

function hasPromise(invoice: CollectionInvoice, today: string, promises: { customerId: string; invoiceId?: string | null; promisedOn: string }[]) {
  return promises.some((item) => item.promisedOn >= today && (item.invoiceId === invoice.id || (!item.invoiceId && item.customerId === invoice.customerId)));
}

function round2(value: number) {
  return Math.round(value * 100) / 100;
}
