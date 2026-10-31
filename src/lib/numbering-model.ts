import type { NumberingCounter, NumberingGroup } from "@/lib/numbering-types";

export const MAX_NUMBERING_VALUE = 2_147_483_646;
export const NUMBERING_ADMIN_ERROR = "Seul un administrateur peut corriger les compteurs de l’entreprise.";
export const NUMBERING_ACTIVATION_MESSAGE = "Le réglage des compteurs doit être activé par l’équipe Felexia.";

const lightKeys = new Set(["customer_invoice", "supplier_invoice", "customer_payment", "supplier_payment", "customer_credit_note", "supplier_credit_note", "customer", "supplier"]);
const fullKeys = new Set([...lightKeys, "customer_reminder", "sales_quote", "sales_order", "sales_delivery", "sales_return", "purchase_order", "purchase_receipt", "prospect"]);
const groups = new Set<NumberingGroup>(["sales", "purchases", "contacts", "accounting", "other"]);

export function isNumberingCounterAllowed(key: string, fullAccess: boolean) {
  return (fullAccess ? fullKeys : lightKeys).has(key) || /^journal:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(key);
}

export function currentNumberingPeriod(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Casablanca", year: "numeric", month: "2-digit" }).formatToParts(now);
  return `${parts.find((part) => part.type === "year")!.value}-${parts.find((part) => part.type === "month")!.value}`;
}

export function parseNumberingPeriod(value: unknown): string | null {
  if (typeof value !== "string" || !/^(19\d{2}|20\d{2}|21\d{2})-(0[1-9]|1[0-2])$/.test(value)) return null;
  return value;
}

export function numberingPeriodLabel(period: string) {
  return new Intl.DateTimeFormat("fr-MA", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${period}-01T12:00:00Z`));
}

function integer(value: unknown, min = 0): number {
  if (typeof value !== "number" && !(typeof value === "string" && /^\d+$/.test(value))) throw new Error("Réponse de numérotation invalide.");
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < min) throw new Error("Réponse de numérotation invalide.");
  return parsed;
}

export function toNumberingCounter(value: unknown): NumberingCounter {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Réponse de numérotation invalide.");
  const row = value as Record<string, unknown>;
  const key = String(row.counter_key ?? "");
  const prefix = String(row.prefix ?? "");
  const revision = String(row.revision ?? "");
  const label = String(row.label ?? "");
  if (!isNumberingCounterAllowed(key, true) || !label || !prefix || !/^[a-f0-9]{32}$/.test(revision)) throw new Error("Réponse de numérotation invalide.");
  const nextNumber = integer(row.next_number, 1);
  const minNextNumber = integer(row.minimum_next_number, 1);
  const numberWidth = integer(row.padding, 1);
  if (numberWidth > 10) throw new Error("Format de numérotation invalide.");
  const exhausted = row.is_exhausted === true || minNextNumber > MAX_NUMBERING_VALUE;
  const rawGroup = String(row.group_key) as NumberingGroup;
  return {
    key, label, prefix, revision,
    group: groups.has(rawGroup) ? rawGroup : "other",
    periodLabel: String(row.period_label ?? ""),
    resetPeriod: row.reset_period === "yearly" ? "yearly" : "monthly",
    nextNumber, minNextNumber, maxNextNumber: MAX_NUMBERING_VALUE,
    lastUsedNumber: typeof row.last_document_number === "string" ? row.last_document_number : null,
    lastUsedValue: row.max_used_number == null ? null : integer(row.max_used_number),
    nextExample: typeof row.next_document_number === "string" ? row.next_document_number : `${prefix}${String(nextNumber).padStart(numberWidth, "0")}`,
    numberPattern: `${prefix}{NUMBER}`,
    numberWidth,
    editable: !exhausted,
    issue: exhausted ? "Ce compteur a atteint sa limite. Contactez l’équipe Felexia." : nextNumber > MAX_NUMBERING_VALUE ? "Le compteur actuel dépasse sa limite. Corrigez-le en choisissant un numéro dans la plage disponible." : null,
    description: key.startsWith("journal:") ? "Compteur annuel du journal" : "Compteur indépendant pour chaque mois",
  };
}

export function isNumberingMigrationMissing(error: { code?: string; message?: string } | null | undefined) {
  return error?.code === "PGRST202" || (error?.code === "42883" && /numbering_counter/.test(error.message ?? ""));
}

export function numberingErrorMessage(error: { code?: string; message?: string }) {
  const message = error.message ?? "";
  if (isNumberingMigrationMissing(error)) return NUMBERING_ACTIVATION_MESSAGE;
  if (/STALE|REVISION|CONFLICT/.test(message)) return "Le compteur a changé depuis votre ouverture, probablement après la création d’un document. Actualisez la page puis réessayez.";
  if (/BELOW|COLLISION|ALREADY_USED|MINIMUM/.test(message)) return "Ce numéro risque de réutiliser un numéro déjà attribué. Choisissez un numéro au moins égal au minimum indiqué.";
  if (/REASON/.test(message)) return "Indiquez le motif de cette correction (au moins 5 caractères).";
  if (error.code === "42501" || /FORBIDDEN|ADMIN|MEMBER|UNAUTHORIZED/.test(message)) return NUMBERING_ADMIN_ERROR;
  if (/RANGE|EXHAUST|INVALID|PERIOD|UNKNOWN/.test(message)) return "Vérifiez le type de document, la période et le prochain numéro saisis.";
  return "La correction n’a pas pu être enregistrée. Actualisez les compteurs puis réessayez.";
}
