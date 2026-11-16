import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { BACKUP_TABLES } from "../src/lib/backup/org-backup";

const sql = readdirSync("supabase/migrations")
  .filter((name) => name.endsWith(".sql"))
  .map((name) => readFileSync(join("supabase/migrations", name), "utf8"))
  .join("\n")
  .replace(/--[^\n]*/g, " ");

const known = new Set<string>();
for (const match of sql.matchAll(/\b(?:create|alter)\s+table\s+(?:if\s+(?:not\s+)?exists\s+)?(?:only\s+)?(?:public\.)?([a-zA-Z_][a-zA-Z0-9_]*)/gi)) {
  known.add(match[1].toLowerCase());
}

const names = new Set<string>(BACKUP_TABLES.map((table) => table.name));
const missing = [...names].filter((name) => !known.has(name));
assert.deepEqual(missing, [], `Tables de sauvegarde absentes des migrations : ${missing.join(", ")}`);
assert.equal(names.has("treasury_movements"), false);
assert.equal(names.has("treasury_transactions"), true);
assert.equal(names.has("customer_credit_notes"), true);
assert.equal(names.has("customer_payment_allocations"), true);
assert.equal(names.has("accounting_accounts"), true);
assert.equal(BACKUP_TABLES.some((table) => table.name === "hr_employees" && "proOnly" in table && table.proOnly === true), true);
console.log("backup tables: ok");
