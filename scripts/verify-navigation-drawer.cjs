// Execute the real Sidebar effects with isolated React/DOM dependencies.
// No browser layout, credentials, network, server actions or business data.
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { resolve } = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");

const args = process.argv.slice(2);
if (args.length && (args.length !== 2 || args[0] !== "--source-file")) {
  throw new Error("Usage: node scripts/verify-navigation-drawer.cjs [--source-file path]");
}
const source = readFileSync(resolve(args[1] ?? "src/components/layout/sidebar.tsx"), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
    jsx: ts.JsxEmit.ReactJSX,
    esModuleInterop: true,
  },
}).outputText;

let checks = 0;
const equal = (actual, expected, message) => {
  assert.equal(actual, expected, message);
  checks += 1;
};

function mount({ mobileOpen = true, desktop = false, rootOverflow = "", bodyOverflow = "", connected = true, visible = true } = {}) {
  const effects = [], listeners = new Map(), frames = new Map(), cancelledFrames = [];
  let nextFrame = 0, closeCalls = 0;
  const document = { body: { style: { overflow: bodyOverflow } }, documentElement: { style: { overflow: rootOverflow } } };
  class Element {
    constructor(name, options = {}) {
      Object.assign(this, { name, tabIndex: 0, disabled: false, excluded: false, isConnected: true, visible: true, focuses: [] }, options);
    }
    getClientRects() { return this.visible ? [{}] : []; }
    matches(selector) { assert.equal(selector, ":disabled"); return this.disabled; }
    closest(selector) { assert.equal(selector, "[inert],[hidden]"); return this.excluded ? this : null; }
    contains(node) { return this === node; }
    focus(options) { this.focuses.push(options); document.activeElement = this; }
    querySelector() { return null; }
    querySelectorAll() { return []; }
  }
  const opener = new Element("opener", { isConnected: connected, visible });
  const first = new Element("first"), close = new Element("close"), last = new Element("last");
  const disabled = new Element("disabled", { disabled: true });
  const hidden = new Element("hidden", { excluded: true });
  const negative = new Element("negative", { tabIndex: -1 });
  const notDisplayed = new Element("not-displayed", { visible: false });
  const sidebar = new Element("sidebar");
  sidebar.querySelectorAll = () => [disabled, hidden, negative, notDisplayed, first, close, last];
  document.activeElement = opener;
  document.addEventListener = (type, callback) => {
    if (!listeners.has(type)) listeners.set(type, new Set());
    listeners.get(type).add(callback);
  };
  document.removeEventListener = (type, callback) => {
    const group = listeners.get(type);
    group?.delete(callback);
    if (group?.size === 0) listeners.delete(type);
  };
  const jsx = (type, props, key) => ({ type, props: props ?? {}, key });
  const stub = () => null;
  const dependencies = {
    react: {
      useEffect(effect) { effects.push(effect); },
      useMemo(callback) { return callback(); },
      useRef(value) { return { current: value }; },
      useState(value) { return [typeof value === "function" ? value() : value, () => {}]; },
    },
    "react/jsx-runtime": { jsx, jsxs: jsx, Fragment: Symbol("Fragment") },
    "next/link": stub,
    "next/navigation": { usePathname: () => "/dashboard", useSearchParams: () => new URLSearchParams() },
    "lucide-react": new Proxy({}, { get: () => stub }),
    "@/components/brand/BrandLogo": { BrandLogo: stub },
    "@/components/layout/help-dropdown": { HelpDropdown: stub },
    "@/components/notifications/notification-dropdown": { NotificationDropdown: stub },
    "@/components/layout/navigation-model": {
      getVisibleNavigationSections: () => [],
      resolveNavigationLocation: () => ({}),
    },
    "@/lib/utils": { cn: (...parts) => parts.filter(Boolean).join(" "), initials: () => "QA" },
    "@/lib/auth/roles": { getRoleLabel: () => "Utilisateur" },
    "@/lib/auth/operator-access": { isOperatorRole: () => false },
  };
  const exported = {};
  vm.runInNewContext(compiled, {
    exports: exported,
    module: { exports: exported },
    document,
    HTMLElement: Element,
    URLSearchParams,
    requestAnimationFrame(callback) { const id = ++nextFrame; frames.set(id, callback); return id; },
    cancelAnimationFrame(id) { cancelledFrames.push(id); frames.delete(id); },
    require(name) {
      if (!Object.hasOwn(dependencies, name)) throw new Error(`Unexpected Sidebar dependency: ${name}`);
      return dependencies[name];
    },
  }, { filename: "sidebar-under-test.js" });
  const tree = exported.Sidebar({ mobileOpen, desktop, onCloseMobile: () => { closeCalls += 1; } });
  let aside;
  function attach(node) {
    if (Array.isArray(node)) { node.forEach(attach); return; }
    if (!node || typeof node !== "object" || !node.props) return;
    if (node.props.id === "app-sidebar") aside = node;
    if (node.props.ref) {
      node.props.ref.current = node.props.id === "app-sidebar" ? sidebar
        : node.props["aria-label"] === "Fermer le menu" ? close : new Element("ref");
    }
    attach(node.props.children);
  }
  attach(tree);
  assert.ok(aside, "The actual Sidebar must render its aside");
  const cleanups = effects.map(effect => effect()).filter(cleanup => typeof cleanup === "function");
  return {
    document, opener, first, close, last, sidebar, aside, frames, cancelledFrames, listeners,
    get closeCalls() { return closeCalls; },
    flushFrames() { for (const [id, callback] of [...frames]) { frames.delete(id); callback(); } },
    key(key, options = {}) {
      const event = { key, shiftKey: false, defaultPrevented: false, preventDefault() { this.defaultPrevented = true; }, ...options };
      for (const callback of listeners.get("keydown") ?? []) callback(event);
      return event;
    },
    cleanup() { for (const cleanup of cleanups.toReversed()) cleanup(); },
  };
}

const variants = ["", "auto", "scroll", "clip", "hidden"];
let scenarios = 0;
for (const rootOverflow of variants) for (const bodyOverflow of variants) {
  const app = mount({ rootOverflow, bodyOverflow });
  scenarios += 1;
  equal(app.document.documentElement.style.overflow, "hidden", "Open mobile drawer locks the root viewport");
  equal(app.document.body.style.overflow, "hidden", "Open mobile drawer locks body");
  equal(app.aside.props.inert, false, "Open drawer remains interactive");
  equal(app.aside.props.role, "dialog", "Mobile drawer is a dialog");
  equal(app.aside.props["aria-modal"], true, "Mobile dialog is modal");
  equal(app.frames.size, 1, "One initial focus frame is scheduled");
  app.flushFrames();
  equal(app.document.activeElement, app.close, "Initial focus enters the close control");
  app.document.activeElement = app.last;
  equal(app.key("Tab").defaultPrevented, true, "Tab wraps at the end");
  equal(app.document.activeElement, app.first, "Disabled, hidden and negative-index nodes are excluded");
  equal(app.key("Tab", { shiftKey: true }).defaultPrevented, true, "Shift-Tab wraps at the start");
  equal(app.document.activeElement, app.last, "Reverse wrap enters last enabled node");
  app.document.activeElement = app.opener;
  app.key("Tab");
  equal(app.document.activeElement, app.first, "Focus outside the modal returns inside");
  app.key("Escape", { defaultPrevented: true });
  equal(app.closeCalls, 0, "An Escape handled by a nested popup does not close the drawer");
  equal(app.key("Escape").defaultPrevented, true, "Unhandled Escape is consumed");
  equal(app.closeCalls, 1, "Unhandled Escape requests one close");
  app.cleanup();
  equal(app.document.documentElement.style.overflow, rootOverflow, "Exact root overflow is restored");
  equal(app.document.body.style.overflow, bodyOverflow, "Exact body overflow is restored");
  equal(app.document.activeElement, app.opener, "Focus returns to the connected visible opener");
  equal(app.opener.focuses.at(-1)?.preventScroll, true, "Focus restoration preserves scroll position");
  equal(app.listeners.size, 0, "Every listener is removed");
  equal(app.frames.size, 0, "No animation frame remains");
  equal(app.cancelledFrames.length, 1, "The scheduled focus frame is cleaned up");
}

for (const mobileOpen of [false, true]) for (const desktop of [false, true]) {
  if (mobileOpen && !desktop) continue;
  const app = mount({ mobileOpen, desktop, rootOverflow: "clip", bodyOverflow: "scroll" });
  scenarios += 1;
  equal(app.document.documentElement.style.overflow, "clip", "Desktop/closed drawer leaves root overflow intact");
  equal(app.document.body.style.overflow, "scroll", "Desktop/closed drawer leaves body overflow intact");
  equal(app.aside.props.inert, !desktop && !mobileOpen, "Only a closed mobile drawer is inert");
  equal(app.aside.props.role, undefined, "Desktop/closed drawer has no modal role");
  equal(app.frames.size, 0, "Desktop/closed drawer does not move focus");
  equal(app.listeners.has("keydown"), false, "Desktop/closed drawer installs no modal keyboard listener");
  app.cleanup();
  equal(app.listeners.size, 0, "Non-modal listeners also clean up");
}

for (const options of [{ connected: false }, { visible: false }]) {
  const app = mount(options);
  scenarios += 1;
  app.flushFrames();
  app.cleanup();
  equal(app.opener.focuses.length, 0, "Disconnected or hidden openers are not refocused");
  equal(app.document.documentElement.style.overflow, "", "Root overflow still restores without a focus target");
  equal(app.document.body.style.overflow, "", "Body overflow still restores without a focus target");
  equal(app.listeners.size, 0, "Cleanup still removes listeners without a focus target");
}

const unmountedBeforeFrame = mount();
unmountedBeforeFrame.cleanup();
scenarios += 1;
equal(unmountedBeforeFrame.frames.size, 0, "Unmount before RAF cancels pending focus work");
equal(unmountedBeforeFrame.document.documentElement.style.overflow, "", "Early unmount restores root overflow");
equal(unmountedBeforeFrame.document.body.style.overflow, "", "Early unmount restores body overflow");
equal(unmountedBeforeFrame.listeners.size, 0, "Early unmount removes every listener");

console.log(JSON.stringify({
  passed: true,
  assertions: checks,
  scenarios,
  method: "Actual Sidebar transpiled with installed TypeScript; real effects run with controlled React hooks, document, focus and RAF.",
  limits: "No browser layout or wheel simulation; native browser QA verifies actual scrolling with global overflow-x: clip.",
}));
