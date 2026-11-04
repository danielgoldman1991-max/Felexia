/**
 * Aide au calcul du solde de tout compte.
 * Indemnité de licenciement : article 53 du Code du travail, paliers 96/144/192/240 heures
 * par année, taux horaire = salaire mensuel / 191 (durée mensuelle usuelle pour 44 h).
 * Congés et préavis : journée = salaire mensuel / 26.
 * Le résultat est une préparation à faire valider par le conseil social. Aucun dépôt officiel.
 */

export type SettlementReason = "demission" | "licenciement" | "fin_cdd" | "faute_grave" | "retraite" | "autre";

export const SETTLEMENT_REASONS: Array<{ value: SettlementReason; label: string }> = [
  { value: "demission", label: "Démission" },
  { value: "licenciement", label: "Licenciement" },
  { value: "fin_cdd", label: "Fin de CDD" },
  { value: "faute_grave", label: "Faute grave" },
  { value: "retraite", label: "Retraite" },
  { value: "autre", label: "Autre motif" },
];

export type SettlementInput = {
  monthlySalary: number;
  hireDate: string;
  exitDate: string;
  reason: SettlementReason;
  remainingLeaveDays: number;
  noticeDays: number;
  noticePaid: boolean;
  lastNet: number;
  daysWorked?: number;
};

export type SettlementResult = {
  monthsOfService: number;
  yearsOfService: number;
  hourlyRate: number;
  dailyRate: number;
  dismissalHours: number;
  leaveIndemnity: number;
  noticeIndemnity: number;
  dismissalIndemnity: number;
  lastNet: number;
  salaryProrata: number;
  daysWorked: number;
  total: number;
  eligibleForDismissal: boolean;
  notes: string[];
};

const HOURLY_DIVISOR = 191;
const DAILY_DIVISOR = 26;
const BRACKETS = [
  { years: 5, hours: 96 },
  { years: 5, hours: 144 },
  { years: 5, hours: 192 },
  { years: Number.POSITIVE_INFINITY, hours: 240 },
] as const;

export function calendarMonths(hireDate: string, exitDate: string): number {
  const hire = parseUtc(hireDate);
  const exit = parseUtc(exitDate);
  if (!hire || !exit || exit < hire) return 0;
  let months = (exit.getUTCFullYear() - hire.getUTCFullYear()) * 12 + (exit.getUTCMonth() - hire.getUTCMonth());
  if (exit.getUTCDate() < hire.getUTCDate()) months -= 1;
  return Math.max(0, months);
}

export function computeFinalSettlement(input: SettlementInput): SettlementResult {
  const monthly = round2(Math.max(0, input.monthlySalary));
  const months = calendarMonths(input.hireDate, input.exitDate);
  const years = round2(months / 12);
  const hourly = round2(monthly / HOURLY_DIVISOR);
  const daily = monthly / DAILY_DIVISOR;
  const leaveDays = Math.max(0, input.remainingLeaveDays);
  const noticeDays = Math.max(0, input.noticeDays);
  const daysWorked = Math.max(0, input.daysWorked ?? 0);
  const leaveIndemnity = round2(leaveDays * daily);
  const noticeIndemnity = input.noticePaid ? 0 : round2(noticeDays * daily);
  const salaryProrata = round2(daysWorked * daily);
  const eligible = input.reason === "licenciement" && months >= 6;
  const dismissalHours = eligible ? round2(bracketHours(years)) : 0;
  const dismissalIndemnity = round2(dismissalHours * hourly);
  const lastNet = round2(Math.max(0, input.lastNet));
  const total = round2(leaveIndemnity + noticeIndemnity + dismissalIndemnity + lastNet + salaryProrata);
  const notes = [
    "Préparation interne. Elle ne remplace pas le reçu pour solde de tout compte signé ni l'avis du conseil social.",
    `Journée retenue : salaire mensuel / ${DAILY_DIVISOR}. Heure retenue : salaire mensuel / ${HOURLY_DIVISOR}.`,
  ];
  if (input.reason === "licenciement" && months < 6) notes.push("Ancienneté inférieure à six mois : indemnité de licenciement non calculée.");
  if (input.reason === "faute_grave") notes.push("La faute grave, si elle est établie, écarte en principe l'indemnité de licenciement et le préavis.");
  if (input.reason !== "licenciement") notes.push("L'indemnité de licenciement n'est calculée que pour le motif licenciement.");
  return {
    monthsOfService: months,
    yearsOfService: years,
    hourlyRate: hourly,
    dailyRate: round2(daily),
    dismissalHours,
    leaveIndemnity,
    noticeIndemnity,
    dismissalIndemnity,
    lastNet,
    salaryProrata,
    daysWorked,
    total,
    eligibleForDismissal: eligible,
    notes,
  };
}

function bracketHours(years: number): number {
  let remaining = Math.max(0, years);
  let hours = 0;
  for (const bracket of BRACKETS) {
    const slice = Math.min(remaining, bracket.years);
    if (slice <= 0) break;
    hours += slice * bracket.hours;
    remaining -= slice;
  }
  return hours;
}

function parseUtc(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function round2(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
