import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { Page } from "@playwright/test";

export type Verdict = "OK" | "bug" | "manquant" | "à améliorer" | "non testé";

export type Finding = {
  module: string;
  operation: string;
  verdict: Verdict;
  detail: string;
  steps?: string;
  screenshot?: string;
  priority?: "P0" | "P1" | "P2";
};

const artifacts = process.env.E2E_ARTIFACTS ?? path.join(process.cwd(), "test-results", "pro");

export const findings: Finding[] = [];

export function record(finding: Finding) {
  findings.push(finding);
  const mark = finding.verdict === "OK" ? "OK" : finding.verdict.toUpperCase();
  console.log(`[${mark}] ${finding.module} — ${finding.operation}: ${finding.detail}`);
}

export function saveJournal() {
  mkdirSync(artifacts, { recursive: true });
  const file = path.join(artifacts, "journal.json");
  writeFileSync(file, JSON.stringify(findings, null, 2));
  return file;
}

export function artifactPath(name: string) {
  mkdirSync(artifacts, { recursive: true });
  return path.join(artifacts, name);
}

export async function shot(page: Page, name: string) {
  const file = artifactPath(name.endsWith(".png") ? name : `${name}.png`);
  await page.screenshot({ path: file, fullPage: true });
  return file;
}

export function psql(sql: string) {
  const host = process.env.E2E_DB_HOST ?? "127.0.0.1";
  const port = process.env.E2E_DB_PORT ?? "54322";
  const user = process.env.E2E_DB_USER ?? "supabase_admin";
  const database = process.env.E2E_DB_NAME ?? "postgres";
  const password = process.env.E2E_DB_PASSWORD ?? "postgres";
  return execFileSync(
    "psql",
    ["-h", host, "-p", port, "-U", user, "-d", database, "-v", "ON_ERROR_STOP=1", "-t", "-A", "-c", sql],
    { env: { ...process.env, PGPASSWORD: password }, encoding: "utf8" },
  ).trim();
}

export function psqlJson<T>(sql: string): T {
  const raw = psql(`select coalesce(json_agg(t), '[]'::json)::text from (${sql}) t`);
  return JSON.parse(raw || "[]") as T;
}

export const OWNER = {
  firstName: "Amina",
  lastName: "Bennani",
  email: process.env.E2E_OWNER_EMAIL ?? "qa.owner.pro@felexia.test",
  password: process.env.E2E_OWNER_PASSWORD ?? "Felexia-Pro-2026!",
};

export const COMPANY = {
  name: "Atlas Negoce SARL",
  forme: "SARL",
  ice: "001234567000084",
  ifNumber: "48591230",
  rc: "123456",
  villeRc: "Casablanca",
  cnss: "9845127",
  adresse: "12 boulevard Abdelmoumen",
  ville: "Casablanca",
  telephone: "+212 522 10 10 10",
  activite: "Négoce de matériel électrique",
  secteur: "Commerce",
};

export const USERS = {
  admin: { email: "qa.admin.pro@felexia.test", role: "admin", label: "Administrateur" },
  accountant: { email: "qa.comptable.pro@felexia.test", role: "accountant", label: "Comptable" },
  operator: { email: "qa.commercial.pro@felexia.test", role: "operator", label: "Opérateur" },
  viewer: { email: "qa.lecteur.pro@felexia.test", role: "viewer", label: "Lecture seule" },
  essentiel: { email: "qa.essentiel.pro@felexia.test", role: "admin", label: "Essentiel" },
} as const;

export const PASSWORD = OWNER.password;

export const PRO_ROUTES = [
  ["/dashboard", "Pilotage"],
  ["/bienvenue", "Guide"],
  ["/tiers/clients", "Clients"],
  ["/tiers/prospects", "Prospects"],
  ["/tiers/new?type=customer", "Nouveau client"],
  ["/vente/devis", "Devis"],
  ["/vente/commandes", "Commandes"],
  ["/vente/livraisons", "Livraisons"],
  ["/vente/retours", "Retours"],
  ["/articles/produits", "Produits"],
  ["/articles/services", "Services"],
  ["/articles/categories", "Catégories"],
  ["/articles/unites", "Unités"],
  ["/articles/tva", "TVA articles"],
  ["/facturation/factures", "Factures"],
  ["/facturation/electronique", "E-facture"],
  ["/facturation/avoirs", "Avoirs"],
  ["/facturation/paiements", "Règlements"],
  ["/facturation/relances", "Relances"],
  ["/achats", "Achats"],
  ["/achats/fournisseurs", "Fournisseurs"],
  ["/achats/commandes", "Commandes fournisseurs"],
  ["/achats/receptions", "Réceptions"],
  ["/achats/factures", "Factures fournisseurs"],
  ["/achats/paiements", "Règlements fournisseurs"],
  ["/achats/avoirs", "Avoirs fournisseurs"],
  ["/stock", "Stock"],
  ["/stock/emplacements", "Emplacements"],
  ["/stock/mouvements", "Mouvements"],
  ["/stock/transferts", "Transferts"],
  ["/stock/inventaire", "Inventaire"],
  ["/stock/ajustements/new", "Ajustement"],
  ["/tresorerie", "Trésorerie"],
  ["/tresorerie/comptes", "Comptes"],
  ["/tresorerie/mouvements", "Mouvements trésorerie"],
  ["/tresorerie/releves", "Relevés"],
  ["/tresorerie/rapprochement", "Rapprochement"],
  ["/tresorerie/previsions", "Prévisions"],
  ["/tresorerie/consultation", "Consultation trésorerie"],
  ["/comptabilite", "Comptabilité"],
  ["/comptabilite/plan-comptable", "Plan comptable"],
  ["/comptabilite/journaux", "Journaux"],
  ["/comptabilite/ecritures", "Écritures"],
  ["/comptabilite/grand-livre", "Grand livre"],
  ["/comptabilite/balance", "Balance"],
  ["/comptabilite/lettrage", "Lettrage"],
  ["/comptabilite/exercices", "Exercices"],
  ["/comptabilite/tva", "TVA"],
  ["/rh/dashboard", "RH"],
  ["/rh/employes", "Employés"],
  ["/rh/contrats", "Contrats"],
  ["/rh/conges", "Congés"],
  ["/rh/paie", "Paie"],
  ["/documents", "GED"],
  ["/outils/audit-log", "Audit"],
  ["/parametres", "Paramètres"],
  ["/parametres/entreprise", "Entreprise"],
  ["/parametres/utilisateurs", "Utilisateurs"],
  ["/parametres/roles", "Rôles"],
  ["/parametres/numerotation", "Numérotation"],
  ["/parametres/abonnement", "Abonnement"],
  ["/agenda", "Agenda"],
] as const;
