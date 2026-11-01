import { PUBLIC_SITE_ORIGIN, isPublicSitePath } from "@/lib/public-site";

export const ANALYTICS_CHOICE_KEY = "felexia:analytics-consent:v1";
export const ANALYTICS_SETTINGS_EVENT = "felexia:analytics-settings";
export const ANALYTICS_CHOICE_DAYS = 180;
const CHOICE_LIFETIME = ANALYTICS_CHOICE_DAYS * 24 * 60 * 60 * 1_000;
const COOKIE_LIFETIME = CHOICE_LIFETIME / 1_000;
const TITLES: Record<string, string> = {
  "/": "FelexiaERP — Gestion d’entreprise au Maroc",
  "/pricing": "Tarifs ESSENTIEL et PRO — FelexiaERP",
  "/essentiel": "Gestion ESSENTIEL — FelexiaERP",
  "/pro": "ERP PRO sur devis — FelexiaERP",
  "/mentions-legales": "Mentions légales — FelexiaERP",
  "/confidentialite": "Confidentialité — FelexiaERP",
  "/conditions": "Conditions générales — FelexiaERP",
};
const PRODUCTION_ORIGINS = [PUBLIC_SITE_ORIGIN, "https://felexia.pro"];
const SEARCH_REFERRERS = new Set([
  "https://www.google.com", "https://www.google.co.ma", "https://www.google.fr",
  "https://www.bing.com", "https://bing.com", "https://duckduckgo.com",
]);

export type AnalyticsChoice = "accepted" | "refused" | null;
export type AnalyticsSnapshot = { available: boolean; choice: AnalyticsChoice };
export type MarketingEvent = "trial_cta_click" | "pro_quote_click" | "whatsapp_click" | "contact_click";
type Gtag = (...args: unknown[]) => void;
type AnalyticsWindow = Window & {
  gtag?: Gtag;
  dataLayer?: unknown[];
  felexiaStartAnalytics?: (measurementId: string, parameters: Record<string, string>) => boolean;
  [key: `ga-disable-${string}`]: boolean;
};

export function validMeasurementId(value: string | undefined): string | null {
  return value && /^G-[A-Z0-9]+$/.test(value) ? value : null;
}

export function publicPath(pathname: string): string | null {
  return isPublicSitePath(pathname) ? pathname.replace(/\/+$/, "") || "/" : null;
}

export function parseAnalyticsChoice(value: string | null, now: number): AnalyticsChoice {
  if (!value) return null;
  try {
    const stored: unknown = JSON.parse(value);
    if (!stored || typeof stored !== "object") return null;
    const item = stored as Record<string, unknown>;
    if (item.version !== 1 || (item.analytics !== "accepted" && item.analytics !== "refused")) return null;
    if (typeof item.updatedAt !== "number" || !Number.isFinite(item.updatedAt) || item.updatedAt > now || now - item.updatedAt >= CHOICE_LIFETIME) return null;
    return item.analytics;
  } catch { return null; }
}

/** Only fixed public locations or known search-engine origins; no query, fragment or private path. */
export function safeInitialReferrer(value: string): string {
  try {
    const url = new URL(value);
    if (PRODUCTION_ORIGINS.includes(url.origin)) {
      const path = publicPath(url.pathname);
      return path ? PUBLIC_SITE_ORIGIN + path : "";
    }
    return SEARCH_REFERRERS.has(url.origin) ? url.origin + "/" : "";
  } catch { return ""; }
}

/** Classifies a destination locally. The destination, link text and query never become event parameters. */
export function marketingEventForHref(href: string, base: string): MarketingEvent | null {
  try {
    const url = new URL(href, base);
    if (PRODUCTION_ORIGINS.includes(url.origin) && url.pathname === "/login" && url.searchParams.get("mode") === "register") return "trial_cta_click";
    if (url.protocol === "mailto:") return url.searchParams.get("subject") === "Felexia PRO — demande de devis" ? "pro_quote_click" : "contact_click";
    if (url.origin === "https://wa.me" && url.pathname === "/212614505090") return "whatsapp_click";
    if (PRODUCTION_ORIGINS.includes(url.origin) && publicPath(url.pathname) && url.hash === "#contact") return "contact_click";
    return null;
  } catch { return null; }
}

/**
 * Inert HTTPS document: a direct GET only defines a bootstrap function. No Google
 * script, cookie or event exists before the consenting public parent invokes it.
 * All interpolated values are fixed application constants, never request input.
 */
export function analyticsRuntimeDocument(): string {
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="referrer" content="no-referrer"><meta name="robots" content="noindex,nofollow"><title>FelexiaERP — mesure publique consentie</title></head><body><script>
(function(){
  var started = false;
  var titles = ${JSON.stringify(TITLES)};
  var origins = ${JSON.stringify(PRODUCTION_ORIGINS)};
  var searchReferrers = ${JSON.stringify([...SEARCH_REFERRERS])};
  var canonical = ${JSON.stringify(PUBLIC_SITE_ORIGIN)};
  function publicPath(value){
    if(typeof value !== 'string' || value.charAt(0) !== '/' || value.slice(0,2) === '//' || /[\\\\?#]/.test(value)) return null;
    var path = value.replace(/\\/+$/, '') || '/';
    return Object.prototype.hasOwnProperty.call(titles,path) ? path : null;
  }
  function safeReferrer(value){
    try {
      var url = new URL(value);
      if(origins.indexOf(url.origin) !== -1){ var path = publicPath(url.pathname); return path ? canonical + path : ''; }
      return searchReferrers.indexOf(url.origin) !== -1 ? url.origin + '/' : '';
    } catch(error){ return ''; }
  }
  window.felexiaStartAnalytics = function(id,parameters){
    if(started || window.parent === window || typeof id !== 'string' || !/^G-[A-Z0-9]+$/.test(id) || !parameters) return false;
    try {
      if(origins.indexOf(window.location.origin) === -1 || window.parent.location.origin !== window.location.origin || !publicPath(window.parent.location.pathname)) return false;
      var choice = JSON.parse(window.localStorage.getItem(${JSON.stringify(ANALYTICS_CHOICE_KEY)}));
      var age = Date.now() - choice.updatedAt;
      if(choice.version !== 1 || choice.analytics !== 'accepted' || typeof choice.updatedAt !== 'number' || !Number.isFinite(age) || age < 0 || age >= ${CHOICE_LIFETIME}) return false;
      var location = new URL(parameters.page_location);
      var path = publicPath(location.pathname);
      if(location.origin !== canonical || !path || parameters.page_location !== canonical + path) return false;
      var config = {
        send_to:id,page_location:canonical+path,page_title:titles[path],page_referrer:safeReferrer(parameters.page_referrer),
        send_page_view:false,allow_google_signals:false,allow_ad_personalization_signals:false,
        cookie_domain:'felexia.pro',cookie_path:'/',cookie_expires:${COOKIE_LIFETIME},cookie_update:false,cookie_flags:'SameSite=Lax;Secure'
      };
      started = true;
      window['ga-disable-'+id] = false;
      window.dataLayer = [];
      window.gtag = function(){ window.dataLayer.push(arguments); };
      window.gtag('consent','default',{analytics_storage:'denied',ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied'});
      window.gtag('set',{allow_google_signals:false,allow_ad_personalization_signals:false,ads_data_redaction:true,url_passthrough:false});
      window.gtag('consent','update',{analytics_storage:'granted',ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied'});
      window.gtag('js',new Date());
      window.gtag('config',id,config);
      var script = document.createElement('script');
      script.async = true;
      script.referrerPolicy = 'no-referrer';
      script.src = 'https://www.googletagmanager.com/gtag/js?id='+id;
      document.head.appendChild(script);
      return true;
    } catch(error){ return false; }
  };
})();
</script></body></html>`;
}

/**
 * Basic consent mode: no Google runtime exists until a persisted opt-in on a public page.
 * The disposable same-origin frame keeps Google's lifecycle and automatic document fields
 * separate from the ERP. It shares first-party GA cookies, but never receives parent URL,
 * DOM content, auth state, message text, user IDs or organisation IDs.
 */
export class PublicAnalyticsController {
  private readonly measurementId: string | null;
  private frame: HTMLIFrameElement | null = null;
  private frameReady = false;
  private sentPath: string | null = null;
  private previousPublicLocation: string;
  private snapshot: AnalyticsSnapshot = { available: false, choice: null };

  constructor(
    private readonly browser: Window,
    private readonly doc: Document,
    measurementId: string | undefined,
    private readonly notify: (snapshot: AnalyticsSnapshot) => void,
  ) {
    this.measurementId = validMeasurementId(measurementId);
    this.previousPublicLocation = safeInitialReferrer(doc.referrer);
  }

  getSnapshot(): AnalyticsSnapshot { return this.snapshot; }

  start(): () => void {
    this.readChoice();
    this.sync();
    this.doc.addEventListener("click", this.onClick, true);
    this.browser.addEventListener("popstate", this.sync);
    this.browser.addEventListener("pageshow", this.sync);
    this.browser.addEventListener("pagehide", this.suspend);
    this.browser.addEventListener("storage", this.onStorage);
    return () => {
      this.doc.removeEventListener("click", this.onClick, true);
      this.browser.removeEventListener("popstate", this.sync);
      this.browser.removeEventListener("pageshow", this.sync);
      this.browser.removeEventListener("pagehide", this.suspend);
      this.browser.removeEventListener("storage", this.onStorage);
      this.suspend();
    };
  }

  setChoice(choice: Exclude<AnalyticsChoice, null>): void {
    if (!this.snapshot.available) return;
    if (choice === "refused") this.suspend();
    try {
      const stored = JSON.stringify({ version: 1, analytics: choice, updatedAt: Date.now() });
      this.browser.localStorage.setItem(ANALYTICS_CHOICE_KEY, stored);
      if (this.browser.localStorage.getItem(ANALYTICS_CHOICE_KEY) !== stored) throw new Error("Consent storage unavailable");
      this.updateSnapshot({ available: true, choice });
    } catch {
      this.suspend();
      this.updateSnapshot({ available: false, choice: null });
    }
    if (choice === "refused" || !this.snapshot.available) this.clearCookies();
    this.sync();
  }

  /** Also called after App Router pathname changes; never uses query strings or document.title. */
  sync = (): void => {
    const path = this.currentPath();
    if (!path || !this.snapshot.available || this.snapshot.choice !== "accepted") {
      this.suspend();
      return;
    }
    if (!this.frame) this.createFrame();
    this.flushPageView(path);
  };

  private currentPath(): string | null {
    return PRODUCTION_ORIGINS.includes(this.browser.location.origin) ? publicPath(this.browser.location.pathname) : null;
  }

  private updateSnapshot(snapshot: AnalyticsSnapshot): void {
    this.snapshot = snapshot;
    this.notify(snapshot);
  }

  private readChoice(): void {
    if (!this.measurementId || !PRODUCTION_ORIGINS.includes(this.browser.location.origin)) {
      this.updateSnapshot({ available: false, choice: null });
      return;
    }
    try {
      const choice = parseAnalyticsChoice(this.browser.localStorage.getItem(ANALYTICS_CHOICE_KEY), Date.now());
      this.updateSnapshot({ available: true, choice });
      if (choice !== "accepted") this.clearCookies();
    } catch {
      this.updateSnapshot({ available: false, choice: null });
      this.clearCookies();
    }
  }

  private onStorage = (event: StorageEvent): void => {
    if (event.key !== ANALYTICS_CHOICE_KEY && event.key !== null) return;
    this.suspend();
    this.readChoice();
    this.sync();
  };

  private onClick = (event: MouseEvent): void => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const link = target.closest<HTMLAnchorElement>("a[href]");
    if (!link || !this.currentPath()) return;
    const eventName = marketingEventForHref(link.href, PUBLIC_SITE_ORIGIN);
    if (eventName) this.sendEvent(eventName);
    // Let the public click be delivered while Next loads the destination. The caller
    // suspends the disposable runtime in a layout effect at the private route commit.
  };

  private parameters(path: string): Record<string, string> {
    return {
      send_to: this.measurementId!,
      page_location: PUBLIC_SITE_ORIGIN + path,
      page_title: TITLES[path],
      page_referrer: this.previousPublicLocation,
    };
  }

  private createFrame(): void {
    if (!this.measurementId) return;
    const frame = this.doc.createElement("iframe");
    frame.title = "Mesure d’audience consentie";
    frame.hidden = true;
    frame.setAttribute("aria-hidden", "true");
    frame.setAttribute("tabindex", "-1");
    frame.referrerPolicy = "no-referrer";
    // An actual HTTPS document can use first-party cookies; about:srcdoc cannot.
    frame.src = this.browser.location.origin + "/api/analytics/runtime";
    this.frame = frame;
    frame.onload = () => {
      if (this.frame !== frame) return;
      this.readChoice();
      const path = this.currentPath();
      if (!path || !this.snapshot.available || this.snapshot.choice !== "accepted") { this.suspend(); return; }
      try {
        const runtime = frame.contentWindow as AnalyticsWindow | null;
        if (!runtime?.felexiaStartAnalytics?.(this.measurementId!, this.parameters(path))) { this.suspend(); return; }
        this.frameReady = true;
        frame.onload = null;
        this.sync();
      } catch { this.suspend(); }
    };
    this.doc.body.appendChild(frame);
  }

  private flushPageView(path: string): void {
    const runtime = this.runtime();
    if (!runtime?.gtag || this.sentPath === path) return;
    runtime.gtag("event", "page_view", this.parameters(path));
    this.sentPath = path;
    this.previousPublicLocation = PUBLIC_SITE_ORIGIN + path;
  }

  private sendEvent(name: MarketingEvent): void {
    const path = this.currentPath();
    const runtime = this.runtime();
    if (path && runtime?.gtag) runtime.gtag("event", name, this.parameters(path));
  }

  private runtime(): AnalyticsWindow | null {
    if (!this.currentPath() || !this.snapshot.available || this.snapshot.choice !== "accepted" || !this.frameReady) return null;
    return this.frame?.contentWindow as AnalyticsWindow | null;
  }

  private suspend = (): void => {
    if (this.frame) {
      const runtime = this.frame.contentWindow as AnalyticsWindow | null;
      if (runtime && this.measurementId) {
        // Disable first: a denied consent update must not turn into a cookieless ping.
        runtime[`ga-disable-${this.measurementId}`] = true;
        runtime.gtag?.("consent", "update", { analytics_storage: "denied", ad_storage: "denied", ad_user_data: "denied", ad_personalization: "denied" });
      }
      this.frame.onload = null;
      this.frame.remove();
      this.frame = null;
    }
    this.frameReady = false;
    this.sentPath = null;
  };

  private clearCookies(): void {
    const names = this.doc.cookie.split(";").map((cookie) => cookie.split("=", 1)[0].trim()).filter((name) => /^_ga(?:_[A-Za-z0-9]+)?$/.test(name) || name === "_gid" || /^_gat(?:_[A-Za-z0-9_-]+)?$/.test(name));
    for (const name of names) {
      for (const domain of ["", "; Domain=www.felexia.pro", "; Domain=.www.felexia.pro", "; Domain=felexia.pro", "; Domain=.felexia.pro"]) {
        this.doc.cookie = `${name}=; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Path=/${domain}; SameSite=Lax; Secure`;
      }
    }
  }
}
