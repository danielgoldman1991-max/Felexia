/* Executes the actual controller and React component with controlled browser boundaries.
 * No Google request is made. Live collection/cookies still require a production browser check.
 */
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const assert = require("node:assert/strict");
const ts = require("typescript");
const root = path.resolve(__dirname, "../../..");
const checks = [];
function check(name, run) { run(); checks.push({ name, passed: true }); }
function compile(relative) {
  return ts.transpileModule(fs.readFileSync(path.join(root, relative), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 },
  }).outputText;
}
function load(relative, dependencies = {}, globals = {}) {
  const module = { exports: {} };
  const context = { module, exports: module.exports, console, URL, Date, ...globals, require(id) {
    if (id in dependencies) return dependencies[id];
    throw new Error("Unexpected dependency: " + id);
  } };
  vm.runInNewContext(compile(relative), context, { filename: relative });
  return module.exports;
}
class FakeElement {
  constructor(anchor = null) { this.anchor = anchor; }
  closest() { return this.anchor; }
}
function browserFixture({ pathname = "/", origin = "https://www.felexia.pro", stored = null, storageFails = false } = {}) {
  const listeners = new Map();
  const clicks = new Set();
  const frames = [];
  const removedFrames = [];
  const cookies = new Map([["_ga", "visitor"], ["_ga_TEST123", "session"], ["_gid", "legacy"], ["auth-session", "private"]]);
  const cookieWrites = [];
  const storage = new Map(stored ? [["felexia:analytics-consent:v1", stored]] : []);
  const browser = {
    location: { pathname, origin, href: origin + pathname },
    localStorage: {
      getItem(key) { if (storageFails) throw new Error("Storage denied"); return storage.get(key) ?? null; },
      setItem(key, value) { if (storageFails) throw new Error("Storage denied"); storage.set(key, value); },
    },
    addEventListener(type, handler) { if (!listeners.has(type)) listeners.set(type, new Set()); listeners.get(type).add(handler); },
    removeEventListener(type, handler) { listeners.get(type)?.delete(handler); },
    dispatchEvent(event) { for (const handler of listeners.get(event.type) ?? []) handler(event); },
  };
  const doc = {
    referrer: "https://www.felexia.pro/dashboard?email=private@example.invalid#secret",
    activeElement: null,
    get cookie() { return [...cookies].map(([key, value]) => `${key}=${value}`).join("; "); },
    set cookie(value) { cookieWrites.push(value); if (value.includes("Max-Age=0")) cookies.delete(value.split("=", 1)[0]); },
    addEventListener(type, handler) { assert.equal(type, "click"); clicks.add(handler); },
    removeEventListener(type, handler) { assert.equal(type, "click"); clicks.delete(handler); },
    createElement(type) {
      assert.equal(type, "iframe");
      const frame = { attributes: {}, contentWindow: null, onload: null,
        setAttribute(key, value) { this.attributes[key] = value; },
        remove() { removedFrames.push(this); },
      };
      return frame;
    },
    body: { appendChild(frame) {
      frames.push(frame);
      const scripts = [];
      const childDocument = { createElement(type) { assert.equal(type, "script"); return {}; }, head: { appendChild(script) { scripts.push(script); } } };
      const runtime = { document: childDocument, location: { origin, pathname: "/api/analytics/runtime" }, parent: browser, localStorage: browser.localStorage, URL, Date, scripts };
      runtime.window = runtime;
      vm.runInNewContext(analytics.analyticsRuntimeDocument().match(/<script>([\s\S]+?)<\/script>/)[1], runtime);
      frame.contentWindow = runtime;
    } },
  };
  return { browser, doc, frames, removedFrames, cookies, cookieWrites, storage, listeners,
    failStorage() { storageFails = true; },
    navigate(pathname) { browser.location.pathname = pathname; browser.location.href = origin + pathname; },
    click(href, extra = {}) {
      const anchor = { href, target: "", ...extra };
      const event = { target: new FakeElement(anchor), button: 0, ctrlKey: false, metaKey: false, shiftKey: false, altKey: false, ...extra };
      for (const click of clicks) click(event);
    },
    dispatch(type, detail = {}) { browser.dispatchEvent({ type, ...detail }); },
  };
}
const site = load("src/lib/public-site.ts");
const analytics = load("src/lib/analytics/public-analytics.ts", { "@/lib/public-site": site }, { Element: FakeElement });
const { PublicAnalyticsController, parseAnalyticsChoice, safeInitialReferrer, validMeasurementId, marketingEventForHref } = analytics;
const consent = (choice = "accepted", time = Date.now()) => JSON.stringify({ version: 1, analytics: choice, updatedAt: time });
const commands = (frame) => (frame.contentWindow.dataLayer ?? []).map((item) => Array.from(item));
const events = (frame) => commands(frame).filter((command) => command[0] === "event");

check("Measurement IDs are strict and fail closed", () => {
  assert.equal(validMeasurementId("G-TEST123"), "G-TEST123");
  for (const value of [undefined, "", " G-TEST123", "G-test", "G-ABC&x=private", "G-<script>", "GT-ABC", "G-"]) assert.equal(validMeasurementId(value), null);
});
check("Versioned consent expires after 180 days and rejects malformed/future records", () => {
  const now = Date.now();
  assert.equal(parseAnalyticsChoice(consent("accepted", now), now), "accepted");
  assert.equal(parseAnalyticsChoice(consent("refused", now), now), "refused");
  for (const stored of ["{", "null", "true", '{"version":2,"analytics":"accepted","updatedAt":1}', consent("accepted", now + 1), consent("accepted", now - 180 * 86400000)]) assert.equal(parseAnalyticsChoice(stored, now), null);
});
check("Only seven exact public paths and safe referrers are accepted", () => {
  for (const pathname of site.PUBLIC_SITE_PATHS) assert.equal(analytics.publicPath(pathname), pathname);
  for (const pathname of ["/dashboard", "/login", "/auth/callback", "/pro/private", "/pricing?email=x", "//evil.invalid/", "/%70ro", "/pro\\private"]) assert.equal(analytics.publicPath(pathname), null);
  assert.equal(safeInitialReferrer("https://www.google.com/search?q=private@example.invalid"), "https://www.google.com/");
  assert.equal(safeInitialReferrer("https://www.felexia.pro/pricing?email=private@example.invalid#secret"), "https://www.felexia.pro/pricing");
  assert.equal(safeInitialReferrer("https://www.felexia.pro/dashboard?secret=x"), "");
  assert.equal(safeInitialReferrer("https://private-company.example.invalid/"), "");
});
check("Marketing classification emits fixed event names and never raw destinations", () => {
  const base = site.PUBLIC_SITE_ORIGIN;
  assert.equal(marketingEventForHref("/login?mode=register&email=private@example.invalid", base), "trial_cta_click");
  assert.equal(marketingEventForHref("mailto:private@example.invalid?subject=" + encodeURIComponent("Felexia PRO — demande de devis") + "&body=SECRET", base), "pro_quote_click");
  assert.equal(marketingEventForHref("mailto:private@example.invalid?body=SECRET", base), "contact_click");
  assert.equal(marketingEventForHref("https://wa.me/212614505090?text=SECRET", base), "whatsapp_click");
  assert.equal(marketingEventForHref("/#contact", base), "contact_click");
  assert.equal(marketingEventForHref("/login", base), null);
  assert.equal(marketingEventForHref("https://evil.invalid/login?mode=register", base), null);
});

const fixture = browserFixture();
let snapshot;
const controller = new PublicAnalyticsController(fixture.browser, fixture.doc, "G-TEST123", (value) => { snapshot = value; });
const stop = controller.start();
check("New visitor gets a choice without a Google script, frame or consent ping", () => {
  assert.equal(snapshot.available, true); assert.equal(snapshot.choice, null); assert.equal(fixture.frames.length, 0);
});
controller.setChoice("refused");
check("Refusal persists and removes only GA cookies across host/apex scopes", () => {
  assert.equal(snapshot.choice, "refused"); assert.equal(fixture.frames.length, 0);
  assert.equal(fixture.cookies.get("auth-session"), "private"); assert.equal(fixture.cookies.has("_ga"), false);
  assert.ok(fixture.cookieWrites.some((cookie) => cookie.includes("Domain=www.felexia.pro")));
  assert.ok(fixture.cookieWrites.some((cookie) => cookie.includes("Domain=.felexia.pro")));
  assert.ok(fixture.cookieWrites.every((cookie) => cookie.includes("Path=/")));
  assert.equal(parseAnalyticsChoice(fixture.storage.get(analytics.ANALYTICS_CHOICE_KEY), Date.now()), "refused");
});
controller.setChoice("accepted");
const firstFrame = fixture.frames[0];
check("Opt-in creates an inert same-origin HTTPS frame without srcdoc or Google autoload", () => {
  assert.equal(fixture.frames.length, 1); assert.equal(firstFrame.referrerPolicy, "no-referrer");
  assert.equal(firstFrame.src, "https://www.felexia.pro/api/analytics/runtime");
  assert.equal(firstFrame.srcdoc, undefined);
  assert.equal(firstFrame.contentWindow.scripts.length, 0);
  assert.equal(commands(firstFrame).length, 0);
});
firstFrame.onload();
check("Parent bootstrap rechecks opt-in then creates one Google tag with denied ads and safe first-party cookie configuration", () => {
  const list = commands(firstFrame);
  assert.equal(list[0][0], "consent"); assert.equal(list[0][1], "default");
  assert.equal(list[0][2].analytics_storage, "denied"); assert.equal(list[0][2].ad_user_data, "denied");
  const config = list.find((command) => command[0] === "config")[2];
  assert.equal(config.send_page_view, false); assert.equal(config.allow_google_signals, false); assert.equal(config.allow_ad_personalization_signals, false);
  assert.equal(config.page_location, "https://www.felexia.pro/"); assert.equal(config.page_referrer, "");
  assert.equal(config.cookie_domain, "felexia.pro"); assert.equal(config.cookie_path, "/"); assert.equal(config.cookie_expires, 15552000);
  assert.equal(events(firstFrame).length, 1);
  assert.equal(firstFrame.contentWindow.scripts.length, 1);
  assert.equal(firstFrame.contentWindow.scripts[0].src, "https://www.googletagmanager.com/gtag/js?id=G-TEST123");
  assert.equal(firstFrame.contentWindow.scripts[0].referrerPolicy, "no-referrer");
});
controller.sync();
fixture.browser.location.href += "?email=private@example.invalid#secret";
controller.sync();
check("Loaded public page has one pageview; repeated renders, queries and hashes do not duplicate it", () => {
  assert.equal(events(firstFrame).length, 1); assert.equal(events(firstFrame)[0][1], "page_view");
});
fixture.navigate("/pricing"); controller.sync();
fixture.click("https://wa.me/212614505090?text=SECRET");
fixture.click("mailto:private@example.invalid?body=SECRET");
fixture.click("mailto:private@example.invalid?subject=" + encodeURIComponent("Felexia PRO — demande de devis") + "&body=SECRET");
check("Public route changes and allowed clicks send only canonical locations and fixed titles/events", () => {
  const list = events(firstFrame);
  assert.equal(list.filter((item) => item[1] === "page_view").length, 2);
  assert.ok(list.some((item) => item[1] === "whatsapp_click"));
  assert.ok(list.some((item) => item[1] === "contact_click"));
  assert.ok(list.some((item) => item[1] === "pro_quote_click"));
  for (const item of list) {
    assert.equal(item[2].send_to, "G-TEST123");
    assert.deepEqual(Object.keys(item[2]).sort(), ["page_location", "page_referrer", "page_title", "send_to"]);
  }
  assert.ok(!JSON.stringify(list).match(/SECRET|private@example|212614505090|[?#]/));
});
fixture.click("https://www.felexia.pro/login?mode=register&email=private@example.invalid");
check("Signup measures intention while the public page is still active", () => {
  assert.ok(events(firstFrame).some((item) => item[1] === "trial_cta_click"));
  assert.equal(fixture.removedFrames.length, 0);
});
fixture.navigate("/dashboard"); controller.sync(); fixture.click("https://wa.me/212614505090");
check("Private route commit disables and removes runtime; stored consent cannot revive it or send events", () => {
  assert.equal(firstFrame.contentWindow["ga-disable-G-TEST123"], true);
  assert.equal(fixture.removedFrames.length, 1);
  assert.equal(commands(firstFrame).at(-1)[0], "consent");
  assert.equal(commands(firstFrame).at(-1)[2].analytics_storage, "denied");
  assert.equal(fixture.frames.length, 1); assert.equal(events(firstFrame).length, 6);
});
fixture.navigate("/pro"); fixture.dispatch("popstate");
const secondFrame = fixture.frames[1]; secondFrame.onload();
fixture.storage.set(analytics.ANALYTICS_CHOICE_KEY, consent("refused")); fixture.dispatch("storage", { key: analytics.ANALYTICS_CHOICE_KEY });
check("Returning to public reuses consent; cross-tab withdrawal destroys the runtime and blocks further events", () => {
  assert.equal(events(secondFrame).length, 1); assert.equal(snapshot.choice, "refused");
  assert.equal(secondFrame.contentWindow["ga-disable-G-TEST123"], true);
  const before = events(secondFrame).length;
  fixture.click("https://wa.me/212614505090"); controller.sync();
  assert.equal(events(secondFrame).length, before); assert.equal(fixture.frames.length, 2);
});
stop();
check("Cleanup removes all global subscriptions", () => {
  assert.ok([...fixture.listeners.values()].every((list) => list.size === 0));
});
check("Invalid ID, storage failure, preview origin and initial private route all fail closed", () => {
  for (const [options, id] of [
    [{ stored: consent() }, "G-TEST123&secret=x"],
    [{ stored: consent(), storageFails: true }, "G-TEST123"],
    [{ stored: consent(), origin: "https://preview.vercel.app" }, "G-TEST123"],
    [{ stored: consent(), pathname: "/login" }, "G-TEST123"],
  ]) {
    const f = browserFixture(options);
    const c = new PublicAnalyticsController(f.browser, f.doc, id, () => {});
    const cleanup = c.start(); c.sync();
    assert.equal(f.frames.length, 0); cleanup();
  }
});
check("Late frame load after route exit cannot revive measurement", () => {
  const f = browserFixture({ stored: consent() });
  const c = new PublicAnalyticsController(f.browser, f.doc, "G-TEST123", () => {});
  const cleanup = c.start();
  const frame = f.frames[0]; const lateLoad = frame.onload;
  f.navigate("/auth/callback"); f.dispatch("popstate"); lateLoad();
  assert.equal(events(frame).length, 0); assert.equal(f.frames.length, 1); cleanup();
});
check("A pending Google load emits only the latest public page once", () => {
  const f = browserFixture({ stored: consent() });
  const c = new PublicAnalyticsController(f.browser, f.doc, "G-TEST123", () => {});
  const cleanup = c.start();
  const frame = f.frames[0];
  f.navigate("/essentiel"); c.sync(); f.navigate("/pricing"); c.sync();
  assert.equal(events(frame).length, 0); assert.equal(f.frames.length, 1);
  frame.onload(); c.sync();
  assert.equal(events(frame).length, 1);
  assert.equal(events(frame)[0][2].page_location, "https://www.felexia.pro/pricing");
  cleanup();
});
check("Direct runtime document never starts Google, including an explicit standalone bootstrap call", () => {
  const f = browserFixture({ stored: consent() });
  const c = new PublicAnalyticsController(f.browser, f.doc, "G-TEST123", () => {});
  const cleanup = c.start(); const frame = f.frames[0]; const runtime = frame.contentWindow;
  runtime.parent = runtime;
  assert.equal(runtime.felexiaStartAnalytics("G-TEST123", { page_location: "https://www.felexia.pro/", page_referrer: "" }), false);
  assert.equal(runtime.scripts.length, 0); assert.equal(commands(frame).length, 0); cleanup();
});
check("Child bootstrap rejects missing consent, invalid IDs, private parent paths and unsafe parameter URLs", () => {
  for (const variant of ["consent", "id", "private", "query", "foreign"]) {
    const f = browserFixture({ stored: consent() });
    const c = new PublicAnalyticsController(f.browser, f.doc, "G-TEST123", () => {});
    const cleanup = c.start(); const runtime = f.frames[0].contentWindow;
    if (variant === "consent") f.storage.set(analytics.ANALYTICS_CHOICE_KEY, consent("refused"));
    if (variant === "private") f.navigate("/dashboard");
    const location = variant === "query" ? "https://www.felexia.pro/?email=private@example.invalid" : variant === "foreign" ? "https://evil.invalid/" : "https://www.felexia.pro/";
    assert.equal(runtime.felexiaStartAnalytics(variant === "id" ? "G-TEST123&secret=x" : "G-TEST123", { page_location: location, page_referrer: "" }), false);
    assert.equal(runtime.scripts.length, 0); cleanup();
  }
});
check("Child ignores supplied title/content, sanitizes referrers, and cannot bootstrap twice", () => {
  const f = browserFixture({ stored: consent() });
  const c = new PublicAnalyticsController(f.browser, f.doc, "G-TEST123", () => {});
  const cleanup = c.start(); const frame = f.frames[0]; const runtime = frame.contentWindow;
  const input = { page_location: "https://www.felexia.pro/pro", page_title: "SECRET", page_referrer: "https://www.felexia.pro/dashboard?email=private@example.invalid", email: "private@example.invalid" };
  assert.equal(runtime.felexiaStartAnalytics("G-TEST123", input), true);
  assert.equal(runtime.felexiaStartAnalytics("G-TEST123", input), false);
  assert.equal(runtime.scripts.length, 1);
  const config = commands(frame).find((command) => command[0] === "config")[2];
  assert.equal(config.page_referrer, ""); assert.equal(config.page_title, "ERP PRO sur devis — FelexiaERP");
  assert.ok(!JSON.stringify(commands(frame)).match(/SECRET|private@example/)); cleanup();
});
check("Consent withdrawn while the HTTPS frame loads cannot start Google", () => {
  const f = browserFixture({ stored: consent() });
  const c = new PublicAnalyticsController(f.browser, f.doc, "G-TEST123", () => {});
  const cleanup = c.start(); const frame = f.frames[0];
  f.storage.set(analytics.ANALYTICS_CHOICE_KEY, consent("refused")); frame.onload();
  assert.equal(frame.contentWindow.scripts.length, 0); assert.equal(f.removedFrames.length, 1); cleanup();
});
check("Storage failure during a consent change stops collection and clears cookies", () => {
  const f = browserFixture({ stored: consent() });
  const c = new PublicAnalyticsController(f.browser, f.doc, "G-TEST123", () => {});
  const cleanup = c.start(); const frame = f.frames[0]; frame.onload();
  f.failStorage(); c.setChoice("accepted"); c.sync();
  assert.equal(c.getSnapshot().available, false);
  assert.equal(frame.contentWindow["ga-disable-G-TEST123"], true);
  assert.equal(f.removedFrames.length, 1); assert.equal(f.frames.length, 1);
  assert.equal(f.cookies.has("_ga"), false); cleanup();
});

// Execute the actual TSX with a small deterministic hook runner.
const uiFixture = browserFixture();
let slots = [], cursor = 0, pendingEffects = [], pathname = "/";
const react = {
  useRef(value) { const index = cursor++; return slots[index] ?? (slots[index] = { current: value }); },
  useState(value) { const index = cursor++; if (!(index in slots)) slots[index] = typeof value === "function" ? value() : value; return [slots[index], (next) => { slots[index] = typeof next === "function" ? next(slots[index]) : next; }]; },
  useEffect(run, dependencies) { const index = cursor++; const previous = slots[index]; if (!previous || dependencies.some((value, i) => !Object.is(value, previous.dependencies[i]))) pendingEffects.push(() => { previous?.cleanup?.(); slots[index] = { dependencies, cleanup: run() }; }); },
};
react.useLayoutEffect = react.useEffect;
const jsx = (type, props) => ({ type, props: props ?? {} });
const ui = load("src/components/analytics/PublicAnalytics.tsx", {
  react, "react/jsx-runtime": { jsx, jsxs: jsx }, "next/navigation": { usePathname: () => pathname },
  "@/lib/public-site": site, "@/lib/analytics/public-analytics": analytics,
  "./PublicAnalytics.module.css": { default: {} },
}, { window: uiFixture.browser, document: uiFixture.doc, process: { env: { NEXT_PUBLIC_GA_MEASUREMENT_ID: "G-TEST123" } }, HTMLElement: FakeElement, Event: class { constructor(type) { this.type = type; } } });
function render() { cursor = 0; pendingEffects = []; const tree = ui.PublicAnalytics(); for (const run of pendingEffects) run(); return tree; }
function walk(node, predicate) {
  if (Array.isArray(node)) { for (const child of node) { const found = walk(child, predicate); if (found) return found; } return null; }
  if (!node || typeof node !== "object") return null;
  return predicate(node) ? node : walk(node.props?.children, predicate);
}
function nodeText(node) { return Array.isArray(node) ? node.map(nodeText).join("") : node && typeof node === "object" ? nodeText(node.props?.children) : String(node ?? ""); }
render(); let tree = render();
check("Consent UI has equal accept/refuse controls and no initial Google load", () => {
  const accept = walk(tree, (node) => node.type === "button" && nodeText(node) === "Accepter la mesure");
  const refuse = walk(tree, (node) => node.type === "button" && nodeText(node) === "Refuser la mesure");
  assert.ok(accept); assert.ok(refuse); assert.equal(accept.props.className, refuse.props.className);
  assert.equal(tree.props.role, "region"); assert.equal(uiFixture.frames.length, 0);
  refuse.props.onClick();
});
tree = render();
check("Footer settings reopens without changing consent or loading Google", () => {
  assert.equal(tree, null);
  ui.AnalyticsSettingsButton({}).props.onClick(); tree = render();
  assert.ok(tree); assert.equal(uiFixture.frames.length, 0);
  assert.ok(walk(tree, (node) => node.type === "button" && nodeText(node) === "Fermer"));
  tree.props.onKeyDown({ key: "Escape" }); assert.equal(render(), null);
});
pathname = "/dashboard"; uiFixture.navigate(pathname); tree = render();
check("Consent UI remains absent in the ERP", () => { assert.equal(tree, null); assert.equal(uiFixture.frames.length, 0); });
for (const slot of slots) slot?.cleanup?.();

(async () => {
  const endpoint = load("src/app/api/analytics/runtime/route.ts", { "@/lib/analytics/public-analytics": analytics }, { Response });
  const response = endpoint.GET();
  const body = await response.text();
  check("Actual GET endpoint is inert HTML with noindex/no-store/no-referrer, no cookies and no external script element", () => {
    assert.equal(response.status, 200); assert.equal(response.headers.get("content-type"), "text/html; charset=utf-8");
    assert.match(response.headers.get("cache-control"), /no-store/); assert.equal(response.headers.get("cdn-cache-control"), "no-store");
    assert.equal(response.headers.get("vercel-cdn-cache-control"), "no-store"); assert.match(response.headers.get("x-robots-tag"), /noindex/);
    assert.equal(response.headers.get("referrer-policy"), "no-referrer"); assert.equal(response.headers.get("set-cookie"), null);
    assert.equal(response.headers.get("x-frame-options"), "SAMEORIGIN");
    assert.equal(body, analytics.analyticsRuntimeDocument()); assert.ok(!/<script[^>]+\bsrc=/i.test(body));
    assert.ok(!/fetch\(|sendBeacon\(|XMLHttpRequest/.test(body));
  });
  const report = { passed: checks.length, failed: 0, scope: "Actual GET endpoint + controller + React component under controlled browser/Google boundaries; not a live Google collection check", checks };
  fs.writeFileSync(path.join(__dirname, "verify-analytics-results.json"), JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify(report, null, 2));
})().catch((error) => { console.error(error); process.exitCode = 1; });
