// Disposable PostgreSQL only. No project .env, network, session or business data.
// node training/essential-audit/20261031/verify-access-isolated.mjs --pglite-root=<temporary package directory>
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
const sql = async (file) => readFile(new URL(`../../../supabase/migrations/${file}`, import.meta.url), "utf8");
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


  `);
  for (const migration of ["039_subscription_billing_invitations.sql","042_saas_modules_subscription.sql","043_make_plan_id_nullable.sql","069_subscription_fixed_packs.sql"]) await db.exec(await sql(migration));
  for (const table of ["accounting_journals", "accounting_entries", "accounting_entry_lines", "accounting_accounts", "accounting_settings", "accounting_auxiliaries", "document_settings", "invitations"]) {
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


try {
  await bootstrap();
  await db.exec('begin');
  await db.query('insert into organizations(id,name,slug) values($1::uuid,$2,$1::text)',[ids.org,'Fictitious audit company']);
  await db.query('insert into organizations(id,name,slug) values($1::uuid,$2,$1::text)',[ids.foreign,'Fictitious foreign audit company']);
  await db.query('insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())',[ids.viewer,'viewer@example.test']);
  await db.query('insert into profiles(id,email) values($1,$2)',[ids.viewer,'viewer@example.test']);
  const role=await one('insert into roles(organization_id,name) values($1,$2) on conflict(organization_id,name) do update set name=excluded.name returning id',[ids.org,'viewer']);
  await db.query('insert into organization_members(organization_id,user_id,role_id,status) values($1,$2,$3,$4)',[ids.org,ids.viewer,role.id,'active']);
  await db.query('insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())',[ids.admin,'admin@example.test']);
  await db.query('insert into profiles(id,email) values($1,$2)',[ids.admin,'admin@example.test']);
  const adminRole=await one('insert into roles(organization_id,name) values($1,$2) on conflict(organization_id,name) do update set name=excluded.name returning id',[ids.org,'admin']);
  await db.query('insert into organization_members(organization_id,user_id,role_id,status) values($1,$2,$3,$4)',[ids.org,ids.admin,adminRole.id,'active']);
  const party=await one('insert into third_parties(organization_id,code,primary_type,types,name) values($1,$2,$3,array[$3::text],$4) returning id',[ids.org,'CU-QA','customer','Synthetic customer']);
  const foreignParty=await one('insert into third_parties(organization_id,code,primary_type,types,name) values($1,$2,$3,array[$3::text],$4) returning id',[ids.foreign,'CU-QA-FOR','customer','Foreign synthetic customer']);
  const subscription=await one('insert into organization_subscriptions(organization_id,plan_code,status,trial_end) values($1,$2,$3,now()-interval \'1 day\') returning id',[ids.org,'essentiel','trialing']);
  await db.exec(await sql('097_document_numbering_controls.sql').then(s=>s.replace(/^begin;\s*$/gmi,'').replace(/^commit;\s*$/gmi,'')));
  await as(ids.viewer);
  const findings=[];
  const contact=await one('insert into third_party_contacts(organization_id,third_party_id,full_name) values($1,$2,$3) returning id',[ids.org,party.id,'Viewer inserted contact']);
  findings.push({name:'Viewer can INSERT own-company contact',confirmed:!!contact.id});
  const contactUpdate=await db.query('update third_party_contacts set full_name=$2 where id=$1 returning id',[contact.id,'Viewer modified contact']);
  findings.push({name:'Viewer can UPDATE own-company contact',confirmed:contactUpdate.rows.length===1});
  const address=await one('insert into third_party_addresses(organization_id,third_party_id,label,address) values($1,$2,$3,$4) returning id',[ids.org,party.id,'Fixture billing','Viewer inserted address']);
  findings.push({name:'Viewer can INSERT own-company address',confirmed:!!address.id});
  const addressUpdate=await db.query('update third_party_addresses set address=$2 where id=$1 returning id',[address.id,'Viewer modified address']);
  findings.push({name:'Viewer can UPDATE own-company address',confirmed:addressUpdate.rows.length===1});
  const billing=await db.query('update organization_subscriptions set status=$2,plan_code=$3,current_period_end=$4 where id=$1 returning status,plan_code',[subscription.id,'active','premium','2099-12-31T00:00:00Z']);
  findings.push({name:'Viewer can make own-company subscription active Premium until2099',confirmed:billing.rows.length===1&&billing.rows[0].status==='active'&&billing.rows[0].plan_code==='premium'});
  await db.exec('savepoint foreign_contact');
  let foreignDenied=false;
  try { await db.query('insert into third_party_contacts(organization_id,third_party_id,full_name) values($1,$2,$3)',[ids.foreign,foreignParty.id,'Forbidden foreign contact']); }
  catch(error){foreignDenied=error.code==='42501';}
  await db.exec('rollback to savepoint foreign_contact');
  findings.push({name:'Foreign-company contact remains protected',confirmed:foreignDenied});
  await as(ids.admin);
  for(const status of ['trialing','canceled','unpaid']) {
    await db.query("update organization_subscriptions set status=$2,plan_code='essentiel',trial_end=now()-interval '1 day',trial_ends_at=now()-interval '1 day',current_period_end=now()-interval '1 day' where id=$1",[subscription.id,status]);
    const invoice=await one('insert into customer_invoices(organization_id,customer_id,invoice_number,invoice_date) values($1,$2,$3,current_date) returning id',[ids.org,party.id,'']);
    findings.push({name:'Admin can create invoice while subscription '+status+' and all dates expired',confirmed:!!invoice.id});
  }
  await db.exec('reset role; rollback');
  const fixtureCount=await one('select count(*)::int as count from organizations where id=$1',[ids.org]);
  findings.push({name:'All fixture changes were rolled back',confirmed:fixtureCount.count===0});
  console.log(JSON.stringify({scope:'Disposable in-memory PostgreSQL; actual039/042/043/069/093/094/095/096/097 and legacy contact migrations; no project secrets/network/data',relaxedV3:process.argv.includes('--relaxed-v3'),findings},null,2));
} catch(error) { console.log(JSON.stringify({error:error.message,code:error.code,phase}));process.exitCode=1; } finally { await db.close(); }
