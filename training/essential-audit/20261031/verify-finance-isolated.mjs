// Audit-only reproduction. Disposable in-memory PostgreSQL, synthetic fixtures.
// No project environment, credentials, remote connections or production data.
// node training/essential-audit/20261031/verify-finance-isolated.mjs --pglite-root=<temporary test package folder>
import { readFile, writeFile, mkdtemp, rm, rmdir } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import { join } from "node:path";
import { tmpdir } from "node:os";

if (!process.argv.some((arg) => arg.startsWith("--pglite-root=")) || process.argv.some((arg) => arg.startsWith("--postgres-url="))) {
  throw new Error("Use the explicit temporary PGlite package folder; remote/native databases are not used by this audit.");
}
const root = fileURLToPath(new URL("../../../", import.meta.url));
const output = fileURLToPath(new URL("finance-isolated.json", import.meta.url));
const baseline = await readFile(join(root, "scripts/verify-numbering-counters.mjs"), "utf8");
const marker = "\ntry {\n  await bootstrap();";
if (!baseline.includes(marker)) throw new Error("The synthetic test bootstrap changed; review before reproducing.");
let source = baseline.slice(0, baseline.indexOf(marker));
source = source.replace(
  "new URL(`../supabase/migrations/${file}`, import.meta.url)",
  "new URL(file, " + JSON.stringify(pathToFileURL(join(root, "supabase/migrations/")).href) + ")",
);
source += `\nconst auditOutput = ${JSON.stringify(output)};\n`;
source += String.raw`
const auditEvidence = {};
try {
  await bootstrap();
  await db.exec("begin");
  await seedLegacyFixtures();
  await db.exec("reset role");
  const migration = await sql("097_document_numbering_controls.sql");
  await db.exec(migration.replace(/^\s*begin;\s*$/gim, "").replace(/^\s*commit;\s*$/gim, ""));
  await as(ids.admin);

  // The normal invoice update action always includes invoice_number:"".
  const invoice = await issue("customer_invoice");
  await db.exec("savepoint admin_edit");
  const edited = await one("update customer_invoices set invoice_number='' where id=$1 returning invoice_number", [invoice.id]);
  equal(edited.invoice_number, "", "Administrator draft update accepts the blank reference sent by the action");
  auditEvidence.invoiceEdit = { originalNumberPresent: Boolean(invoice.document_number), administratorResult: edited.invoice_number };
  await db.exec("rollback to savepoint admin_edit; release savepoint admin_edit");
  await as(ids.operator);
  await rejected(() => db.query("update customer_invoices set invoice_number='' where id=$1", [invoice.id]), /OPERATOR_NUMBERING_READ_ONLY/, "Operator draft update rejects the same action payload");
  auditEvidence.invoiceEdit.operatorError = "OPERATOR_NUMBERING_READ_ONLY";

  // The UI accepts any treasury currency; the actual atomic payment RPC forces MAD.
  await as(ids.admin);
  const account = await one("insert into treasury_accounts(organization_id,name,currency,current_balance) values($1,'Synthetic EUR bank','EUR',0) returning id", [ids.org]);
  const payment = await one("select * from create_customer_payment_atomic($1,$2,$3,100,$4::date,gen_random_uuid())", [ids.org, fixtures.parties.get(ids.org + ":customer"), account.id, period]);
  const mismatch = await one("select p.currency as payment_currency,a.currency as account_currency,a.current_balance,t.currency as transaction_currency from customer_payments p join treasury_accounts a on a.id=p.treasury_account_id join treasury_transactions t on t.customer_payment_id=p.id where p.id=$1", [payment.payment_id]);
  equal(mismatch.payment_currency, "MAD", "Customer payment is hardcoded to MAD");
  equal(mismatch.account_currency, "EUR", "The MAD payment is accepted into a EUR account");
  equal(Number(mismatch.current_balance), 100, "EUR account balance increases by the raw MAD amount without exchange");
  auditEvidence.currencyMismatch = mismatch;

  // Reproduce the posted-payment guard using the minimal explicit accounting
  // schema from the existing numbering fixture; historical accounting DDL is
  // absent in this repository. The actual 095 guard and cancellation RPC run.
  const journalId = [...fixtures.journals.keys()][0];
  await one("insert into accounting_entries(organization_id,journal_id,entry_number,entry_date,status,source_document_type,source_document_id) values($1,$2,null,$3::date,'posted','customer_payment',$4) returning id", [ids.org, journalId, period, payment.payment_id]);
  await one("select * from cancel_customer_payment_atomic($1,$2)", [ids.org, payment.payment_id]);
  const cancelled = await one("select p.status as payment_status,e.status as entry_status,a.current_balance from customer_payments p join accounting_entries e on e.source_document_id=p.id join treasury_accounts a on a.id=p.treasury_account_id where p.id=$1", [payment.payment_id]);
  equal(cancelled.payment_status, "cancelled", "Administrator cancellation succeeds for a posted customer payment");
  equal(cancelled.entry_status, "posted", "Linked accounting entry remains posted after cancellation");
  equal(Number(cancelled.current_balance), 0, "Treasury balance is reversed without a linked journal reversal");
  auditEvidence.postedCancellation = cancelled;

  // Active RLS prevents reading the foreign relation, but simple foreign keys
  // do not stop linking it from a document belonging to the current company.
  const foreignCustomer = fixtures.parties.get(ids.foreign + ":customer");
  equal((await db.query("select id from third_parties where id=$1", [foreignCustomer])).rows.length, 0, "Administrator cannot read another company's customer");
  const crossInvoice = await one("insert into customer_invoices(organization_id,customer_id,invoice_number) values($1,$2,'') returning organization_id,customer_id", [ids.org, foreignCustomer]);
  equal(crossInvoice.organization_id, ids.org, "Cross-company customer invoice remains visible in the current company");
  equal(crossInvoice.customer_id, foreignCustomer, "Customer invoice accepts a known foreign-company customer UUID");
  const foreignSupplier = fixtures.parties.get(ids.foreign + ":supplier");
  const crossPurchase = await one("insert into supplier_invoices(organization_id,supplier_id,invoice_number) values($1,$2,'') returning organization_id,supplier_id", [ids.org, foreignSupplier]);
  equal(crossPurchase.supplier_id, foreignSupplier, "Supplier invoice accepts a known foreign-company supplier UUID at the database boundary");
  auditEvidence.crossTenantReferences = { foreignCustomerReadDenied: true, customerDocumentCrossReferenceAccepted: true, supplierDocumentCrossReferenceAccepted: true, foreignDataDisclosureTested: false };

  await db.exec("rollback; reset role");
  equal(Number((await one("select count(*) as count from organizations where id=$1", [ids.org])).count), 0, "All synthetic fixtures are rolled back");
  const report = {
    passed: true, date: new Date().toISOString(), syntheticOnly: true,
    scope: "Disposable in-memory PostgreSQL; no production configuration or data",
    postgresVersion: (await one("show server_version")).server_version,
    checks, results, evidence: auditEvidence, fixtureRollbackVerified: true,
    limitations: ["These are reproductions of reported gaps, not assertions that the application is healthy.", "No production document was created, updated or cancelled.", "Historical accounting table creation DDL is missing in the repository; the explicit minimal schema from the numbering suite is used for the posted-payment guard.", "Cross-tenant reference acceptance does not prove disclosure of another company's private fields."],
  };
  await writeFile(auditOutput, JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify({ passed: true, syntheticOnly: true, checks, results, fixtureRollbackVerified: true }));
} catch (error) {
  console.error(JSON.stringify({ passed: false, phase, checks, message: error.message, code: error.code }));
  process.exitCode = 1;
} finally { await db.close(); }
`;

const folder = await mkdtemp(join(tmpdir(), "felexia-finance-audit-"));
const runtime = join(folder, "reproduce.mjs");
try {
  await writeFile(runtime, source);
  await import(pathToFileURL(runtime).href);
} finally {
  // This path is created directly by mkdtemp inside the system temp directory.
  await rm(runtime, { force: true });
  await rmdir(folder);
}
