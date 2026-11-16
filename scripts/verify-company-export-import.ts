import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildOrganizationBackup, planOrganizationRestore, readOrganizationBackup } from "../src/lib/backup/org-backup";
import { toCsv, unzip, zipStore } from "../src/lib/export/archive";
import { writeXlsx } from "../src/lib/spreadsheet/minimal-xlsx";
import { readSpreadsheet } from "../src/lib/spreadsheet/read-table";
import { parseThirdPartyCsv, parseThirdPartyTable, reviewThirdPartyRows, THIRD_PARTY_IMPORT_TEMPLATE } from "../src/lib/tiers/third-party-import";

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

const orgA = "11111111-1111-4111-8111-111111111111";
const orgB = "22222222-2222-4222-8222-222222222222";
const backup = buildOrganizationBackup({
  organizationId: orgA,
  organizationName: "Atelier Démo",
  createdAt: "2026-11-16T08:00:00.000Z",
  tables: [
    { name: "third_parties", rows: [{ id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", organization_id: orgA, name: "Atelier Démo", ice: "001234567000018" }] },
    { name: "customer_invoices", rows: [{ id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", organization_id: orgA, invoice_number: "FAC-1001", third_party_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" }] },
  ],
});
const readBack = readOrganizationBackup(backup.zip);
assert.deepEqual(readBack.tables[0]?.rows, backup.manifest && [{ id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", organization_id: orgA, name: "Atelier Démo", ice: "001234567000018" }]);
assert.equal(readBack.tables[1]?.rows[0]?.invoice_number, "FAC-1001");
const tamperedFiles = unzip(backup.zip);
const manifest = JSON.parse(tamperedFiles.get("manifest.json")!.toString("utf8"));
tamperedFiles.set("tables/third_parties.json", Buffer.from(tamperedFiles.get("tables/third_parties.json")!.toString("utf8").replace("Atelier", "Piraté")));
assert.throws(() => readOrganizationBackup(zipStore([...tamperedFiles.entries()].map(([name, data]) => ({ name, data })))), /modifié/);
manifest.checksum = "0".repeat(64);
assert.throws(() => readOrganizationBackup(zipStore([
  { name: "manifest.json", data: Buffer.from(JSON.stringify(manifest)) },
  { name: "tables/third_parties.json", data: tamperedFiles.get("tables/third_parties.json")! },
])), /refusé|modifié|manifeste/);
const foreign = buildOrganizationBackup({
  organizationId: orgB,
  organizationName: "Autre",
  createdAt: "2026-11-16T08:00:00.000Z",
  tables: [{ name: "third_parties", rows: [{ id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc", organization_id: orgB, name: "Intrus" }] }],
});
const planned = planOrganizationRestore(readOrganizationBackup(foreign.zip), orgA, "merge");
assert.equal(planned.tables[0]?.rows[0]?.organization_id, orgA);
assert.equal(planned.counts[0]?.foreignOrganizationRows, 1);
assert.equal(planned.tables[0]?.rows.some((row) => row.organization_id === orgB), false);

const sheet = readSpreadsheet(writeXlsx([
  ["Nom", "Type", "ICE", "IF", "RC", "Email", "Téléphone", "Ville", "Adresse"],
  ["Client Fictif", "Client", "123", "12", "1", "mauvais", "12", "Casablanca", "1 rue Démo"],
  ["Atelier Démo", "Client", "001234567000018", "12345678", "12345", "contact@exemple.test", "0612000000", "Casablanca", "1 rue Démo"],
  ["Atelier Démo", "Client", "001234567000018", "", "", "", "", "", ""],
]), "clients.xlsx");
const excel = parseThirdPartyTable(sheet.rows);
const excelIssues = [...excel.issues, ...reviewThirdPartyRows(excel.rows, [])];
assert.equal(excelIssues.some((item) => item.message.includes("15 chiffres")), true);
assert.equal(excelIssues.some((item) => item.message.includes("IF")), true);
assert.equal(excelIssues.some((item) => item.message.includes("déjà utilisé")), true);
assert.equal(excel.rows.some((row) => row.name === "Atelier Démo" && row.ifNumber === "12345678"), true);
assert.equal(readSpreadsheet(Buffer.from("pas un classeur"), "clients.xls").error?.includes("non reconnu"), true);

const migration = readFileSync("supabase/migrations/145_org_backup_restore.sql", "utf8");
assert.equal(migration.includes("join public.roles member_role on member_role.id = member.role_id"), true);
assert.equal(/from public\.organization_members\s+where[\s\S]*\brole in\b/.test(migration), false);
assert.equal(migration.includes("organization_id = p_organization_id"), true);
assert.equal(migration.includes("RESTORE_TABLE_FORBIDDEN"), true);
assert.equal(migration.includes("jsonb_build_object('organization_id', p_organization_id)"), true);

console.log("company export/import: ok");
