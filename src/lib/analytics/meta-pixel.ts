/** Meta Pixel. Empty or invalid IDs stay disabled: no identifier is invented. */

export const META_PIXEL_SCRIPT = "https://connect.facebook.net/en_US/fbevents.js";

type Fbq = ((...args: unknown[]) => void) & { callMethod?: (...args: unknown[]) => void; queue?: unknown[]; loaded?: boolean; version?: string; push?: (...args: unknown[]) => void };
type PixelWindow = Window & { fbq?: Fbq; _fbq?: Fbq };

export function validMetaPixelId(value: string | undefined | null) {
  return value && /^\d{8,20}$/.test(value) ? value : null;
}

export function metaPixelId(value = process.env.NEXT_PUBLIC_META_PIXEL_ID) {
  return validMetaPixelId(value?.trim());
}

function pixel(browser: Window): Fbq | undefined {
  const fbq = (browser as PixelWindow).fbq;
  return typeof fbq === "function" ? fbq : undefined;
}

/** Installs the pixel once, only after a stored acceptance. Missing IDs do nothing. */
export function activateMetaPixel(browser: Window, doc: Document, id = metaPixelId()) {
  if (!id || pixel(browser)) {
    if (id && pixel(browser)) return true;
    return false;
  }
  const fbq: Fbq = function (...args: unknown[]) {
    if (fbq.callMethod) fbq.callMethod(...args);
    else (fbq.queue = fbq.queue || []).push(args);
  };
  fbq.push = fbq;
  fbq.loaded = true;
  fbq.version = "2.0";
  fbq.queue = [];
  (browser as PixelWindow).fbq = fbq;
  (browser as PixelWindow)._fbq = fbq;
  const script = doc.createElement("script");
  script.async = true;
  script.src = META_PIXEL_SCRIPT;
  const first = doc.getElementsByTagName("script")[0];
  first?.parentNode?.insertBefore(script, first);
  if (!first) {
    if (doc.head) doc.head.appendChild(script);
    else doc.body?.appendChild(script);
  }
  fbq("consent", "grant");
  fbq("init", id);
  return true;
}

export function trackMetaEvent(browser: Window, name: "PageView" | "Lead" | "CompleteRegistration" | "Contact", params?: Record<string, string | number>) {
  const fbq = pixel(browser);
  if (!fbq || !metaPixelId()) return false;
  if (params) fbq("track", name, params);
  else fbq("track", name);
  return true;
}

export function trackMetaPageView(browser: Window) {
  return trackMetaEvent(browser, "PageView");
}
