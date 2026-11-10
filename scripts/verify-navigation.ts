// Pure navigation checks: static registries and synthetic URLs only; no application data or network requests.
import assert from "node:assert/strict";
import { getVisibleNavigationSections, resolveNavigationLocation } from "../src/components/layout/navigation-model";
import { lightSections, sections, type SidebarSection } from "../src/components/layout/sidebar-data";
import { isOperatorPathAllowed, isOperatorRole } from "../src/lib/auth/operator-access";
import { ORGANIZATION_ROLES } from "../src/lib/auth/roles";

let assertions = 0;
function equal(actual: unknown, expected: unknown, message: string) {
  assert.deepStrictEqual(actual, expected, message);
  assertions += 1;
}
function same(actual: unknown, expected: unknown, message: string) {
  assert.strictEqual(actual, expected, message);
  assertions += 1;
}

type VisibilityOptions = Parameters<typeof getVisibleNavigationSections>[0];

// Baseline is the published Sidebar visibility logic, independent of the new helper.
function publishedVisibility({ fullAccess, operator, showWelcomeGuide, enabledModules }: VisibilityOptions) {
  return (fullAccess ? sections : lightSections).map((section) => {
    const items = section.items?.filter((item) => !operator || isOperatorPathAllowed(item.href));
    const href = operator && items?.length && !isOperatorPathAllowed(section.href) ? items[0].href : section.href;
    return operator && section.key === "settings"
      ? { ...section, label: "Mon compte", href: "/parametres/profil", items }
      : { ...section, href, items };
  }).filter((section) => {
    if (section.hidden) return false;
    if (operator && !isOperatorPathAllowed(section.href) && !(section.items?.length)) return false;
    if (section.key === "welcome") return showWelcomeGuide;
    if (!section.moduleKey) return true;
    return enabledModules?.includes(section.moduleKey) ?? false;
  });
}

function freezeRegistry(registry: SidebarSection[]) {
  for (const section of registry) {
    for (const item of section.items ?? []) Object.freeze(item);
    if (section.items) Object.freeze(section.items);
    Object.freeze(section);
  }
  Object.freeze(registry);
}
freezeRegistry(sections);
freezeRegistry(lightSections);

const allModules = [...new Set(sections.flatMap((section) => section.moduleKey ? [section.moduleKey] : []))];
let visibilityCases = 0;
for (let mask = 0; mask < 2 ** allModules.length; mask += 1) {
  const enabledModules = Object.freeze(allModules.filter((_, index) => Boolean(mask & (1 << index))));
  for (const fullAccess of [false, true]) for (const operator of [false, true]) for (const showWelcomeGuide of [false, true]) {
    const options = { fullAccess, operator, showWelcomeGuide, enabledModules };
    equal(getVisibleNavigationSections(options), publishedVisibility(options), `Visibility differs for ${JSON.stringify(options)}`);
    visibilityCases += 1;
  }
}
for (const enabledModules of [undefined, null]) {
  const options = { fullAccess: true, operator: false, showWelcomeGuide: true, enabledModules };
  equal(getVisibleNavigationSections(options), publishedVisibility(options), "Missing module information preserves the published behavior");
}

for (const role of [...ORGANIZATION_ROLES, "operateur", "opérateur", " OpÉrAtEuR ", "unknown", ""]) {
  for (const fullAccess of [false, true]) {
    const operator = isOperatorRole(role);
    const options = { fullAccess, operator, showWelcomeGuide: true, enabledModules: allModules };
    const visible = getVisibleNavigationSections(options);
    equal(visible, publishedVisibility(options), `Real role policy differs for ${role}`);
    equal(visible.find((section) => section.key === "settings")?.href, operator ? "/parametres/profil" : "/parametres", `Settings destination for ${role}`);
    if (operator) {
      equal(visible.every((section) => isOperatorPathAllowed(section.href)), true, `Denied section destination exposed for ${role}`);
      equal(visible.every((section) => section.items?.every((item) => isOperatorPathAllowed(item.href)) ?? true), true, `Denied child exposed for ${role}`);
    }
  }
}

const full = getVisibleNavigationSections({ fullAccess: true, operator: false, showWelcomeGuide: true, enabledModules: allModules });
const light = getVisibleNavigationSections({ fullAccess: false, operator: false, showWelcomeGuide: false });
const operator = getVisibleNavigationSections({ fullAccess: true, operator: true, showWelcomeGuide: true, enabledModules: allModules });

// Concrete registry expectations catch policy drift even if both implementations change.
equal(full.map((section) => section.key), ["dashboard", "welcome", "achats", "ventes", "articles", "facturation", "stock", "tresorerie", "rh", "comptabilite", "documents", "settings"], "Full ERP section inventory");
equal(light.map((section) => section.key), ["dashboard", "ventes", "achats", "tresorerie", "journaux", "settings"], "ESSENTIEL section inventory");
equal(operator.map((section) => section.key), ["dashboard", "achats", "ventes", "articles", "facturation", "stock", "tresorerie", "comptabilite", "settings"], "Operator section inventory");
equal(getVisibleNavigationSections({ fullAccess: true, operator: false, showWelcomeGuide: false }).map((section) => section.key), ["dashboard", "settings"], "Full ERP without enabled modules exposes only common sections");
equal(light.find((section) => section.key === "ventes")?.items?.map((item) => item.href), ["/facturation/factures", "/facturation/electronique", "/tiers/clients", "/facturation/paiements"], "ESSENTIEL sales destinations remain available");
equal(operator.find((section) => section.key === "comptabilite")?.items?.map((item) => item.href), ["/comptabilite/ecritures", "/comptabilite/journaux"], "Operator accounting destinations stay limited");
equal(operator.find((section) => section.key === "achats")?.href, "/achats/fournisseurs", "Operator purchase entry uses its first allowed destination");
equal(operator.find((section) => section.key === "facturation")?.href, "/facturation/factures", "Operator billing entry uses its first allowed destination");
equal(full.find((section) => section.key === "settings")?.label, "Paramètres", "Nonoperator settings label stays unchanged");
equal(operator.find((section) => section.key === "settings")?.label, "Mon compte", "Operator settings label stays unchanged");

function location(registry: SidebarSection[], pathname: string, query: URLSearchParams | string = "") {
  const resolved = resolveNavigationLocation(registry, pathname, query);
  if (resolved.sectionKey) {
    same(resolved.section, registry.find((section) => section.key === resolved.sectionKey), "Return the original visible section");
    if (resolved.item) {
      same(resolved.item, resolved.section?.items?.find((item) => item === resolved.item), "Return the original item");
      equal(registry.flatMap((section) => (section.items ?? []).filter((item) => !item.hidden && section.key === resolved.sectionKey && item.href === resolved.itemHref)).length, 1, "Exactly one visible item receives the active marker");
    }
  }
  return { sectionKey: resolved.sectionKey, itemHref: resolved.itemHref, isExact: resolved.isExact };
}

const actualCases: [SidebarSection[], string, string, string | undefined, string | undefined, boolean][] = [
  [full, "/facturation/factures", "", "facturation", "/facturation/factures", true],
  [full, "/facturation/factures", "?paymentStatus=unpaid", "facturation", "/facturation/factures?paymentStatus=unpaid", true],
  [full, "/facturation/factures", "paymentStatus=unpaid&page=2&search=Atlas", "facturation", "/facturation/factures?paymentStatus=unpaid", true],
  [full, "/facturation/factures", "paymentStatus=paid", "facturation", "/facturation/factures", true],
  [full, "/facturation/factures", "paymentStatus=UNPAID", "facturation", "/facturation/factures", true],
  [full, "/facturation/factures", "paymentStatus=unpaid-extra", "facturation", "/facturation/factures", true],
  [full, "/facturation/factures/example/edit", "", "facturation", "/facturation/factures", false],
  [full, "/facturation/relances/file", "", "facturation", "/facturation/relances/file", true],
  [full, "/facturation/relances/regles/new", "", "facturation", "/facturation/relances/regles", false],
  [full, "/stock", "", "stock", "/stock", true],
  [full, "/stock/emplacements/example/edit", "", "stock", "/stock/emplacements", false],
  [full, "/stock/inventaire/sessions/example", "", "stock", "/stock/inventaire/sessions", false],
  [full, "/stockage", "", undefined, undefined, false],
  [full, "/rh/paie", "", "rh", "/rh/paie", true],
  [full, "/rh/paie/reference", "", "rh", "/rh/paie/reference", true],
  [full, "/rh/paie/bulletins/example", "", "rh", "/rh/paie/bulletins", false],
  [full, "/tresorerie/rapprochement/regles/new", "", "tresorerie", "/tresorerie/rapprochement/regles", false],
  [full, "/comptabilite", "", "comptabilite", undefined, true],
  [full, "/dashboard/", "", "dashboard", undefined, true],
  [full, "/does-not-exist", "", undefined, undefined, false],
  [light, "/facturation/factures", "paymentStatus=unpaid", "ventes", "/facturation/factures", true],
  [light, "/tiers/clients/example", "", "ventes", "/tiers/clients", false],
  [light, "/achats/avoirs/new", "", "achats", "/achats/avoirs", false],
  [light, "/rh/employes", "", undefined, undefined, false],
  [operator, "/parametres/profil", "", "settings", undefined, true],
  [operator, "/parametres/entreprise", "", undefined, undefined, false],
  [operator, "/rh/paie", "", undefined, undefined, false],
];
for (const [registry, pathname, query, sectionKey, itemHref, isExact] of actualCases) {
  equal(location(registry, pathname, query), { sectionKey, itemHref, isExact }, `Wrong winner for ${pathname}?${query}`);
}

const disabledStock = getVisibleNavigationSections({ fullAccess: true, operator: false, showWelcomeGuide: true, enabledModules: allModules.filter((key) => key !== "stock") });
equal(location(disabledStock, "/stock/inventaire"), { sectionKey: undefined, itemHref: undefined, isExact: false }, "Disabled module cannot win");

const icon = sections[0].icon;
const synthetic: SidebarSection[] = [{ key: "custom", label: "Custom", href: "/custom", icon, items: [
  { label: "General", href: "/custom/list" },
  { label: "One query", href: "/custom/list?status=unpaid" },
  { label: "Two queries", href: "/custom/list?status=unpaid&kind=invoice" },
  { label: "Repeated queries", href: "/custom/list?tag=a&tag=a" },
  { label: "Empty query", href: "/custom/list?tag=" },
  { label: "Encoded query", href: "/custom/list?label=%C3%A0+payer" },
  { label: "Specific path", href: "/custom/list/detail" },
  { label: "Hidden child", href: "/custom/list/deeper", hidden: true },
] }, { key: "hidden", label: "Hidden section", href: "/custom/list/private", icon, hidden: true }];
freezeRegistry(synthetic);
for (const [query, expected] of [
  ["kind=invoice&status=unpaid", "/custom/list?status=unpaid&kind=invoice"],
  ["tag=a&tag=a&extra=b", "/custom/list?tag=a&tag=a"],
  ["tag=a", "/custom/list"],
  ["tag=", "/custom/list?tag="],
  ["label=%C3%A0%20payer", "/custom/list?label=%C3%A0+payer"],
] as const) equal(location(synthetic, "/custom/list", query).itemHref, expected, `Query subset ${query}`);
equal(location(synthetic, "/custom/list/deeper").itemHref, "/custom/list", "Hidden item never selected");
equal(location(synthetic, "/custom/list/private").sectionKey, "custom", "Hidden section never selected");
equal(location(synthetic, "/custom/list/detail", "status=unpaid&kind=invoice").itemHref, "/custom/list/detail", "A longer path wins over a query-specific ancestor");
const params = new URLSearchParams("tag=a&tag=a&status=unpaid");
const before = params.toString();
resolveNavigationLocation(synthetic, "/custom/list", params);
equal(params.toString(), before, "Caller URLSearchParams is not mutated");
equal(location(synthetic, "/custom/list/deep", "status=unpaid").isExact, false, "Query match cannot make descendant exact");

console.log(JSON.stringify({ passed: true, assertions, visibilityCases, realRouteCases: actualCases.length, allModules }));
