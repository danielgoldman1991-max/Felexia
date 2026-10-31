import assert from "node:assert/strict";
import { getLaunchDestination, isLaunchPathAvailable } from "../src/lib/launch-profile";
import { lightSections } from "../src/components/layout/sidebar-data";
import { GLOBAL_SEARCH_REGISTRY } from "../src/lib/global-search-registry";

const invoiceId = "41b90309-8ca7-459f-a115-a847f9694053";
const keptPaths = [
  "/dashboard", "/onboarding/entreprise", "/bienvenue", "/parametres/modules",
  "/facturation/factures/new", `/facturation/factures/${invoiceId}/paiement`,
  `/facturation/factures/${invoiceId}/print`, "/facturation/paiements/new",
  "/facturation/avoirs/new", "/achats/factures/new", "/achats/paiements/new",
  "/tiers/clients", "/tiers/fournisseurs", "/tiers/new?type=supplier",
  `/tiers/${invoiceId}/edit`, "/articles/services", "/tresorerie",
  "/tresorerie/comptes/new", "/tresorerie/mouvements/new",
  "/comptabilite/journaux", `/comptabilite/journaux/${invoiceId}/export`,
  `/comptabilite/journaux/${invoiceId}/print`, "/comptabilite/ecritures/nouveau",
];
for (const path of keptPaths) {
  assert.equal(isLaunchPathAvailable(path), true, `Le parcours essentiel doit rester accessible : ${path}`);
  assert.equal(getLaunchDestination(path), null, `Pas de redirection du parcours essentiel : ${path}`);
}

const onRequestPaths = [
  "/stock", "/stock/mouvements", "/stock/entrees/new", "/rh/dashboard",
  "/documents", "/agenda", "/outils", "/rapports", "/vente/devis/new",
  "/vente/livraisons", "/achats/receptions/new", "/achats/commandes",
  "/comptabilite/plan-comptable", "/comptabilite/grand-livre", "/comptabilite/balance",
  "/comptabilite/tva/declarations/new", "/comptabilite/plan-comptable/init",
  "/tresorerie/previsions/export", "/tresorerie/rapprochement", "/tiers/prospects",
  "/tiers/new?type=prospect",
];
for (const path of onRequestPaths) {
  assert.equal(isLaunchPathAvailable(path), false, `Module complémentaire masqué : ${path}`);
  assert.equal(getLaunchDestination(path), "/parametres/modules", `Module proposé sur demande : ${path}`);
  assert.equal(isLaunchPathAvailable(path, true), true, `Le profil complet conserve le module : ${path}`);
  assert.equal(getLaunchDestination(path, true), null, `Le profil complet conserve son URL : ${path}`);
}

assert.equal(getLaunchDestination("/comptabilite"), "/comptabilite/journaux");
assert.equal(getLaunchDestination("/vente"), "/facturation/factures");
assert.equal(getLaunchDestination("/achats"), "/achats/factures");
assert.equal(getLaunchDestination(`/factures/${invoiceId}`), `/facturation/factures/${invoiceId}`);
assert.equal(isLaunchPathAvailable("/stock/../comptabilite/balance"), false);
assert.equal(isLaunchPathAvailable("/comptabilite/journaux/../balance"), false);
for (const path of ["https://example.com", "//example.com", "/\\example.com", "/%invalid"]) {
  assert.equal(isLaunchPathAvailable(path, true), false, `Aucun lien externe ou invalide : ${path}`);
}

assert.deepEqual(lightSections.map((section) => section.label), ["Accueil", "Ventes", "Achats", "Trésorerie", "Journaux", "Paramètres"]);
for (const section of lightSections) {
  for (const item of [section, ...(section.items ?? [])]) {
    assert.equal(isLaunchPathAvailable(item.href), true, `Menu sans impasse : ${item.href}`);
  }
}
const visibleSearchResults = GLOBAL_SEARCH_REGISTRY.filter((result) => isLaunchPathAvailable(result.href));
assert.ok(visibleSearchResults.some((result) => result.href === "/comptabilite/journaux"));
assert.ok(visibleSearchResults.some((result) => result.href === "/achats/factures/new"));
assert.ok(!visibleSearchResults.some((result) => result.category === "Stock"));
console.log(`Version light : ${keptPaths.length} parcours conservés, ${onRequestPaths.length} modules/écrans sur demande, 6 menus, profil complet et recherche vérifiés.`);
