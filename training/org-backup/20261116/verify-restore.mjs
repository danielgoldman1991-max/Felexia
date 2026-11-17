// Disposable PostgreSQL only. Loads the real migrations, including the invoice guards.
// node training/org-backup/20261116/verify-restore.mjs --pglite-root=<temporary package directory>
import assert from "node:assert/strict";
import { tmpdir } from "node:os";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import { join } from "node:path";

if (!process.argv.some((arg) => arg.startsWith("--pglite-root=")) || process.argv.some((arg) => arg.startsWith("--postgres-url="))) {
  throw new Error("Use an explicit temporary PGlite package folder. Production URLs are refused.");
}
const root = fileURLToPath(new URL("../../../", import.meta.url));
const proofOutput = fileURLToPath(new URL("./restore.json", import.meta.url));
const baseline = await readFile(join(root, "scripts/verify-numbering-counters.mjs"), "utf8");
const marker = "\ntry {\n  await bootstrap();";
if (!baseline.includes(marker)) throw new Error("Review changed PostgreSQL test bootstrap");
let source = baseline.slice(0, baseline.indexOf(marker));
source = source.replace("new URL(`../supabase/migrations/${file}`, import.meta.url)", "new URL(file," + JSON.stringify(pathToFileURL(join(root, "supabase/migrations/")).href) + ")");
const folder = await mkdtemp(join(tmpdir(), "felexia-restore-"));
const runtime = join(folder, "runtime.mjs");
await writeFile(runtime, source + "\nglobalThis.__felexia = { db, sql, ids, one, as, equal, rejected, bootstrap, get checks() { return checks; }, get results() { return results; }, remember(name) { checks += 1; results.push(name); } };\n");
await import(pathToFileURL(runtime).href);
const { db, sql, ids, one, as, equal, rejected, bootstrap } = globalThis.__felexia;
const phaseBox = { phase: "bootstrap" };

function remember(name) {
  globalThis.__felexia.remember(name);
}

async function apply(file) {
  phaseBox.phase = file;
  const text = await sql(file);
  await db.exec(text.replace(/^\s*begin;\s*$/gim, "").replace(/^\s*commit;\s*$/gim, ""));
}

try {
  await db.exec(`
    create schema if not exists storage;
    create table if not exists storage.buckets (
      id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]
    );
    create table if not exists storage.objects (
      id uuid primary key default gen_random_uuid(), bucket_id text, name text
    );
    alter table storage.objects enable row level security;
  `);
  await bootstrap();
  await db.exec(`
    alter table accounting_accounts add column if not exists code text, add column if not exists name text;
    alter table accounting_entries add column if not exists total_debit numeric, add column if not exists total_credit numeric,
      add column if not exists posted_at timestamptz, add column if not exists posted_by uuid, add column if not exists created_by uuid,
      add column if not exists reference text, add column if not exists notes text;
    alter table accounting_entry_lines add column if not exists account_id uuid, add column if not exists account_code text,
      add column if not exists account_label text, add column if not exists line_number integer, add column if not exists debit numeric,
      add column if not exists credit numeric, add column if not exists label text,
      add column if not exists lettering_code text, add column if not exists lettering_date date;
  `);
  await apply("097_document_numbering_controls.sql");
  await apply("098_essential_finance_integrity.sql");
  await apply("082_hr_module.sql");
  await apply("134_posted_entry_lettering.sql");
  await apply("145_org_backup_restore.sql");
  await apply("147_org_backup_restore_fix.sql");
  await db.exec(`
    create table if not exists public.supplier_credit_notes (id uuid);
    create table if not exists public.supplier_credit_note_lines (id uuid);
    create table if not exists public.supplier_credit_note_applications (id uuid);
  `);
  await apply("148_essential_backup_completeness.sql");
  await apply("149_restore_backup_batches.sql");
  await apply("150_restore_document_bundle.sql");
  await apply("151_restore_fk_order.sql");
  await apply("152_essentiel_audit.sql");
  const installed = await one("select restauration_147_active from (select has_function_privilege('anon', 'public.restore_organization_backup(uuid,text,jsonb)', 'execute') = false and has_function_privilege('anon', 'public.restore_organization_backup_bundle(uuid,text,text,jsonb,text,text,jsonb,uuid[],text,text,boolean)', 'execute') = false and has_table_privilege('anon', 'app_private.organization_restore_scope', 'insert') = false as restauration_147_active) probe");
  equal(installed.restauration_147_active, true, "anonymous role cannot execute the restore or write the private marker");
  await db.exec("begin");

  phaseBox.phase = "seed";
  await db.exec("reset role");
  await db.query("insert into organizations(id,name,slug) values($1::uuid,'Atelier Démo',$2),($3::uuid,'Autre atelier',$4)", [ids.org, ids.org, ids.foreign, ids.foreign]);
  for (const [name, user, org] of [["admin", ids.admin, ids.org], ["viewer", ids.viewer, ids.org], ["outsider", ids.outsider, ids.foreign]]) {
    await db.query("insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())", [user, `${name}@example.test`]);
    await db.query("insert into profiles(id,email) values($1,$2)", [user, `${name}@example.test`]);
    const roleName = name === "outsider" ? "admin" : name;
    const role = await one("insert into roles(organization_id,name) values($1,$2) returning id", [org, roleName]);
    await db.query("insert into organization_members(organization_id,user_id,role_id,status) values($1,$2,$3,'active')", [org, user, role.id]);
  }
  const period = (await one("select timezone('Africa/Casablanca', now())::date::text as value")).value;
  const customer = (await one("insert into third_parties(organization_id,code,primary_type,types,name) values($1,'CU-DEMO','customer',array['customer'],'Client Démo') returning id", [ids.org])).id;
  const supplier = (await one("insert into third_parties(organization_id,code,primary_type,types,name) values($1,'SU-DEMO','supplier',array['supplier'],'Fournisseur Démo') returning id", [ids.org])).id;
  const foreignCustomer = (await one("insert into third_parties(organization_id,code,primary_type,types,name) values($1,'CU-AUTRE','customer',array['customer'],'Client étranger') returning id", [ids.foreign])).id;
  await db.query("insert into company_settings(organization_id,legal_name) values($1,'Atelier Démo')", [ids.org]);
  const journal = (await one("insert into accounting_journals(organization_id,code,name) values($1,'VE','Ventes') returning id", [ids.org])).id;
  const bankAccount = (await one("insert into accounting_accounts(organization_id,code,name) values($1,'5141','Banque') returning id", [ids.org])).id;
  const customerAccount = (await one("insert into accounting_accounts(organization_id,code,name) values($1,'3421','Clients') returning id", [ids.org])).id;
  await db.exec("grant select,insert,update,delete on all tables in schema public to authenticated");
  await db.exec("grant usage on schema public, auth, app_private to authenticated, anon");

  await as(ids.admin);
  await rejected(
    () => db.query("insert into customer_invoices(organization_id,customer_id,invoice_number,status,total_ttc) values($1,$2,'','validated',100)", [ids.org, customer]),
    /FINANCE_DRAFT_REQUIRED/,
    "a direct validated customer invoice is still refused",
  );
  const customerInvoice = await one(
    "insert into customer_invoices(organization_id,customer_id,invoice_number,invoice_date,status,currency) values($1,$2,'',$3::date,'draft','MAD') returning id, invoice_number",
    [ids.org, customer, period],
  );
  await db.query(
    "insert into customer_invoice_lines(organization_id,invoice_id,description,quantity,unit_price_ht,discount_rate,tax_rate) values($1,$2,'Prestation',2,100,0,20)",
    [ids.org, customerInvoice.id],
  );
  await db.query(`update customer_invoices i set subtotal_ht=l.subtotal_ht, discount_total=l.discount_amount, tax_total=l.tax_amount, total_ttc=l.total_ttc, remaining_amount=l.total_ttc
    from customer_invoice_lines l where i.id=l.invoice_id and i.id=$1`, [customerInvoice.id]);
  await db.query("update customer_invoices set status='validated' where id=$1", [customerInvoice.id]);
  const supplierInvoice = await one(
    "insert into supplier_invoices(organization_id,supplier_id,supplier_invoice_number,invoice_number,invoice_date,status,currency) values($1,$2,'EXT-001','',$3::date,'draft','MAD') returning id, invoice_number",
    [ids.org, supplier, period],
  );
  await db.query(
    "insert into supplier_invoice_lines(organization_id,invoice_id,description,quantity,unit_price_ht,discount_rate,tax_rate) values($1,$2,'Achat',1,100,0,20)",
    [ids.org, supplierInvoice.id],
  );
  await db.query(`update supplier_invoices i set subtotal_ht=l.subtotal_ht, discount_total=l.discount_amount, tax_total=l.tax_amount, total_ttc=l.total_ttc, remaining_amount=l.total_ttc
    from supplier_invoice_lines l where i.id=l.invoice_id and i.id=$1`, [supplierInvoice.id]);
  await db.query("update supplier_invoices set status='validated' where id=$1", [supplierInvoice.id]);
  const payment = await one(
    "insert into customer_payments(organization_id,third_party_id,customer_id,payment_number,payment_date,amount,currency,payment_method,status) values($1,$2,$2,'',$3::date,50,'MAD','bank_transfer','confirmed') returning id, payment_number, amount",
    [ids.org, customer, period],
  );
  const entry = await one(
    "insert into accounting_entries(organization_id,journal_id,entry_number,entry_date,status,label,total_debit,total_credit,source_document_type,source_document_id) values($1,$2,'',$3::date,'posted','Facture client',(select total_ttc from customer_invoices where id=$4),(select total_ttc from customer_invoices where id=$4),'customer_invoice',$4) returning id, entry_number, total_debit",
    [ids.org, journal, period, customerInvoice.id],
  );
  await db.query(
    "insert into accounting_entry_lines(organization_id,entry_id,account_id,line_number,debit,credit,label) values($1,$2,$3,1,$4,0,'Banque'),($1,$2,$5,2,0,$4,'Client')",
    [ids.org, entry.id, bankAccount, entry.total_debit, customerAccount],
  );
  await db.exec("set constraints all immediate");
  await db.exec("set constraints all deferred");
  await db.exec("reset role");
  const employee = await one(
    "insert into hr_employees(organization_id,employee_number,first_name,last_name,hire_date,base_salary) values($1,'EMP-001','Sara','Bennani',$2::date,8000) returning id, full_name",
    [ids.org, period],
  );
  equal(employee.full_name, "Sara Bennani", "the employee name is generated from the first and last name");
  await as(ids.outsider);
  const foreignInvoice = await one(
    "insert into customer_invoices(organization_id,customer_id,invoice_number,invoice_date,status,currency) values($1,$2,'FAC-AUTRE',$3::date,'draft','MAD') returning id, invoice_number, status",
    [ids.foreign, foreignCustomer, period],
  );

  const tables = ["company_settings", "third_parties", "customer_invoices", "customer_invoice_lines", "customer_payments", "supplier_invoices", "supplier_invoice_lines", "accounting_entries", "accounting_entry_lines", "treasury_accounts", "treasury_transactions", "hr_employees"];
  async function snapshot(org) {
    const payload = [];
    for (const name of tables) {
      const rows = (await db.query(`select to_jsonb(t) as row from public.${name} t where organization_id = $1 order by id`, [org])).rows.map((row) => row.row);
      payload.push({ name, rows });
    }
    return payload;
  }
  await db.exec("reset role");
  const treasury = await one(
    "insert into treasury_accounts(organization_id,name,account_type,currency) values($1,'Caisse test','cash','MAD') returning id",
    [ids.org],
  );
  await one(
    "insert into treasury_transactions(organization_id,treasury_account_id,transaction_type,direction,amount,currency,label) values($1,$2,'manual_in','in',15,'MAD','Entrée de caisse') returning id",
    [ids.org, treasury.id],
  );
  const original = await snapshot(ids.org);
  const poisoned = JSON.parse(JSON.stringify(original));
  const invoiceRows = poisoned.find((table) => table.name === "customer_invoices").rows;
  invoiceRows.push({ id: foreignInvoice.id, organization_id: ids.foreign, customer_id: customer, invoice_number: "PIRATE", status: "validated", total_ttc: 1, notes: "SECRET_TOKEN_XYZ" });

  phaseBox.phase = "draft deletion and company rights";
  await as(ids.admin);
  const draft = await one(
    "insert into customer_invoices(organization_id,customer_id,invoice_number,invoice_date,status,currency) values($1,$2,'FAC-BROUILLON',$3::date,'draft','MAD') returning id",
    [ids.org, customer, period],
  );
  await db.query(
    "insert into customer_invoice_lines(organization_id,invoice_id,description,quantity,unit_price_ht,discount_rate,tax_rate) values($1,$2,'Brouillon',1,10,0,20)",
    [ids.org, draft.id],
  );
  await db.query("delete from customer_invoices where id=$1", [draft.id]);
  equal(Number((await one("select count(*)::int n from customer_invoice_lines where invoice_id=$1", [draft.id])).n), 0, "deleting a draft invoice removes its lines");
  await rejected(
    () => db.query("delete from customer_invoice_lines where invoice_id=$1", [customerInvoice.id]),
    /FINANCE_DRAFT_REQUIRED/,
    "lines of a validated invoice stay protected",
  );
  await db.exec("reset role");
  await db.query("insert into auth.users(id,email,email_confirmed_at) values($1,'comptable@example.test',now())", [ids.accountant]);
  await db.query("insert into profiles(id,email) values($1,'comptable@example.test')", [ids.accountant]);
  const accountantRole = await one("insert into roles(organization_id,name) values($1,'accountant') returning id", [ids.org]);
  await db.query("insert into organization_members(organization_id,user_id,role_id,status) values($1,$2,$3,'active')", [ids.org, ids.accountant, accountantRole.id]);
  await as(ids.accountant);
  const blockedSettings = await db.query("update company_settings set ice='999999999999999' where organization_id=$1 returning organization_id", [ids.org]);
  equal(blockedSettings.rows.length, 0, "an accountant cannot change company settings");
  const blockedOrg = await db.query("update organizations set ice='999999999999999' where id=$1 returning id", [ids.org]);
  equal(blockedOrg.rows.length, 0, "an accountant cannot change the organization record");
  await as(ids.admin);
  const allowedSettings = await db.query("update company_settings set city='Rabat' where organization_id=$1 returning organization_id", [ids.org]);
  equal(allowedSettings.rows.length, 1, "an administrator can still update company settings");

  phaseBox.phase = "naive generated insert";
  const employeeJson = original.find((table) => table.name === "hr_employees").rows[0];
  await rejected(
    () => db.query("insert into public.hr_employees select rec.* from jsonb_populate_record(null::public.hr_employees, $1::jsonb) rec", [JSON.stringify(employeeJson)]),
    /full_name|non-DEFAULT/i,
    "inserting the whole employee record still rejects the generated full name",
  );

  async function wipe(org) {
    await db.exec("reset role");
    for (const name of [...tables].reverse()) await db.exec(`alter table public.${name} disable trigger user`);
    try {
      for (const name of [...tables].reverse()) await db.query(`delete from public.${name} where organization_id = $1`, [org]);
    } finally {
      for (const name of tables) await db.exec(`alter table public.${name} enable trigger user`);
    }
  }
  async function restore(mode, payload, user = ids.admin) {
    await as(user);
    return one("select public.restore_organization_backup($1,$2,$3::jsonb) as result", [ids.org, mode, JSON.stringify(payload)]);
  }
  async function counts(org) {
    const out = {};
    for (const name of tables) out[name] = Number((await one(`select count(*)::int n from public.${name} where organization_id = $1`, [org])).n);
    return out;
  }

  phaseBox.phase = "merge restore";
  await wipe(ids.org);
  equal(Number((await one("select count(*)::int n from customer_invoices where organization_id=$1", [ids.org])).n), 0, "the organization data was removed before merge");
  await restore("merge", original);
  await db.exec("reset role");
  const restoredInvoice = await one("select invoice_number, status, total_ttc from customer_invoices where id=$1", [customerInvoice.id]);
  equal(restoredInvoice.invoice_number, customerInvoice.invoice_number, "merge keeps the validated customer invoice number");
  equal(restoredInvoice.status, "validated", "merge keeps the validated customer invoice status");
  equal(Number(restoredInvoice.total_ttc), Number((await one("select total_ttc from customer_invoice_lines where invoice_id=$1", [customerInvoice.id])).total_ttc), "merge keeps the customer invoice total");
  equal((await one("select status, invoice_number from supplier_invoices where id=$1", [supplierInvoice.id])).status, "validated", "merge keeps the validated supplier invoice");
  equal(Number((await one("select amount from customer_payments where id=$1", [payment.id])).amount), Number(payment.amount), "merge keeps the customer payment");
  equal((await one("select entry_number, status from accounting_entries where id=$1", [entry.id])).entry_number, entry.entry_number, "merge keeps the posted entry number");
  equal(Number((await one("select count(*)::int n from accounting_entry_lines where entry_id=$1", [entry.id])).n), 2, "merge keeps both entry lines");
  equal((await one("select full_name, first_name from hr_employees where id=$1", [employee.id])).full_name, "Sara Bennani", "merge restores the employee without writing the generated name");
  equal((await one("select label from treasury_transactions where organization_id=$1", [ids.org])).label, "Entrée de caisse", "merge restores the treasury movement");
  const afterMerge = await counts(ids.org);

  phaseBox.phase = "merge replay";
  await restore("merge", original);
  await db.exec("reset role");
  equal(await counts(ids.org), afterMerge, "replaying the merge does not create a duplicate");
  equal(Number((await one("select count(*)::int n from customer_invoices where invoice_number=$1", [customerInvoice.invoice_number])).n), 1, "the customer invoice number stays unique");

  phaseBox.phase = "replace";
  await as(ids.admin);
  await db.query("insert into customer_invoices(organization_id,customer_id,invoice_number,invoice_date,status,currency) values($1,$2,'',$3::date,'draft','MAD')", [ids.org, customer, period]);
  equal(Number((await one("select count(*)::int n from customer_invoices where organization_id=$1", [ids.org])).n), afterMerge.customer_invoices + 1, "an extra draft exists before replace");
  await restore("replace", original);
  await db.exec("reset role");
  equal(await counts(ids.org), afterMerge, "replace removes the extra draft and restores the snapshot");
  equal((await one("select status, invoice_number from customer_invoices where id=$1", [customerInvoice.id])).status, "validated", "replace keeps the validated invoice behind the guards");

  phaseBox.phase = "isolation";
  await restore("merge", poisoned);
  await db.exec("reset role");
  const foreignAfter = await one("select organization_id, invoice_number, status, notes from customer_invoices where id=$1", [foreignInvoice.id]);
  equal(foreignAfter.organization_id, ids.foreign, "a conflicting id owned by another organization is left untouched");
  equal(foreignAfter.invoice_number, "FAC-AUTRE", "the other organization invoice number is unchanged");
  equal(foreignAfter.notes ?? null, null, "the other organization invoice gains no imported note");
  equal(Number((await one("select count(*)::int n from customer_invoices where organization_id=$1 and id=$2", [ids.org, foreignInvoice.id])).n), 0, "the foreign invoice is not copied into the restored organization");
  await rejected(
    () => db.query("select public.restore_organization_backup($1,'replace',$2::jsonb)", [ids.foreign, JSON.stringify(original)]),
    /RESTORE_FORBIDDEN|42501/,
    "an administrator cannot restore another organization",
  );
  await as(ids.viewer);
  await rejected(
    () => db.query("select public.restore_organization_backup($1,'merge',$2::jsonb)", [ids.org, JSON.stringify(original)]),
    /RESTORE_FORBIDDEN|42501/,
    "a viewer cannot restore the organization",
  );
  await as(null, "anon");
  await rejected(
    () => db.query("select public.restore_organization_backup($1,'merge','[]'::jsonb)", [ids.org]),
    /permission denied/i,
    "the anonymous role cannot call the restore",
  );
  await as(ids.admin);
  await rejected(
    () => db.query("insert into app_private.organization_restore_scope(txid, organization_id) values(txid_current(), $1)", [ids.org]),
    /permission denied|row-level security/i,
    "an authenticated user cannot activate the restore bypass",
  );
  await rejected(
    () => db.query("insert into customer_invoices(organization_id,customer_id,invoice_number,status,total_ttc) values($1,$2,'DIRECT','validated',10)", [ids.org, customer]),
    /FINANCE_DRAFT_REQUIRED/,
    "the invoice guard still refuses a direct validated insert after restore",
  );

  phaseBox.phase = "sanitized error";
  await db.exec("savepoint poisoned_restore");
  const bad = JSON.parse(JSON.stringify(original));
  const badInvoice = bad.find((table) => table.name === "customer_invoices").rows[0];
  badInvoice.status = "NOT_A_STATUS";
  badInvoice.notes = "SECRET_TOKEN_XYZ";
  let leaked = false;
  try {
    await db.query("select public.restore_organization_backup($1,'replace',$2::jsonb)", [ids.org, JSON.stringify(bad)]);
    leaked = true;
  } catch (error) {
    assert.match(error.message, /RESTORE_BLOCKED\|customer_invoices\|[0-9A-Z]{5}/, "the failure names the blocked table and SQLSTATE");
    assert.equal(error.message.includes("SECRET_TOKEN_XYZ"), false, "the failure message does not contain the row");
    assert.equal(String(error.detail ?? "").includes("SECRET_TOKEN_XYZ"), false, "the failure detail does not contain the row");
    remember("a blocked table is reported without its data");
  }
  if (leaked) throw new Error("the invalid invoice should have blocked the restore");
  await db.exec("rollback to savepoint poisoned_restore");
  equal((await one("select status from customer_invoices where id=$1", [customerInvoice.id])).status, "validated", "a failed restore leaves the validated invoice unchanged");

  await db.exec("reset role");
  await db.query("insert into organization_subscriptions(organization_id, plan_code) values($1,'essentiel')", [ids.org]);
  await db.query("delete from hr_employees where organization_id=$1", [ids.org]);
  await restore("merge", original);
  await db.exec("reset role");
  equal(Number((await one("select count(*)::int n from hr_employees where organization_id=$1", [ids.org])).n), 0, "an Essentiel organization does not restore employees from a PRO backup");

  phaseBox.phase = "batched restore";
  await as(ids.admin);
  const settingsSame = await one(
    "select public.restore_organization_backup_batch($1,'merge','company_settings',$2::jsonb,'{}'::uuid[]) as result",
    [ids.org, JSON.stringify([{ organization_id: ids.org, legal_name: "Atelier Démo" }])],
  );
  equal(Number(settingsSame.result.written), 0, "replaying identical company settings writes nothing");
  const settingsChange = await one(
    "select public.restore_organization_backup_batch($1,'merge','company_settings',$2::jsonb,'{}'::uuid[]) as result",
    [ids.org, JSON.stringify([{ organization_id: ids.org, legal_name: "Atelier Démo", city: "Rabat" }])],
  );
  equal(Number(settingsChange.result.written), 1, "a real company settings change is written once");
  const settingsReplay = await one(
    "select public.restore_organization_backup_batch($1,'merge','company_settings',$2::jsonb,'{}'::uuid[]) as result",
    [ids.org, JSON.stringify([{ organization_id: ids.org, legal_name: "Atelier Démo", city: "Rabat" }])],
  );
  equal(Number(settingsReplay.result.written), 0, "replaying the same company settings still writes nothing");

  const partyId = "10000000-0000-4000-8000-000000000001";
  const party = { id: partyId, organization_id: ids.org, name: "Client lot", primary_type: "customer", types: ["customer"], code: "CU-LOT-1", status: "active" };
  const insertedParty = await one(
    "select public.restore_organization_backup_batch($1,'merge','third_parties',$2::jsonb,'{}'::uuid[]) as result",
    [ids.org, JSON.stringify([party])],
  );
  equal(Number(insertedParty.result.written), 1, "a missing third party is inserted");
  const replayParty = await one(
    "select public.restore_organization_backup_batch($1,'merge','third_parties',$2::jsonb,'{}'::uuid[]) as result",
    [ids.org, JSON.stringify([party])],
  );
  equal(Number(replayParty.result.written), 0, "replaying the same third party does not duplicate it");
  await rejected(
    () => db.query("select public.restore_organization_backup_batch($1,'merge','third_parties',$2::jsonb,'{}'::uuid[])", [ids.org, JSON.stringify([{ name: "Sans identifiant" }])]),
    /RESTORE_ROW_KEY|RESTORE_BLOCKED/,
    "a batch without a key fails",
  );
  await db.exec("reset role");
  equal(Number((await one("select count(*)::int n from app_private.organization_restore_scope")).n), 0, "the restore marker is cleared after an error");
  await as(ids.admin);
  equal(Number((await one("select count(*)::int n from third_parties where id=$1", [partyId])).n), 1, "the failed batch did not remove the earlier row");

  const restoredInvoiceId = "10000000-0000-4000-8000-000000000002";
  const validated = await one(
    "select public.restore_organization_backup_batch($1,'merge','customer_invoices',$2::jsonb,'{}'::uuid[]) as result",
    [ids.org, JSON.stringify([{ id: restoredInvoiceId, organization_id: ids.org, customer_id: customer, invoice_number: "FAC-REPRISE", invoice_date: period, status: "validated", currency: "MAD", total_ttc: 12 }])],
  );
  equal(validated.result.insertedInvoiceIds[0], restoredInvoiceId, "a validated invoice can be restored inside the batch");
  await db.exec("reset role");
  equal(Number((await one("select count(*)::int n from app_private.organization_restore_scope")).n), 0, "the restore marker is cleared after success");
  await as(ids.admin);
  await rejected(
    () => db.query("insert into customer_invoices(organization_id,customer_id,invoice_number,status,total_ttc) values($1,$2,'FAC-REFUS','validated',100)", [ids.org, customer]),
    /FINANCE_DRAFT_REQUIRED/,
    "a validated invoice is refused again once the batch has finished",
  );
  const line = await one(
    "select public.restore_organization_backup_batch($1,'merge','customer_invoice_lines',$2::jsonb,$3::uuid[]) as result",
    [ids.org, JSON.stringify([{ id: "10000000-0000-4000-8000-000000000003", organization_id: ids.org, invoice_id: restoredInvoiceId, description: "Ligne restaurée", quantity: 1, unit_price_ht: 10, discount_rate: 0, tax_rate: 20 }]), [restoredInvoiceId]],
  );
  equal(Number(line.result.written), 1, "lines of an invoice inserted by this restore are kept");
  const foreignSkip = await one(
    "select public.restore_organization_backup_batch($1,'merge','third_parties',$2::jsonb,'{}'::uuid[]) as result",
    [ids.org, JSON.stringify([{ id: foreignCustomer, organization_id: ids.org, name: "Piraté", primary_type: "customer", code: "CU-PIRATE" }])],
  );
  equal(Number(foreignSkip.result.written), 0, "a row owned by another organization is not moved");
  await db.exec("reset role");
  equal((await one("select name from third_parties where id=$1", [foreignCustomer])).name, "Client étranger", "the other organization keeps its row");
  await as(ids.admin);

  const unitId = "10000000-0000-4000-8000-000000000004";
  const unit = { id: unitId, organization_id: ids.org, name: "Pièce", symbol: "pce" };
  await one("select public.restore_organization_backup_batch($1,'merge','units',$2::jsonb,'{}'::uuid[]) as result", [ids.org, JSON.stringify([unit])]);
  const deleted = await one(
    "select public.restore_organization_backup_batch($1,'delete','units','[]'::jsonb,'{}'::uuid[]) as result",
    [ids.org],
  );
  equal(Number(deleted.result.written) > 0, true, "replace deletes the organization rows of one table");
  const cleared = await one(
    "select public.restore_organization_backup_batch($1,'delete','units','[]'::jsonb,'{}'::uuid[]) as result",
    [ids.org],
  );
  equal(Number(cleared.result.written), 0, "a second delete of the same table is empty");
  await one("select public.restore_organization_backup_batch($1,'merge','units',$2::jsonb,'{}'::uuid[]) as result", [ids.org, JSON.stringify([unit])]);
  const unitReplay = await one("select public.restore_organization_backup_batch($1,'merge','units',$2::jsonb,'{}'::uuid[]) as result", [ids.org, JSON.stringify([unit])]);
  equal(Number(unitReplay.result.written), 0, "replaying the restored unit does not duplicate it");
  equal(Number((await one("select count(*)::int n from units where id=$1", [unitId])).n), 1, "the deleted unit can be inserted again");

  const bulkParent = (await one(
    "insert into customer_invoices(organization_id,customer_id,invoice_number,invoice_date,status,currency) values($1,$2,'',$3::date,'draft','MAD') returning id",
    [ids.org, customer, period],
  )).id;
  let maxBatchMs = 0;
  const batchSize = 200;
  const bulkTotal = 5000;
  for (let offset = 0; offset < bulkTotal; offset += batchSize) {
    const rows = [];
    for (let index = 0; index < batchSize && offset + index < bulkTotal; index += 1) {
      const number = offset + index + 1;
      rows.push({
        id: `20000000-0000-4000-8000-${String(number).padStart(12, "0")}`,
        organization_id: ids.org,
        invoice_id: bulkParent,
        description: `Ligne ${number}`,
        quantity: 1,
        unit_price_ht: 10,
        discount_rate: 0,
        tax_rate: 20,
      });
    }
    const started = performance.now();
    const chunk = await one(
      "select public.restore_organization_backup_batch($1,'merge','customer_invoice_lines',$2::jsonb,'{}'::uuid[]) as result",
      [ids.org, JSON.stringify(rows)],
    );
    maxBatchMs = Math.max(maxBatchMs, performance.now() - started);
    equal(Number(chunk.result.written), rows.length, `batch at ${offset} writes its lines`);
  }
  equal(maxBatchMs < 4000, true, `each batch of ${batchSize} lines stays under 4s (max ${Math.round(maxBatchMs)} ms)`);
  equal(Number((await one("select count(*)::int n from customer_invoice_lines where invoice_id=$1", [bulkParent])).n), bulkTotal, "five thousand lines are restored");
  const replayBulk = await one(
    "select public.restore_organization_backup_batch($1,'merge','customer_invoice_lines',$2::jsonb,'{}'::uuid[]) as result",
    [ids.org, JSON.stringify([{
      id: "20000000-0000-4000-8000-000000000001",
      organization_id: ids.org,
      invoice_id: bulkParent,
      description: "Ligne 1",
      quantity: 1,
      unit_price_ht: 10,
      discount_rate: 0,
      tax_rate: 20,
    }])],
  );
  equal(Number(replayBulk.result.written), 0, "replaying a restored line does not write it again");

  phaseBox.phase = "document bundle";
  await as(ids.admin);
  const entryId = "30000000-0000-4000-8000-000000000010";
  const lineA = "30000000-0000-4000-8000-000000000011";
  const lineB = "30000000-0000-4000-8000-000000000012";
  const postedHeader = { id: entryId, organization_id: ids.org, journal_id: journal, entry_number: "VE-REPRISE", entry_date: period, status: "posted", label: "Écriture restaurée", total_debit: 10, total_credit: 10 };
  const postedLines = [
    { id: lineA, organization_id: ids.org, entry_id: entryId, debit: 10, credit: 0 },
    { id: lineB, organization_id: ids.org, entry_id: entryId, debit: 0, credit: 10 },
  ];
  await db.query("savepoint unbalanced_entry");
  try {
    await db.query("select public.restore_organization_backup_batch($1,'merge','accounting_entries',$2::jsonb,'{}'::uuid[])", [ids.org, JSON.stringify([postedHeader])]);
    await db.query("set constraints all immediate");
    throw new Error("Missing expected rejection.");
  } catch (error) {
    if (!/FINANCE_ENTRY_UNBALANCED/.test(error.message ?? "")) throw error;
    await db.query("rollback to savepoint unbalanced_entry");
  }
  equal(true, true, "a posted entry without its lines is refused");
  const bundled = await one(
    "select public.restore_organization_backup_bundle($1,'merge','accounting_entries',$2::jsonb,'accounting_entry_lines','entry_id',$3::jsonb,'{}'::uuid[]) as result",
    [ids.org, JSON.stringify([postedHeader]), JSON.stringify(postedLines)],
  );
  equal(bundled.result.ok, true, "a missing posted entry is restored with its lines");
  equal(Number((await one("select count(*)::int n from accounting_entry_lines where entry_id=$1", [entryId])).n), 2, "both entry lines were restored");
  await db.query("savepoint failed_replace");
  try {
    await db.query(
      "select public.restore_organization_backup_bundle($1,'replace','accounting_entries',$2::jsonb,'accounting_entry_lines','entry_id',$3::jsonb,'{}'::uuid[],'oui','Atelier Démo')",
      [ids.org, JSON.stringify([postedHeader]), JSON.stringify([{ id: lineA, organization_id: ids.org, entry_id: entryId, debit: 10, credit: 0 }])],
    );
    await db.query("set constraints all immediate");
    throw new Error("Missing expected rejection.");
  } catch (error) {
    if (!/FINANCE_ENTRY_UNBALANCED/.test(error.message ?? "")) throw error;
    await db.query("rollback to savepoint failed_replace");
  }
  equal(Number((await one("select count(*)::int n from accounting_entry_lines where entry_id=$1", [entryId])).n), 2, "a failed replace keeps the previous entry");
  await one(
    "select public.restore_organization_backup_bundle($1,'replace','accounting_entries',$2::jsonb,'accounting_entry_lines','entry_id',$3::jsonb,'{}'::uuid[],'oui','Atelier Démo')",
    [ids.org, JSON.stringify([postedHeader]), JSON.stringify(postedLines)],
  );
  equal(Number((await one("select count(*)::int n from accounting_entry_lines where entry_id=$1", [entryId])).n), 2, "resuming the replace restores the same entry without a duplicate");
  const unbalanced = { ...postedHeader, id: "30000000-0000-4000-8000-000000000099", entry_number: "VE-DESEQ", total_debit: 10, total_credit: 10 };
  const sentinelBefore = Number((await one("select count(*)::int n from third_parties where organization_id=$1", [ids.org])).n);
  await rejected(
    () => db.query("select public.restore_organization_backup_bundle($1,'rehearse','accounting_entries',$2::jsonb,'accounting_entry_lines','entry_id',$3::jsonb,'{}'::uuid[])", [ids.org, JSON.stringify([unbalanced]), JSON.stringify([{ id: lineA, organization_id: ids.org, entry_id: unbalanced.id, debit: 10, credit: 0 }])]),
    /FINANCE_ENTRY_UNBALANCED/,
    "the dry run rejects an unbalanced entry",
  );
  equal(Number((await one("select count(*)::int n from third_parties where organization_id=$1", [ids.org])).n), sentinelBefore, "a failed dry run deletes nothing");
  equal(Number((await one("select count(*)::int n from accounting_entries where entry_number='VE-DESEQ'")).n), 0, "the rejected entry was not kept");

  const invoiceId = "30000000-0000-4000-8000-000000000020";
  const invoiceLineId = "30000000-0000-4000-8000-000000000021";
  await one(
    "select public.restore_organization_backup_bundle($1,'merge','customer_invoices',$2::jsonb,'customer_invoice_lines','invoice_id',$3::jsonb,'{}'::uuid[]) as result",
    [ids.org, JSON.stringify([{ id: invoiceId, organization_id: ids.org, customer_id: customer, invoice_number: "FAC-BUNDLE", invoice_date: period, status: "validated", currency: "MAD", total_ttc: 12 }]), JSON.stringify([{ id: invoiceLineId, organization_id: ids.org, invoice_id: invoiceId, description: "Ligne groupée", quantity: 1, unit_price_ht: 10, discount_rate: 0, tax_rate: 20 }])],
  );
  equal(Number((await one("select count(*)::int n from customer_invoice_lines where invoice_id=$1", [invoiceId])).n), 1, "a missing validated invoice keeps its line");

  const noteId = "30000000-0000-4000-8000-000000000030";
  await one(
    "select public.restore_organization_backup_bundle($1,'merge','customer_credit_notes',$2::jsonb,'customer_credit_note_lines','credit_note_id',$3::jsonb,'{}'::uuid[]) as result",
    [ids.org, JSON.stringify([{ id: noteId, organization_id: ids.org, customer_id: customer, credit_note_number: "AV-BUNDLE", credit_note_date: period, status: "draft", currency: "MAD", subtotal_ht: 10, discount_total: 0, tax_total: 2, total_ttc: 12 }]), JSON.stringify([{ id: "30000000-0000-4000-8000-000000000031", organization_id: ids.org, credit_note_id: noteId, description: "Avoir", quantity: 1, unit_price_ht: 10, discount_rate: 0, tax_rate: 20 }])],
  );
  equal(Number((await one("select count(*)::int n from customer_credit_note_lines where credit_note_id=$1", [noteId])).n), 1, "a credit note is restored with its line");

  const paymentId = "30000000-0000-4000-8000-000000000040";
  await one(
    "select public.restore_organization_backup_bundle($1,'merge','customer_payments',$2::jsonb,'customer_payment_allocations','payment_id',$3::jsonb,'{}'::uuid[]) as result",
    [ids.org, JSON.stringify([{ id: paymentId, organization_id: ids.org, customer_id: customer, third_party_id: customer, payment_number: "REG-BUNDLE", payment_date: period, amount: 12, currency: "MAD", status: "confirmed" }]), JSON.stringify([{ id: "30000000-0000-4000-8000-000000000041", organization_id: ids.org, payment_id: paymentId, invoice_id: invoiceId, customer_id: customer, third_party_id: customer, amount: 12 }])],
  );
  equal(Number((await one("select count(*)::int n from customer_payment_allocations where payment_id=$1", [paymentId])).n), 1, "a payment is restored with its allocation");

  const extraId = "30000000-0000-4000-8000-000000000050";
  await one(
    "select public.restore_organization_backup_bundle($1,'merge','accounting_entries',$2::jsonb,'accounting_entry_lines','entry_id',$3::jsonb,'{}'::uuid[])",
    [ids.org, JSON.stringify([{ id: extraId, organization_id: ids.org, journal_id: journal, entry_number: "VE-EXTRA", entry_date: period, status: "posted", label: "Extra", total_debit: 5, total_credit: 5 }]), JSON.stringify([{ id: "30000000-0000-4000-8000-000000000051", organization_id: ids.org, entry_id: extraId, debit: 5, credit: 0 }, { id: "30000000-0000-4000-8000-000000000052", organization_id: ids.org, entry_id: extraId, debit: 0, credit: 5 }])],
  );
  await one(
    "select public.restore_organization_backup_bundle($1,'purge','accounting_entries','[]'::jsonb,'accounting_entry_lines','entry_id','[]'::jsonb,$2::uuid[],'oui','Atelier Démo')",
    [ids.org, [entryId]],
  );
  equal(Number((await one("select count(*)::int n from accounting_entries where id=$1", [extraId])).n), 0, "replace removes an entry that is not in the file");
  equal(Number((await one("select count(*)::int n from accounting_entries where id=$1", [entryId])).n), 1, "replace keeps the entry from the file");
  equal(Number((await one("select count(*)::int n from accounting_entry_lines where entry_id=$1", [entryId])).n), 2, "the kept entry still has its lines");

  phaseBox.phase = "posted entry guard";
  await db.exec("reset role");
  const guard = await one("select pg_get_functiondef('app_private.guard_essential_posted_entry()'::regprocedure) as body");
  equal(guard.body.includes("lettering_code") && guard.body.includes("lettering_date"), true, "migration 150 keeps the lettering exception from 134");
  equal(guard.body.includes("FINANCE_RELATED_RECORD_INVALID"), true, "migration 150 keeps the organization check from 147");
  await as(ids.admin);
  await db.query("update accounting_entry_lines set lettering_code='A', lettering_date=$2::date where id=$1", [lineA, period]);
  equal((await one("select lettering_code from accounting_entry_lines where id=$1", [lineA])).lettering_code, "A", "lettering a posted entry line stays allowed");
  await rejected(
    () => db.query("update accounting_entries set label='Libellé modifié' where id=$1", [entryId]),
    /FINANCE_POSTED_ENTRY_READ_ONLY/,
    "the label of a posted entry stays read only",
  );
  await rejected(
    () => db.query("update accounting_entry_lines set label='Ligne modifiée' where id=$1", [lineA]),
    /FINANCE_POSTED_ENTRY_READ_ONLY/,
    "a posted line can no longer change anything except lettering",
  );
  await rejected(
    () => db.query("update accounting_entries set organization_id=$2 where id=$1", [entryId, ids.foreign]),
    /FINANCE_RELATED_RECORD_INVALID/,
    "moving a posted entry to another organization is refused",
  );

  phaseBox.phase = "replace with payments";
  await db.exec("reset role");
  const applicationId = "30000000-0000-4000-8000-000000000060";
  const accountId = "30000000-0000-4000-8000-000000000070";
  const movementId = "30000000-0000-4000-8000-000000000071";
  const supplierPaymentId = "30000000-0000-4000-8000-000000000080";
  const supplierMovementId = "30000000-0000-4000-8000-000000000081";
  const extraMovementId = "30000000-0000-4000-8000-000000000082";
  await db.query("update customer_credit_notes set source_invoice_id=$2 where id=$1", [noteId, invoiceId]);
  await db.query("update customer_credit_note_lines set source_invoice_line_id=$2 where credit_note_id=$1", [noteId, invoiceLineId]);
  await db.query(
    "insert into customer_credit_note_applications(id,organization_id,credit_note_id,invoice_id,customer_id,amount) values($1,$2,$3,$4,$5,12)",
    [applicationId, ids.org, noteId, invoiceId, customer],
  );
  await db.query("insert into treasury_accounts(id,organization_id,name,account_type,currency) values($1,$2,'Banque QA','bank','MAD')", [accountId, ids.org]);
  await db.query(
    "insert into treasury_transactions(id,organization_id,treasury_account_id,transaction_type,direction,amount,currency,transaction_date,label,customer_payment_id,customer_invoice_id) values($1,$2,$3,'customer_payment','in',12,'MAD',$4::date,'Encaissement client',$5,$6)",
    [movementId, ids.org, accountId, period, paymentId, invoiceId],
  );
  await db.query(
    "insert into supplier_payments(id,organization_id,payment_number,supplier_id,payment_date,amount,currency,status) values($1,$2,'RFO-BUNDLE',$3,$4::date,12,'MAD','confirmed')",
    [supplierPaymentId, ids.org, supplier, period],
  );
  await db.query(
    "insert into treasury_transactions(id,organization_id,treasury_account_id,transaction_type,direction,amount,currency,transaction_date,label,supplier_payment_id,supplier_invoice_id) values($1,$2,$3,'supplier_payment','out',12,'MAD',$4::date,'Décaissement fournisseur',$5,$6)",
    [supplierMovementId, ids.org, accountId, period, supplierPaymentId, supplierInvoice.id],
  );
  await db.query(
    "insert into treasury_transactions(id,organization_id,treasury_account_id,transaction_type,direction,amount,currency,transaction_date,label,customer_invoice_id) values($1,$2,$3,'other','in',5,'MAD',$4::date,'Mouvement hors fichier',$5)",
    [extraMovementId, ids.org, accountId, period, invoiceId],
  );
  await as(ids.admin);
  const invoicePayload = JSON.stringify([{ id: invoiceId, organization_id: ids.org, customer_id: customer, invoice_number: "FAC-BUNDLE", invoice_date: period, status: "validated", currency: "MAD", total_ttc: 12 }]);
  const invoiceLines = JSON.stringify([{ id: invoiceLineId, organization_id: ids.org, invoice_id: invoiceId, description: "Ligne groupée", quantity: 1, unit_price_ht: 10, discount_rate: 0, tax_rate: 20 }]);
  await rejected(
    () => db.query("select public.restore_organization_backup_bundle($1,'replace','customer_invoices',$2::jsonb,'customer_invoice_lines','invoice_id',$3::jsonb,'{}'::uuid[])", [ids.org, invoicePayload, invoiceLines]),
    /RESTORE_CONFIRMATION/,
    "replace without the typed confirmation is refused",
  );
  await rejected(
    () => db.query("select public.restore_organization_backup_bundle($1,'purge','treasury_transactions','[]'::jsonb,null,null,'[]'::jsonb,$2::uuid[],'oui','Autre nom')", [ids.org, [movementId]]),
    /RESTORE_CONFIRMATION/,
    "purge with the wrong company name is refused",
  );
  equal((await one("select customer_invoice_id from treasury_transactions where id=$1", [movementId])).customer_invoice_id, invoiceId, "a refused replace keeps the treasury link");
  equal(Number((await one("select count(*)::int n from customer_credit_note_applications where id=$1", [applicationId])).n), 1, "a refused replace keeps the credit application");
  await one(
    "select public.restore_organization_backup_bundle($1,'replace','customer_invoices',$2::jsonb,'customer_invoice_lines','invoice_id',$3::jsonb,'{}'::uuid[],'oui','Atelier Démo') as result",
    [ids.org, invoicePayload, invoiceLines],
  );
  await one(
    "select public.restore_organization_backup_bundle($1,'replace','customer_credit_notes',$2::jsonb,'customer_credit_note_lines','credit_note_id',$3::jsonb,'{}'::uuid[],'oui','Atelier Démo')",
    [ids.org, JSON.stringify([{ id: noteId, organization_id: ids.org, customer_id: customer, credit_note_number: "AV-BUNDLE", credit_note_date: period, status: "draft", currency: "MAD", source_invoice_id: invoiceId, subtotal_ht: 10, discount_total: 0, tax_total: 2, total_ttc: 12 }]), JSON.stringify([{ id: "30000000-0000-4000-8000-000000000031", organization_id: ids.org, credit_note_id: noteId, source_invoice_line_id: invoiceLineId, description: "Avoir", quantity: 1, unit_price_ht: 10, discount_rate: 0, tax_rate: 20 }])],
  );
  await one(
    "select public.restore_organization_backup_bundle($1,'replace','customer_payments',$2::jsonb,'customer_payment_allocations','payment_id',$3::jsonb,'{}'::uuid[],'oui','Atelier Démo')",
    [ids.org, JSON.stringify([{ id: paymentId, organization_id: ids.org, customer_id: customer, third_party_id: customer, payment_number: "REG-BUNDLE", payment_date: period, amount: 12, currency: "MAD", status: "confirmed" }]), JSON.stringify([{ id: "30000000-0000-4000-8000-000000000041", organization_id: ids.org, payment_id: paymentId, invoice_id: invoiceId, customer_id: customer, third_party_id: customer, amount: 12 }])],
  );
  await one(
    "select public.restore_organization_backup_bundle($1,'replace','supplier_payments',$2::jsonb,'supplier_payment_allocations','payment_id','[]'::jsonb,'{}'::uuid[],'oui','Atelier Démo')",
    [ids.org, JSON.stringify([{ id: supplierPaymentId, organization_id: ids.org, payment_number: "RFO-BUNDLE", supplier_id: supplier, payment_date: period, amount: 12, currency: "MAD", status: "confirmed" }])],
  );
  await one(
    "select public.restore_organization_backup_batch($1,'merge','customer_credit_note_applications',$2::jsonb,'{}'::uuid[])",
    [ids.org, JSON.stringify([{ id: applicationId, organization_id: ids.org, credit_note_id: noteId, invoice_id: invoiceId, customer_id: customer, amount: 12 }])],
  );
  await one(
    "select public.restore_organization_backup_batch($1,'merge','treasury_transactions',$2::jsonb,'{}'::uuid[])",
    [ids.org, JSON.stringify([
      { id: movementId, organization_id: ids.org, treasury_account_id: accountId, transaction_type: "customer_payment", direction: "in", amount: 12, currency: "MAD", transaction_date: period, label: "Encaissement client", customer_payment_id: paymentId, customer_invoice_id: invoiceId, supplier_payment_id: null, supplier_invoice_id: null },
      { id: supplierMovementId, organization_id: ids.org, treasury_account_id: accountId, transaction_type: "supplier_payment", direction: "out", amount: 12, currency: "MAD", transaction_date: period, label: "Décaissement fournisseur", customer_payment_id: null, customer_invoice_id: null, supplier_payment_id: supplierPaymentId, supplier_invoice_id: supplierInvoice.id },
    ])],
  );
  await one(
    "select public.restore_organization_backup_bundle($1,'purge','treasury_transactions','[]'::jsonb,null,null,'[]'::jsonb,$2::uuid[],'oui','Atelier Démo')",
    [ids.org, [movementId, supplierMovementId]],
  );
  const restored = await one(
    `select
      (select count(*)::int from customer_invoices where id=$1) as invoices,
      (select count(*)::int from customer_invoice_lines where invoice_id=$1) as invoice_lines,
      (select source_invoice_id from customer_credit_notes where id=$2) as credit_source,
      (select source_invoice_line_id from customer_credit_note_lines where credit_note_id=$2) as credit_line_source,
      (select count(*)::int from customer_credit_note_applications where id=$3 and invoice_id=$1) as applications,
      (select count(*)::int from customer_payment_allocations where payment_id=$4 and invoice_id=$1) as allocations,
      (select customer_invoice_id from treasury_transactions where id=$5) as treasury_invoice,
      (select customer_payment_id from treasury_transactions where id=$5) as treasury_payment,
      (select supplier_payment_id from treasury_transactions where id=$6) as treasury_supplier_payment,
      (select count(*)::int from treasury_transactions where id=$7) as extra_movements`,
    [invoiceId, noteId, applicationId, paymentId, movementId, supplierMovementId, extraMovementId],
  );
  equal(Number(restored.invoices), 1, "replace keeps the customer invoice");
  equal(Number(restored.invoice_lines), 1, "replace keeps the customer invoice line");
  equal(restored.credit_source, invoiceId, "replace keeps the credit note linked to the invoice");
  equal(restored.credit_line_source, invoiceLineId, "replace keeps the credit line linked to the invoice line");
  equal(Number(restored.applications), 1, "replace keeps the credit application");
  equal(Number(restored.allocations), 1, "replace keeps the payment allocation");
  equal(restored.treasury_invoice, invoiceId, "replace keeps the treasury movement linked to the invoice");
  equal(restored.treasury_payment, paymentId, "replace keeps the treasury movement linked to the customer payment");
  equal(restored.treasury_supplier_payment, supplierPaymentId, "replace keeps the treasury movement linked to the supplier payment");
  equal(Number(restored.extra_movements), 0, "replace removes a treasury movement that is not in the file");

  phaseBox.phase = "external references";
  await db.exec("reset role");
  const outsideParty = "30000000-0000-4000-8000-000000000090";
  const linkedProduct = "30000000-0000-4000-8000-000000000091";
  const loneProduct = "30000000-0000-4000-8000-000000000092";
  const warehouseId = "30000000-0000-4000-8000-000000000093";
  const salesDocumentId = "30000000-0000-4000-8000-000000000094";
  const salesLineId = "30000000-0000-4000-8000-000000000095";
  const stockMoveId = "30000000-0000-4000-8000-000000000096";
  const reminderId = "30000000-0000-4000-8000-000000000097";
  await db.query("insert into third_parties(id,organization_id,code,primary_type,types,name) values($1,$2,'CU-HORS','customer',array['customer'],'Client hors fichier')", [outsideParty, ids.org]);
  await db.query("insert into products(id,organization_id,type,name,sku) values($1,$2,'product','Article lié','SKU-LIE'),($3,$2,'product','Article seul','SKU-SEUL')", [linkedProduct, ids.org, loneProduct]);
  await db.query("insert into warehouses(id,organization_id,name,code) values($1,$2,'Dépôt QA','DEP-QA')", [warehouseId, ids.org]);
  await db.query("insert into sales_documents(id,organization_id,document_type,document_number,customer_id,document_date,status) values($1,$2,'quote','DEV-HORS',$3,$4::date,'draft')", [salesDocumentId, ids.org, outsideParty, period]);
  await db.query("insert into sales_document_lines(id,organization_id,document_id,description,quantity,unit_price_ht,product_id) values($1,$2,$3,'Ligne hors fichier',1,10,$4)", [salesLineId, ids.org, salesDocumentId, linkedProduct]);
  await db.query("insert into stock_moves(id,organization_id,warehouse_id,product_id,move_type,quantity) values($1,$2,$3,$4,'in',1)", [stockMoveId, ids.org, warehouseId, linkedProduct]);
  const beforeOutside = await one(
    `select
      (select count(*)::int from sales_documents where id=$1) as documents,
      (select count(*)::int from sales_document_lines where id=$2) as lines,
      (select count(*)::int from stock_moves where id=$3) as moves,
      (select count(*)::int from products where id=$4) as products,
      (select count(*)::int from third_parties where id=$5) as parties`,
    [salesDocumentId, salesLineId, stockMoveId, linkedProduct, outsideParty],
  );
  await as(ids.admin);
  await rejected(
    () => db.query("select public.restore_organization_backup_bundle($1,'rehearse','products','[]'::jsonb,null,null,'[]'::jsonb,$2::uuid[])", [ids.org, [loneProduct]]),
    /RESTORE_BLOCKED/,
    "the dry run refuses to remove a product that still has a sales line and a stock move",
  );
  await rejected(
    () => db.query("select public.restore_organization_backup_bundle($1,'purge','products','[]'::jsonb,null,null,'[]'::jsonb,$2::uuid[],'oui','Atelier Démo')", [ids.org, [loneProduct]]),
    /RESTORE_BLOCKED/,
    "replace refuses to remove a product referenced outside the backup",
  );
  await rejected(
    () => db.query("select public.restore_organization_backup_bundle($1,'rehearse','third_parties','[]'::jsonb,null,null,'[]'::jsonb,$2::uuid[])", [ids.org, [customer, supplier]]),
    /RESTORE_BLOCKED/,
    "the dry run refuses to remove a third party that still has a sales document",
  );
  await rejected(
    () => db.query("select public.restore_organization_backup_bundle($1,'purge','third_parties','[]'::jsonb,null,null,'[]'::jsonb,$2::uuid[],'oui','Atelier Démo')", [ids.org, [customer, supplier]]),
    /RESTORE_BLOCKED/,
    "replace refuses to remove a third party referenced outside the backup",
  );
  const afterOutside = await one(
    `select
      (select count(*)::int from sales_documents where id=$1) as documents,
      (select count(*)::int from sales_document_lines where id=$2) as lines,
      (select count(*)::int from stock_moves where id=$3) as moves,
      (select count(*)::int from products where id=$4) as products,
      (select count(*)::int from third_parties where id=$5) as parties`,
    [salesDocumentId, salesLineId, stockMoveId, linkedProduct, outsideParty],
  );
  equal(afterOutside, beforeOutside, "a refused replace deletes no sales document, line, stock move, product or third party");
  await one(
    "select public.restore_organization_backup_bundle($1,'purge','products','[]'::jsonb,null,null,'[]'::jsonb,$2::uuid[],'oui','Atelier Démo')",
    [ids.org, [linkedProduct]],
  );
  equal(Number((await one("select count(*)::int n from products where id=$1", [loneProduct])).n), 0, "replace still removes a product that nothing outside the backup references");
  equal(Number((await one("select count(*)::int n from products where id=$1", [linkedProduct])).n), 1, "the product referenced by the sales line stays");
  equal(Number((await one("select count(*)::int n from stock_moves where id=$1", [stockMoveId])).n), 1, "the stock move stays with its product");
  await db.exec("reset role");
  await db.query("insert into customer_reminders(id,organization_id,reminder_number,customer_id) values($1,$2,'REL-HORS',$3)", [reminderId, ids.org, customer]);
  await db.query("insert into customer_reminder_invoices(organization_id,reminder_id,invoice_id) values($1,$2,$3)", [ids.org, reminderId, invoiceId]);
  await as(ids.admin);
  await rejected(
    () => db.query("select public.restore_organization_backup_bundle($1,'rehearse','customer_invoices',$2::jsonb,'customer_invoice_lines','invoice_id',$3::jsonb,'{}'::uuid[])", [ids.org, invoicePayload, invoiceLines]),
    /RESTORE_BLOCKED/,
    "the dry run refuses to replace an invoice that still has a reminder",
  );
  await rejected(
    () => db.query("select public.restore_organization_backup_bundle($1,'replace','customer_invoices',$2::jsonb,'customer_invoice_lines','invoice_id',$3::jsonb,'{}'::uuid[],'oui','Atelier Démo')", [ids.org, invoicePayload, invoiceLines]),
    /RESTORE_BLOCKED/,
    "replace refuses to remove an invoice referenced by a reminder",
  );
  equal(Number((await one("select count(*)::int n from customer_reminder_invoices where reminder_id=$1 and invoice_id=$2", [reminderId, invoiceId])).n), 1, "the reminder line is kept");
  equal(Number((await one("select count(*)::int n from customer_invoices where id=$1", [invoiceId])).n), 1, "the invoice referenced by the reminder is kept");
  let externalMessage = "";
  await db.query("savepoint external_detail");
  try {
    await db.query("select public.restore_organization_backup_bundle($1,'rehearse','products','[]'::jsonb,null,null,'[]'::jsonb,$2::uuid[])", [ids.org, [loneProduct]]);
  } catch (error) {
    externalMessage = error.message ?? "";
    await db.query("rollback to savepoint external_detail");
  }
  equal(/Ventes/.test(externalMessage) && /Stock/.test(externalMessage), true, "the dry run names the Ventes and Stock modules");
  const paddedProduct = "30000000-0000-4000-8000-000000000098";
  await db.exec("reset role");
  await db.query("insert into products(id,organization_id,type,name,sku) values($1,$2,'product','Article libre','SKU-LIBRE')", [paddedProduct, ids.org]);
  await as(ids.admin);
  await one("select public.restore_organization_backup_bundle($1,'purge','products','[]'::jsonb,null,null,'[]'::jsonb,$2::uuid[],'oui','  Atelier   Démo ')", [ids.org, [linkedProduct]]);
  equal(Number((await one("select count(*)::int n from products where id=$1", [paddedProduct])).n), 0, "a padded company name matches after the same normalization");
  const lateId = "30000000-0000-4000-8000-000000000099";
  await one(
    "select public.restore_organization_backup_bundle($1,'merge','customer_invoices',$2::jsonb,'customer_invoice_lines','invoice_id',$3::jsonb,'{}'::uuid[])",
    [ids.org, JSON.stringify([{ id: lateId, organization_id: ids.org, customer_id: customer, invoice_number: "FAC-RETARD", invoice_date: "2020-01-01", due_date: "2020-01-15", status: "validated", currency: "MAD", total_ttc: 12, paid_amount: 0, credit_amount: 0 }]), JSON.stringify([{ id: "30000000-0000-4000-8000-00000000009a", organization_id: ids.org, invoice_id: lateId, description: "Retard", quantity: 1, unit_price_ht: 10, discount_rate: 0, tax_rate: 20 }])],
  );
  equal((await one("select status from customer_invoices where id=$1", [lateId])).status, "overdue", "a restored unpaid invoice past its due date becomes overdue");
  equal(Number((await one("select count(*)::int n from organization_restore_audit where record_id=$1 and document_status='validated'", [invoiceId])).n) > 0, true, "restoring a validated invoice is written to the audit log");
  await db.exec("reset role");
  const cashAccount = "30000000-0000-4000-8000-00000000009b";
  const bankOnly = "30000000-0000-4000-8000-00000000009c";
  await db.query("insert into treasury_accounts(id,organization_id,name,account_type,currency,current_balance,opening_balance) values($1,$2,'Caisse QA','cash','MAD',10,10),($3,$2,'Banque vide','bank','MAD',0,0)", [cashAccount, ids.org, bankOnly]);
  await as(ids.admin);
  await rejected(
    () => db.query("insert into treasury_transactions(organization_id,treasury_account_id,transaction_type,direction,amount,currency,label) values($1,$2,'manual_out','out',20,'MAD','Trop')", [ids.org, cashAccount]),
    /CASH_NEGATIVE_BALANCE/,
    "a cash outflow that would go negative is refused",
  );
  equal(Number((await one("select current_balance from treasury_accounts where id=$1", [cashAccount])).current_balance), 10, "the refused cash outflow leaves the balance unchanged");
  await db.query("insert into treasury_transactions(organization_id,treasury_account_id,transaction_type,direction,amount,currency,label) values($1,$2,'manual_out','out',100,'MAD','Banque')", [ids.org, bankOnly]);
  equal(Number((await one("select count(*)::int n from treasury_transactions where treasury_account_id=$1", [bankOnly])).n), 1, "a bank account can still record an outflow");
  await db.exec("reset role");
  const quotaOrg = "10000000-0000-4000-8000-000000000099";
  await db.query("insert into organizations(id,name,slug) values($1::uuid,'Quota Démo',$1::text)", [quotaOrg]);
  await db.query("insert into commercial_document_usage(organization_id,document_table,document_id,created_at,document_on) select $1,'customer_invoices',gen_random_uuid(),timestamptz '2020-01-10',date '2020-01-10' from generate_series(1,500)", [quotaOrg]);
  const quotaRole = await one("insert into roles(organization_id,name) values($1,'admin') returning id", [quotaOrg]);
  await db.query("insert into organization_members(organization_id,user_id,role_id,status) values($1,$2,$3,'active')", [quotaOrg, ids.admin, quotaRole.id]);
  await db.query("select set_config('request.jwt.claim.sub','',true)");
  const quotaCustomer = (await one("insert into third_parties(organization_id,code,primary_type,types,name) values($1,'CU-QUOTA','customer',array['customer'],'Client quota') returning id", [quotaOrg])).id;
  await as(ids.admin);
  await rejected(
    () => db.query("insert into customer_invoices(organization_id,customer_id,invoice_number,invoice_date,status,currency) values($1,$2,'','2020-01-20','draft','MAD')", [quotaOrg, quotaCustomer]),
    /COMMERCIAL_DOCUMENT_LIMIT_REACHED/,
    "a backdated invoice is also counted in its issue month",
  );
  await db.query("insert into customer_invoices(organization_id,customer_id,invoice_number,invoice_date,status,currency) values($1,$2,'',$3::date,'draft','MAD')", [quotaOrg, quotaCustomer, period]);
  equal(Number((await one("select count(*)::int n from customer_invoices where organization_id=$1", [quotaOrg])).n), 1, "the same organization can still create a document in an open month");
  await db.exec("reset role");
  const oldOrg = "10000000-0000-4000-8000-000000000098";
  const newOrg = "10000000-0000-4000-8000-000000000097";
  await db.query("insert into organizations(id,name,slug) values($1::uuid,'Ancienne',$1::text),($2::uuid,'Nouvelle',$2::text)", [oldOrg, newOrg]);
  await db.query("insert into accounting_settings(organization_id,auto_post_on_validation) values($1,false)", [oldOrg]);
  await db.query("insert into accounting_settings(organization_id) values($1)", [newOrg]);
  equal((await one("select auto_post_on_validation from accounting_settings where organization_id=$1", [oldOrg])).auto_post_on_validation, false, "an existing organization keeps automatic posting disabled");
  equal((await one("select auto_post_on_validation from accounting_settings where organization_id=$1", [newOrg])).auto_post_on_validation, true, "a new organization gets automatic posting");

  await db.exec("commit");
  await writeFile(proofOutput, JSON.stringify({
    passed: true,
    date: new Date().toISOString(),
    checks: globalThis.__felexia.checks,
    results: globalThis.__felexia.results,
    migration: "151_restore_fk_order.sql",
    maxBatchMs: Math.round(maxBatchMs),
    bulkTotal,
    engine: "PostgreSQL via PGlite",
    productionRead: false,
    productionWrite: false,
  }, null, 2) + "\n");
  console.log(JSON.stringify({ passed: true, checks: globalThis.__felexia.checks, results: globalThis.__felexia.results }));
} catch (error) {
  console.error(JSON.stringify({ passed: false, phase: phaseBox.phase, message: error.message, code: error.code, detail: error.detail, where: error.where }));
  process.exitCode = 1;
} finally {
  await db.close();
  await rm(folder, { recursive: true, force: true });
}
