export const DEFAULT_TRIAL_MONTHS = 1;
export const DEFAULT_TRIAL_LABEL = "Essai Essentiel";
export const DEFAULT_TRIAL_DURATION_LABEL = "1 mois";
export const DEFAULT_TRIAL_MARKETING_MESSAGE =
  "Votre essai Essentiel est actif pendant 1 mois. Passez à Business ou Premium à tout moment.";

export function getDefaultTrialEndDate(startDate = new Date()): Date {
  const trialEnd = new Date(startDate);
  trialEnd.setMonth(trialEnd.getMonth() + DEFAULT_TRIAL_MONTHS);
  return trialEnd;
}

export const BUSINESS_TRIAL_MONTHS = 3;
export const BUSINESS_TRIAL_DAYS_FALLBACK = 90;
export const BUSINESS_TRIAL_LABEL = "Business spécial lancement";
export const BUSINESS_TRIAL_DURATION_LABEL = "3 mois";
export const BUSINESS_TRIAL_MARKETING_MESSAGE =
  "Votre essai Business spécial lancement est actif pendant 3 mois.";

export function getBusinessTrialEndDate(startDate = new Date()): Date {
  const trialEnd = new Date(startDate);
  trialEnd.setMonth(trialEnd.getMonth() + BUSINESS_TRIAL_MONTHS);
  return trialEnd;
}
