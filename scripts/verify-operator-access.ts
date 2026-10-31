import assert from "node:assert/strict";
import { getOperatorDestination, isOperatorPathAllowed, isOperatorRole } from "../src/lib/auth/operator-access";
import { getRoleLabel, isAdminRole, isReadOnlyRole } from "../src/lib/auth/roles";

const id = "0c1d0c3e-7b4e-4e2e-a51e-21fc0f2f4bf1";
const business = ["/facturation/factures/new", `/facturation/factures/${id}`, `/facturation/factures/${id}/paiement`,
  "/facturation/paiements/new", `/facturation/paiements/${id}/affecter`, "/facturation/avoirs/new",
  "/achats/factures/new", `/achats/factures/${id}/edit`, "/achats/paiements/new", "/achats/fournisseurs",
  "/tiers/clients", "/tiers/fournisseurs", "/tiers/new?type=customer", "/tiers/new?type=supplier", `/tiers/${id}/edit`];
for (const path of business) {
  assert.equal(isOperatorPathAllowed(path), true, path);
  assert.equal(isOperatorPathAllowed(path, "POST"), true, path);
}
const consultation = ["/dashboard", "/tresorerie", "/tresorerie/comptes", `/tresorerie/comptes/${id}`,
  "/tresorerie/mouvements", `/tresorerie/mouvements/${id}`, "/comptabilite/journaux",
  `/comptabilite/journaux/${id}/export`, `/comptabilite/journaux/${id}/print`, `/comptabilite/ecritures/${id}`];
for (const path of consultation) {
  assert.equal(isOperatorPathAllowed(path), true, path);
  assert.equal(isOperatorPathAllowed(path, "POST"), false, path);
}
const restricted = ["/parametres/entreprise", "/parametres/utilisateurs", "/parametres/roles", "/parametres/abonnement",
  "/parametres/numerotation", "/parametres/documents", "/parametres/modules", "/onboarding/entreprise",
  "/articles/new", "/stock", "/rh", "/tiers/new?type=prospect", "/tresorerie/comptes/new",
  `/tresorerie/comptes/${id}/edit`, "/tresorerie/mouvements/new", "/tresorerie/rapprochement",
  "/comptabilite/ecritures/nouveau", "/comptabilite/plan-comptable", `/comptabilite/ecritures/${id}/edit`,
  "/api/stripe/checkout", "/api/stripe/portal", "/api/subscriptions/start-trial", "/api/invitations",
  "https://example.com", "//example.com", "/\\example.com", "/%invalid", "/facturation/factures/../../parametres/roles",
  "/facturation/factures/%2e%2e/%2e%2e/parametres/roles"];
for (const path of restricted) {
  assert.equal(isOperatorPathAllowed(path), false, path);
  assert.equal(isOperatorPathAllowed(path, "POST"), false, path);
}
assert.equal(getOperatorDestination("/parametres"), "/parametres/profil");
assert.equal(getOperatorDestination("/parametres/roles"), "/dashboard");
assert.equal(getOperatorDestination("/facturation/factures"), null);
assert.equal(getRoleLabel("operator"), "Opérateur");
assert.equal(isOperatorRole("operator"), true);
assert.equal(isOperatorRole(" Opérateur "), true);
assert.equal(getRoleLabel("operateur"), "Opérateur");
assert.equal(isAdminRole("operator"), false);
assert.equal(isReadOnlyRole("operator"), false);
for (const path of ["/parametres/profil", "/parametres/preferences", "/parametres/securite"]) assert.equal(isOperatorPathAllowed(path, "POST"), true);
console.log(`Opérateur : ${business.length} parcours métier, ${consultation.length} consultations et ${restricted.length} refus, identité et accès personnels vérifiés.`);
