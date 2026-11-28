"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import Script from "next/script";
import {
  consumeSignupConversion,
  googleAdsId,
  isGoogleAdsSurface,
} from "@/lib/analytics/google-ads";

function consumeSignupMarkers() {
  consumeSignupConversion(window, document, window.sessionStorage, window.localStorage);
}

/** Loads the Ads tag on public pages, login and onboarding. The ERP does not load it. */
export function GoogleAds() {
  const pathname = usePathname();
  const enabled = Boolean(pathname && isGoogleAdsSurface(pathname));
  const id = googleAdsId();

  useEffect(() => {
    if (enabled) consumeSignupMarkers();
  }, [enabled, pathname]);

  if (!enabled) return null;
  return (
    <>
      <Script id="google-ads-config" strategy="afterInteractive">{`window.gtag&&window.gtag('config',${JSON.stringify(id)});`}</Script>
      <Script src={`https://www.googletagmanager.com/gtag/js?id=${id}`} strategy="afterInteractive" onLoad={consumeSignupMarkers} />
    </>
  );
}
