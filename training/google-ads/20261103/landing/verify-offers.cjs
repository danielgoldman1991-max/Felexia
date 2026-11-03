/* eslint-disable @typescript-eslint/no-require-imports -- Isolated server-rendered offer checks. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");

const root = path.resolve(__dirname, "../../../..");
const cache = new Map();
const checks = [];
function check(value, label) { assert.ok(value, label); checks.push(label); }
function load(relative) {
  let file = path.resolve(root, relative);
  if (!path.extname(file)) file = [".ts", ".tsx"].map(ext => file + ext).find(fs.existsSync);
  assert.ok(file && file.startsWith(root + path.sep), "Fixture stays inside the repository");
  if (cache.has(file)) return cache.get(file);
  const state = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(file, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true }, fileName: file,
  }).outputText;
  vm.runInNewContext(code, {
    exports: state.exports, module: state, URL, process: { env: {} },
    fetch() { throw new Error("No external request is permitted in offer SSR verification"); },
    require(name) {
      if (["react", "react/jsx-runtime", "lucide-react"].includes(name)) return require(name);
      if (name === "next/link") return { __esModule: true, default: ({ children, ...props }) => React.createElement("a", props, children) };
      if (name.endsWith(".css")) return { __esModule: true, default: new Proxy({}, { get: (_, key) => String(key) }) };
      if (name.endsWith("/LandingHeader")) return { LandingHeader: () => null };
      if (name.endsWith("/LandingFooter")) return { LandingFooter: () => null };
      if (name.startsWith("@/")) return load("src/" + name.slice(2));
      if (name.startsWith(".")) return load(path.relative(root, path.resolve(path.dirname(file), name)));
      throw new Error("Unexpected offer SSR dependency: " + name);
    },
  }, { filename: file });
  cache.set(file, state.exports);
  return state.exports;
}

const pages = {};
for (const route of ["essentiel", "pro"]) {
  const page = load("src/app/" + route + "/page.tsx");
  const html = renderToStaticMarkup(React.createElement(page.default));
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
  check(new Set(ids).size === ids.length, route + ": unique document IDs");
  check((html.match(/<h1\b/g) || []).length === 1, route + ": one H1");
  check(page.metadata.alternates.canonical === "https://www.felexia.pro/" + route, route + ": canonical keeps existing public URL");
  check(page.metadata.robots.index === true && page.metadata.robots.follow === true, route + ": explicit public indexing");
  for (const match of html.matchAll(/(?:aria-describedby|aria-labelledby)="([^"]+)"/g)) {
    for (const id of match[1].split(" ")) check(ids.includes(id), route + ": accessible reference resolves: " + id);
  }
  for (const match of html.matchAll(/href="#([^"]+)"/g)) check(ids.includes(match[1]), route + ": local navigation target resolves: " + match[1]);
  check(!html.includes("<form"), route + ": no unconnected form masquerades as a lead submission");
  check(html.includes("<details>") && html.includes("<summary>"), route + ": FAQ uses native keyboard-accessible disclosure");
  check(!html.includes("1290") && !html.includes("12900"), route + ": historical PRO contract prices stay private");
  pages[route] = html;
}

const essential = pages.essentiel;
const pro = pages.pro;
check(essential.includes("Logiciel de gestion pour PME au Maroc"), "ESSENTIEL addresses the commercial intent directly");
check(essential.includes("Commencer mes 15 jours gratuits") && essential.includes("Sans carte bancaire"), "ESSENTIEL has the real 15-day CTA and card-free conditions");
check((essential.match(/href="\/login\?mode=register"/g) || []).length === 2, "Both ESSENTIEL CTAs reach the real registration path");
check(essential.includes("99") && essential.includes("HT MAD / mois") && essential.includes("Jusqu’à 3"), "ESSENTIEL price and user limit are rendered from the catalogue");
check(essential.includes("logo") && essential.includes("ICE"), "ESSENTIEL explains the implemented invoice identity");
check(pro.includes("Un ERP pour piloter votre PME au Maroc") && pro.includes("Jusqu’à 25"), "PRO explains its target use and real user limit");
const mailLinks = [...pro.matchAll(/href="(mailto:[^"]+)"/g)].map(match => match[1].replaceAll("&amp;", "&"));
check(mailLinks.length === 2 && mailLinks.every(href => href === mailLinks[0]), "Both PRO CTAs open the same real quote draft");
const quote = new URL(mailLinks[0]);
check(quote.pathname === "contact@felexia.pro" && quote.searchParams.get("subject").includes("demande de devis"), "PRO uses the verified default business address and quote subject");
check(pro.includes("ouvre un brouillon") && pro.includes("vous devez envoyer votre message"), "PRO makes mail draft versus actual submission explicit");
check(!pro.includes("plan=pro") && !pro.includes("plan=premium"), "PRO does not route paid demand into a public trial or direct checkout");
check(pro.includes("uniquement ESSENTIEL") && pro.includes("pas un cycle de paie complet"), "PRO maintains trial and payroll scope boundaries");

const receipt = { passed: true, date: "2026-11-03", assertions: checks.length, scope: "Real offer page content and shared component rendered on the server with header/footer omitted and Next links rendered as anchors. No browser, network, mail, account, database, conversion transport or production claim.", checks };
fs.mkdirSync(__dirname, { recursive: true });
fs.writeFileSync(path.join(__dirname, "ssr-results.json"), JSON.stringify(receipt, null, 2) + "\n");
console.log(JSON.stringify({ passed: true, assertions: checks.length }));
