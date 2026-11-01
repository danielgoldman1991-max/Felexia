/*
 * Execute the actual widget TSX with controlled React, fetch and timer boundaries.
 * This checks conversation behavior; it does not emulate a browser or native dialog.
 */
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const assert = require("node:assert/strict");
const ts = require("typescript");

const repositoryRoot = path.resolve(__dirname, "../../..");
const sourcePath = "src/components/support/SupportAssistant.tsx";
const source = fs.readFileSync(path.join(repositoryRoot, sourcePath), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 },
}).outputText;

let slots = [];
let cursor = 0;
let effects = [];
const timers = new Map();
let timerId = 0;
let uid = 0;
const requests = [];
let fetchImplementation;
const checks = [];
function verify(condition, name) {
  assert.ok(condition, name);
  checks.push({ name, passed: true });
}

const react = {
  useId() {
    const index = cursor++;
    return slots[index] ?? (slots[index] = "id" + (++uid));
  },
  useRef(value) {
    const index = cursor++;
    return slots[index] ?? (slots[index] = { current: value });
  },
  useState(value) {
    const index = cursor++;
    if (!(index in slots)) slots[index] = typeof value === "function" ? value() : value;
    return [slots[index], (next) => { slots[index] = typeof next === "function" ? next(slots[index]) : next; }];
  },
  useEffect(run, dependencies) {
    const index = cursor++;
    const previous = slots[index];
    if (!previous || dependencies.some((value, dependencyIndex) => !Object.is(value, previous.dependencies[dependencyIndex]))) {
      effects.push(() => {
        previous?.cleanup?.();
        slots[index] = { dependencies, cleanup: run() };
      });
    }
  },
};

const jsx = (type, props, key) => ({ type, props: props ?? {}, key });
const moduleObject = { exports: {} };
const sandbox = {
  module: moduleObject,
  exports: moduleObject.exports,
  require(id) {
    if (id === "react") return react;
    if (id === "react/jsx-runtime") return { jsx, jsxs: jsx };
    if (id === "lucide-react") return new Proxy({}, { get: (_target, name) => "icon:" + String(name) });
    if (id === "@/lib/legal/legal-config") return { LEGAL_CONFIG: { legalEmail: "contact@felexia.pro" } };
    if (id === "@/lib/subscriptions/quote-contact") return { getProQuoteHref: () => "mailto:contact@felexia.pro?subject=PRO" };
    if (id.endsWith(".css")) return {};
    throw new Error("Unexpected dependency: " + id);
  },
  crypto: { randomUUID: () => "request-" + (++uid) },
  AbortController,
  URL,
  console,
  fetch(url, options) {
    requests.push(JSON.parse(options.body));
    return fetchImplementation(url, options);
  },
  window: {
    setTimeout(run, milliseconds) {
      const id = ++timerId;
      timers.set(id, { run, milliseconds });
      return id;
    },
    clearTimeout(id) { timers.delete(id); },
  },
};
vm.runInNewContext(compiled + "\nexports.__requestMessages = requestMessages;", sandbox, { filename: sourcePath });

function render() {
  cursor = 0;
  effects = [];
  const tree = moduleObject.exports.SupportAssistant();
  const pendingEffects = effects;
  effects = [];
  pendingEffects.forEach((run) => run());
  return tree;
}

function walk(node, predicate) {
  if (!node) return null;
  if (Array.isArray(node)) {
    for (const child of node) {
      const found = walk(child, predicate);
      if (found) return found;
    }
    return null;
  }
  if (typeof node !== "object") return null;
  if (predicate(node)) return node;
  return walk(node.props?.children, predicate);
}

function text(node) {
  if (Array.isArray(node)) return node.map(text).join("");
  if (node && typeof node === "object") return typeof node.type === "function" ? text(node.type(node.props)) : text(node.props?.children);
  return String(node ?? "");
}

const button = (tree, label) => walk(tree, (node) => node.type === "button" && (node.props["aria-label"] === label || text(node) === label));
function draft(tree, value) {
  walk(tree, (node) => node.type === "textarea").props.onChange({ target: { value } });
  return render();
}
function submit(tree) {
  walk(tree, (node) => node.type === "form").props.onSubmit({ preventDefault() {} });
}
const messages = (tree) => walk(tree, (node) => node.props.role === "log");
async function flushRequests() { for (let index = 0; index < 8; index++) await Promise.resolve(); }

async function main() {
  fetchImplementation = async () => ({ ok: false, status: 429, headers: { get: () => "2" } });
  let tree = render();
  const teamLink = walk(tree, (node) => node.type === "a" && node.props["aria-label"] === "Felexia Team sur WhatsApp");
  verify(Boolean(button(tree, "Ouvrir Felexia IA")), "Named AI launcher is available");
  verify(teamLink?.props.href === "https://wa.me/212614505090", "Team launcher points only to the requested WhatsApp number");
  verify(teamLink.props.target === "_blank" && /noopener/.test(teamLink.props.rel) && /noreferrer/.test(teamLink.props.rel), "WhatsApp opens a protected separate tab without any automatic transmission");
  verify(text(messages(tree)) === "", "Conversation starts completely empty");
  verify(!walk(walk(tree, (node) => node.type === "dialog"), (node) => node.type === "a"), "Chat panel contains no secondary information links");
  button(tree, "Ouvrir Felexia IA").props.onClick();
  tree = draft(render(), "What can ESSENTIEL do?");
  submit(tree);
  await flushRequests();
  tree = render();
  verify(requests.length === 1, "Initial question submitted");
  verify(Boolean(button(tree, "Réessayer dans 2 s")), "429 response exposes retry countdown");

  button(tree, "Commencer une nouvelle conversation").props.onClick();
  tree = render();
  verify(!walk(tree, (node) => node.props.role === "alert"), "New conversation clears previous error");
  verify(!walk(tree, (node) => node.type === "button" && text(node).startsWith("Réessayer")), "New conversation has no retry for empty history");
  verify(text(tree).includes("Réessayez dans 2 s"), "Cooldown remains visible after reset");
  tree = draft(tree, "A fresh question");
  verify(button(tree, "Envoyer votre question").props.disabled, "Sending remains disabled during cooldown");
  submit(tree);
  verify(requests.length === 1, "Reset cannot bypass request cooldown");

  for (let index = 0; index < 2; index++) {
    const entry = [...timers.entries()].find(([, item]) => item.milliseconds === 1_000);
    verify(Boolean(entry), "Cooldown timer exists at step " + (index + 1));
    timers.delete(entry[0]);
    entry[1].run();
    tree = render();
  }
  verify(!walk(tree, (node) => node.type === "button" && text(node).startsWith("Réessayer")), "Cooldown completion does not recreate empty-history retry");
  verify(requests.length === 1, "Reset and cooldown never submit a request");
  verify(!button(tree, "Envoyer votre question").props.disabled, "Sending is re-enabled after cooldown");

  fetchImplementation = async () => ({ ok: true, status: 200, json: async () => ({ reply: "Useful answer", sources: [{ id: "help", href: "/pricing", title: "A source card" }], suggestions: ["A suggested next question"], mode: "knowledge" }), headers: { get: () => null } });
  submit(tree);
  await flushRequests();
  tree = render();
  verify(requests.length === 2, "A fresh question is submitted after cooldown");
  verify(requests[1].messages.length === 1 && requests[1].messages[0].role === "user", "Fresh conversation contains one user question");
  verify(text(tree).includes("Useful answer"), "Successful answer appears in conversation");
  verify(!text(tree).includes("A source card") && !text(tree).includes("A suggested next question") && !text(tree).includes("Réponse de la base"), "Only chat messages are shown, without source cards, suggested prompts or mode badges");

  const trim = moduleObject.exports.__requestMessages;
  verify(trim([]).length === 0, "Empty context is rejected");
  verify(trim([{ id: "x", role: "assistant", content: "bad ending" }]).length === 0, "Context ending with assistant is rejected");
  const history = [];
  for (let index = 0; index < 12; index++) {
    history.push({ id: "u" + index, role: "user", content: "q".repeat(2_000) }, { id: "a" + index, role: "assistant", content: "a".repeat(6_000) });
  }
  history.push({ id: "current", role: "user", content: "c".repeat(2_000) });
  const recent = trim(history);
  verify(recent.length === 3, "Large history retains a complete recent turn within budget");
  verify(recent.at(-1).content === "c".repeat(2_000), "Current question is preserved");
  verify(recent.reduce((length, message) => length + message.content.length, 0) <= 16_000, "Context stays within 16000 characters");
  verify(recent[0].role === "user" && recent[1].role === "assistant", "Previous conversation turn keeps user/assistant ordering");
  verify(trim(history.map((message) => ({ ...message, content: "short" }))).length === 11, "Context stays within eleven messages");

  let resolveSlowResponse;
  fetchImplementation = () => new Promise((resolve) => { resolveSlowResponse = resolve; });
  walk(tree, (node) => node.type === "textarea").props.onChange({ target: { value: "Another question" } });
  tree = render();
  walk(tree, (node) => node.type === "form").props.onSubmit({ preventDefault() {} });
  tree = render();
  button(tree, "Commencer une nouvelle conversation").props.onClick();
  tree = render();
  // Deliberately resolve after cancellation: the component must discard the stale result.
  resolveSlowResponse({ ok: true, status: 200, json: async () => ({ reply: "stale response", sources: [], mode: "knowledge" }) });
  await flushRequests();
  tree = render();
  verify(text(messages(tree)) === "", "Reset during pending request returns to an empty conversation");
  verify(!text(tree).includes("stale response"), "Response from previous conversation is discarded");
  verify(!requests.some((request) => request.messages.length === 0), "No empty context is ever sent");

  let stoppedSignal;
  fetchImplementation = (_url, options) => new Promise((_resolve, reject) => {
    stoppedSignal = options.signal;
    options.signal.addEventListener("abort", () => reject(new Error("aborted")), { once: true });
  });
  tree = draft(tree, "Keep this question if I stop");
  submit(tree);
  tree = render();
  button(tree, "Interrompre la réponse").props.onClick();
  await flushRequests();
  tree = render();
  verify(stoppedSignal.aborted, "Stop aborts the pending HTTP request");
  verify(text(tree).includes("La réponse a été interrompue."), "Stop gives a concise recoverable status");
  verify(Boolean(button(tree, "Réessayer")), "Stopped question remains retryable");
  fetchImplementation = async () => ({ ok: true, status: 200, json: async () => ({ reply: "Retry answer", mode: "knowledge" }) });
  const beforeRetry = requests.length;
  button(tree, "Réessayer").props.onClick();
  await flushRequests();
  tree = render();
  verify(requests.length === beforeRetry + 1 && requests.at(-1).messages.length === 1 && requests.at(-1).messages[0].content === "Keep this question if I stop", "Retry preserves the original question without a duplicate turn");
  verify(text(messages(tree)).includes("Retry answer"), "Retried answer is rendered");

  const report = {
    date: new Date().toISOString(),
    passed: true,
    source: sourcePath,
    assertions: checks.length,
    method: "Actual widget TSX transpiled with TypeScript and executed in node:vm with React state/effect, fetch, and timer boundaries controlled.",
    limits: "No browser is emulated. Native dialog focus, visual layout, keyboard integration, and actual network/model behavior require separate verification.",
    checks,
  };
  const output = path.join(repositoryRoot, "training/ht-chat-sides/20261101/widget-fixtures.json");
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify({ passed: true, assertions: checks.length, source: sourcePath }));
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
