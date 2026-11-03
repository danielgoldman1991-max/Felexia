/* Actual public controller + child runtime under controlled browser boundaries.
 * These checks make no Google request and do not prove hosted collection. */
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const assert = require("node:assert/strict");
const ts = require("typescript");
const root = path.resolve(__dirname, "../../../..");
let now = Date.now();
class ClockDate extends Date { static now() { return now; } }
class Element { constructor(href) { this.href = href; } closest() { return { href: this.href }; } }
function load(file, dependencies = {}) {
  const module = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(path.join(root, file), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(code, { module, exports: module.exports, URL, Date: ClockDate, Element,
    require: (id) => { if (id in dependencies) return dependencies[id]; throw new Error(id); } });
  return module.exports;
}
const site = load("src/lib/public-site.ts");
const analytics = load("src/lib/analytics/public-analytics.ts", { "@/lib/public-site": site });
const checks = [];
function check(name, run) { run(); checks.push({ name, passed: true }); }
const consent = (choice = "accepted", time = now) => JSON.stringify({ version: 1, analytics: choice, updatedAt: time });
const suffix = "?utm_source=google&utm_medium=cpc&utm_campaign=felexia_essentiel_maroc&utm_content=essentiel_a";
function fixture({ href = site.PUBLIC_SITE_ORIGIN + "/essentiel" + suffix, stored = null } = {}) {
  const storage = new Map(stored ? [[analytics.ANALYTICS_CHOICE_KEY, stored]] : []);
  const writes = [];
  const frames = [];
  const listeners = new Map();
  let url = new URL(href), hrefReads = 0;
  const browser = {
    location: { get origin() { return url.origin; }, get pathname() { return url.pathname; }, get href() { hrefReads++; return url.href; } },
    localStorage: { getItem: (key) => storage.get(key) ?? null, setItem: (key, value) => { writes.push([key, value]); storage.set(key, value); } },
    get sessionStorage() { throw new Error("Campaign tracking must not introduce browser storage"); },
    addEventListener: (type, callback) => { if (!listeners.has(type)) listeners.set(type, new Set()); listeners.get(type).add(callback); },
    removeEventListener: (type, callback) => listeners.get(type)?.delete(callback),
  };
  let click;
  const doc = {
    referrer: "https://www.google.com/search?q=CONFIDENTIAL",
    cookie: "auth-session=PRIVATE; _ga=old",
    addEventListener: (type, callback) => { assert.equal(type, "click"); click = callback; },
    removeEventListener: () => { click = null; },
    createElement: (type) => { assert.equal(type, "iframe"); return { setAttribute() {}, onload: null, remove() { this.removed = true; } }; },
    body: { appendChild(frame) {
      const scripts = [];
      const runtime = { URL, Date: ClockDate, parent: browser, location: { origin: url.origin }, localStorage: browser.localStorage,
        document: { createElement: () => ({}), head: { appendChild: (script) => scripts.push(script) } }, scripts };
      runtime.window = runtime;
      vm.runInNewContext(analytics.analyticsRuntimeDocument().match(/<script>([\s\S]+?)<\/script>/)[1], runtime);
      frame.contentWindow = runtime; frames.push(frame);
    } },
  };
  const controller = new analytics.PublicAnalyticsController(browser, doc, "G-TEST123", () => {});
  const commands = (frame = frames.at(-1)) => Array.from(frame?.contentWindow.dataLayer ?? [], (item) => Array.from(item));
  const events = () => commands().filter((item) => item[0] === "event");
  return { browser, doc, controller, frames, storage, writes, commands, events,
    get hrefReads() { return hrefReads; }, get href() { return url.href; },
    navigate(value) { url = new URL(value, site.PUBLIC_SITE_ORIGIN); },
    click(href) { click?.({ target: new Element(href) }); },
  };
}
check("Six fixed campaign variants map to GA campaign fields", () => {
  let count = 0;
  for (const [campaign, contents] of Object.entries(analytics.PUBLIC_AD_CAMPAIGNS)) for (const content of contents) {
    const url = `${site.PUBLIC_SITE_ORIGIN}/?utm_source=google&utm_medium=cpc&utm_campaign=${campaign}&utm_content=${content}`;
    assert.equal(JSON.stringify(analytics.publicCampaignForUrl(url)), JSON.stringify({ campaign_source: "google", campaign_medium: "cpc", campaign_name: campaign, campaign_content: content }));
    count++;
  }
  assert.equal(count, 6);
});
check("Untrusted, duplicated, incomplete, mismatched and private campaign inputs fail closed", () => {
  for (const value of [
    site.PUBLIC_SITE_ORIGIN + "/login" + suffix,
    site.PUBLIC_SITE_ORIGIN + "/dashboard" + suffix,
    "https://evil.invalid/" + suffix,
    site.PUBLIC_SITE_ORIGIN + "/" + suffix + "&utm_source=google",
    site.PUBLIC_SITE_ORIGIN + "/" + suffix + "&utm_content=private@example.invalid",
    site.PUBLIC_SITE_ORIGIN + "/" + suffix.replace("essentiel_a", "pro_a"),
    site.PUBLIC_SITE_ORIGIN + "/" + suffix.replace("felexia_essentiel_maroc", "__proto__"),
    site.PUBLIC_SITE_ORIGIN + "/" + suffix.replace("essentiel_a", "private@example.invalid"),
    site.PUBLIC_SITE_ORIGIN + "/" + suffix.replace("google", "Google"),
    site.PUBLIC_SITE_ORIGIN + "/?gclid=SECRET",
    "invalid",
  ]) assert.equal(analytics.publicCampaignForUrl(value), null, value);
});
check("No URL attribution is read, stored or emitted before opt-in or after refusal", () => {
  const f = fixture(); const stop = f.controller.start();
  assert.equal(f.hrefReads, 0); assert.equal(f.frames.length, 0); assert.equal(f.writes.length, 0);
  f.controller.setChoice("refused"); f.controller.sync();
  assert.equal(f.hrefReads, 0); assert.equal(f.frames.length, 0);
  assert.deepEqual(f.writes.map(([key]) => key), [analytics.ANALYTICS_CHOICE_KEY]); stop();
});
check("Opt-in passes only campaign constants; GCLID, arbitrary query, fragment and search term never enter runtime", () => {
  const href = site.PUBLIC_SITE_ORIGIN + "/essentiel" + suffix + "&gclid=CLICK_SECRET&utm_term=private%40example.invalid&email=private%40example.invalid#PASSWORD";
  const f = fixture({ href }); const stop = f.controller.start(); f.controller.setChoice("accepted"); f.frames[0].onload();
  assert.equal(f.href, href); assert.equal(f.frames.length, 1);
  const commands = f.commands(); const config = commands.find((item) => item[0] === "config")[2];
  assert.equal(config.campaign_source, "google"); assert.equal(config.campaign_name, "felexia_essentiel_maroc");
  assert.equal(config.campaign_content, "essentiel_a"); assert.equal(config.page_location, site.PUBLIC_SITE_ORIGIN + "/essentiel");
  assert.equal(config.send_page_view, false); assert.equal(config.allow_google_signals, false);
  assert.ok(!/CLICK_SECRET|private@|PASSWORD|CONFIDENTIAL|gclid|utm_term/.test(JSON.stringify(commands)));
  assert.equal(f.frames[0].contentWindow.scripts.length, 1);
  assert.deepEqual(f.writes.map(([key]) => key), [analytics.ANALYTICS_CHOICE_KEY]);
  assert.ok(commands.filter((item) => item[0] === "consent").every((item) => item[2].ad_storage === "denied" && item[2].ad_user_data === "denied"));
  stop();
});
check("Public SPA navigation keeps fixed attribution and deduplicates page views; no signup or lead is fabricated", () => {
  const f = fixture({ stored: consent() }); const stop = f.controller.start(); f.frames[0].onload();
  f.navigate("/pricing"); f.controller.sync(); f.controller.sync();
  f.click(site.PUBLIC_SITE_ORIGIN + "/login?mode=register&email=SECRET");
  f.click("mailto:private@example.invalid?subject=" + encodeURIComponent("Felexia PRO — demande de devis") + "&body=SECRET");
  const events = f.events();
  assert.deepEqual(events.map((item) => item[1]), ["page_view", "page_view", "trial_cta_click", "pro_quote_click"]);
  assert.ok(events.every((item) => item[2].campaign_content === "essentiel_a"));
  assert.ok(!/SECRET|private@|signup_|lead_|trial_activated|company_created/.test(JSON.stringify(events)));
  stop();
});
check("Private boundary removes Google and drops in-memory campaign; ERP URL queries are not read", () => {
  const f = fixture({ stored: consent() }); const stop = f.controller.start(); f.frames[0].onload();
  const reads = f.hrefReads; f.navigate("/login?email=PRIVATE&gclid=PRIVATE"); f.controller.sync();
  assert.equal(f.hrefReads, reads); assert.equal(f.frames[0].removed, true);
  assert.equal(f.frames[0].contentWindow["ga-disable-G-TEST123"], true);
  f.navigate("/pro"); f.controller.sync(); f.frames[1].onload();
  assert.equal(f.events()[0][2].campaign_name, undefined); stop();
});
check("Consent expiry during an open page blocks the next click and destroys its runtime", () => {
  const f = fixture({ stored: consent() }); const stop = f.controller.start(); const frame = f.frames[0]; frame.onload();
  const before = f.events().length;
  now += 180 * 86400000;
  f.click(site.PUBLIC_SITE_ORIGIN + "/login?mode=register");
  assert.equal(f.commands(frame).filter((item) => item[0] === "event").length, before);
  assert.equal(frame.removed, true); assert.equal(frame.contentWindow["ga-disable-G-TEST123"], true);
  stop();
});
check("Refusal followed by later opt-in cannot recover the previous in-memory campaign", () => {
  const f = fixture({ stored: consent() }); const stop = f.controller.start(); f.frames[0].onload();
  f.controller.setChoice("refused"); f.navigate("/pro"); f.controller.setChoice("accepted"); f.frames[1].onload();
  assert.equal(f.events()[0][2].campaign_name, undefined); stop();
});
check("Loss of consent storage while open blocks the next event without a new Google runtime", () => {
  const f = fixture({ stored: consent() }); const stop = f.controller.start(); const frame = f.frames[0]; frame.onload();
  const before = f.events().length;
  f.browser.localStorage.getItem = () => { throw new Error("Storage blocked"); };
  f.click(site.PUBLIC_SITE_ORIGIN + "/login?mode=register");
  assert.equal(f.commands(frame).filter((item) => item[0] === "event").length, before);
  assert.equal(frame.removed, true); assert.equal(f.frames.length, 1); assert.equal(f.controller.getSnapshot().available, false); stop();
});
check("Child bootstrap independently rejects forged campaign fields and arbitrary parameters", () => {
  const f = fixture({ stored: consent() }); const stop = f.controller.start();
  const runtime = f.frames[0].contentWindow;
  assert.equal(runtime.felexiaStartAnalytics("G-TEST123", { page_location: site.PUBLIC_SITE_ORIGIN + "/essentiel", page_referrer: "",
    campaign_source: "google", campaign_medium: "cpc", campaign_name: "felexia_essentiel_maroc", campaign_content: "private@example.invalid", gclid: "SECRET", email: "SECRET" }), true);
  const config = f.commands().find((item) => item[0] === "config")[2];
  assert.equal(config.campaign_name, undefined); assert.ok(!/SECRET|private@/.test(JSON.stringify(f.commands()))); stop();
});
const report = { passed: checks.length, failed: 0, scope: "Actual public controller and child bootstrap, browser and Google transport controlled; no live collection validation", checks };
fs.writeFileSync(path.join(__dirname, "verify-tracking-results.json"), JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify(report, null, 2));
