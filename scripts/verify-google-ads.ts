import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  adsConsentState,
  flushTrialConversion,
  freshTrialSignup,
  googleAdsConsentSource,
  googleAdsConversionSendTo,
  googleAdsId,
  isGoogleAdsSurface,
  queueTrialConversion,
  readSignupCookie,
  trialTransactionId,
} from "../src/lib/analytics/google-ads";

const id = "11111111-1111-4111-8111-111111111111";
assert.equal(googleAdsId(undefined), "AW-18492364232");
assert.equal(googleAdsId("AW-9"), "AW-9");
assert.equal(googleAdsId("G-TEST"), "AW-18492364232");
assert.equal(googleAdsConversionSendTo(), "AW-18492364232/7CimCP-S5rodEMir7PFE");
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

const memory = new Map<string, string>();
const storage = {
  getItem: (key: string) => memory.get(key) ?? null,
  setItem: (key: string, value: string) => { memory.set(key, value); },
  removeItem: (key: string) => { memory.delete(key); },
};
const calls: unknown[][] = [];
const browser = { gtag: (...args: unknown[]) => { calls.push(args); } } as unknown as Window;
assert.equal(queueTrialConversion("private@example.invalid", storage), false);
assert.equal(calls.length, 0);
assert.equal(queueTrialConversion(id, storage), true);
assert.equal(flushTrialConversion(browser, storage), true);
assert.deepEqual(calls[0], ["event", "conversion", { send_to: "AW-18492364232/7CimCP-S5rodEMir7PFE", value: 99.0, currency: "MAD", transaction_id: id }]);
assert.equal(flushTrialConversion(browser, storage), false);
assert.equal(queueTrialConversion(id, storage), false);
assert.equal(calls.length, 1);
assert.equal(readSignupCookie(`a=1; felexia_ads_signup=${id}`), id);
assert.equal(readSignupCookie("felexia_ads_signup=private@example.invalid"), null);

const layout = readFileSync("src/app/layout.tsx", "utf8");
const ads = readFileSync("src/components/analytics/GoogleAds.tsx", "utf8");
assert.match(layout, /strategy="beforeInteractive"/);
assert.match(ads, /strategy="afterInteractive"/);
assert.match(ads, /googletagmanager\.com\/gtag\/js\?id=/);
assert.match(readFileSync("src/components/auth/register-admin-form.tsx", "utf8"), /rememberTrialConversion\(signUpData\.user\.id, window\)/);
assert.equal(readFileSync("src/lib/auth-actions/signup.ts", "utf8").includes("signup="), false);
assert.doesNotMatch(readFileSync("next.config.mjs", "utf8"), /Content-Security-Policy/);

console.log("Google Ads : consentement refusé par défaut, conversion unique et surfaces publiques contrôlés.");
