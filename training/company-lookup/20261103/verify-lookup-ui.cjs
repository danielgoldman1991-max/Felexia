/* Execute the real lookup TSX with controlled React/fetch boundaries.
 * This verifies request and result handling, not a browser or external provider.
 */
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const assert = require("node:assert/strict");
const ts = require("typescript");

const root = path.resolve(__dirname, "../../..");
let slots = [];
let cursor = 0;
let requests = [];
let manual = [];
let confirmed = [];
let fetchImplementation;
let clockNow = Date.UTC(2026, 10, 3, 14);
let nextTimer = 0;
let effects = new Map();
let pendingEffects = [];
const timers = new Map();
let errorToasts = [];
let successToasts = [];
class ClockDate extends Date {
  constructor(...args) { super(...(args.length ? args : [clockNow])); }
  static now() { return clockNow; }
}
const checks = [];
const jsx = (type, props) => ({ type, props: props ?? {} });
const react = {
  useState(value) {
    const index = cursor++;
    if (!(index in slots)) slots[index] = value;
    return [slots[index], (next) => { slots[index] = typeof next === "function" ? next(slots[index]) : next; }];
  },
  useRef(value) {
    const index = cursor++;
    return slots[index] ?? (slots[index] = { current: value });
  },
  useEffect(callback, dependencies) {
    const index = cursor++;
    const previous = effects.get(index);
    if (!previous || !dependencies || dependencies.some((value, at) => !Object.is(value, previous.dependencies[at]))) {
      pendingEffects.push(() => {
        previous?.cleanup?.();
        effects.set(index, { dependencies: dependencies ? [...dependencies] : null, cleanup: callback() });
      });
    }
  },
};

function load(filename, imports = {}) {
  const loaded = { exports: {} };
  const output = ts.transpileModule(fs.readFileSync(path.join(root, filename), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  vm.runInNewContext(output, {
    module: loaded, exports: loaded.exports,
    Date: ClockDate,
    window: {
      setInterval(callback, delay) { const id = ++nextTimer; timers.set(id, { callback, delay }); return id; },
      clearInterval(id) { timers.delete(id); },
    },
    require(name) {
      if (name in imports) return imports[name];
      throw Error("Unexpected import " + name);
    },
    fetch(url, options) {
      requests.push({ url, options, body: JSON.parse(options.body) });
      return fetchImplementation(url, options);
    },
  }, { filename });
  return loaded.exports;
}

const parser = load("src/lib/ice/ice.ts");
const component = load("src/components/onboarding/CompanyLookupStep.tsx", {
  react,
  "react/jsx-runtime": { jsx, jsxs: jsx },
  "sonner": { toast: { success(message) { successToasts.push(message); }, error(message) { errorToasts.push(message); } } },
  "lucide-react": new Proxy({}, { get: (_target, name) => "icon:" + String(name) }),
  "@/lib/ice/ice": parser,
  "@/components/ui/button": { Button: "button" },
});

function render() {
  cursor = 0;
  pendingEffects = [];
  const tree = component.CompanyLookupStep({
    onConfirm(payload) { confirmed.push(payload); },
    onManual(payload) { manual.push(payload); },
  });
  for (const run of pendingEffects) run();
  return tree;
}
function find(node, predicate) {
  if (Array.isArray(node)) {
    for (const child of node) { const found = find(child, predicate); if (found) return found; }
    return null;
  }
  if (!node || typeof node !== "object") return null;
  return predicate(node) ? node : find(node.props?.children, predicate);
}
function findAll(node, predicate) {
  if (Array.isArray(node)) return node.flatMap(child => findAll(child, predicate));
  if (!node || typeof node !== "object") return [];
  return [...(predicate(node) ? [node] : []), ...findAll(node.props?.children, predicate)];
}
function text(node) {
  if (Array.isArray(node)) return node.map(text).join("");
  return node && typeof node === "object" ? text(node.props?.children) : String(node ?? "");
}
const input = (tree) => find(tree, (node) => node.type === "input");
const button = (tree, label) => find(tree, (node) => node.type === "button" && text(node) === label);
const alert = (tree) => find(tree, (node) => node.props.role === "alert");
const statusNotice = (tree) => find(tree, (node) => node.props.role === "status");
const candidateList = tree => find(tree, node => node.type === "ul" && node.props["aria-label"] === "Entreprises proches de votre recherche");
const candidateButtons = tree => findAll(candidateList(tree), node => node.type === "button");
const resultModal = tree => find(tree, node => typeof node.type === "function" && node.type.name === "ResultModal");
function enter(tree) { input(tree).props.onKeyDown({ key: "Enter", preventDefault() {} }); }
function query(tree, value) { input(tree).props.onChange({ target: { value } }); return render(); }
function unmount() { for (const effect of effects.values()) effect.cleanup?.(); effects = new Map(); }
function reset() { unmount(); slots = []; cursor = 0; requests = []; manual = []; confirmed = []; errorToasts = []; successToasts = []; return render(); }
function advance(milliseconds) { clockNow += milliseconds; for (const timer of [...timers.values()]) timer.callback(); return render(); }
function ok(condition, label) { assert.ok(condition, label); checks.push(label); }
async function flush() { for (let index = 0; index < 10; index++) await Promise.resolve(); }
const response = (body, status = 200, headers = {}) => ({ ok: status >= 200 && status < 300, status, headers: new Headers(headers), json: async () => body });

async function main() {
  let resolveSearch;
  fetchImplementation = () => new Promise((resolve) => { resolveSearch = resolve; });
  let tree = query(reset(), "  001 234 567 890 123  ");
  const staleInputTree = tree;
  enter(tree);
  enter(staleInputTree);
  button(staleInputTree, "Rechercher").props.onClick();
  ok(requests.length === 1, "Repeated Enter/click before React rerender starts one lookup");
  ok(requests[0].url === "/api/company/search" && requests[0].options.method === "POST", "Lookup uses the authenticated same-origin search route");
  ok(requests[0].body.query === "001234567890123", "ICE is normalized before submission");
  tree = render();
  ok(input(tree).props.disabled === true, "Query is locked during a pending request to avoid stale results");
  resolveSearch(response({ status: "unavailable", message: "Service temporairement indisponible." }));
  await flush();
  tree = render();
  ok(text(alert(tree)).includes("Service temporairement indisponible."), "HTTP 200 unavailable response leaves a persistent visible message");
  ok(text(alert(render())).includes("Service temporairement indisponible."), "Failure message survives rerender rather than relying on a toast");
  ok(input(tree).props.disabled === false, "Input is released after provider failure");
  button(alert(tree), "Continuer manuellement").props.onClick();
  ok(manual[0].result.ice === "001234567890123" && manual[0].result.source === "manual", "Manual continuation preserves the ICE without inventing company data");

  for (const [status, httpStatus] of [["blocked", 200], ["invalid_input", 400], ["unavailable", 502], ["ambiguous", 200]]) {
    const message = status === "ambiguous" ? "Plusieurs entreprises correspondent à ce nom. Précisez la raison sociale ou utilisez l’ICE à quinze chiffres." : "Erreur vérifiable " + httpStatus;
    fetchImplementation = async () => response({ status, message }, httpStatus);
    tree = query(reset(), "  société   exemple  ");
    enter(tree); await flush(); tree = render();
    ok(text(alert(tree)).includes(message), `${status}/${httpStatus} remains visible with retry and manual actions`);
    if (status === "ambiguous") ok(text(alert(tree)).includes("Recherche à préciser"), "Ambiguous companies ask for a more precise search instead of implying provider failure");
    ok(Boolean(button(alert(tree), "Réessayer")) && Boolean(button(alert(tree), "Continuer manuellement")), "A failed lookup offers retry and manual entry");
    button(alert(tree), "Continuer manuellement").props.onClick();
    ok(manual[0].result.raisonSociale === "SOCIÉTÉ EXEMPLE", "Manual continuation preserves the normalized company name");
    tree = query(tree, "Autre société");
    ok(!alert(tree), "Editing the query removes the previous failure message");
  }

  fetchImplementation = async () => response({ status: "rate_limited", message: "Limite de recherches atteinte.", retryAfterSeconds: 10 }, 429, { "Retry-After": "10" });
  tree = query(reset(), "felexia");
  const beforeQuotaRender = tree;
  enter(tree); await flush();
  // Ref deadline must guard stale closures before the disabled button is rendered.
  enter(beforeQuotaRender);
  button(beforeQuotaRender, "Rechercher").props.onClick();
  tree = render();
  ok(requests.length === 1, "A real quota response blocks repeated Enter and stale clicks even before React rerenders");
  ok(!alert(tree) && text(statusNotice(tree)).includes("Patientez avant de réessayer"), "Quota exhaustion is a timed status notice rather than a provider outage");
  ok(errorToasts.length === 0, "A quota notice does not duplicate a transient provider-error toast");
  ok(button(tree, "Rechercher").props.disabled === true && button(statusNotice(tree), "Réessayer dans 10 s").props.disabled === true, "Both search and retry are disabled during the server-supplied wait");
  ok(Boolean(button(statusNotice(tree), "Continuer manuellement")), "Manual continuation remains available while quota is exhausted");
  tree = advance(1000);
  ok(text(statusNotice(tree)).includes("dans 9 secondes") && Boolean(button(statusNotice(tree), "Réessayer dans 9 s")), "The visible quota countdown advances from ten to nine seconds");
  tree = query(tree, "FELEXIA CONSEILS");
  ok(text(statusNotice(tree)).includes("dans 9 secondes") && button(tree, "Rechercher").props.disabled === true, "Changing the query does not erase an active server quota deadline");
  button(statusNotice(tree), "Continuer manuellement").props.onClick();
  ok(manual[0].result.raisonSociale === "FELEXIA CONSEILS", "Manual continuation during cooldown uses the newly edited legal name");
  tree = advance(9000);
  ok(text(statusNotice(tree)).includes("Vous pouvez relancer la recherche") && button(tree, "Rechercher").props.disabled === false && button(statusNotice(tree), "Réessayer").props.disabled === false, "At expiry the search and retry controls unlock without requiring page reload");
  ok(timers.size === 0, "The quota timer is cleaned up when its countdown reaches zero");
  fetchImplementation = async () => response({ status: "not_found", message: "Aucun résultat confirmé." });
  button(statusNotice(tree), "Réessayer").props.onClick(); await flush(); tree = render();
  ok(requests.length === 2 && requests[1].body.query === "FELEXIA CONSEILS" && !statusNotice(tree), "The first retry after expiry submits the current query and clears the quota notice");

  fetchImplementation = async () => response({ status: "unavailable", message: "Trop de recherches." }, 429, { "Retry-After": "3" });
  tree = query(reset(), "felexia"); enter(tree); await flush(); tree = render();
  ok(!alert(tree) && Boolean(button(statusNotice(tree), "Réessayer dans 3 s")), "An old-format HTTP 429 response is normalized into the same timed quota notice");
  ok(timers.size === 1, "A pending quota deadline owns one active countdown timer");
  unmount();
  ok(timers.size === 0, "Unmounting the lookup step clears its pending countdown timer");

  fetchImplementation = async () => ({ ok: false, status: 429, headers: new Headers({ "Retry-After": "2" }), json: async () => { throw Error("bad upstream JSON"); } });
  tree = query(reset(), "felexia"); enter(tree); await flush(); tree = render();
  ok(!alert(tree) && Boolean(button(statusNotice(tree), "Réessayer dans 2 s")), "A quota response with malformed JSON still honors its Retry-After header");
  fetchImplementation = async () => response({ status: "rate_limited", retryAfterSeconds: 0 }, 429);
  tree = query(reset(), "felexia"); enter(tree); await flush(); tree = render();
  ok(Boolean(button(statusNotice(tree), "Réessayer dans 30 s")), "A malformed zero quota duration cannot create an immediate retry loop");
  tree = advance(30_000);
  ok(button(tree, "Rechercher").props.disabled === false, "A conservative fallback quota duration also expires normally");

  fetchImplementation = async () => { throw Error("Synthetic network failure"); };
  tree = query(reset(), "Exemple"); enter(tree); await flush(); tree = render();
  ok(Boolean(alert(tree)) && text(alert(tree)).includes("continuer manuellement"), "Network failure has a persistent manual fallback");
  fetchImplementation = async () => ({ ok: false, status: 502, json: async () => { throw Error("not JSON"); } });
  button(alert(tree), "Réessayer").props.onClick(); await flush(); tree = render();
  ok(requests.length === 2 && Boolean(alert(tree)), "Retry after failure is possible and malformed JSON is visible");

  fetchImplementation = async () => response({ status: "not_found", message: "Aucun résultat confirmé." });
  tree = query(reset(), "Exemple"); enter(tree); await flush(); tree = render();
  ok(Boolean(find(tree, (node) => typeof node.type === "function" && node.type.name === "NotFoundState")), "Not-found behavior remains distinct from provider failure");

  fetchImplementation = async () => response({ status: "found", message: "Trouvée", result: {
    source: "cache", query: "EXEMPLE", found: true, raisonSociale: "EXEMPLE SARL", ice: "001234567890123", confidence: "high",
  } });
  tree = query(reset(), "Exemple"); enter(tree); await flush(); tree = render();
  const modal = find(tree, (node) => typeof node.type === "function" && node.type.name === "ResultModal");
  ok(Boolean(modal) && !alert(tree), "Found result still opens the confirmation modal");
  ok(confirmed.length === 0 && manual.length === 0, "Searching never creates or confirms a company automatically");
  modal.props.onConfirm();
  ok(confirmed[0].result.raisonSociale === "EXEMPLE SARL" && confirmed[0].result.ice === "001234567890123", "Explicit confirmation passes the actual returned company data");

  const candidate = (ice, name = "ATLAS CONSEIL") => ({
    source: "managepro", query: "CONSEIL", found: true,
    raisonSociale: name, ice, rc: "RC-" + ice.slice(-3), villeRc: "Casablanca", formeJuridique: "SARL", confidence: "medium",
  });
  const first = candidate("001234567890101");
  const second = candidate("001234567890202");
  const multiple = { status: "ambiguous", message: "Choisissez une entreprise.", candidates: [first, second], candidateCount: 2, candidatesTruncated: false };
  fetchImplementation = async () => response(multiple);
  tree = query(reset(), "conseil"); enter(tree); await flush(); tree = render();
  ok(Boolean(candidateList(tree)) && candidateButtons(tree).length === 2 && !alert(tree), "A partial-name response displays its companies instead of an ambiguity error");
  ok(text(statusNotice(tree)).includes("2 entreprises proposées"), "The number of visible company choices is announced as a status");
  ok(text(candidateList(tree)).includes(first.ice) && text(candidateList(tree)).includes(first.rc) && text(candidateList(tree)).includes("Casablanca"), "Each company choice exposes identity fields needed to distinguish legal entities");
  ok(candidateButtons(tree).every(node => node.props["aria-label"].includes("ATLAS CONSEIL") && /ICE \d{15}$/.test(node.props["aria-label"])), "Homonymous company buttons have distinct accessible names including their ICE");
  ok(!resultModal(tree) && confirmed.length === 0 && manual.length === 0, "Receiving several companies neither chooses nor confirms the first company");
  candidateButtons(tree)[1].props.onClick(); tree = render();
  let chosenModal = resultModal(tree);
  ok(chosenModal?.props.result.ice === second.ice && chosenModal.props.result.rc === second.rc, "Choosing the second company opens its own confirmation data");
  ok(confirmed.length === 0 && requests.length === 1, "Choosing a company requires later confirmation and does not issue another lookup");
  chosenModal.props.onClose(); tree = render();
  ok(!resultModal(tree) && candidateButtons(tree).length === 2, "Closing company details returns to the unchanged company choices");
  candidateButtons(tree)[1].props.onClick(); tree = render();
  resultModal(tree).props.onBack(); tree = render();
  ok(!resultModal(tree) && candidateButtons(tree).length === 2, "The explicit return-to-results action preserves all choices");
  candidateButtons(tree)[1].props.onClick(); tree = render();
  resultModal(tree).props.onConfirm(); tree = render();
  ok(confirmed.length === 1 && confirmed[0].result.ice === second.ice && confirmed[0].result.rc === second.rc, "Only explicit confirmation sends the selected second company's exact prefill");
  ok(!resultModal(tree) && requests.length === 1, "Confirming a selection closes its details without consuming another search");

  tree = query(reset(), "conseil"); enter(tree); await flush(); tree = render();
  candidateButtons(tree)[1].props.onClick(); tree = render();
  resultModal(tree).props.onModify(); tree = render();
  ok(manual.length === 1 && manual[0].result.ice === second.ice && manual[0].result.raisonSociale === second.raisonSociale, "Manual modification starts with the selected company's data rather than the partial query");
  ok(confirmed.length === 0, "Manual modification does not also confirm the company");

  tree = query(reset(), "conseil"); enter(tree); await flush(); tree = render();
  candidateButtons(tree)[1].props.onClick(); tree = render();
  tree = query(tree, "Autre société");
  ok(!candidateList(tree) && !resultModal(tree), "Changing the query clears both previous company choices and selected details");
  tree = query(tree, "conseil"); enter(tree); await flush(); tree = render();
  fetchImplementation = () => new Promise(resolve => { resolveSearch = resolve; });
  button(tree, "Rechercher").props.onClick(); tree = render();
  ok(!candidateList(tree) && !resultModal(tree) && input(tree).props.disabled, "Starting another search removes stale choices while the new request is pending");
  resolveSearch(response({ status: "not_found", message: "Aucun résultat confirmé." })); await flush(); tree = render();

  const addiSuggestion = { ...candidate("002173923000040", "ADDIOUI NEGOCE"), query: "ADDI NEGOCE", rc: "17507", villeRc: "Inzegane" };
  fetchImplementation = async () => response({ status: "ambiguous", candidates: [addiSuggestion], candidateCount: 1 });
  tree = query(reset(), "ADDI NEGOCE"); enter(tree); await flush(); tree = render();
  ok(candidateButtons(tree).length === 1 && text(statusNotice(tree)).includes("1 entreprise proposée"), "A sole nearby ADDIOUI identity is displayed as a singular suggestion for ADDI NEGOCE");
  ok(!resultModal(tree) && confirmed.length === 0 && !successToasts.length, "A sole partial-name suggestion neither opens details nor announces an exact match automatically");
  candidateButtons(tree)[0].props.onClick(); tree = render();
  ok(resultModal(tree)?.props.result.raisonSociale === "ADDIOUI NEGOCE" && resultModal(tree).props.result.ice === "002173923000040", "Choosing the nearby company retains its actual legal name and ICE");
  resultModal(tree).props.onConfirm(); tree = render();
  ok(confirmed.length === 1 && confirmed[0].result.raisonSociale === "ADDIOUI NEGOCE" && confirmed[0].result.ice === "002173923000040" && requests.length === 1, "Confirming a nearby company prefills the actual source identity without renaming it to the query");

  const trueAddi = { ...candidate("002207267000009", "ADDI NEGOCE"), source: "marocfacture", query: "ADDI NEGOCE", rc: "93771", villeRc: "MARRAKECH" };
  fetchImplementation = async () => response({ status: "ambiguous", candidates: [trueAddi, addiSuggestion], candidateCount: 2 });
  tree = query(reset(), "ADDI NEGOCE"); enter(tree); await flush(); tree = render();
  ok(candidateButtons(tree).length === 2 && candidateButtons(tree)[0].props["aria-label"].includes("002207267000009"), "The real exact ADDI company stays distinguishable from the nearby ADDIOUI company");
  candidateButtons(tree)[0].props.onClick(); tree = render();
  ok(resultModal(tree)?.props.result.source === "marocfacture" && resultModal(tree).props.result.rc === "93771", "Selecting the complementary-source company opens its own source record and RC");
  resultModal(tree).props.onConfirm(); tree = render();
  ok(confirmed.length === 1 && confirmed[0].result.raisonSociale === "ADDI NEGOCE" && confirmed[0].result.ice === "002207267000009" && confirmed[0].result.source === "marocfacture", "Explicit confirmation forwards the real ADDI identity and complementary source unchanged");

  const many = Array.from({ length: 12 }, (_, index) => candidate(String(index + 1).padStart(15, "0"), "CONSEIL " + (index + 1)));
  fetchImplementation = async () => response({ status: "ambiguous", candidates: [null, { ...first, ice: "123" }, { ...first, raisonSociale: "" }, { ...first, found: false }, many[0], ...many], candidateCount: 12, candidatesTruncated: true });
  tree = query(reset(), "conseil"); enter(tree); await flush(); tree = render();
  ok(candidateButtons(tree).length === 10, "Malformed choices and duplicate ICEs are removed and no more than ten are rendered");
  ok(candidateButtons(tree)[0].props["aria-label"].includes("CONSEIL 1"), "The source's ranked order is retained after defensive validation");
  ok(text(tree).includes("D’autres entreprises correspondent"), "A truncated list explains how to refine the name or use an ICE");
  ok(!resultModal(tree) && confirmed.length === 0, "A capped result list still leaves the company choice to the user");

  fetchImplementation = async () => response({ status: "ambiguous", message: "Recherche à préciser.", candidates: [{ ...first, found: false }, { ...second, ice: "invalid" }] });
  tree = query(reset(), "conseil"); enter(tree); await flush(); tree = render();
  ok(!candidateList(tree) && Boolean(alert(tree)) && !resultModal(tree), "An old or malformed ambiguous response retains an actionable fallback without false identity choices");
  console.log(JSON.stringify({ passed: checks.length, checks }, null, 2));
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
