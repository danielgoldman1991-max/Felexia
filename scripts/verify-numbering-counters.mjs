// Disposable PostgreSQL only. No project .env, network, session or business data.
// node scripts/verify-numbering-counters.mjs --pglite-root=<temporary package directory>
import assert from "node:assert/strict";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { createHash } from "node:crypto";
import { resolve } from "node:path";

const packageRoot = process.argv.find((arg) => arg.startsWith("--pglite-root="))?.slice("--pglite-root=".length);
const pgRoot = process.argv.find((arg) => arg.startsWith("--pg-root="))?.slice("--pg-root=".length);
const postgresUrl = process.argv.find((arg) => arg.startsWith("--postgres-url="))?.slice("--postgres-url=".length);
let db;
let engine;
if (postgresUrl) {
  const target = new URL(postgresUrl);
  if (!(["127.0.0.1", "localhost"].includes(target.hostname) && /^\/numbering_qa_[a-z0-9_]+$/i.test(target.pathname) && target.username === "postgres" && !target.password)) throw new Error("Only a dedicated local trust-auth numbering_qa_ database is allowed");
  const pgRequire = createRequire(pgRoot ? resolve(pgRoot, "package.json") : import.meta.url);
  const { Client } = pgRequire("pg");
  const client = new Client({ connectionString: postgresUrl });
  await client.connect();
  db = { exec: (statement) => client.query(statement), query: (statement, values) => client.query(statement, values), close: () => client.end() };
  engine = "Native PostgreSQL";
} else {
  const require = createRequire(packageRoot ? resolve(packageRoot, "package.json") : import.meta.url);
  const { PGlite } = require("@electric-sql/pglite");
  db = new PGlite();
  engine = "PostgreSQL via PGlite";
}
const sql = async (file) => readFile(new URL(`../supabase/migrations/${file}`, import.meta.url), "utf8");
const ids = {
  org: "10000000-0000-4000-8000-000000000001", foreign: "10000000-0000-4000-8000-000000000002",
  admin: "20000000-0000-4000-8000-000000000001", operator: "20000000-0000-4000-8000-000000000002",
  viewer: "20000000-0000-4000-8000-000000000003", accountant: "20000000-0000-4000-8000-000000000004",
  outsider: "20000000-0000-4000-8000-000000000005", inactive: "20000000-0000-4000-8000-000000000006",
  owner: "20000000-0000-4000-8000-000000000007", noMember: "20000000-0000-4000-8000-000000000008",
};
let checks = 0;
let phase = "bootstrap";
const results = [];
const equal = (actual, expected, name) => { assert.deepEqual(actual, expected, name); checks++; if (name) results.push(name); };
const one = async (query, values = []) => (await db.query(query, values)).rows[0];
async function as(user, role = "authenticated") {
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [user ?? ""]);
  await db.exec(`set role ${role}`);
}
async function rejected(run, pattern, name) {
  await db.exec("savepoint expected_error");
  try { await assert.rejects(run, pattern); checks++; if (name) results.push(name); }
  finally { await db.exec("rollback to savepoint expected_error; release savepoint expected_error"); }
}
async function writeDenied(run, pattern, name) {
  await db.exec("savepoint blocked_write");
  try {
    try {
      const response = await run();
      equal(response.rows.length, 0, name);
    } catch (error) {
      assert.match(error.message, pattern, name); checks++; results.push(name);
    }
  } finally { await db.exec("rollback to savepoint blocked_write; release savepoint blocked_write"); }
}

async function bootstrap() {
  await db.exec(`
    do $$ begin create role anon; exception when duplicate_object then null; end $$;
    do $$ begin create role authenticated; exception when duplicate_object then null; end $$;
    create schema auth;
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    create function auth.role() returns text language sql stable as $$ select current_user::text $$;
    create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);
  `);
  await db.exec((await sql("001_initial_schema.sql")).replace("create extension if not exists pgcrypto;", ""));
  for (const file of ["002_third_parties_complete.sql", "005_sales_module_v1.sql", "006_delivery_returns_stock.sql", "014_customer_invoicing_v1.sql", "018_customer_payments_v1.sql", "019_customer_reminders_v1.sql", "020_customer_credit_notes_v1.sql", "021_customer_invoice_credit_amount.sql", "022_purchase_module_v1.sql", "028_treasury_module_v1.sql", "029_customer_payments_treasury_account.sql", "030_supplier_payments_treasury_account.sql"]) {
    phase = file;
    const content = await sql(file);
    // The unrelated stock tail of 022 assumes the omitted stock-module enum conversion.
    await db.exec(file === "022_purchase_module_v1.sql" ? content.slice(0, content.indexOf("-- 9. Add purchase_receipt_in")) : content);
  }
  // The repository does not include the historical accounting table-creation
  // migration (034 already assumes it). Keep its numbering-relevant columns and
  // constraints explicit, rather than mocking any generator or security function.
  await db.exec(`
    create table public.accounting_journals(id uuid primary key default gen_random_uuid(), organization_id uuid not null references organizations(id), code text not null, name text not null, type text default 'general', is_active boolean default true, unique(organization_id,code));
    create table public.accounting_entries(id uuid primary key default gen_random_uuid(), organization_id uuid not null references organizations(id), journal_id uuid not null references accounting_journals(id), entry_number text not null, entry_date date not null default current_date, status text not null default 'draft', label text not null default 'QA synthetic entry', source_document_type text, source_document_id uuid, created_at timestamptz default now(), updated_at timestamptz default now(), archived_at timestamptz, unique(organization_id,entry_number));
    create table public.accounting_entry_lines(id uuid primary key default gen_random_uuid(), organization_id uuid not null references organizations(id), entry_id uuid references accounting_entries(id), notes text);
    create table public.accounting_accounts(id uuid primary key default gen_random_uuid(),organization_id uuid references organizations(id),notes text);
    create table public.accounting_settings(id uuid primary key default gen_random_uuid(),organization_id uuid references organizations(id),notes text);
    create table public.accounting_auxiliaries(id uuid primary key default gen_random_uuid(),organization_id uuid references organizations(id),notes text);
    create table public.document_settings(id uuid primary key default gen_random_uuid(),organization_id uuid references organizations(id),notes text);
    create table public.invitations(id uuid primary key default gen_random_uuid(),organization_id uuid references organizations(id),email text,role_id uuid references roles(id),invited_by uuid,token text unique,status text default 'pending',expires_at timestamptz,created_at timestamptz default now(),updated_at timestamptz default now());
    create table public.subscription_plans(code text primary key,max_users integer);
    create table public.organization_subscriptions(id uuid primary key default gen_random_uuid(),organization_id uuid references organizations(id),plan_code text,notes text,created_at timestamptz default now());
  `);
  for (const table of ["accounting_journals", "accounting_entries", "accounting_entry_lines", "accounting_accounts", "accounting_settings", "accounting_auxiliaries", "document_settings", "invitations", "organization_subscriptions"]) {
    await db.exec(`alter table public.${table} enable row level security; create policy original_member_all on public.${table} for all to authenticated using(app_private.is_org_member(organization_id)) with check(app_private.is_org_member(organization_id));`);
  }
  const onboarding = await sql("059_fix_organization_onboarding_finalization.sql");
  await db.exec(onboarding.slice(0, onboarding.indexOf("create or replace function")));
  await db.exec("alter table public.profiles add column default_organization_id uuid");
  await db.exec(await sql("087_ensure_company_legal_fields.sql"));
  await db.exec(await sql("093_secure_user_invitations.sql"));
  const integrity = await sql("20260810213138_fix_erp_integrity_and_transfers.sql");
  await db.exec(integrity.slice(0, integrity.indexOf("create or replace function public.link_stock_move_to_sales_line")));
  await db.exec(integrity.slice(integrity.indexOf("create or replace function public.sync_customer_payment_totals"), integrity.indexOf("/*\nHistorical backfills")));
  await db.exec(await sql("20260811103000_active_membership_and_financial_permissions.sql"));
  if (process.argv.includes("--relaxed-v3")) await db.exec(await sql("20260811130000_relax_v3_guards_to_active_membership.sql"));
  await db.exec(await sql("094_readonly_financial_documents.sql"));
  await db.exec(await sql("095_operator_profile.sql"));
  await db.exec(await sql("096_fix_operator_contact_numbering.sql"));
  await db.exec("grant usage on schema public,auth,app_private to authenticated,anon; grant select,insert,update,delete on all tables in schema public to authenticated; grant select on all tables in schema public to anon");
}

const fixedSpecs = [
  ["customer_invoice", "customer_invoices", "invoice_number", "invoice_date", "FAC", "customer"],
  ["supplier_invoice", "supplier_invoices", "invoice_number", "invoice_date", "FF", "supplier"],
  ["customer_payment", "customer_payments", "payment_number", "payment_date", "REG", "customer"],
  ["supplier_payment", "supplier_payments", "payment_number", "payment_date", "RFO", "supplier"],
  ["customer_credit_note", "customer_credit_notes", "credit_note_number", "credit_note_date", "AV", "customer"],
  ["customer_reminder", "customer_reminders", "reminder_number", "reminder_date", "REL", "customer"],
  ["sales_quote", "sales_documents", "document_number", "document_date", "DEV", "customer", "quote"],
  ["sales_order", "sales_documents", "document_number", "document_date", "CMD", "customer", "order"],
  ["sales_delivery", "sales_documents", "document_number", "document_date", "BL", "customer", "delivery_note"],
  ["sales_return", "sales_documents", "document_number", "document_date", "BR", "customer", "return_note"],
  ["purchase_order", "purchase_documents", "document_number", "document_date", "CF", "supplier", "supplier_order"],
  ["purchase_receipt", "purchase_documents", "document_number", "document_date", "REC", "supplier", "supplier_receipt"],
  ["customer", "third_parties", "code", null, "CU", null, "customer"],
  ["supplier", "third_parties", "code", null, "SU", null, "supplier"],
  ["prospect", "third_parties", "code", null, "PR", null, "prospect"],
].map(([key, table, field, dateField, prefix, party, documentType]) => ({ key, table, field, dateField, prefix, party, documentType }));
let period;
const fixtures = { parties: new Map(), journals: new Map(), legacy: [] };
function specFor(key) {
  if (key.startsWith("journal:")) {
    const journalId = key.slice("journal:".length);
    return { key, table: "accounting_entries", field: "entry_number", dateField: "entry_date", prefix: fixtures.journals.get(journalId)?.code, journalId };
  }
  const spec = fixedSpecs.find((item) => item.key === key);
  assert.ok(spec, `unknown QA spec ${key}`);
  return spec;
}
function formatted(key, number, documentPeriod = period) {
  const spec = specFor(key);
  const suffix = String(number).padStart(5, "0");
  if (spec.journalId) return `${spec.prefix}-${documentPeriod.slice(0, 4)}-${suffix}`;
  const month = `${documentPeriod.slice(2, 4)}${documentPeriod.slice(5, 7)}`;
  return `${spec.prefix}${spec.table === "third_parties" ? "" : "-"}${month}-${suffix}`;
}
async function issue(key, explicitNumber, options = {}) {
  const spec = specFor(key);
  const org = options.org ?? ids.org;
  const documentPeriod = options.period ?? period;
  const columns = ["organization_id", spec.field];
  const values = [org, explicitNumber === undefined ? (spec.table === "third_parties" || spec.journalId ? null : "") : explicitNumber];
  const expressions = ["$1", "$2"];
  const add = (column, value, expression) => {
    columns.push(column); values.push(value); expressions.push(expression ?? `$${values.length}`);
  };
  if (spec.dateField) add(spec.dateField, documentPeriod);
  if (spec.party) {
    const partyId = fixtures.parties.get(`${org}:${spec.party}`);
    add(spec.party === "customer" ? "customer_id" : "supplier_id", partyId);
    if (key === "customer_payment") add("third_party_id", partyId);
  }
  if (key.endsWith("_payment")) add("amount", 1);
  if (spec.documentType && spec.table !== "third_parties") add("document_type", spec.documentType);
  if (spec.table === "third_parties") {
    add("primary_type", spec.documentType);
    add("types", spec.documentType, `array[$${values.length + 1}::text]`);
    add("name", `Synthetic ${key} numbering fixture`);
  }
  if (spec.journalId) add("journal_id", spec.journalId);
  if (options.archived) {
    add("status", spec.table === "third_parties" ? "archived" : "cancelled");
    add("archived_at", "2026-01-01T12:00:00Z");
  }
  return one(`insert into public.${spec.table}(${columns.join(",")}) values(${expressions.join(",")}) returning id, ${spec.field} as document_number`, values);
}
async function counters(org = ids.org, date = period) {
  return (await one("select public.get_numbering_counters($1::uuid,$2::date) as counters", [org, date])).counters;
}
async function counter(key, org = ids.org, date = period) {
  const found = (await counters(org, date)).find((row) => (row.counter_key ?? row.key) === key);
  assert.ok(found, `counter missing ${key}`);
  return found;
}
async function correct(key, next, revision, reason = "Synthetic QA correction", org = ids.org, date = period) {
  return (await one("select public.correct_numbering_counter($1::uuid,$2::text,$3::date,$4::integer,$5::text,$6::text) as counter", [org, key, date, next, revision, reason])).counter;
}
async function legacySnapshot() {
  const snapshot = [];
  for (const legacy of fixtures.legacy) {
    const spec = specFor(legacy.key);
    snapshot.push(await one(`select id,${spec.field} as document_number,status,archived_at from public.${spec.table} where id=$1`, [legacy.id]));
  }
  return snapshot;
}
async function seedLegacyFixtures() {
  phase = "historical fixture seed";
  await db.exec("reset role");
  for (const [id, name] of [[ids.org, "Synthetic QA company"], [ids.foreign, "Synthetic foreign QA company"]]) {
    await db.query("insert into organizations(id,name,slug) values($1::uuid,$2,$1::text)", [id, name]);
  }
  for (const name of ["admin", "operator", "viewer", "accountant", "outsider", "inactive", "owner", "noMember"]) {
    const user = ids[name];
    const org = name === "outsider" ? ids.foreign : ids.org;
    const roleName = name === "outsider" || name === "inactive" || name === "noMember" ? "admin" : name;
    await db.query("insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())", [user, `${name}@example.test`]);
    await db.query("insert into profiles(id,email) values($1,$2)", [user, `${name}@example.test`]);
    const role = await one("insert into roles(organization_id,name) values($1,$2) on conflict(organization_id,name) do update set name=excluded.name returning id", [org, roleName]);
    if (name !== "noMember") await db.query("insert into organization_members(organization_id,user_id,role_id,status) values($1,$2,$3,$4)", [org, user, role.id, name === "inactive" ? "disabled" : "active"]);
  }
  period = (await one("select timezone('Africa/Casablanca',now())::date::text as value")).value;
  for (const org of [ids.org, ids.foreign]) {
    for (const kind of ["customer", "supplier"]) {
      const party = await one("insert into third_parties(organization_id,code,primary_type,types,name) values($1,$2,$3,array[$3::text],$4) returning id", [org, `QA-${kind}-${org}`, kind, `Synthetic ${kind} relation`]);
      fixtures.parties.set(`${org}:${kind}`, party.id);
    }
    for (const code of org === ids.org ? ["VE", "BQ"] : ["BQ"]) {
      const journal = await one("insert into accounting_journals(organization_id,code,name) values($1,$2,$3) returning id", [org, code, `Synthetic ${code} journal`]);
      fixtures.journals.set(journal.id, { code, org });
    }
  }
  await as(ids.admin);
  for (const spec of fixedSpecs) {
    const row = await issue(spec.key, formatted(spec.key, 9), { archived: true });
    fixtures.legacy.push({ ...row, key: spec.key });
  }
  for (const [journalId, journal] of fixtures.journals) if (journal.org === ids.org) {
    const key = `journal:${journalId}`;
    const row = await issue(key, formatted(key, 9), { archived: true });
    fixtures.legacy.push({ ...row, key });
  }
  const converted = await issue("customer", formatted("prospect", 80), { archived: true });
  fixtures.convertedContactId = converted.id;
  fixtures.legacy.push({ ...converted, key: "customer" });
  const month = period.slice(2, 4) + period.slice(5, 7);
  await db.query("insert into numbering_sequences(organization_id,document_type,prefix,current_year,next_number) values($1,$2,$3,$4,100)", [ids.org, `CUSTOMER_INVOICE_${month}`, `FAC-${month}-`, Number(period.slice(0, 4))]);
}

async function runNumberingCases() {
  phase = "numbering RPC cases";
  await as(ids.admin);
  const legacyBefore = await legacySnapshot();
  const list = await counters();
  if (!postgresUrl && !process.argv.includes("--relaxed-v3")) {
    const folder = resolve("training/numbering-counters/20261031");
    await mkdir(folder, { recursive: true });
    await writeFile(resolve(folder, "counter-contract.json"), JSON.stringify({ syntheticOnly: true, period, counters: list }, null, 2) + "\n");
  }
  equal(list.length, 17, "all 15 document/contact types and the two own journals are listed");
  const sequenceCount = Number((await one("select count(*) as count from numbering_sequences")).count);
  await counters();
  equal(Number((await one("select count(*) as count from numbering_sequences")).count), sequenceCount, "reading counters never creates or consumes a sequence");
  const untouchedPeriod = (await one("select (date_trunc('month',current_date)+interval '2 months')::date::text as value")).value;
  const ownEmptyRevision = (await counter("supplier_invoice", ids.org, untouchedPeriod)).revision;
  await as(ids.outsider);
  const foreignEmptyRevision = (await counter("supplier_invoice", ids.foreign, untouchedPeriod)).revision;
  equal(ownEmptyRevision === foreignEmptyRevision, false, "uninitialized counter revisions are bound to the organisation as well as their format and value");
  await as(ids.admin);
  for (const spec of fixedSpecs) {
    const row = await counter(spec.key);
    const maximum = spec.key === "prospect" ? 80 : 9;
    equal(Number(row.minimum_next_number), maximum + 1, `${spec.key}: cancelled and archived historical number sets the minimum`);
    equal(row.last_document_number, formatted(spec.key, maximum), `${spec.key}: highest historical number is displayed`);
    equal(row.next_document_number, formatted(spec.key, spec.key === "customer_invoice" ? 100 : maximum + 1), `${spec.key}: preview preserves the original format`);
  }
  await db.exec("savepoint historical_delete");
  await db.query("delete from third_parties where id=$1", [fixtures.convertedContactId]);
  equal(Number((await counter("prospect")).minimum_next_number), 81, "a converted PR code remains reserved when its pre-migration contact is deleted");
  equal((await counter("prospect")).last_document_number, formatted("prospect", 80), "the converted contact retains its original numbering family");
  await db.exec("rollback to savepoint historical_delete; release savepoint historical_delete");
  const legacyReminder = fixtures.legacy.find((row) => row.key === "customer_reminder");
  await db.exec("savepoint historical_update");
  await db.query("update customer_reminders set reminder_number=$2 where id=$1", [legacyReminder.id, formatted("customer_reminder", 12)]);
  await db.query("update customer_reminders set reminder_number=$2 where id=$1", [legacyReminder.id, formatted("customer_reminder", 10)]);
  equal(Number((await counter("customer_reminder")).minimum_next_number), 13, "changing a historical number never frees its previous serial for reuse");
  await db.exec("rollback to savepoint historical_update; release savepoint historical_update");
  for (const [name, user, org] of [["foreign admin", ids.outsider, ids.org], ["admin to another tenant", ids.admin, ids.foreign], ["inactive admin", ids.inactive, ids.org], ["no member", ids.noMember, ids.org], ["operator", ids.operator, ids.org], ["viewer", ids.viewer, ids.org], ["accountant", ids.accountant, ids.org]]) {
    await as(user);
    await rejected(() => counters(org), /NUMBERING_ADMIN_REQUIRED|permission denied/i, `${name}: counter reads denied`);
    await rejected(() => correct("customer_invoice", 500, "forged", "forbidden", org), /NUMBERING_ADMIN_REQUIRED|permission denied/i, `${name}: counter corrections denied`);
  }
  await as(null, "anon");
  await rejected(() => counters(), /permission denied|NUMBERING_ADMIN_REQUIRED/i, "anonymous counter read denied");
  await rejected(() => correct("customer_invoice", 500, "forged"), /permission denied|NUMBERING_ADMIN_REQUIRED/i, "anonymous counter correction denied");
  await db.exec("reset role; grant insert on customer_invoices to anon");
  await as(null, "anon");
  await rejected(() => issue("customer_invoice", formatted("customer_invoice", 9)), (error) => error.code === "42501" && /NUMBERING_MEMBERSHIP_REQUIRED/.test(error.message), "anonymous duplicate-number inserts reveal no existence oracle before RLS");
  await as(null, "authenticated");
  await rejected(() => issue("customer_invoice", formatted("customer_invoice", 9)), (error) => error.code === "42501" && /NUMBERING_MEMBERSHIP_REQUIRED/.test(error.message), "authenticated role without an identity cannot probe a document number");
  await db.exec("reset role; savepoint trusted_import");
  const trustedImport = await issue("supplier_invoice", formatted("supplier_invoice", 1234));
  equal(trustedImport.document_number, formatted("supplier_invoice", 1234), "trusted SQL-owner imports without an auth identity retain their explicit number");
  await db.exec("rollback to savepoint trusted_import; release savepoint trusted_import");
  await as(ids.owner);
  equal((await counters()).length, 17, "owner retains numbering administration");
  await as(ids.admin);
  let current = await counter("customer_invoice");
  for (const invalid of [0, -1, null, 2147483647]) await rejected(() => correct("customer_invoice", invalid, current.revision), /NUMBERING_INVALID_NEXT_NUMBER|NUMBERING_EXHAUSTED|out of range/i, `invalid next number ${invalid} rejected`);
  await rejected(() => correct("customer_invoice", 9, current.revision), /NUMBERING_INVALID_NEXT_NUMBER|NUMBERING.*COLLISION|NUMBERING.*MIN|NUMBERING_BELOW_USED_NUMBER/i, "cannot reuse cancelled/archived historical numbers");
  await rejected(() => correct("customer_invoice", 20, current.revision, "  "), /NUMBERING.*REASON|reason/i, "empty correction reason rejected");
  await rejected(() => correct("not_a_real_counter", 20, "forged"), /NUMBERING_UNKNOWN_COUNTER/i, "unknown counter rejected");
  const foreignJournal = [...fixtures.journals].find(([, item]) => item.org === ids.foreign)[0];
  await rejected(() => correct(`journal:${foreignJournal}`, 20, "forged"), /NUMBERING_UNKNOWN_COUNTER|NUMBERING_ADMIN_REQUIRED/i, "foreign journal cannot be targeted through an own organisation");

  for (const spec of fixedSpecs) {
    const before = await counter(spec.key);
    const configuredNext = spec.key === "prospect" ? 90 : 20;
    const updated = await correct(spec.key, configuredNext, before.revision, `QA correction for ${spec.key}`);
    equal(Number(updated.next_number), configuredNext, `${spec.key}: administrator can correct the next number`);
    const saved = await issue(spec.key);
    equal(saved.document_number, formatted(spec.key, configuredNext), `${spec.key}: the actual insert consumes the configured number`);
    const after = await counter(spec.key);
    equal(Number(after.next_number), configuredNext + 1, `${spec.key}: next preview increments after real creation`);
    await rejected(() => correct(spec.key, 30, before.revision), /NUMBERING_CONFLICT/i, `${spec.key}: stale preview rejected after correction and consumption`);
  }
  for (const [journalId, journal] of fixtures.journals) if (journal.org === ids.org) {
    const key = `journal:${journalId}`;
    const before = await counter(key);
    await correct(key, 30, before.revision);
    equal((await issue(key)).document_number, formatted(key, 30), `${journal.code}: entry trigger consumes the configured journal counter`);
  }
  equal(await legacySnapshot(), legacyBefore, "no historical document is renumbered or otherwise modified");

  current = await counter("customer_invoice");
  await correct("customer_invoice", 100000, current.revision);
  equal((await issue("customer_invoice")).document_number, formatted("customer_invoice", 100000), "six-digit serials are not truncated by lpad");
  equal((await issue("customer_invoice")).document_number, formatted("customer_invoice", 100001), "six-digit serials continue without collision");

  current = await counter("supplier_invoice");
  const deleted = await issue("supplier_invoice");
  await db.query("delete from supplier_invoices where id=$1", [deleted.id]);
  const afterDelete = await counter("supplier_invoice");
  equal(Number(afterDelete.minimum_next_number) > Number(deleted.document_number.split("-").at(-1)), true, "an issued number remains reserved after a draft is deleted");
  await rejected(() => correct("supplier_invoice", Number(deleted.document_number.split("-").at(-1)), afterDelete.revision), /NUMBERING_INVALID_NEXT_NUMBER|NUMBERING.*MIN|NUMBERING.*COLLISION|NUMBERING_BELOW_USED_NUMBER/i, "deleted draft number cannot be reused");
  await rejected(() => issue("supplier_invoice", deleted.document_number), /NUMBERING_ALREADY_ISSUED|duplicate key/i, "a deleted document number cannot be manually reassigned to a different document");

  current = await counter("purchase_order");
  await correct("purchase_order", 100, current.revision);
  const abaInitial = await counter("purchase_order");
  await correct("purchase_order", 101, abaInitial.revision);
  const abaMiddle = await counter("purchase_order");
  await correct("purchase_order", 100, abaMiddle.revision);
  await rejected(() => correct("purchase_order", 102, abaInitial.revision), /NUMBERING_CONFLICT/i, "ABA corrections invalidate the original revision even within one transaction");

  const futureMonth = (await one("select (date_trunc('month',current_date)+interval '1 month')::date::text as value")).value;
  const beforeCurrent = await counter("customer_invoice");
  equal((await issue("customer_invoice", undefined, { period: futureMonth })).document_number, formatted("customer_invoice", 1, futureMonth), "a new month starts an independent invoice sequence");
  equal(Number((await counter("customer_invoice")).next_number), Number(beforeCurrent.next_number), "future-month creation does not change the current-month counter");
  const explicitWithLeadingZeroes = formatted("supplier_invoice", 1, futureMonth).replace("00001", "000000000001");
  await issue("supplier_invoice", explicitWithLeadingZeroes, { period: futureMonth });
  const leadingZeroCounter = await counter("supplier_invoice", ids.org, futureMonth);
  equal(Number(leadingZeroCounter.minimum_next_number), 2, "a long zero-padded legacy serial is parsed by numeric value without false exhaustion");
  equal(leadingZeroCounter.last_document_number, explicitWithLeadingZeroes, "the original exact text of a long zero-padded number is displayed");
  const ownJournalId = [...fixtures.journals].find(([, item]) => item.org === ids.org && item.code === "VE")[0];
  const futureYear = (await one("select (date_trunc('year',current_date)+interval '1 year')::date::text as value")).value;
  equal((await issue(`journal:${ownJournalId}`, undefined, { period: futureYear })).document_number, formatted(`journal:${ownJournalId}`, 1, futureYear), "journal counters reset independently by year");
  const sameYearLaterMonth = (await one("select (date_trunc('year',current_date)+interval '11 months')::date::text as value")).value;
  equal(Number((await counter(`journal:${ownJournalId}`, ids.org, sameYearLaterMonth)).next_number), Number((await counter(`journal:${ownJournalId}`)).next_number), "months in the same year share the same journal counter");

  const rescueBefore = await counter("customer_invoice");
  const rescueSequence = await one("select id from numbering_sequences where organization_id=$1 and document_type=$2", [ids.org, `CUSTOMER_INVOICE_${period.slice(2, 4)}${period.slice(5, 7)}`]);
  await db.exec("reset role");
  await db.query("update numbering_sequences set next_number=2147483647 where id=$1", [rescueSequence.id]);
  await as(ids.admin);
  const rescuePreview = await counter("customer_invoice");
  equal(rescuePreview.is_exhausted, false, "an erroneous high stored counter remains repairable when the true issued floor is lower");
  await rejected(() => issue("customer_invoice"), /NUMBERING_EXHAUSTED/i, "an exhausted stored counter does not create a truncated or duplicate number");
  await correct("customer_invoice", Number(rescueBefore.minimum_next_number), rescuePreview.revision, "QA rescue erroneous high legacy counter");
  equal(Number((await counter("customer_invoice")).next_number), Number(rescueBefore.minimum_next_number), "administrator can repair a high erroneous stored counter safely down to the real issued floor");

  const protectedSequence = await one("select id,document_type,prefix,current_year,next_number from numbering_sequences where organization_id=$1 order by document_type limit 1", [ids.org]);
  for (const [name, user] of [["admin", ids.admin], ["operator", ids.operator], ["viewer", ids.viewer], ["accountant", ids.accountant]]) {
    await as(user);
    await writeDenied(() => db.query("update numbering_sequences set next_number=1 where id=$1 returning id", [protectedSequence.id]), /row-level security|NUMBERING|OPERATOR|permission denied/i, `${name}: direct counter reset cannot bypass the audited RPC`);
    await writeDenied(() => db.query("update numbering_sequences set prefix='FORGED-' where id=$1 returning id", [protectedSequence.id]), /row-level security|NUMBERING|OPERATOR|permission denied/i, `${name}: direct prefix change denied`);
    await writeDenied(() => db.query("delete from numbering_sequences where id=$1 returning id", [protectedSequence.id]), /row-level security|NUMBERING|OPERATOR|permission denied/i, `${name}: direct counter deletion denied`);
    await rejected(() => db.query("insert into numbering_sequences(organization_id,document_type,prefix,current_year,next_number) values($1,'FORGED','FORGED-',2026,1)", [ids.org]), /row-level security|NUMBERING|OPERATOR|permission denied/i, `${name}: direct counter insert denied`);
  }
  await as(ids.operator);
  for (const key of ["customer_invoice", "supplier_invoice", "customer_payment", "supplier_payment", "customer_credit_note", "customer", "supplier"]) {
    const saved = await issue(key);
    assert.ok(saved.document_number); checks++; results.push(`operator: ordinary ${key} creation still consumes its number`);
  }
  await rejected(() => issue("prospect"), /OPERATOR|NUMBERING|row-level security|permission denied/i, "operator prospect creation remains prohibited");
  await rejected(() => issue("customer", formatted("customer", 999)), /OPERATOR|NUMBERING|row-level security|permission denied/i, "operator cannot provide a manual contact number");
  equal((await db.query("update third_parties set name='Synthetic converted contact edited by operator' where id=$1 returning id", [fixtures.convertedContactId])).rows.length, 1, "operator can still edit a converted PR contact whose primary type is now customer");
  await rejected(() => db.query("update third_parties set code=$2 where id=$1", [fixtures.convertedContactId, formatted("prospect", 999)]), /OPERATOR|NUMBERING|row-level security|permission denied/i, "operator cannot renumber a converted contact");
  await as(ids.admin);
  await rejected(() => issue(`journal:${foreignJournal}`), /NUMBERING|FOREIGN|JOURNAL|row-level security/i, "accounting insert cannot consume another tenant's journal");
  await as(ids.outsider);
  const foreignInvoice = await issue("customer_invoice", undefined, { org: ids.foreign });
  equal(foreignInvoice.document_number, formatted("customer_invoice", 1), "another tenant starts its own independent counter");
  await as(ids.admin);
  await rejected(() => correct("customer_invoice", 500000, "forged", "forbidden", ids.foreign), /NUMBERING_ADMIN_REQUIRED/i, "foreign counter correction cannot be forged");
  equal((await counter("customer_invoice")).next_document_number.startsWith("FAC-"), true, "own numbering remains readable after denied foreign operations");
  equal(Number((await one("select count(*) as count from numbering_counter_changes where organization_id=$1", [ids.org])).count), 22, "only the 22 successful explicit corrections are audited");
  equal(Number((await one("select count(*) as count from numbering_counter_changes where organization_id=$1 and (actor_id<>$2 or length(btrim(reason))<5)", [ids.org, ids.admin])).count), 0, "correction audit rows carry the authenticated actor and a nonempty reason");
  await rejected(() => db.query("select app_private.allocate_document_number($1,'customer_invoice',$2::date,gen_random_uuid(),'customer_invoices')", [ids.org, period]), /permission denied/i, "authenticated administrators cannot bypass the public API through the private allocator");
}

try {
  await bootstrap();
  if (process.argv.includes("--bootstrap-only")) {
    console.log(JSON.stringify({ bootstrap: true, syntheticOnly: true, engine, checks }));
  } else if (process.argv.includes("--seed-only")) {
    await db.exec("begin");
    try { await seedLegacyFixtures(); equal(fixtures.legacy.length, 18, "historical numbering fixtures are valid"); }
    finally { await db.exec("rollback; reset role"); }
    equal(Number((await one("select count(*) as count from organizations where id=$1", [ids.org])).count), 0, "historical fixtures are fully rolled back");
    console.log(JSON.stringify({ seed: true, syntheticOnly: true, engine, checks }));
  } else {
    const migrationName = process.argv.find((arg) => arg.startsWith("--migration="))?.slice("--migration=".length) ?? "097_document_numbering_controls.sql";
    const migration = await sql(migrationName);
    // Keep all fixture writes and migration statements inside one rollback-only
    // transaction. Only the file's transaction wrapper is removed here. Its
    // complete transaction wrapper is exercised twice afterwards on empty data.
    const transactionBody = migration.replace(/^\s*begin;\s*$/gim, "").replace(/^\s*commit;\s*$/gim, "");
    await db.exec("begin");
    try {
      phase = "historical fixture seed";
      await seedLegacyFixtures();
      await db.exec("reset role");
      phase = migrationName;
      await db.exec(transactionBody);
      await runNumberingCases();
    } finally { await db.exec("rollback; reset role"); }
    equal(Number((await one("select count(*) as count from organizations where id=$1", [ids.org])).count), 0, "every synthetic fixture is rolled back");
    phase = "complete migration and idempotence";
    await db.exec(migration);
    await db.exec(migration); checks++;
    const report = { passed: true, syntheticOnly: true, engine, postgresVersion: (await one("show server_version")).server_version, migrationCanonicalSha256: createHash("sha256").update(migration.replace(/\r\n/g, "\n").trim()).digest("hex"), checks, relaxedV3: process.argv.includes("--relaxed-v3"), fixtureRollbackVerified: true, multiSessionConcurrencyTested: false, results };
    const output = resolve("training/numbering-counters/20261031");
    await mkdir(output, { recursive: true });
    await writeFile(resolve(output, `${postgresUrl ? "native-" : ""}postgres-${process.argv.includes("--relaxed-v3") ? "relaxed" : "strict"}.json`), JSON.stringify(report, null, 2) + "\n");
    console.log(JSON.stringify({ ...report, results: undefined }));
  }
} catch (error) {
  console.error(JSON.stringify({ passed: false, phase, checks, message: error.message, code: error.code, detail: error.detail }));
  process.exitCode = 1;
} finally {
  await db.close();
}
