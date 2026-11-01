"use strict";

// Executes the application's actual controller with deterministic DOM geometry.
// This is not a browser test: CSS, media-query layout, image composition and
// native inert/focus behavior are not emulated or certified by this harness.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");

const sourcePath = path.resolve(__dirname, "../../../src/components/landing/LandingEffects.tsx");
const source = fs.readFileSync(sourcePath, "utf8");
const compiled = ts.transpileModule(source, {
  fileName: sourcePath,
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
let assertions = 0;
function check(condition, description) { assert.ok(condition, description); assertions += 1; }
function equal(actual, expected, description) { assert.equal(actual, expected, description); assertions += 1; }
function different(actual, previous, description) { assert.notEqual(actual, previous, description); assertions += 1; }

class EventSurface {
  constructor() { this.listeners = new Map(); }
  addEventListener(type, callback) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type).add(callback);
  }
  removeEventListener(type, callback) { this.listeners.get(type)?.delete(callback); }
  emit(type) { for (const callback of [...(this.listeners.get(type) ?? [])]) callback({ type, target: this }); }
  listenerCount() { return [...this.listeners.values()].reduce((count, callbacks) => count + callbacks.size, 0); }
}

function createEnvironment({ width = 1280, height = 590, reduced = false, heroHeight = 2600, scrollingElement = true, intersections = true } = {}) {
  const window = new EventSurface();
  const document = new EventSurface();
  const mutationObservers = new Set();
  const intersectionObservers = new Set();
  const resizeObservers = new Set();
  const pendingMutations = new Map();
  const frames = new Map();
  let nextFrame = 0;
  let cleanup;
  let reducedMotion = reduced;
  let activeHeroHeight = heroHeight;
  window.innerWidth = width;
  window.innerHeight = height;
  window.scrollY = 0;
  document.hidden = false;
  document.scrollingElement = scrollingElement ? { scrollTop: 0 } : null;
  document.documentElement = { scrollHeight: 7600 };

  function notifyAttribute(target, name) {
    for (const observer of mutationObservers) {
      if (observer.target !== target || !observer.options.attributes) continue;
      if (observer.options.attributeFilter && !observer.options.attributeFilter.includes(name)) continue;
      if (!pendingMutations.has(observer)) pendingMutations.set(observer, []);
      pendingMutations.get(observer).push({ type: "attributes", target, attributeName: name });
    }
  }
  function element(rectangle) {
    const item = { inert: false, getBoundingClientRect: rectangle };
    item.style = {
      setProperty(name, value) { this[name] = String(value); },
      removeProperty(name) { delete this[name]; },
    };
    item.dataset = new Proxy({}, {
      set(target, key, value) {
        if (target[key] !== String(value)) {
          target[key] = String(value);
          notifyAttribute(item, `data-${String(key).replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}`);
        }
        return true;
      },
      deleteProperty(target, key) {
        if (Object.hasOwn(target, key)) {
          delete target[key];
          notifyAttribute(item, `data-${String(key).replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}`);
        }
        return true;
      },
    });
    item.setAttribute = (name, value) => { item.dataset[name.slice(5).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())] = value; };
    item.removeAttribute = (name) => { delete item.dataset[name.slice(5).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())]; };
    return item;
  }
  const scrollTop = () => document.scrollingElement?.scrollTop ?? window.scrollY;
  const hero = element(() => ({ top: -scrollTop(), height: activeHeroHeight, width: window.innerWidth }));
  const heroWindow = element(() => ({ top: 0, height: window.innerHeight, width: window.innerWidth }));
  Object.defineProperty(heroWindow, "clientWidth", { get: () => window.innerWidth });
  const world = element(() => ({ top: 0, height: 941, width: 1672 }));
  const laptop = element(() => ({ top: 0, height: 680, width: 1120 }));
  const heroCopy = element(() => ({ top: 120 - scrollTop(), height: 260, width: 800 }));
  const reveal = element(() => ({ top: 3500 - scrollTop(), height: 150, width: 600 }));
  const root = element(() => ({ top: -scrollTop(), height: 7600, width: window.innerWidth }));
  root.classList = { contains: (name) => name === "marketing-horizon-site" };
  const selectors = new Map([
    [".horizon-hero, .marketing-hero", hero], [".horizon-window", heroWindow],
    [".horizon-world", world], [".horizon-laptop", laptop], [".horizon-copy", heroCopy],
  ]);
  root.querySelector = (selector) => selectors.get(selector) ?? null;
  root.querySelectorAll = (selector) => selector === "[data-reveal]" ? [reveal] : [];
  document.querySelector = (selector) => selector === ".marketing-site" ? root : null;

  class FakeMediaQuery extends EventSurface {
    constructor(query) { super(); this.query = query; }
    get matches() { return this.query.includes("prefers-reduced-motion") ? reducedMotion : window.innerWidth <= 859; }
  }
  const reducedQuery = new FakeMediaQuery("(prefers-reduced-motion: reduce)");
  const mobileQuery = new FakeMediaQuery("(max-width: 859px)");
  window.matchMedia = (query) => query.includes("prefers-reduced-motion") ? reducedQuery : mobileQuery;

  class FakeMutationObserver {
    constructor(callback) { this.callback = callback; this.target = null; this.options = {}; }
    observe(target, options) { this.target = target; this.options = options; mutationObservers.add(this); }
    disconnect() { mutationObservers.delete(this); pendingMutations.delete(this); this.target = null; }
  }
  class FakeResizeObserver {
    constructor(callback) { this.callback = callback; }
    observe() { resizeObservers.add(this); }
    disconnect() { resizeObservers.delete(this); }
  }
  class FakeIntersectionObserver {
    constructor(callback) { this.callback = callback; this.targets = new Set(); }
    observe(target) { this.targets.add(target); intersectionObservers.add(this); }
    unobserve(target) { this.targets.delete(target); }
    disconnect() { this.targets.clear(); intersectionObservers.delete(this); }
  }
  window.ResizeObserver = FakeResizeObserver;
  if (intersections) window.IntersectionObserver = FakeIntersectionObserver;
  const module = { exports: {} };
  const sandbox = {
    module, exports: module.exports, window, document,
    require(name) {
      assert.equal(name, "react", "controller must only require the provided React effect stub");
      return { useEffect(effect) { cleanup = effect(); } };
    },
    MutationObserver: FakeMutationObserver, ResizeObserver: FakeResizeObserver,
    IntersectionObserver: FakeIntersectionObserver,
    requestAnimationFrame(callback) { const id = ++nextFrame; frames.set(id, callback); return id; },
    cancelAnimationFrame(id) { frames.delete(id); },
  };
  vm.runInNewContext(compiled, sandbox, { filename: sourcePath, timeout: 2000 });
  module.exports.LandingEffects();

  function flushFrames() {
    let passes = 0;
    while (frames.size) {
      assert.ok(++passes < 10, "RAF must settle without a permanent animation loop");
      const batch = [...frames.values()];
      frames.clear();
      for (const callback of batch) callback(0);
    }
  }
  function flushMutations() {
    const batch = [...pendingMutations.entries()];
    pendingMutations.clear();
    for (const [observer, records] of batch) if (mutationObservers.has(observer)) observer.callback(records, observer);
  }
  const api = {
    window, document, root, world, laptop, heroCopy, reveal, frames, pendingMutations,
    progress: () => Number(root.style["--hero-progress"]),
    flushFrames, flushMutations,
    scroll(value, windowValue = value) {
      if (document.scrollingElement) document.scrollingElement.scrollTop = value;
      window.scrollY = windowValue;
      window.emit("scroll");
    },
    resize(nextWidth, nextHeight) {
      const wasMobile = mobileQuery.matches;
      window.innerWidth = nextWidth; window.innerHeight = nextHeight;
      if (mobileQuery.matches !== wasMobile) mobileQuery.emit("change");
      window.emit("resize");
    },
    setReduced(value) { reducedMotion = value; reducedQuery.emit("change"); },
    setHeroHeight(value) { activeHeroHeight = value; window.emit("resize"); },
    unmount() { cleanup(); },
    listeners: () => window.listenerCount() + document.listenerCount() + reducedQuery.listenerCount() + mobileQuery.listenerCount(),
    observers: () => mutationObservers.size + resizeObservers.size + intersectionObservers.size,
  };
  return api;
}

function positiveProgress(environment, description) {
  const value = environment.progress();
  check(Number.isFinite(value) && value > 0 && value <= 1, description);
}
function finiteTransforms(environment, description) {
  check(typeof environment.world.style.transform === "string" && !/NaN|Infinity/.test(environment.world.style.transform), `${description}: landscape transform is finite`);
  check(typeof environment.laptop.style.transform === "string" && !/NaN|Infinity/.test(environment.laptop.style.transform), `${description}: interface transform is finite`);
}
function verifyCleanup(environment, description) {
  environment.unmount();
  equal(environment.listeners(), 0, `${description}: window/document/media listeners removed`);
  equal(environment.observers(), 0, `${description}: all observers disconnected`);
  equal(environment.frames.size, 0, `${description}: pending RAF canceled`);
  equal(environment.heroCopy.inert, false, `${description}: hero controls released from inert`);
  equal(environment.world.style.transform, undefined, `${description}: landscape transform removed`);
  equal(environment.laptop.style.transform, undefined, `${description}: interface transform removed`);
  equal(environment.laptop.style.opacity, undefined, `${description}: interface opacity removed`);
  equal(environment.root.style["--hero-progress"], undefined, `${description}: zoom progress removed`);
  equal(environment.root.style["--reading-progress"], undefined, `${description}: reading progress removed`);
  check(!["scrolled", "heroVisible", "horizonAway", "horizonEnhanced", "horizonMotion"].some((name) => Object.hasOwn(environment.root.dataset, name)), `${description}: controller-owned dataset flags removed`);
  equal(environment.reveal.dataset.revealed, undefined, `${description}: reveal enhancement removed`);
  environment.window.emit("scroll");
  environment.window.emit("resize");
  equal(environment.frames.size, 0, `${description}: late events do not restart controller`);
}

// Short desktop viewport: DOM remains a pinned, scrollable sequence. The source
// controller must animate it even when window.scrollY lags scrollingElement.
const short = createEnvironment({ height: 590 });
equal(short.root.dataset.horizonEnhanced, "true", "590px: enhancement mounted");
equal(short.progress(), 0, "590px: initial progress is zero");
const initialWorld = short.world.style.transform;
const initialLaptop = short.laptop.style.transform;
short.scroll(300, 0); short.scroll(700, 0);
equal(short.frames.size, 1, "590px: successive scroll events coalesce into one RAF");
short.flushFrames();
positiveProgress(short, "590px: document scroll advances the actual controller");
different(short.world.style.transform, initialWorld, "590px: landscape zoom actually changes");
different(short.laptop.style.transform, initialLaptop, "590px: HTML interface projection actually changes");
check(Number(short.laptop.style.opacity) > 0, "590px: interface becomes visible");
equal(short.heroCopy.inert, true, "590px: faded hero links become inert");
finiteTransforms(short, "590px");

// Actual pause attribute + MutationObserver, followed by scrolling while paused.
short.root.dataset.motionPaused = "true";
check(short.pendingMutations.size > 0, "pause: mutation observer receives the real attribute change");
short.flushMutations(); short.flushFrames();
equal(short.progress(), 0, "pause: zoom is reset to its static state");
const pausedWorld = short.world.style.transform;
short.scroll(950, 0); short.flushFrames();
equal(short.progress(), 0, "pause: further scrolling cannot advance zoom");
equal(short.world.style.transform, pausedWorld, "pause: transform remains stationary while scrolling");
equal(short.heroCopy.inert, false, "pause: static hero controls are available");
delete short.root.dataset.motionPaused;
short.flushMutations(); short.flushFrames();
positiveProgress(short, "resume: removing pause resumes at the current scroll position");
different(short.world.style.transform, pausedWorld, "resume: landscape moves again");

// Resize and reverse use behavior, not a duplicate of the zoom formula.
const beforeResize = short.laptop.style.transform;
short.resize(390, 844); short.flushFrames();
positiveProgress(short, "resize: mobile portrait still advances");
different(short.laptop.style.transform, beforeResize, "resize: interface reframes for the new viewport");
finiteTransforms(short, "resize");
short.scroll(0); short.flushFrames();
equal(short.progress(), 0, "reverse: top of page restores zero progress");
equal(Number(short.laptop.style.opacity), 0, "reverse: interface is hidden again");
equal(short.heroCopy.inert, false, "reverse: hero controls are restored");
const resizedBase = short.world.style.transform;
short.scroll(100000); short.flushFrames();
equal(short.progress(), 1, "overscroll: progress stays bounded at one");
finiteTransforms(short, "overscroll");
short.scroll(0); short.flushFrames();
equal(short.world.style.transform, resizedBase, "reverse: landscape returns to its resized initial framing");
short.scroll(1000); short.flushFrames();
equal(short.heroCopy.inert, true, "cleanup precondition: hero is currently inert");
short.scroll(1100);
equal(short.frames.size, 1, "cleanup precondition: a frame is pending");
verifyCleanup(short, "short viewport cleanup");

// Reduced motion: opting in must be observed without a scroll or resize event.
const reduced = createEnvironment({ reduced: true, height: 590 });
const reducedBase = reduced.world.style.transform;
reduced.scroll(700); reduced.flushFrames();
equal(reduced.progress(), 0, "reduced motion: scroll leaves progress at zero");
equal(reduced.world.style.transform, reducedBase, "reduced motion: landscape remains stationary");
equal(Number(reduced.laptop.style.opacity), 0, "reduced motion: enlarged interface remains hidden");
equal(reduced.heroCopy.inert, false, "reduced motion: hero links remain available");
reduced.root.dataset.horizonMotion = "enabled";
check(reduced.pendingMutations.size > 0, "opt-in: override attribute is observed");
reduced.flushMutations();
equal(reduced.frames.size, 1, "opt-in: mutation alone schedules zoom update");
reduced.flushFrames();
positiveProgress(reduced, "opt-in: reduced-motion visitor can explicitly enable zoom");
different(reduced.world.style.transform, reducedBase, "opt-in: landscape visibly changes");
check(Number(reduced.laptop.style.opacity) > 0, "opt-in: HTML interface becomes visible");
equal(reduced.heroCopy.inert, true, "opt-in: faded links are inert");
delete reduced.root.dataset.horizonMotion;
reduced.flushMutations(); reduced.flushFrames();
equal(reduced.progress(), 0, "cancel opt-in: zero progress restored");
equal(reduced.world.style.transform, reducedBase, "cancel opt-in: original framing restored");
equal(Number(reduced.laptop.style.opacity), 0, "cancel opt-in: interface hidden");
equal(reduced.heroCopy.inert, false, "cancel opt-in: hero links released");
reduced.setReduced(false); reduced.flushFrames();
positiveProgress(reduced, "OS preference change: normal motion resumes at current scroll position");
reduced.setReduced(true); reduced.flushFrames();
equal(reduced.progress(), 0, "OS preference change: reduced motion immediately stops zoom");
verifyCleanup(reduced, "reduced-motion cleanup");

// Legacy engines can expose scroll through window only, without IO support.
const fallback = createEnvironment({ scrollingElement: false, intersections: false });
fallback.scroll(700); fallback.flushFrames();
positiveProgress(fallback, "legacy fallback: window scroll works without scrollingElement");
equal(fallback.reveal.dataset.revealed, undefined, "legacy fallback: unsupported IO does not hide content");
verifyCleanup(fallback, "legacy fallback cleanup");

// Geometry fixture for a truly static layout: the controller must not divide a
// zero pinning range into a zoom, even if the preference override is present.
const staticLayout = createEnvironment({ height: 590, heroHeight: 590 });
staticLayout.root.dataset.horizonMotion = "enabled";
staticLayout.flushMutations();
staticLayout.scroll(700); staticLayout.flushFrames();
equal(staticLayout.progress(), 0, "static geometry: a one-screen hero never zooms");
equal(staticLayout.heroCopy.inert, false, "static geometry: links remain available");
finiteTransforms(staticLayout, "static geometry");
verifyCleanup(staticLayout, "static-layout cleanup");

process.stdout.write(JSON.stringify({
  passed: assertions,
  source: path.relative(process.cwd(), sourcePath).replaceAll("\\", "/"),
  method: "Actual LandingEffects transpiled with TypeScript and executed in node:vm; DOM/effect/RAF/observer doubles.",
  limits: "CSS compatibility and layout are not emulated; this does not replace native-browser verification of zoom, focus, image alignment or reduced-motion rendering.",
}, null, 2) + "\n");
