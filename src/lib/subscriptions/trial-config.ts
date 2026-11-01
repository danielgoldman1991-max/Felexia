export const DEFAULT_TRIAL_DAYS = 15;
export const DEFAULT_TRIAL_LABEL = "Essai Essentiel";
export const DEFAULT_TRIAL_DURATION_LABEL = `${DEFAULT_TRIAL_DAYS} jours`;
export const DEFAULT_TRIAL_MARKETING_MESSAGE =
  `Votre essai Essentiel est actif pendant ${DEFAULT_TRIAL_DURATION_LABEL}.`;

function addTrialMonths(startDate: Date, months: number): Date {
  const trialEnd = new Date(startDate);
  const day = trialEnd.getUTCDate();
  // Move through day 1 so 31 October + 1 month clamps to 30 November.
  trialEnd.setUTCDate(1);
  trialEnd.setUTCMonth(trialEnd.getUTCMonth() + months);
  const lastDay = new Date(Date.UTC(trialEnd.getUTCFullYear(), trialEnd.getUTCMonth() + 1, 0)).getUTCDate();
  trialEnd.setUTCDate(Math.min(day, lastDay));
  return trialEnd;
}

export function getDefaultTrialEndDate(startDate = new Date()): Date {
  return new Date(startDate.getTime() + DEFAULT_TRIAL_DAYS * 24 * 60 * 60 * 1_000);
}

export const BUSINESS_TRIAL_MONTHS = 3;
export const BUSINESS_TRIAL_DAYS_FALLBACK = 90;
export const BUSINESS_TRIAL_LABEL = "Business spécial lancement";
export const BUSINESS_TRIAL_DURATION_LABEL = "3 mois";
export const BUSINESS_TRIAL_MARKETING_MESSAGE =
  "Votre essai Business spécial lancement est actif pendant 3 mois.";

export function getBusinessTrialEndDate(startDate = new Date()): Date {
  return addTrialMonths(startDate, BUSINESS_TRIAL_MONTHS);
}
