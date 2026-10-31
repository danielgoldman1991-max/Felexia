// Disposable PostgreSQL only. No project .env, network, session or business data.
// node training/essential-audit/20261031/verify-access-isolated.mjs --pglite-root=<temporary package directory>
import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
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
  phase='subscription regressions';
  await db.exec("do $$ begin create role service_role bypassrls; exception when duplicate_object then null;end $$;");
  await db.exec('begin');
  await db.exec('create policy synthetic_member_org_update on organizations for update to authenticated using(app_private.is_org_member(id)) with check(app_private.is_org_member(id))');
  await db.query('insert into organizations(id,name,slug) values($1::uuid,$2,$1::text)',[ids.org,'Subscription regression QA']);
  await db.query('insert into organizations(id,name,slug) values($1::uuid,$2,$1::text)',[ids.foreign,'Foreign QA']);
  for(const [user,name] of [[ids.admin,'admin'],[ids.viewer,'viewer'],[ids.operator,'operator']]) {
    await db.query('insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())',[user,name+'@example.test']);
    await db.query('insert into profiles(id,email) values($1,$2)',[user,name+'@example.test']);
    const role=await one('insert into roles(organization_id,name) values($1,$2) on conflict(organization_id,name) do update set name=excluded.name returning id',[ids.org,name]);
    await db.query('insert into organization_members(organization_id,user_id,role_id,status) values($1,$2,$3,$4)',[ids.org,user,role.id,'active']);
  }
  await db.exec(await sql('097_document_numbering_controls.sql').then(s=>s.replace(/^begin;\s*$/gmi,'').replace(/^commit;\s*$/gmi,'')));
  await db.exec(await sql('099_essential_subscription_access.sql').then(s=>s.replace(/^begin;\s*$/gmi,'').replace(/^commit;\s*$/gmi,'')));
  await as(ids.viewer);
  await rejected(()=>db.query('select ensure_essential_trial($1)',[ids.org]),/BILLING_ADMIN_REQUIRED/,'Viewer cannot start trial');
  await as(ids.admin);
  equal((await one('select ensure_essential_trial($1) as created',[ids.org])).created,true,'Admin starts one essential trial');
  const trial=await one('select plan_code,status,trial_end,trial_start from organization_subscriptions where organization_id=$1',[ids.org]);
  equal(trial.plan_code,'essentiel','Trial plan cannot be chosen by caller');
  equal((await one('select ensure_essential_trial($1) as created',[ids.org])).created,false,'A second call never resets trial');
  await as(null,'service_role');
  const incomplete={stripe_subscription_id:'sub_incomplete',stripe_customer_id:'cus_qa',plan_code:'essentiel',status:'incomplete',billing_cycle:'monthly',current_period_start:null,current_period_end:null};
  equal((await one('select apply_stripe_subscription($1,$2::jsonb,90) as applied',[ids.org,JSON.stringify(incomplete)])).applied,false,'Incomplete checkout does not consume a valid free trial');
  await as(ids.admin);
  const same=await one('select trial_end from organization_subscriptions where organization_id=$1',[ids.org]);
  equal(String(same.trial_end),String(trial.trial_end),'Trial dates remain unchanged');
  const viewerRole=await one("select id from roles where organization_id=$1 and name='viewer'",[ids.org]);
  await rejected(()=>db.query("select reserve_organization_invitation($1,$2,$3,$4,$5,$6)",["30000000-0000-4000-8000-000000000001",ids.org,"fourth@example.test",viewerRole.id,"Fourth local fixture","f".repeat(64)]),/INVITATION_USER_LIMIT/,'A fourth invitation is refused when three plan seats are occupied');
  equal(Number((await one("select count(*) as count from invitations where organization_id=$1",[ids.org])).count),0,'A refused fourth invitation creates no pending user or email reservation');
  equal((await one('select trial_end=trial_start+interval \'1 month\' as correct from organization_subscriptions where organization_id=$1',[ids.org])).correct,true,'PostgreSQL month-end bounded month');
  await rejected(()=>db.query('select ensure_essential_trial($1)',[ids.foreign]),/BILLING_ADMIN_REQUIRED/,'Admin cannot create trial for foreign org');
  for(const who of [ids.admin,ids.operator,ids.viewer]) {
    await as(who);
    await writeDenied(()=>db.query("update organization_subscriptions set status='active',plan_code='premium',current_period_end='2099-01-01' where organization_id=$1 returning id",[ids.org]),/42501|permission|OPERATOR/,'Member cannot promote billing state '+who);
  }
  await as(ids.admin);
  await rejected(()=>db.query("update organizations set stripe_customer_id='cus_foreign' where id=$1",[ids.org]),/BILLING_SERVER_REQUIRED/,'Admin cannot choose a Stripe customer ID');
  const party=await one("insert into third_parties(organization_id,primary_type,types,name,code) values($1,'customer',array['customer'],'QA customer','') returning id",[ids.org]);
  const invoice=await one("insert into customer_invoices(organization_id,customer_id,invoice_number,invoice_date) values($1,$2,'',current_date) returning id",[ids.org,party.id]);
  equal(!!invoice.id,true,'Valid trial can create invoice');
  await rejected(()=>db.query('update customer_invoices set id=gen_random_uuid() where id=$1',[invoice.id]),/IMMUTABLE_RECORD_KEY/,'Document identity cannot change to reuse consumed quota');
  equal(Number((await one('select get_commercial_document_usage($1) as count',[ids.org])).count),1,'Usage counts real commercial invoice');
  for(const [status,end] of [['trialing',"now()-interval '1 day'"],['canceled',"now()+interval '1 month'"],['unpaid',"now()+interval '1 month'"],['past_due',"now()+interval '1 month'"],['active','null']]) {
    await as(null); await db.exec('reset role');
    await db.query(`update organization_subscriptions set status=$2,trial_end=${end},trial_ends_at=${end},current_period_end=${end} where organization_id=$1`,[ids.org,status]);
    await as(ids.admin);
    await rejected(()=>db.query("insert into customer_invoices(organization_id,customer_id,invoice_number,invoice_date) values($1,$2,'',current_date)",[ids.org,party.id]),/SUBSCRIPTION_WRITE_REQUIRED/,'Creation denied for '+status+' '+end);
    await rejected(()=>db.query("update customer_invoices set notes='blocked' where id=$1",[invoice.id]),/SUBSCRIPTION_WRITE_REQUIRED/,'Update denied for '+status+' '+end);
    equal((await one('select id from customer_invoices where id=$1',[invoice.id])).id,invoice.id,'Read remains allowed for '+status);
  }
  await as(null);await db.exec('reset role');
  await db.query("update organization_subscriptions set status='active',current_period_end=now()+interval '1 month' where organization_id=$1",[ids.org]);
  await db.query("insert into commercial_document_usage(organization_id,document_table,document_id,created_at) select $1,'synthetic',gen_random_uuid(),clock_timestamp() from generate_series(1,499)",[ids.org]);
  await as(ids.admin);
  equal(Number((await one('select get_commercial_document_usage($1) as count',[ids.org])).count),500,'Monthly limit uses invoice plus usage ledger');
  await rejected(()=>db.query("insert into customer_invoices(organization_id,customer_id,invoice_number,invoice_date) values($1,$2,'',current_date)",[ids.org,party.id]),/COMMERCIAL_DOCUMENT_LIMIT_REACHED/,'501st commercial document refused');
  await db.query('delete from customer_invoices where id=$1',[invoice.id]);
  equal(Number((await one('select get_commercial_document_usage($1) as count',[ids.org])).count),500,'Deleting document cannot reset quota');
  await rejected(()=>db.query('delete from commercial_document_usage where organization_id=$1',[ids.org]),/permission denied/,'Client cannot delete usage ledger');
  await rejected(()=>db.query('select get_commercial_document_usage($1)',[ids.foreign]),/SUBSCRIPTION_MEMBERSHIP_REQUIRED/,'Usage for another tenant denied');
  await rejected(()=>db.query("select claim_stripe_event('evt_no','x','{}')"),/permission denied/,'User cannot claim Stripe event');
  await rejected(()=>db.query('select claim_billing_checkout($1)',[ids.org]),/permission denied/,'User cannot claim server checkout lease');
  await as(null,'service_role');
  const lease=await one('select claim_billing_checkout($1) as token',[ids.org]);
  equal(!!lease.token,true,'Server claims checkout lease');
  equal((await one('select claim_billing_checkout($1) as token',[ids.org])).token,null,'Concurrent checkout is blocked');
  await db.query('select release_billing_checkout($1,$2)',[ids.org,lease.token]);
  equal(!!(await one('select claim_billing_checkout($1) as token',[ids.org])).token,true,'Lease can be claimed after release');
  equal((await one("select claim_stripe_event('evt_qa','subscription.updated','{}') as state")).state,'claimed','Server claims event');
  equal((await one("select claim_stripe_event('evt_qa','subscription.updated','{}') as state")).state,'processing','Simultaneous event is retryable, not processed');
  await db.exec("update stripe_events set processing_started_at=null,error='retry' where stripe_event_id='evt_qa'");
  equal((await one("select claim_stripe_event('evt_qa','subscription.updated','{}') as state")).state,'claimed','Failed event can retry');
  await db.exec("update stripe_events set processed=true where stripe_event_id='evt_qa'");
  equal((await one("select claim_stripe_event('evt_qa','subscription.updated','{}') as state")).state,'processed','Completed event is idempotent');
  const payload={stripe_subscription_id:'sub_qa',stripe_customer_id:'cus_qa',plan_code:'essentiel',status:'active',billing_cycle:'monthly',current_period_start:new Date().toISOString(),current_period_end:new Date(Date.now()+86400000).toISOString(),trial_start:null,trial_end:null,cancel_at_period_end:false,canceled_at:null};
  equal((await one('select apply_stripe_subscription($1,$2::jsonb,100) as applied',[ids.org,JSON.stringify(payload)])).applied,true,'Server applies paid subscription atomically');
  equal((await one('select apply_stripe_subscription($1,$2::jsonb,99) as applied',[ids.org,JSON.stringify({...payload,status:'canceled'})])).applied,false,'Out-of-order cancellation ignored');
  equal((await one('select apply_stripe_subscription($1,$2::jsonb,101) as applied',[ids.org,JSON.stringify({...payload,stripe_subscription_id:'sub_old',status:'canceled'})])).applied,false,'Old subscription cancellation cannot overwrite current');
  await db.exec('reset role');
  await db.query("select set_config('request.jwt.claim.sub','',false)");
  await db.exec(await sql('099_essential_subscription_access.sql').then(s=>s.replace(/^begin;\s*$/gmi,'').replace(/^commit;\s*$/gmi,'')));
  equal(Number((await one('select count(*) as count from commercial_document_usage where organization_id=$1',[ids.org])).count),500,'Reinstall preserves consumed quota and known deleted document usage');
  await db.exec('rollback');
  equal(Number((await one('select count(*) as count from organizations where id=$1',[ids.org])).count),0,'All fixture changes rolled back');
  const output=new URL(process.argv.includes('--relaxed-v3') ? 'subscription-postgres-relaxed.json' : 'subscription-postgres-strict.json',import.meta.url);
  await writeFile(output,JSON.stringify({success:true,checks,results,engine,scope:'Disposable PostgreSQL; no project secrets, network or production',relaxedV3:process.argv.includes('--relaxed-v3')},null,2));
  console.log(JSON.stringify({success:true,checks,output:output.pathname}));
} catch(error) {console.log(JSON.stringify({error:error.message,code:error.code,phase,results}));process.exitCode=1;} finally{await db.close();}
