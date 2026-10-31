// Disposable PostgreSQL only; no .env, project connection or email is used.
// node scripts/verify-operator-profile.mjs --pglite-root=<temporary package directory>
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { resolve } from "node:path";

const packageRoot = process.argv.find((arg) => arg.startsWith("--pglite-root="))?.slice("--pglite-root=".length);
const require = createRequire(packageRoot ? resolve(packageRoot, "package.json") : import.meta.url);
const { PGlite } = require("@electric-sql/pglite");
const db = new PGlite();
let checks = 0;
const sql = async (file) => readFile(new URL(`../supabase/migrations/${file}`, import.meta.url), "utf8");
const ids = {
  org: "10000000-0000-4000-8000-000000000001", foreign: "10000000-0000-4000-8000-000000000002",
  future: "10000000-0000-4000-8000-000000000003", admin: "20000000-0000-4000-8000-000000000001",
  operator: "20000000-0000-4000-8000-000000000002", viewer: "20000000-0000-4000-8000-000000000003",
  accountant: "20000000-0000-4000-8000-000000000004", outsider: "20000000-0000-4000-8000-000000000005",
};
const equal = (actual, expected) => { assert.deepEqual(actual, expected); checks++; };
const denied = async (run) => { await assert.rejects(run, /row-level security|OPERATOR_|ADMIN_REQUIRED|permission denied/i); checks++; };
async function as(user, role = "authenticated") {
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [user ?? ""]);
  await db.exec(`set role ${role}`);
}
const one = async (query, values = []) => (await db.query(query, values)).rows[0];
try {
  await db.exec(`
    create role anon; create role authenticated;
    create schema auth;
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    create function auth.role() returns text language sql stable as $$ select current_user::text $$;
    create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);
  `);
  // Load real operational schemas and their original numbering triggers.
  await db.exec((await sql("001_initial_schema.sql")).replace("create extension if not exists pgcrypto;", ""));
  await db.exec(await sql("002_third_parties_complete.sql"));
  await db.exec(`
    grant usage on schema public,auth,app_private to authenticated,anon;
    create table public.sales_documents(id uuid primary key);
    create table public.sales_document_lines(id uuid primary key);
  `);
  for (const file of ["014_customer_invoicing_v1.sql", "018_customer_payments_v1.sql", "020_customer_credit_notes_v1.sql", "021_customer_invoice_credit_amount.sql", "022_purchase_module_v1.sql", "028_treasury_module_v1.sql", "029_customer_payments_treasury_account.sql", "030_supplier_payments_treasury_account.sql"]) {
    const content = await sql(file);
    // The unrelated 022 stock tail assumes the omitted stock-module enum conversion.
    await db.exec(file === "022_purchase_module_v1.sql" ? content.slice(0, content.indexOf("-- 9. Add purchase_receipt_in")) : content);
  }
  await db.exec(`
    create table public.invitations(id uuid primary key default gen_random_uuid(),organization_id uuid references organizations(id),email text,role_id uuid references roles(id),invited_by uuid,token text unique,status text default 'pending',expires_at timestamptz,created_at timestamptz default now(),updated_at timestamptz default now());
    alter table public.invitations enable row level security;
    create policy invitations_org_member_select on public.invitations for select to authenticated using(app_private.is_org_member(organization_id));
    create table public.subscription_plans(code text primary key,max_users integer);
    create table public.organization_subscriptions(id uuid primary key default gen_random_uuid(),organization_id uuid references organizations(id),plan_code text,notes text,created_at timestamptz default now());
  `);
  const protectedTables = ["accounting_entries", "accounting_entry_lines", "accounting_journals", "accounting_accounts", "accounting_settings", "accounting_auxiliaries", "document_settings", "custom_advanced_module"];
  for (const table of protectedTables) await db.exec(`
    create table public.${table}(id uuid primary key default gen_random_uuid(),organization_id uuid references organizations(id),notes text);
  `);
  // Original permissive policies intentionally give full member access. 095
  // must narrow only operators, even if legacy rules are broad.
  for (const table of [...protectedTables, "organization_subscriptions"]) await db.exec(`
    alter table public.${table} enable row level security;
    create policy original_member_all on public.${table} for all to authenticated using(app_private.is_org_member(organization_id)) with check(app_private.is_org_member(organization_id));
  `);
  const onboarding059 = await sql("059_fix_organization_onboarding_finalization.sql");
  await db.exec(onboarding059.slice(0, onboarding059.indexOf("create or replace function")));
  await db.exec("alter table public.profiles add column default_organization_id uuid");
  await db.exec(await sql("087_ensure_company_legal_fields.sql"));
  await db.exec(await sql("093_secure_user_invitations.sql"));
  const integrity = await sql("20260810213138_fix_erp_integrity_and_transfers.sql");
  await db.exec(integrity.slice(0, integrity.indexOf("create or replace function public.link_stock_move_to_sales_line")));
  await db.exec(integrity.slice(integrity.indexOf("create or replace function public.sync_customer_payment_totals"), integrity.indexOf("/*\nHistorical backfills")));
  await db.exec(await sql("20260811103000_active_membership_and_financial_permissions.sql"));
  if (process.argv.includes("--relaxed-v3")) await db.exec(await sql("20260811130000_relax_v3_guards_to_active_membership.sql"));
  await db.exec(await sql("094_readonly_financial_documents.sql"));
  await db.exec("grant select,insert,update,delete on all tables in schema public to authenticated; grant select on all tables in schema public to anon");
  for (const [org, name] of [[ids.org, "QA company"], [ids.foreign, "Foreign QA company"]]) await db.query("insert into organizations(id,name,slug) values($1::uuid,$2,$1::text)", [org, name]);
  for (const [name, user] of Object.entries(ids).filter(([name]) => ["admin", "operator", "viewer", "accountant", "outsider"].includes(name))) {
    const org = name === "outsider" ? ids.foreign : ids.org;
    await db.query("insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())", [user, `${name}@example.test`]);
    await db.query("insert into profiles(id,email) values($1,$2)", [user, `${name}@example.test`]);
    const role = await one("insert into roles(organization_id,name) values($1,$2) returning id", [org, name === "outsider" ? "admin" : name]);
    await db.query("insert into organization_members(organization_id,user_id,role_id,status) values($1,$2,$3,'active')", [org, user, role.id]);
  }
  const migration = await sql("095_operator_profile.sql");
  const originalMemberships = (await db.query("select organization_id,user_id,role_id,status from organization_members order by user_id")).rows;
  await db.exec("alter table accounting_entries add column source_document_type text, add column source_document_id uuid, add column status text");
  await db.exec(migration);
  await db.exec(migration); checks++;
  equal((await db.query("select organization_id,user_id,role_id,status from organization_members order by user_id")).rows, originalMemberships);
  equal(Number((await one("select count(*) as count from roles where name='operator'")).count), 2);
  equal((await db.query("select permission.code from role_permissions rp join permissions permission on permission.id=rp.permission_id join roles role on role.id=rp.role_id where role.organization_id=$1 and role.name='operator' order by code", [ids.org])).rows.map((row) => row.code), ["treasury.create_payment"]);
  await db.query("insert into organizations(id,name,slug) values($1::uuid,'Future QA company',$1::text)", [ids.future]);
  equal(Number((await one("select count(*) as count from roles where organization_id=$1 and name='operator'", [ids.future])).count), 1);
  equal(Number((await one("select count(*) as count from organization_members where organization_id=$1", [ids.future])).count), 0);
  await as(ids.admin);
  const bank = await one("insert into treasury_accounts(organization_id,name,code,account_type,currency) values($1,'QA Bank','QA','bank','MAD') returning id", [ids.org]);
  const bank2 = await one("insert into treasury_accounts(organization_id,name,code,account_type,currency) values($1,'QA Bank 2','QA2','bank','MAD') returning id", [ids.org]);
  await as(ids.operator);
  // Reproduce the live 095 defect with the actual 002 code generator, then
  // install its additive correction. Never force a code to bypass numbering.
  await denied(() => db.query("insert into third_parties(organization_id,type,primary_type,types,name) values($1,'customer','customer',array['customer'],'before 096 blocked')", [ids.org]));
  await db.exec("reset role");
  const contactMigration = await sql("096_fix_operator_contact_numbering.sql");
  await db.exec(contactMigration);
  await db.exec(contactMigration); checks++;
  await as(ids.operator);
  const customer = await one("insert into third_parties(organization_id,type,primary_type,types,name) values($1,'customer','customer',array['customer'],'QA customer') returning id,code", [ids.org]); checks++;
  const supplier = await one("insert into third_parties(organization_id,type,primary_type,types,name) values($1,'supplier','supplier',array['supplier'],'QA supplier') returning id,code", [ids.org]); checks++;
  assert.match(customer.code, /^CU[0-9]{4}-00001$/); checks++;
  assert.match(supplier.code, /^SU[0-9]{4}-00001$/); checks++;
  const customer2 = await one("insert into third_parties(organization_id,type,primary_type,types,name) values($1,'customer','customer',array['customer'],'QA customer 2') returning code", [ids.org]);
  equal(Number(customer2.code.slice(-5)), 2);
  const supplier2 = await one("insert into third_parties(organization_id,type,primary_type,types,name) values($1,'supplier','supplier',array['supplier'],'QA supplier 2') returning code", [ids.org]);
  equal(Number(supplier2.code.slice(-5)), 2);
  await denied(() => db.query("insert into third_parties(organization_id,primary_type,types,name) values($1,'prospect',array['prospect'],'not in light operator scope')", [ids.org]));
  for (const party of [customer, supplier]) {
    const contact = await one("insert into third_party_contacts(organization_id,third_party_id,full_name) values($1,$2,'QA contact') returning id", [ids.org, party.id]); checks++;
    equal((await db.query("update third_party_contacts set full_name='QA contact updated' where id=$1 returning id", [contact.id])).rows.length, 1);
    equal((await db.query("delete from third_party_contacts where id=$1 returning id", [contact.id])).rows.length, 1);
    const address = await one("insert into third_party_addresses(organization_id,third_party_id,label,address) values($1,$2,'QA billing','QA fictitious address') returning id", [ids.org, party.id]); checks++;
    equal((await db.query("update third_party_addresses set label='QA updated' where id=$1 returning id", [address.id])).rows.length, 1);
    equal((await db.query("delete from third_party_addresses where id=$1 returning id", [address.id])).rows.length, 1);
  }
  await as(ids.outsider);
  const foreignParty = await one("insert into third_parties(organization_id,type,primary_type,types,name) values($1,'customer','customer',array['customer'],'Foreign QA customer') returning id", [ids.foreign]);
  await as(ids.operator);
  await denied(() => db.query("insert into third_party_contacts(organization_id,third_party_id,full_name) values($1,$2,'forbidden foreign parent')", [ids.org, foreignParty.id]));
  await denied(() => db.query("insert into third_party_addresses(organization_id,third_party_id,label,address) values($1,$2,'forbidden','foreign parent')", [ids.org, foreignParty.id]));
  const invoice = await one("insert into customer_invoices(organization_id,customer_id,invoice_number,status,total_ttc,remaining_amount) values($1,$2,'','validated',240,240) returning id,invoice_number", [ids.org, customer.id]);
  assert.match(invoice.invoice_number, /^FAC-/); checks++;
  const invoice2 = await one("insert into customer_invoices(organization_id,customer_id,invoice_number) values($1,$2,'') returning invoice_number", [ids.org, customer.id]);
  equal(Number(invoice2.invoice_number.slice(-5)), Number(invoice.invoice_number.slice(-5)) + 1);
  const purchase = await one("insert into supplier_invoices(organization_id,supplier_id,invoice_number,status,total_ttc,remaining_amount) values($1,$2,'','validated',120,120) returning id,invoice_number", [ids.org, supplier.id]);
  assert.match(purchase.invoice_number, /^FF-/); checks++;
  for (const [amount, key] of [[100, "30000000-0000-4000-8000-000000000001"], [140, "30000000-0000-4000-8000-000000000002"]]) {
    await db.query("select * from create_customer_payment_atomic($1,$2,$3,$4,current_date,$5,$6::jsonb)", [ids.org, customer.id, bank.id, amount, key, JSON.stringify([{ invoice_id: invoice.id, amount }])]); checks++;
  }
  equal(Number((await one("select current_balance from treasury_accounts where id=$1", [bank.id])).current_balance), 240);
  equal(Number((await one("select paid_amount from customer_invoices where id=$1", [invoice.id])).paid_amount), 240);
  const allocation100 = await one("select id,payment_id from customer_payment_allocations where invoice_id=$1 and amount=100", [invoice.id]);
  await db.query("select * from unallocate_customer_payment_atomic($1,$2)", [ids.org, allocation100.id]); checks++;
  equal(Number((await one("select remaining_amount from customer_invoices where id=$1", [invoice.id])).remaining_amount), 100);
  equal(Number((await one("select current_balance from treasury_accounts where id=$1", [bank.id])).current_balance), 240);
  await db.query("select * from allocate_customer_payment_atomic($1,$2,$3::jsonb)", [ids.org, allocation100.payment_id, JSON.stringify([{invoice_id: invoice.id, amount: 100}])]); checks++;
  equal(Number((await one("select remaining_amount from customer_invoices where id=$1", [invoice.id])).remaining_amount), 0);
  const credit = await one("insert into customer_credit_notes(organization_id,customer_id,credit_note_number,source_invoice_id) values($1,$2,'',$3) returning id,credit_note_number", [ids.org, customer.id, invoice.id]);
  assert.match(credit.credit_note_number, /^AV-/); checks++;
  const creditLine = await one("insert into customer_credit_note_lines(organization_id,credit_note_id,description,quantity,unit_price_ht) values($1,$2,'QA operator credit',1,10) returning id", [ids.org, credit.id]); checks++;
  equal((await db.query("update customer_credit_note_lines set description='QA modified credit' where id=$1 returning id", [creditLine.id])).rows.length, 1);
  equal((await db.query("delete from customer_credit_note_lines where id=$1 returning id", [creditLine.id])).rows.length, 1);
  const supplierPayment = await one("select * from create_supplier_payment_atomic($1,$2,$3,120,current_date,$4,$5::jsonb)", [ids.org, supplier.id, bank.id, "30000000-0000-4000-8000-000000000003", JSON.stringify([{ invoice_id: purchase.id, amount: 120 }])]); checks++;
  equal(Number((await one("select current_balance from treasury_accounts where id=$1", [bank.id])).current_balance), 120);
  equal(Number((await one("select paid_amount from supplier_invoices where id=$1", [purchase.id])).paid_amount), 120);
  await db.query("select * from cancel_supplier_payment_atomic($1,$2)", [ids.org, supplierPayment.payment_id]); checks++;
  equal(Number((await one("select current_balance from treasury_accounts where id=$1", [bank.id])).current_balance), 240);
  equal(Number((await one("select remaining_amount from supplier_invoices where id=$1", [purchase.id])).remaining_amount), 120);
  const advance = await one("select * from create_customer_payment_atomic($1,$2,$3,50,current_date,$4)", [ids.org, customer.id, bank.id, "30000000-0000-4000-8000-000000000004"]); checks++;
  await db.query("select * from update_customer_payment_atomic($1,$2,75,current_date)", [ids.org, advance.payment_id]); checks++;
  equal(Number((await one("select current_balance from treasury_accounts where id=$1", [bank.id])).current_balance), 315);
  await db.query("select * from cancel_customer_payment_atomic($1,$2)", [ids.org, advance.payment_id]); checks++;
  equal(Number((await one("select current_balance from treasury_accounts where id=$1", [bank.id])).current_balance), 240);
  // Posting remains admin-only. Once posted, operators may still reallocate
  // payment credit, but edits/cancellation must not desynchronise the ledger.
  await as(ids.admin);
  const postedHeader = await one("insert into accounting_entries(organization_id,source_document_type,source_document_id,status,notes) values($1,'customer_payment',$2,'posted','posted unchanged') returning id", [ids.org, allocation100.payment_id]);
  const bankBeforePosted = Number((await one("select current_balance from treasury_accounts where id=$1", [bank.id])).current_balance);
  await as(ids.operator);
  await denied(() => db.query("select * from update_customer_payment_atomic($1,$2,101,current_date)", [ids.org, allocation100.payment_id]));
  await denied(() => db.query("select * from cancel_customer_payment_atomic($1,$2)", [ids.org, allocation100.payment_id]));
  equal(Number((await one("select current_balance from treasury_accounts where id=$1", [bank.id])).current_balance), bankBeforePosted);
  equal(Number((await one("select paid_amount from customer_invoices where id=$1", [invoice.id])).paid_amount), 240);
  equal((await one("select notes from accounting_entries where id=$1", [postedHeader.id])).notes, 'posted unchanged');
  equal((await db.query("delete from customer_payments where id=$1 returning id", [allocation100.payment_id])).rows.length, 0);
  equal((await db.query("delete from supplier_payments where id=$1 returning id", [supplierPayment.payment_id])).rows.length, 0);
  equal((await db.query("delete from customer_invoices where id=$1 returning id", [invoice.id])).rows.length, 0);
  equal((await db.query("delete from supplier_invoices where id=$1 returning id", [purchase.id])).rows.length, 0);
  const liveAllocation100 = await one("select id from customer_payment_allocations where payment_id=$1 and cancelled_at is null", [allocation100.payment_id]);
  await db.query("select * from unallocate_customer_payment_atomic($1,$2)", [ids.org, liveAllocation100.id]); checks++;
  await db.query("select * from allocate_customer_payment_atomic($1,$2,$3::jsonb)", [ids.org, allocation100.payment_id, JSON.stringify([{invoice_id: invoice.id, amount: 100}])]); checks++;
  equal(Number((await one("select current_balance from treasury_accounts where id=$1", [bank.id])).current_balance), bankBeforePosted);
  const postedSupplier = await one("select * from create_supplier_payment_atomic($1,$2,$3,120,current_date,$4,$5::jsonb)", [ids.org, supplier.id, bank.id, "30000000-0000-4000-8000-000000000007", JSON.stringify([{ invoice_id: purchase.id, amount: 120 }])]); checks++;
  await as(ids.admin);
  const postedSupplierHeader = await one("insert into accounting_entries(organization_id,source_document_type,source_document_id,status,notes) values($1,'supplier_payment',$2,'posted','supplier posted unchanged') returning id", [ids.org, postedSupplier.payment_id]);
  await as(ids.operator);
  await denied(() => db.query("select * from cancel_supplier_payment_atomic($1,$2)", [ids.org, postedSupplier.payment_id]));
  await denied(() => db.query("update supplier_payments set amount=121 where id=$1", [postedSupplier.payment_id]));
  equal(Number((await one("select current_balance from treasury_accounts where id=$1", [bank.id])).current_balance), 120);
  equal((await one("select notes from accounting_entries where id=$1", [postedSupplierHeader.id])).notes, 'supplier posted unchanged');
  await denied(() => db.query("update treasury_accounts set name='forbidden' where id=$1", [bank.id]));
  await denied(() => db.query("update treasury_accounts set current_balance=999 where id=$1", [bank.id]));
  await denied(() => db.query("insert into treasury_accounts(organization_id,name) values($1,'forbidden')", [ids.org]));
  equal((await db.query("delete from treasury_accounts where id=$1 returning id", [bank2.id])).rows.length, 0);
  await denied(() => db.query("update numbering_sequences set next_number=999 where organization_id=$1", [ids.org]));
  await denied(() => db.query("insert into numbering_sequences(organization_id,document_type,prefix,current_year,next_number) values($1,'CUSTOMER_INVOICE_9999','BAD-',2099,2)", [ids.org]));
  await denied(() => db.query("select * from create_treasury_transaction_atomic($1,$2,'manual_in','in',1,current_date,$3,null,'forbidden')", [ids.org, bank.id, "30000000-0000-4000-8000-000000000005"]));
  await denied(() => db.query("select * from create_treasury_transfer($1,$2,1,current_date,null,'forbidden',null,null,$3)", [bank.id, bank2.id, "30000000-0000-4000-8000-000000000006"]));
  await denied(() => db.query("update treasury_transactions set amount=999 where customer_payment_id=$1", [advance.payment_id]));
  await denied(() => db.query("update treasury_transactions set reconciliation_status='reconciled' where customer_payment_id=$1", [advance.payment_id]));
  for (const table of [...protectedTables, "company_settings", "organization_subscriptions"]) {
    await as(ids.admin);
    const record = table === "company_settings"
      ? await one("insert into company_settings(organization_id,legal_name) values($1,'QA legal name') returning id", [ids.org])
      : await one(`insert into ${table}(organization_id,notes) values($1,'administrator original') returning id`, [ids.org]);
    await as(ids.operator);
    const column = table === "company_settings" ? "legal_name" : "notes";
    equal((await db.query(`update ${table} set ${column}='forbidden' where id=$1 returning id`, [record.id])).rows.length, 0);
    equal((await db.query(`delete from ${table} where id=$1 returning id`, [record.id])).rows.length, 0);
    await denied(() => db.query(`insert into ${table}(organization_id,${column}) values($1,'forbidden')`, [ids.org]));
  }
  await denied(() => db.query("insert into roles(organization_id,name) values($1,'forbidden_admin')", [ids.org]));
  equal((await db.query("update organization_members set role_id=(select id from roles where name='admin' and organization_id=$1) where user_id=$2 returning id", [ids.org, ids.operator])).rows.length, 0);
  const finalize = () => db.query("select finalize_organization_onboarding($1,'QA identity','QA fictitious address','Casablanca','+212600000000','qa@example.test') as id", [ids.org]);
  const beforeFinalize = await one("select name,address from organizations where id=$1", [ids.org]);
  await denied(finalize);
  equal(await one("select name,address from organizations where id=$1", [ids.org]), beforeFinalize);
  equal((await db.query("select id from organizations where id=$1", [ids.foreign])).rows.length, 0);
  await denied(() => db.query("insert into third_parties(organization_id,type,name) values($1,'customer','foreign forbidden')", [ids.foreign]));
  await as(ids.viewer);
  await denied(() => db.query("insert into customer_invoices(organization_id,customer_id,invoice_number) values($1,$2,'viewer forbidden')", [ids.org, customer.id]));
  await denied(finalize);
  await as(ids.accountant);
  await db.query("insert into accounting_entries(organization_id,notes) values($1,'accountant preserved')", [ids.org]); checks++;
  await as(ids.admin);
  equal((await finalize()).rows[0].id, ids.org);
  await db.query("update treasury_accounts set name='administrator still allowed' where id=$1", [bank.id]); checks++;
  await db.exec("reset role");
  const futureAdminRole = await one("insert into roles(organization_id,name) values($1,'admin') returning id", [ids.future]);
  await db.query("insert into organization_members(organization_id,user_id,role_id,status) values($1,$2,$3,'active')", [ids.future, ids.admin, futureAdminRole.id]);
  await as(ids.admin);
  equal((await db.query("select finalize_organization_onboarding($1,'Future owner QA','QA fictitious address','Casablanca','+212600000000','qa@example.test') as id", [ids.future])).rows[0].id, ids.future);
  // One person can be admin in A and operator in B. Neither side of an
  // UPDATE may reparent an account or counter around the operator guard.
  await db.exec("reset role");
  const foreignOperatorRole = await one("select id from roles where organization_id=$1 and name='operator'", [ids.foreign]);
  await db.query("insert into organization_members(organization_id,user_id,role_id,status) values($1,$2,$3,'active')", [ids.foreign, ids.admin, foreignOperatorRole.id]);
  await as(ids.admin);
  await denied(() => db.query("update treasury_accounts set organization_id=$1 where id=$2", [ids.foreign, bank.id]));
  equal((await one("select organization_id from treasury_accounts where id=$1", [bank.id])).organization_id, ids.org);
  await denied(() => db.query("update numbering_sequences set organization_id=$1 where organization_id=$2", [ids.foreign, ids.org]));
  await db.exec("reset role");
  await db.query("delete from organization_members where organization_id=$1 and user_id=$2", [ids.foreign, ids.admin]);
  const foreignAdminRole = await one("select id from roles where organization_id=$1 and name='admin'", [ids.foreign]);
  await db.query("insert into organization_members(organization_id,user_id,role_id,status) values($1,$2,$3,'active')", [ids.foreign, ids.operator, foreignAdminRole.id]);
  await as(ids.operator);
  await denied(() => db.query("update treasury_accounts set organization_id=$1 where id=$2", [ids.foreign, bank.id]));
  await denied(() => db.query("update numbering_sequences set organization_id=$1 where organization_id=$2", [ids.foreign, ids.org]));
  await db.exec("reset role");
  await db.query("delete from organization_members where organization_id=$1 and user_id=$2", [ids.foreign, ids.operator]);
  await as(ids.admin);
  await db.query("update organization_members set status='disabled' where user_id=$1", [ids.operator]);
  await as(ids.operator);
  equal((await db.query("select id from customer_invoices where organization_id=$1", [ids.org])).rows.length, 0);
  await denied(() => db.query("insert into third_parties(organization_id,type,name) values($1,'customer','disabled forbidden')", [ids.org]));
  await db.exec("reset role; alter table public.company_settings disable row level security");
  await assert.rejects(() => db.exec(migration), /RLS_DISABLED_REQUIRES_REVIEW/); checks++;
  await db.exec("rollback");
  console.log(`Operator profile (${process.argv.includes("--relaxed-v3") ? "relaxed V3" : "strict V3"}): ${checks} PostgreSQL checks passed, including real invoice/payment numbering, atomic payments, balances, cancellation and posted-ledger boundaries.`);
} catch (error) {
  console.error(JSON.stringify({ message: error.message, code: error.code, detail: error.detail, position: error.position, where: error.where, internalQuery: error.internalQuery }));
  process.exitCode = 1;
} finally { await db.close(); }
