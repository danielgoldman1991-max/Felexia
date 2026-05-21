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
