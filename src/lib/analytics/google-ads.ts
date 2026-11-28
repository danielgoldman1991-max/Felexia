import { ANALYTICS_CHOICE_KEY, parseAnalyticsChoice } from "@/lib/analytics/public-analytics";
import { isPublicSitePath } from "@/lib/public-site";

export const DEFAULT_GOOGLE_ADS_ID = "AW-18492364232";
export const GOOGLE_ADS_CONVERSION_LABEL = "7CimCP-S5rodEMir7PFE";
export const GOOGLE_ADS_SIGNUP_COOKIE = "felexia_ads_signup";
export const SIGNUP_COOKIE_MAX_AGE_SECONDS = 300;
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
type AdsWindow = Window & { gtag?: Gtag; dataLayer?: unknown[]; localStorage?: MemoryStorage; document?: { cookie: string }; location?: { protocol?: string } };
type MemoryStorage = { getItem(key: string): string | null; setItem(key: string, value: string): void; removeItem(key: string): void };
type CookieJar = { cookie: string };

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

export function signupCookieWrite(transactionId: string, secure: boolean) {
  const id = trialTransactionId(transactionId);
  if (!id) return "";
  return `${GOOGLE_ADS_SIGNUP_COOKIE}=${encodeURIComponent(id)}; Max-Age=${SIGNUP_COOKIE_MAX_AGE_SECONDS}; Path=/; SameSite=Lax${secure ? "; Secure" : ""}`;
}

export function signupCookieClear(secure: boolean) {
  return `${GOOGLE_ADS_SIGNUP_COOKIE}=; Max-Age=0; Path=/; SameSite=Lax${secure ? "; Secure" : ""}`;
}

export function writeSignupCookie(transactionId: string, doc: CookieJar, secure: boolean) {
  const value = signupCookieWrite(transactionId, secure);
  if (!value) return false;
  doc.cookie = value;
  return true;
}

export function clearSignupCookie(doc: CookieJar, secure: boolean) {
  doc.cookie = signupCookieClear(secure);
}

export function isSecurePage(browser: { location?: { protocol?: string } } | undefined) {
  return browser?.location?.protocol === "https:";
}

export function queueTrialConversion(transactionId: string, storage: MemoryStorage) {
  const id = trialTransactionId(transactionId);
  if (!id || storage.getItem(FIRED_PREFIX + id)) return false;
  storage.setItem(PENDING_KEY, id);
  return true;
}

/** Stores the signup cookie and a same-tab pending flag. Does not send the tag: the destination page flushes after navigation. */
export function rememberTrialConversion(transactionId: string, browser: Window | undefined) {
  try {
    const storage = browser?.sessionStorage;
    if (!storage) return false;
    const id = trialTransactionId(transactionId);
    if (!id) return false;
    const doc = (browser as AdsWindow).document;
    if (doc) writeSignupCookie(id, doc, isSecurePage(browser));
    return queueTrialConversion(id, storage);
  } catch {
    return false;
  }
}

/** Sends the conversion only after a stored acceptance. Denied or missing consent keeps the pending id. */
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
  const localStorage = (browser as AdsWindow).localStorage;
  if (!localStorage || readStoredAdsChoice(localStorage) !== "accepted") return false;
  const gtag = (browser as AdsWindow).gtag;
  if (typeof gtag !== "function") return false;
  gtag("event", "conversion", { send_to: sendTo, value: 99.0, currency: "MAD", transaction_id: id });
  storage.setItem(FIRED_PREFIX + id, "1");
  storage.removeItem(PENDING_KEY);
  return true;
}

/** Queues a signup cookie if present, then flushes only when consent is accepted. The cookie is cleared only after a successful send. */
export function consumeSignupConversion(browser: Window, doc: CookieJar, session: MemoryStorage, local: MemoryStorage) {
  const fromCookie = readSignupCookie(doc.cookie);
  if (fromCookie) queueTrialConversion(fromCookie, session);
  const current = typeof browser.location?.href === "string" ? new URL(browser.location.href) : null;
  if (current) {
    const fromQuery = current.searchParams.get("signup");
    if (fromQuery) {
      queueTrialConversion(fromQuery, session);
      current.searchParams.delete("signup");
      const next = current.pathname + (current.searchParams.size ? `?${current.searchParams.toString()}` : "") + current.hash;
      browser.history?.replaceState(browser.history.state, "", next);
    }
  }
  const choice = readStoredAdsChoice(local);
  if (choice) applyParentAdsConsent(browser, choice);
  const fired = flushTrialConversion(browser, session);
  if (fired) clearSignupCookie(doc, isSecurePage(browser));
  return fired;
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

export const GOOGLE_TAGS_SCRIPT_ORIGIN = "https://www.googletagmanager.com/gtag/js?id=";

/** Conversion label for a WhatsApp click. Empty or malformed values stay disabled. */
export function googleAdsWhatsAppLabel(value = process.env.NEXT_PUBLIC_GOOGLE_ADS_WHATSAPP_LABEL) {
  const label = value?.trim() ?? "";
  return /^[A-Za-z0-9_-]{8,64}$/.test(label) ? label : null;
}

export function googleAdsWhatsAppSendTo(id = googleAdsId(), label = googleAdsWhatsAppLabel()) {
  return label ? `${id}/${label}` : null;
}

export function googleTagScriptUrl(id = googleAdsId()) {
  return `${GOOGLE_TAGS_SCRIPT_ORIGIN}${id}`;
}

export function configureGoogleTags(browser: Window, measurementId?: string | null) {
  const gtag = (browser as AdsWindow).gtag;
  if (typeof gtag !== "function") return false;
  gtag("config", googleAdsId());
  if (measurementId) {
    gtag("config", measurementId, {
      send_page_view: false,
      allow_google_signals: false,
      allow_ad_personalization_signals: false,
    });
  }
  return true;
}

export function trackGoogleAdsConversion(browser: Window, sendTo: string | null) {
  if (!sendTo) return false;
  const local = (browser as AdsWindow).localStorage;
  if (!local || readStoredAdsChoice(local) !== "accepted") return false;
  const gtag = (browser as AdsWindow).gtag;
  if (typeof gtag !== "function") return false;
  gtag("event", "conversion", { send_to: sendTo });
  return true;
}

export function trackWhatsAppAdsConversion(browser: Window) {
  return trackGoogleAdsConversion(browser, googleAdsWhatsAppSendTo());
}
