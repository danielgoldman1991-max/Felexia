import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseThirdPartyCsv, reviewThirdPartyRows, THIRD_PARTY_IMPORT_TEMPLATE } from "../src/lib/tiers/third-party-import";
import { toCsv, zipStore } from "../src/lib/export/archive";

const valid = parseThirdPartyCsv(THIRD_PARTY_IMPORT_TEMPLATE);
assert.equal(valid.headerError, undefined);
assert.equal(valid.issues.length, 0);
assert.equal(valid.rows[0]?.name, "Atelier Démo");
assert.equal(valid.rows[0]?.type, "customer");
assert.equal(valid.rows[0]?.phone, "0612000000");
assert.equal(valid.rows[0]?.city, "Casablanca");

const badIce = parseThirdPartyCsv("Nom;Type;ICE\nClient Fictif;Client;123\n");
assert.equal(badIce.issues.some((item) => item.message.includes("15 chiffres")), true);

const duplicateFile = parseThirdPartyCsv("Nom;Type;ICE\nAlpha;Client;001234567000018\nAlpha;Fournisseur;001234567000018\n");
const fileIssues = reviewThirdPartyRows(duplicateFile.rows, []);
assert.equal(fileIssues.some((item) => item.message.includes("déjà utilisé ligne")), true);

const known = reviewThirdPartyRows(valid.rows, [{ name: "Atelier Démo", ice: null }]);
assert.equal(known.some((item) => item.message.includes("existe déjà dans votre entreprise")), true);

const csv = toCsv([{ nom: "Société; Atlas", ice: "001234567000018" }]);
assert.equal(csv.toString("utf8").includes("\"Société; Atlas\""), true);
const zip = zipStore([{ name: "tiers.csv", data: csv }]);
assert.equal(zip.readUInt32LE(0), 0x04034b50);
assert.equal(zip.includes(csv), true);

const route = readFileSync("src/app/api/exports/entreprise/route.ts", "utf8");
assert.equal(route.includes(".eq(\"organization_id\", organizationId)"), true);
assert.equal(route.includes("searchParams"), false);
assert.equal(route.includes("isAdminRole"), true);
assert.equal(route.includes("hr_employees"), true);
const action = readFileSync("src/lib/tiers/third-party-import-actions.ts", "utf8");
assert.equal(action.includes("organization_id: workspace.organization.id"), true);
assert.equal(action.includes(".insert(payload)"), true);
assert.equal(action.includes("previewThirdPartyImportAction"), true);

console.log("company export/import: ok");
