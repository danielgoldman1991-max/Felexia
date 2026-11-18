import { ANALYTICS_CHOICE_KEY, parseAnalyticsChoice } from "@/lib/analytics/public-analytics";
import { isPublicSitePath } from "@/lib/public-site";

export const DEFAULT_GOOGLE_ADS_ID = "AW-18492364232";
export const GOOGLE_ADS_CONVERSION_LABEL = "7CimCP-S5rodEMir7PFE";
export const GOOGLE_ADS_SIGNUP_COOKIE = "felexia_ads_signup";
const PENDING_KEY = "felexia:ads-conversion-pending";
const FIRED_PREFIX = "felexia:ads-conversion:";
const SIGNUP_MAX_AGE_MS = 15 * 60 * 1000;

export type AdsConsentChoice = "accepted" | "refused" | null;
export type AdsConsentState = {
  ad_storage: "granted" | "denied";
  ad_user_data: "granted" | "denied";
  ad_personalization: "granted" | "denied";
  analytics_storage: "granted" | "denied";
};

type Gtag = (...args: unknown[]) => void;
type AdsWindow = Window & { gtag?: Gtag; dataLayer?: unknown[] };
type MemoryStorage = { getItem(key: string): string | null; setItem(key: string, value: string): void; removeItem(key: string): void };

export function googleAdsId(value = process.env.NEXT_PUBLIC_GOOGLE_ADS_ID) {
  return value && /^AW-\d+$/.test(value) ? value : DEFAULT_GOOGLE_ADS_ID;
}

export function googleAdsConversionSendTo(id = googleAdsId()) {
  return `${id}/${GOOGLE_ADS_CONVERSION_LABEL}`;
}

/** Consent Mode v2. Refusal and a missing choice stay denied. */
export function adsConsentState(choice: AdsConsentChoice): AdsConsentState {
  const value = choice === "accepted" ? "granted" : "denied";
  return {
    ad_storage: value,
    ad_user_data: value,
    ad_personalization: value,
    analytics_storage: value,
  };
}

export function isGoogleAdsSurface(pathname: string) {
  if (isPublicSitePath(pathname)) return true;
  const path = pathname.replace(/\/+$/, "") || "/";
  return path === "/login" || path.startsWith("/onboarding");
}

/** Technical account id only. Names, emails and other free text are rejected. */
export function trialTransactionId(value: string | null | undefined) {
  return value && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value) ? value.toLowerCase() : null;
}

export function freshTrialSignup(createdAt: string | null | undefined, now = Date.now()) {
  const created = createdAt ? Date.parse(createdAt) : Number.NaN;
  return Number.isFinite(created) && created <= now && now - created <= SIGNUP_MAX_AGE_MS;
}

/** Runs before gtag.js. Default storage is denied; a stored acceptance is applied immediately. */
export function googleAdsConsentSource() {
  return `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}window.gtag=window.gtag||gtag;gtag('consent','default',${JSON.stringify(adsConsentState(null))});try{var raw=localStorage.getItem(${JSON.stringify(ANALYTICS_CHOICE_KEY)});var choice=JSON.parse(raw);if(choice&&choice.version===1&&choice.analytics==='accepted'&&typeof choice.updatedAt==='number'&&Date.now()-choice.updatedAt>=0&&Date.now()-choice.updatedAt<15552000000){gtag('consent','update',${JSON.stringify(adsConsentState("accepted"))});}}catch(e){}`;
}

export function applyParentAdsConsent(browser: Window, choice: Exclude<AdsConsentChoice, null>) {
  const gtag = (browser as AdsWindow).gtag;
  if (typeof gtag !== "function") return false;
  gtag("consent", "update", adsConsentState(choice));
  return true;
}

export function readStoredAdsChoice(storage: { getItem(key: string): string | null }, now = Date.now()): AdsConsentChoice {
  try {
    return parseAnalyticsChoice(storage.getItem(ANALYTICS_CHOICE_KEY), now);
  } catch {
    return null;
  }
}

export function queueTrialConversion(transactionId: string, storage: MemoryStorage) {
  const id = trialTransactionId(transactionId);
  if (!id || storage.getItem(FIRED_PREFIX + id)) return false;
  storage.setItem(PENDING_KEY, id);
  return true;
}

export function flushTrialConversion(browser: Window, storage: MemoryStorage, sendTo = googleAdsConversionSendTo()) {
  const id = trialTransactionId(storage.getItem(PENDING_KEY));
  if (!id) {
    storage.removeItem(PENDING_KEY);
    return false;
  }
  if (storage.getItem(FIRED_PREFIX + id)) {
    storage.removeItem(PENDING_KEY);
    return false;
  }
  const gtag = (browser as AdsWindow).gtag;
  if (typeof gtag !== "function") return false;
  gtag("event", "conversion", { send_to: sendTo, value: 99.0, currency: "MAD", transaction_id: id });
  storage.setItem(FIRED_PREFIX + id, "1");
  storage.removeItem(PENDING_KEY);
  return true;
}

export function readSignupCookie(cookie: string) {
  const match = cookie.match(new RegExp(`(?:^|; )${GOOGLE_ADS_SIGNUP_COOKIE}=([^;]+)`));
  if (!match) return null;
  try {
    return trialTransactionId(decodeURIComponent(match[1]));
  } catch {
    return null;
  }
}
