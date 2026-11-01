import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { getPlanDefinition } from "../../../src/lib/subscriptions/plans";
import { DEFAULT_TRIAL_DURATION_LABEL } from "../../../src/lib/subscriptions/trial-config";
import { SUPPORT_KNOWLEDGE_ARTICLES, SUPPORT_KNOWLEDGE_VERSION } from "../../../src/lib/support/knowledge";
import { normalizeSupportQuery, searchSupportKnowledge } from "../../../src/lib/support/knowledge-search";

const checks: Array<{ name: string; passed: true }> = [];
function check(name: string, condition: unknown) {
  assert(condition, name);
  checks.push({ name, passed: true });
}
const byId = (id: string) => SUPPORT_KNOWLEDGE_ARTICLES.find((article) => article.id === id)!;
const corpus = SUPPORT_KNOWLEDGE_ARTICLES.map((article) => article.content).join("\n");
check("Curated product coverage spans at least thirty public topics", SUPPORT_KNOWLEDGE_ARTICLES.length >= 30);
check("Knowledge IDs are unique", new Set(SUPPORT_KNOWLEDGE_ARTICLES.map((article) => article.id)).size === SUPPORT_KNOWLEDGE_ARTICLES.length);
check("Every article has content, keywords and an internal reference", SUPPORT_KNOWLEDGE_ARTICLES.every((article) => article.title && article.content.length > 100 && article.keywords.length > 0 && article.href.startsWith("/") && !article.href.startsWith("//")));
check("No tenant, user or QA UUID enters public knowledge", !/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i.test(corpus));
check("No private bearer or API credentials enter public knowledge", !/Bearer\s+\S+|eyJ[A-Za-z0-9_-]{25,}|sk_live_|sk_test_|service_role|SUPABASE_SERVICE_ROLE/i.test(corpus));
check("No historic PRO price is exposed", !/1[\s\u202f]*290|12[\s\u202f]*900/.test(corpus));
const essential = getPlanDefinition("essentiel");
check("Approved ESSENTIEL monthly tariff is99 MAD", essential.monthlyPrice === 99 && essential.currency === "MAD");
check("Approved annual tariff is1188 MAD without a discount", essential.yearlyPrice === 1188 && essential.yearlyPrice === essential.monthlyPrice * 12);
check("Monthly HT price follows the plan configuration", byId("essential-pricing").content.includes(essential.monthlyPrice.toLocaleString("fr-FR") + " HT MAD /mois"));
check("Annual HT price follows the plan configuration", byId("essential-pricing").content.includes(essential.yearlyPrice.toLocaleString("fr-FR") + " HT MAD /an"));
check("Knowledge explicitly excludes annual savings", byId("essential-pricing").content.includes("sans remise") && !/deux mois offerts|two monthly payments|شهرين/.test(byId("essential-pricing").content));
check("Trial duration follows the actual trial config", byId("trial").content.includes(DEFAULT_TRIAL_DURATION_LABEL));
check("PRO user quota follows the actual plan config", byId("pro").content.includes(String(getPlanDefinition("premium").limits.users) + " utilisateurs"));
check("PRO quotation-only policy is explicit", byId("pro").content.includes("exclusivement sur devis") && byId("pro").content.includes("Aucun montant mensuel/annuel PRO"));
check("DGI acceptance is never inferred from an XML export", byId("dgi-signature").content.includes("ces capacités officielles ne sont pas activées"));
check("Email status action does not pretend to send email", byId("invoice-email").content.includes("ce bouton n’envoie pas d’email"));
check("Inventory is accurately marked reserved", byId("stock").content.includes("Inventaire reste un écran réservé"));
check("Payroll is accurately marked preparatory", byId("payroll").content.includes("paie de PRO est préparatoire"));
check("RH forms are not advertised as complete", byId("hr").content.includes("consultation sans tous les formulaires"));
check("Visitor bot cannot see private tenant data", byId("support-scope").content.includes("Il ne voit pas les comptes ou données d’entreprise"));
check("Human support uses the published Felexia Team WhatsApp", byId("contact").content.includes("Felexia Team") && byId("contact").content.includes("https://wa.me/212614505090") && !byId("contact").content.includes("Aucun numéro de téléphone"));
check("Accents and punctuation normalize consistently", normalizeSupportQuery("TRÉSORERIE / D’ACHAT") === "tresorerie d achat");
check("Arabic diacritics and alif variants normalize consistently", normalizeSupportQuery("إِلَى أَمَان") === "الي امان");

const scenarios: Array<[string, string, number]> = [
  ["Combien coûte Essentiel ?", "essential-pricing", 1],
  ["prix PRO", "pro", 3],
  ["ch7al taman essentiel", "essential-pricing", 1],
  ["بشحال الثمن ديال البرنامج", "essential-pricing", 1],
  ["How much is the monthly plan?", "essential-pricing", 1],
  ["prx essntiel", "essential-pricing", 3],
  ["facturre client", "sales-invoices", 1],
  ["factrue client", "sales-invoices", 1],
  ["Can I send invoices by email?", "invoice-email", 1],
  ["نسيت كلمة السر", "login", 1],
  ["الفاتورة الإلكترونية واش مطابقة DGI", "dgi-signature", 1],
  ["gestion des congés", "hr", 1],
  ["inventory stock", "unfinished-features", 3],
  ["Je veux parler à un humain", "contact", 1],
  ["بغيت نهضر مع إنسان", "contact", 1],
  ["عرض السعر ديال pro", "pro", 1],
  ["devis commercial client", "commercial-cycle", 1],
  ["What about payroll and salary slips?", "payroll", 1],
  ["عندي مشكل فالكونيكسيون", "troubleshooting", 1],
  ["privacy and security of customer data", "privacy-security", 1],
  ["reconciliation forecast cashflow", "reconciliation-forecast", 1],
  ["numérotation compteur référence", "numbering", 1],
  ["abonnement expiré renouvellement", "subscription", 1],
  ["Business ancienne offre", "legacy-offers", 1],
];
for (const [query, expected, top] of scenarios) {
  check(`Retrieval: ${query}`, searchSupportKnowledge(query, top).some((article) => article.id === expected));
}
check("Unknown topics return scope and human help", searchSupportKnowledge("What is a rocket engine?").map((article) => article.id).join(",") === "support-scope,contact");
check("Empty prompt has a useful product introduction", searchSupportKnowledge("")[0]?.id === "overview");
check("Limit never exceeds eight articles", searchSupportKnowledge("Felexia ERP gestion entreprise factures achats stock TVA RH paiements abonnement contact", 999).length <= 8);
check("Invalid numeric limit is bounded", searchSupportKnowledge("facture", Number.NaN).length <= 5 && searchSupportKnowledge("facture", -4).length === 1);
check("Large untrusted text remains bounded to curated results", searchSupportKnowledge("nonsense ".repeat(50000), 2).length <= 2);
check("Retrieval never returns content outside the curated corpus", scenarios.every(([query]) => searchSupportKnowledge(query).every((article) => SUPPORT_KNOWLEDGE_ARTICLES.includes(article))));

const report = { passed: true, version: SUPPORT_KNOWLEDGE_VERSION, articles: SUPPORT_KNOWLEDGE_ARTICLES.length, assertions: checks.length, checks };
const reportDirectory = resolve(process.cwd(), "training/support-assistant/20261101");
mkdirSync(reportDirectory, { recursive: true });
writeFileSync(resolve(reportDirectory, "knowledge-fixtures.json"), JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify({ passed: true, articles: report.articles, assertions: report.assertions }));
