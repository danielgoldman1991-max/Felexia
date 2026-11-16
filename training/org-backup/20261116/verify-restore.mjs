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
      add column if not exists credit numeric, add column if not exists label text;
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
  const installed = await one("select restauration_147_active from (select has_function_privilege('anon', 'public.restore_organization_backup(uuid,text,jsonb)', 'execute') = false and has_table_privilege('anon', 'app_private.organization_restore_scope', 'insert') = false as restauration_147_active) probe");
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

  await db.exec("commit");
  await writeFile(proofOutput, JSON.stringify({
    passed: true,
    date: new Date().toISOString(),
    checks: globalThis.__felexia.checks,
    results: globalThis.__felexia.results,
    migration: "147_org_backup_restore_fix.sql",
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
