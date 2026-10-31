// Disposable PostgreSQL only. No project environment, network DB or credentials.
// Install optional test dependency outside this checkout, then run:
// node scripts/verify-readonly-finance-guard.mjs --pglite-root=<temporary install directory>
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { resolve } from "node:path";

const packageRoot = process.argv.find((arg) => arg.startsWith("--pglite-root="))?.slice("--pglite-root=".length);
const require = createRequire(packageRoot ? resolve(packageRoot, "package.json") : import.meta.url);
let database;
try {
  const { PGlite } = require("@electric-sql/pglite");
  database = new PGlite();
  const tables = [
    "customer_invoices", "customer_invoice_lines", "supplier_invoices", "supplier_invoice_lines",
    "customer_payments", "customer_payment_allocations", "supplier_payments", "supplier_payment_allocations",
    "treasury_accounts", "treasury_transactions", "accounting_entries", "accounting_entry_lines",
    "accounting_journals", "accounting_accounts", "accounting_settings", "third_parties", "company_settings",
  ];
  const financialTables = new Set(["customer_payments", "customer_payment_allocations", "supplier_payments", "supplier_payment_allocations", "treasury_accounts", "treasury_transactions"]);
  const organization = "10000000-0000-4000-8000-000000000001";
  const otherOrganization = "10000000-0000-4000-8000-000000000002";
  const users = {
    admin: "20000000-0000-4000-8000-000000000001",
    viewer: "20000000-0000-4000-8000-000000000002",
    sales: "20000000-0000-4000-8000-000000000003",
    accountant: "20000000-0000-4000-8000-000000000004",
    foreignAdmin: "20000000-0000-4000-8000-000000000005",
  };
  let checks = 0;
  await database.exec(`
    create role anon; create role authenticated;
    create schema auth; create schema app_private;
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    create table public.roles(id uuid primary key, organization_id uuid, name text);
    create table public.organization_members(id uuid primary key default gen_random_uuid(),organization_id uuid,user_id uuid,role_id uuid references roles(id),status text);
    create table public.permissions(id uuid primary key default gen_random_uuid(),code text);
    create table public.role_permissions(role_id uuid,permission_id uuid);
    create function app_private.is_org_member(target_org uuid) returns boolean language sql stable security definer set search_path=public as $$
      select exists(select 1 from public.organization_members where organization_id=target_org and user_id=auth.uid() and status='active');
    $$;
    grant usage on schema public,auth,app_private to anon,authenticated;
  `);
  for (const [name, userId] of Object.entries(users)) {
    const org = name === "foreignAdmin" ? otherOrganization : organization;
    const roleName = name === "foreignAdmin" ? "admin" : name;
    await database.query("insert into public.roles(id,organization_id,name) values($1,$2,$3)", [userId, org, roleName]);
    await database.query("insert into public.organization_members(organization_id,user_id,role_id,status) values($1,$2,$2,'active')", [org, userId]);
  }
  for (const table of tables) {
    await database.exec(`
      create table public.${table}(id uuid primary key default gen_random_uuid(),organization_id uuid,notes text);
      alter table public.${table} enable row level security;
      create policy original_member_all on public.${table} for all to authenticated
        using(app_private.is_org_member(organization_id)) with check(app_private.is_org_member(organization_id));
      grant select,insert,update,delete on public.${table} to authenticated;
    `);
  }
  // Use the real V3 helpers and guards, including treasury restrictions.
  await database.exec(await readFile(new URL("../supabase/migrations/20260811103000_active_membership_and_financial_permissions.sql", import.meta.url), "utf8"));
  async function as(userId) {
    await database.exec("reset role");
    await database.query("select set_config('request.jwt.claim.sub',$1,false)", [userId]);
    await database.exec("set role authenticated");
  }
  const insert = (table, note) => database.query(`insert into public.${table}(organization_id,notes) values($1,$2) returning id`, [organization, note]);

  // Reproduce the verified production defect before applying the new guard.
  await as(users.viewer);
  await insert("customer_invoices", "original viewer write permitted"); checks++;
  await database.exec("reset role");
  const migration = await readFile(new URL("../supabase/migrations/094_readonly_financial_documents.sql", import.meta.url), "utf8");
  await database.exec(migration);
  await database.exec(migration); checks++;

  for (const table of tables) {
    await as(users.admin);
    const id = (await insert(table, "original administrator note")).rows[0].id; checks++;
    await as(users.viewer);
    assert.equal((await database.query(`select id from public.${table} where id=$1`, [id])).rows.length, 1); checks++;
    await assert.rejects(() => insert(table, "viewer must not write"), /row-level security/i); checks++;
    assert.equal((await database.query(`update public.${table} set notes='forbidden update' where id=$1`, [id])).affectedRows, 0); checks++;
    assert.equal((await database.query(`delete from public.${table} where id=$1`, [id])).affectedRows, 0); checks++;
    await as(users.admin);
    assert.equal((await database.query(`select notes from public.${table} where id=$1`, [id])).rows[0].notes, "original administrator note"); checks++;

    await as(users.sales);
    if (financialTables.has(table)) {
      // Seeded sales has no treasury permission: 094 must not grant one.
      await assert.rejects(() => insert(table, "sales treasury denied"), /row-level security/i);
    } else {
      await insert(table, "existing sales permission preserved");
    }
    checks++;
    await as(users.accountant);
    await insert(table, "existing accountant permission preserved"); checks++;
    await as(users.foreignAdmin);
    assert.equal((await database.query(`select id from public.${table} where organization_id=$1`, [organization])).rows.length, 0); checks++;
    await assert.rejects(() => insert(table, "cross-tenant denied"), /row-level security/i); checks++;
  }
  await database.exec("reset role");
  await database.exec("alter table public.company_settings disable row level security");
  await assert.rejects(() => database.exec(migration), /RLS_DISABLED_REQUIRES_REVIEW/);
  await database.exec("rollback"); checks++;
  console.log(`Readonly finance guard: ${checks} PostgreSQL checks passed across ${tables.length} tables, with actual V3 permissions and no external database access.`);
} catch (error) {
  console.error(error instanceof Error ? error.message : "Readonly finance guard test failed.");
  process.exitCode = 1;
} finally {
  await database?.close();
}
