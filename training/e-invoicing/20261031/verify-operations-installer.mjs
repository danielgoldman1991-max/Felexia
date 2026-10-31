// A disposable in-memory PostgreSQL only; no project environment or remote URL.
import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { createLocalDatabase } from "./local-bootstrap.mjs";

const prefix = process.argv.find(value => value.startsWith("--pglite-root="))?.slice(14);
if (!prefix) throw new Error("Explicit isolated PGlite package directory required");
const { db } = await createLocalDatabase(prefix);
const results = [];
const check = (name, condition) => { assert.ok(condition, name); results.push(name); };
const fingerprint = async table => (await db.query(`select md5(coalesce(jsonb_agg(to_jsonb(t) order by id)::text,'')) value from public.${table} t`)).rows[0].value;
try {
  await db.exec("reset role");
  const sql = await readFile(new URL("../../../supabase/electronic-invoicing-102-103.sql", import.meta.url), "utf8");
  check("Installer has one outer transaction and no intermediate commit", (sql.match(/^begin;$/gm) || []).length === 1 && (sql.match(/^commit;$/gm) || []).length === 1);
  const before = await Promise.all(["customer_invoices", "customer_invoice_lines", "customer_credit_notes"].map(fingerprint));
  await db.exec(sql);
  const capabilities = (await db.query("select to_regprocedure('public.einvoice_issue_and_archive(uuid,integer)') is not null and to_regprocedure('public.einvoice_get_capabilities(uuid)') is not null ready")).rows[0];
  check("The combined installer upgrades an existing102 database to the complete workflow", capabilities.ready);
  await db.exec(sql);
  check("Reinstallation preserves all source invoices, lines and credit notes", JSON.stringify(before) === JSON.stringify(await Promise.all(["customer_invoices", "customer_invoice_lines", "customer_credit_notes"].map(fingerprint))));
  const settingsBefore = (await db.query("select md5(jsonb_agg(to_jsonb(t) order by organization_id)::text) value from public.einvoice_settings t")).rows[0].value;
  const finalCommit = sql.lastIndexOf("\ncommit;");
  const interrupted = sql.slice(0, finalCommit) + "\nupdate public.einvoice_settings set enabled=not enabled;\ndo $$ begin raise exception 'ATOMIC_INSTALL_TEST_FAILURE'; end $$;\ncommit;\n";
  await assert.rejects(db.exec(interrupted), /ATOMIC_INSTALL_TEST_FAILURE/);
  await db.exec("rollback");
  check("A failed transaction restores the exact previous organization settings", settingsBefore === (await db.query("select md5(jsonb_agg(to_jsonb(t) order by organization_id)::text) value from public.einvoice_settings t")).rows[0].value);
  check("A failed reinstall leaves all financial source rows unchanged", JSON.stringify(before) === JSON.stringify(await Promise.all(["customer_invoices", "customer_invoice_lines", "customer_credit_notes"].map(fingerprint))));
  const report = { passed: true, checks: results.length, results, bundleSha256: createHash("sha256").update(sql).digest("hex"), scope: "Real isolated PostgreSQL/PGlite installer and rollback; no production read or write" };
  await writeFile(new URL("operations-installer.json", import.meta.url), JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify(report));
} finally { await db.close(); }
