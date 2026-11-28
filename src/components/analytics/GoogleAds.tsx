"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import Script from "next/script";
import { marketingEventForHref, validMeasurementId, GOOGLE_TAGS_READY_EVENT } from "@/lib/analytics/public-analytics";
import { PUBLIC_SITE_ORIGIN } from "@/lib/public-site";
import {
  applyParentAdsConsent,
  configureGoogleTags,
  consumeSignupConversion,
  googleAdsId,
  googleTagScriptUrl,
  isGoogleAdsSurface,
  readStoredAdsChoice,
  trackWhatsAppAdsConversion,
} from "@/lib/analytics/google-ads";
import { activateMetaPixel, trackMetaEvent, trackMetaPageView } from "@/lib/analytics/meta-pixel";

const MEASUREMENT_ID = validMeasurementId(process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID);

function onGoogleTagsReady() {
  const choice = readStoredAdsChoice(window.localStorage);
  if (choice) applyParentAdsConsent(window, choice);
  configureGoogleTags(window, choice === "accepted" ? MEASUREMENT_ID : null);
  if (choice === "accepted") {
    if (activateMetaPixel(window, document)) trackMetaPageView(window);
    if (consumeSignupConversion(window, document, window.sessionStorage, window.localStorage)) {
      trackMetaEvent(window, "CompleteRegistration");
    }
  } else {
    consumeSignupConversion(window, document, window.sessionStorage, window.localStorage);
  }
  window.dispatchEvent(new Event(GOOGLE_TAGS_READY_EVENT));
}

function onPublicClick(event: MouseEvent) {
  const target = event.target;
  if (!(target instanceof Element)) return;
  const link = target.closest<HTMLAnchorElement>("a[href]");
  if (!link || marketingEventForHref(link.href, PUBLIC_SITE_ORIGIN) !== "whatsapp_click") return;
  if (readStoredAdsChoice(window.localStorage) !== "accepted") return;
  trackWhatsAppAdsConversion(window);
  trackMetaEvent(window, "Contact");
}

/** Loads a single gtag.js (Ads + GA4) on public pages, login and onboarding. The ERP does not load it. */
export function GoogleAds() {
  const pathname = usePathname();
  const enabled = Boolean(pathname && isGoogleAdsSurface(pathname));
  const id = googleAdsId();

  useEffect(() => {
    if (!enabled) return;
    onGoogleTagsReady();
    document.addEventListener("click", onPublicClick, true);
    return () => document.removeEventListener("click", onPublicClick, true);
  }, [enabled, pathname]);

  if (!enabled) return null;
  return <Script id="google-tags" src={googleTagScriptUrl(id)} strategy="afterInteractive" onLoad={onGoogleTagsReady} />;
}
