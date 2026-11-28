import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ANALYTICS_CHOICE_KEY } from "../src/lib/analytics/public-analytics";
import {
  adsConsentState,
  consumeSignupConversion,
  flushTrialConversion,
  freshTrialSignup,
  googleAdsConsentSource,
  googleAdsConversionSendTo,
  googleAdsId,
  isGoogleAdsSurface,
  queueTrialConversion,
  readSignupCookie,
  rememberTrialConversion,
  SIGNUP_COOKIE_MAX_AGE_SECONDS,
  signupCookieClear,
  signupCookieWrite,
  trialTransactionId,
} from "../src/lib/analytics/google-ads";

const id = "11111111-1111-4111-8111-111111111111";
assert.equal(googleAdsId(undefined), "AW-18492364232");
assert.equal(googleAdsId("AW-9"), "AW-9");
assert.equal(googleAdsId("G-TEST"), "AW-18492364232");
assert.equal(googleAdsConversionSendTo(), "AW-18492364232/7CimCP-S5rodEMir7PFE");
assert.equal(SIGNUP_COOKIE_MAX_AGE_SECONDS, 300);
assert.deepEqual(adsConsentState(null), { ad_storage: "denied", ad_user_data: "denied", ad_personalization: "denied", analytics_storage: "denied" });
assert.deepEqual(adsConsentState("refused"), adsConsentState(null));
assert.equal(adsConsentState("accepted").ad_storage, "granted");
assert.equal(adsConsentState("accepted").ad_user_data, "granted");
assert.equal(adsConsentState("accepted").analytics_storage, "granted");

const consent = googleAdsConsentSource();
assert.match(consent, /gtag\('consent','default',\{"ad_storage":"denied"/);
assert.match(consent, /ad_user_data":"denied"/);
assert.doesNotMatch(consent, /@|email|nom/i);
assert.equal(isGoogleAdsSurface("/"), true);
assert.equal(isGoogleAdsSurface("/essentiel"), true);
assert.equal(isGoogleAdsSurface("/login"), true);
assert.equal(isGoogleAdsSurface("/onboarding/entreprise"), true);
assert.equal(isGoogleAdsSurface("/dashboard"), false);
assert.equal(trialTransactionId("private@example.invalid"), null);
assert.equal(trialTransactionId(id), id);
assert.equal(freshTrialSignup(new Date().toISOString()), true);
assert.equal(freshTrialSignup(new Date(Date.now() - 60 * 60 * 1000).toISOString()), false);

assert.equal(
  signupCookieWrite(id, true),
  `felexia_ads_signup=${id}; Max-Age=300; Path=/; SameSite=Lax; Secure`,
);
assert.equal(signupCookieWrite("private@example.invalid", true), "");
assert.match(signupCookieClear(true), /Max-Age=0; Path=\/; SameSite=Lax; Secure/);
assert.doesNotMatch(signupCookieWrite(id, true), /Domain=/);

function memoryStorage() {
  const memory = new Map<string, string>();
  return {
    getItem: (key: string) => memory.get(key) ?? null,
    setItem: (key: string, value: string) => { memory.set(key, value); },
    removeItem: (key: string) => { memory.delete(key); },
    raw: memory,
  };
}

function acceptedLocalStorage() {
  const storage = memoryStorage();
  storage.setItem(ANALYTICS_CHOICE_KEY, JSON.stringify({ version: 1, analytics: "accepted", updatedAt: Date.now() }));
  return storage;
}

const session = memoryStorage();
const calls: unknown[][] = [];
const jar = { cookie: "" };
const browser = {
  gtag: (...args: unknown[]) => { calls.push(args); },
  localStorage: memoryStorage(),
  sessionStorage: session,
  document: jar,
  location: { protocol: "https:", href: "https://www.felexia.pro/onboarding/entreprise" },
  history: { state: null, replaceState() {} },
} as unknown as Window;

assert.equal(queueTrialConversion("private@example.invalid", session), false);
assert.equal(calls.length, 0);
assert.equal(queueTrialConversion(id, session), true);
assert.equal(flushTrialConversion(browser, session), false, "no send without accepted consent");
assert.equal(calls.length, 0);
assert.equal(session.getItem("felexia:ads-conversion-pending"), id);

(browser as unknown as { localStorage: ReturnType<typeof memoryStorage> }).localStorage = acceptedLocalStorage();
assert.equal(flushTrialConversion(browser, session), true);
assert.deepEqual(calls[0], ["event", "conversion", { send_to: "AW-18492364232/7CimCP-S5rodEMir7PFE", value: 99.0, currency: "MAD", transaction_id: id }]);
assert.equal(flushTrialConversion(browser, session), false);
assert.equal(queueTrialConversion(id, session), false);
assert.equal(calls.length, 1);
assert.equal(readSignupCookie(`a=1; felexia_ads_signup=${id}`), id);
assert.equal(readSignupCookie("felexia_ads_signup=private@example.invalid"), null);

const emailSession = memoryStorage();
const emailJar = { cookie: "" };
const emailBrowser = {
  sessionStorage: emailSession,
  document: emailJar,
  location: { protocol: "https:" },
} as unknown as Window;
assert.equal(rememberTrialConversion(id, emailBrowser), true);
assert.match(emailJar.cookie, /felexia_ads_signup=11111111-1111-4111-8111-111111111111; Max-Age=300; Path=\/; SameSite=Lax; Secure/);
assert.equal(emailSession.getItem("felexia:ads-conversion-pending"), id);
assert.equal(calls.length, 1, "email signup must not fire gtag before the destination page");

const onboardingSession = memoryStorage();
const onboardingJar = { cookie: emailJar.cookie };
const onboardingCalls: unknown[][] = [];
const deniedLocal = memoryStorage();
const acceptedLocal = acceptedLocalStorage();
const onboardingBrowser = {
  gtag: (...args: unknown[]) => { onboardingCalls.push(args); },
  localStorage: deniedLocal,
  location: { protocol: "https:", href: "https://www.felexia.pro/onboarding/entreprise" },
  history: { state: null, replaceState() {} },
} as unknown as Window;
assert.equal(consumeSignupConversion(onboardingBrowser, onboardingJar, onboardingSession, deniedLocal), false);
assert.match(onboardingJar.cookie, /felexia_ads_signup=/, "cookie stays when consent is missing");
assert.equal(onboardingCalls.length, 0);

(onboardingBrowser as unknown as { localStorage: typeof acceptedLocal }).localStorage = acceptedLocal;
assert.equal(consumeSignupConversion(onboardingBrowser, onboardingJar, onboardingSession, acceptedLocal), true);
assert.deepEqual(onboardingCalls.find((item) => item[0] === "event"), ["event", "conversion", { send_to: "AW-18492364232/7CimCP-S5rodEMir7PFE", value: 99.0, currency: "MAD", transaction_id: id }]);
assert.match(onboardingJar.cookie, /Max-Age=0/, "cookie is cleared only after a successful send");
assert.equal(consumeSignupConversion(onboardingBrowser, onboardingJar, onboardingSession, acceptedLocal), false);
assert.equal(onboardingCalls.filter((item) => item[0] === "event").length, 1);

const layout = readFileSync("src/app/layout.tsx", "utf8");
const ads = readFileSync("src/components/analytics/GoogleAds.tsx", "utf8");
assert.match(layout, /strategy="beforeInteractive"/);
assert.match(ads, /strategy="afterInteractive"/);
assert.match(ads, /googletagmanager\.com\/gtag\/js\?id=/);
assert.match(ads, /consumeSignupConversion/);
assert.doesNotMatch(ads, /Max-Age=0; Path=\/; SameSite=Lax`;/);
assert.match(readFileSync("src/components/auth/register-admin-form.tsx", "utf8"), /rememberTrialConversion\(signUpData\.user\.id, window\)/);
assert.match(readFileSync("src/components/analytics/PublicAnalytics.tsx", "utf8"), /consumeSignupConversion/);
assert.match(readFileSync("src/app/auth/callback/route.ts", "utf8"), /maxAge: 300/);
assert.match(readFileSync("src/app/auth/callback/route.ts", "utf8"), /GOOGLE_ADS_SIGNUP_COOKIE/);
assert.equal(readFileSync("src/lib/auth-actions/signup.ts", "utf8").includes("signup="), false);
assert.doesNotMatch(readFileSync("next.config.mjs", "utf8"), /Content-Security-Policy/);
assert.doesNotMatch(readFileSync("src/components/landing/LandingEssentiel.tsx", "utf8"), /<title/);

console.log("Google Ads : cookie d’inscription, consentement requis, conversion unique et surfaces publiques contrôlés.");
