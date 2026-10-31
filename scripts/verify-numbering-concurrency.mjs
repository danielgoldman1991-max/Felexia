// Native PostgreSQL only: two independent authenticated sessions and an observer.
// Requires a dedicated local database bootstrapped by verify-numbering-counters.
// No .env, project credentials, browser state or production database is read.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const option = (key) => process.argv.find((arg) => arg.startsWith(`--${key}=`))?.slice(key.length + 3);
const connectionString = option("postgres-url");
const target = new URL(connectionString);
if (!(["127.0.0.1", "localhost"].includes(target.hostname) && /^\/numbering_qa_[a-z0-9_]+$/i.test(target.pathname) && target.username === "postgres" && !target.password)) throw new Error("A dedicated local trust-auth numbering_qa_ database is required");
const require = createRequire(resolve(option("pg-root") ?? ".", "package.json"));
const { Client } = require("pg");
const clients = Array.from({ length: 3 }, (_, index) => new Client({ connectionString, application_name: `felexia-numbering-qa-${index}` }));
const [observer, first, second] = clients;
const id = {
  org: "30000000-0000-4000-8000-000000000091", foreign: "30000000-0000-4000-8000-000000000092",
  adminA: "30000000-0000-4000-8000-000000000093", adminB: "30000000-0000-4000-8000-000000000094",
  customer: "30000000-0000-4000-8000-000000000095", supplier: "30000000-0000-4000-8000-000000000096",
  foreignCustomer: "30000000-0000-4000-8000-000000000097",
};
let checks = 0;
const results = [];
let seeded = false;
const equal = (actual, expected, name) => { assert.deepEqual(actual, expected, name); checks++; results.push(name); };
const one = async (client, text, values = []) => (await client.query(text, values)).rows[0];
const settle = (promise) => promise.then((value) => ({ value }), (error) => ({ error }));
let period;
let secondPid;
async function begin(client, user) {
  await client.query("begin");
  await client.query("select set_config('request.jwt.claim.sub',$1,true)", [user]);
  await client.query("set local role authenticated");
}
async function authenticated(client, user, operation) {
  await begin(client, user);
  try { const result = await operation(); await client.query("commit"); return result; }
  catch (error) { await client.query("rollback"); throw error; }
}
async function list(client, org = id.org) {
  return (await one(client, "select get_numbering_counters($1,$2::date) as rows", [org, period])).rows;
}
async function invoiceCounter(client, org = id.org) {
  return (await list(client, org)).find((row) => row.counter_key === "customer_invoice");
}
async function invoice(client, org = id.org) {
  return one(client, "insert into customer_invoices(organization_id,customer_id,invoice_number,invoice_date) values($1,$2,'',$3::date) returning id,invoice_number", [org, org === id.org ? id.customer : id.foreignCustomer, period]);
}
async function correction(client, next, revision, reason) {
  return one(client, "select correct_numbering_counter($1,'customer_invoice',$2::date,$3::integer,$4,$5) as row", [id.org, period, next, revision, reason]);
}
async function assertSecondIsBlocked(name) {
  let lock;
  for (let attempt = 0; attempt < 50; attempt++) {
    lock = await one(observer, "select wait_event_type,wait_event from pg_stat_activity where pid=$1", [secondPid]);
    if (lock?.wait_event_type === "Lock") break;
    await new Promise((done) => setTimeout(done, 20));
  }
  equal(lock?.wait_event_type, "Lock", name);
}
async function setup() {
  equal(Number((await one(observer, "select count(*) as count from organizations")).count), 0, "dedicated QA database contains no business organisations before the test");
  assert.ok((await one(observer, "select to_regprocedure('public.get_numbering_counters(uuid,date)') is not null as ready")).ready, "Run the native functional numbering suite first");
  await observer.query("begin");
  try {
    for (const org of [id.org, id.foreign]) await observer.query("insert into organizations(id,name,slug) values($1::uuid,'Synthetic concurrency QA',$1::text)", [org]);
    for (const user of [id.adminA, id.adminB]) {
      await observer.query("insert into auth.users(id,email,email_confirmed_at) values($1,'synthetic-concurrency@example.test',now())", [user]);
      await observer.query("insert into profiles(id,email) values($1,'synthetic-concurrency@example.test')", [user]);
    }
    for (const org of [id.org, id.foreign]) {
      const role = await one(observer, "insert into roles(organization_id,name) values($1,'admin') returning id", [org]);
      for (const user of org === id.org ? [id.adminA, id.adminB] : [id.adminB]) await observer.query("insert into organization_members(organization_id,user_id,role_id,status) values($1,$2,$3,'active')", [org, user, role.id]);
    }
    for (const [party, org, type] of [[id.customer, id.org, "customer"], [id.supplier, id.org, "supplier"], [id.foreignCustomer, id.foreign, "customer"]]) {
      await observer.query("insert into third_parties(id,organization_id,code,primary_type,types,name) values($1,$2,$3,$4,array[$4::text],'Synthetic concurrency contact')", [party, org, `QA-${party}`, type]);
    }
    await observer.query("commit"); seeded = true;
  } catch (error) { await observer.query("rollback"); throw error; }
  period = (await one(observer, "select timezone('Africa/Casablanca',now())::date::text as value")).value;
  secondPid = Number((await one(second, "select pg_backend_pid() as pid")).pid);
}
async function cleanup() {
  await Promise.all(clients.map((client) => client.query("rollback").catch(() => {})));
  if (!seeded) return;
  await observer.query("begin");
  try {
    // Delete only our documents first so their audit/number reservations remain
    // available to the DELETE triggers until the synthetic tenant is removed.
    for (const table of ["customer_invoices", "supplier_invoices", "third_parties"]) await observer.query(`delete from ${table} where organization_id=any($1::uuid[])`, [[id.org, id.foreign]]);
    await observer.query("delete from organizations where id=any($1::uuid[])", [[id.org, id.foreign]]);
    await observer.query("delete from profiles where id=any($1::uuid[])", [[id.adminA, id.adminB]]);
    await observer.query("delete from auth.users where id=any($1::uuid[])", [[id.adminA, id.adminB]]);
    await observer.query("commit");
    equal(Number((await one(observer, "select count(*) as count from organizations")).count), 0, "synthetic concurrency organisations and their counters are removed");
  } catch (error) { await observer.query("rollback"); throw error; }
}

try {
  await Promise.all(clients.map((client) => client.connect()));
  await setup();
  // Both requests begin when no sequence row exists. The second session must
  // wait for the first transaction and then consume the following number.
  await begin(first, id.adminA);
  const firstInvoice = await invoice(first);
  await begin(second, id.adminB);
  const secondPending = settle(invoice(second));
  await assertSecondIsBlocked("concurrent first-use allocation waits on the real database lock");
  await first.query("commit");
  const secondResult = await secondPending;
  assert.ifError(secondResult.error); await second.query("commit");
  equal(Number(firstInvoice.invoice_number.split("-").at(-1)), 1, "first concurrent allocation receives serial one");
  equal(Number(secondResult.value.invoice_number.split("-").at(-1)), 2, "second concurrent allocation receives serial two");
  equal(Number((await one(observer, "select count(*) as count from numbering_sequences where organization_id=$1 and document_type like 'CUSTOMER_INVOICE_%'", [id.org])).count), 1, "concurrent first-use creates exactly one sequence row");

  const beforeCreation = await authenticated(second, id.adminB, () => invoiceCounter(second));
  await begin(first, id.adminA);
  await invoice(first);
  await begin(second, id.adminB);
  const staleCorrection = settle(correction(second, 50, beforeCreation.revision, "QA stale correction racing creation"));
  await assertSecondIsBlocked("correction waits for an in-flight document allocation");
  await first.query("commit");
  const staleResult = await staleCorrection;
  equal(staleResult.error?.message, "NUMBERING_CONFLICT", "a creation invalidates the stale correction after lock release");
  await second.query("rollback");
  equal(Number((await authenticated(second, id.adminB, () => invoiceCounter(second))).next_number), 4, "the rejected correction does not overwrite the consumed counter");

  const sharedPreview = await authenticated(second, id.adminB, () => invoiceCounter(second));
  await begin(first, id.adminA);
  await correction(first, 50, sharedPreview.revision, "QA first concurrent correction");
  await begin(second, id.adminB);
  const competingCorrection = settle(correction(second, 60, sharedPreview.revision, "QA second concurrent correction"));
  await assertSecondIsBlocked("two administrators correcting the same preview serialize on the database lock");
  await first.query("commit");
  const competingResult = await competingCorrection;
  equal(competingResult.error?.message, "NUMBERING_CONFLICT", "only one of two corrections with the same revision commits");
  await second.query("rollback");
  equal(Number((await one(observer, "select count(*) as count from numbering_counter_changes where organization_id=$1", [id.org])).count), 1, "only the successful correction creates an audit row");

  const beforeRollback = await authenticated(second, id.adminB, () => invoiceCounter(second));
  await begin(first, id.adminA);
  await correction(first, 60, beforeRollback.revision, "QA rolled-back correction");
  await begin(second, id.adminB);
  const followingRollback = settle(invoice(second));
  await assertSecondIsBlocked("a new document waits for a pending correction transaction");
  await first.query("rollback");
  const rollbackResult = await followingRollback;
  assert.ifError(rollbackResult.error); await second.query("commit");
  equal(Number(rollbackResult.value.invoice_number.split("-").at(-1)), 50, "rolled-back correction changes neither allocation nor numbering state");
  equal(Number((await one(observer, "select count(*) as count from numbering_counter_changes where organization_id=$1", [id.org])).count), 1, "rolled-back correction leaves no audit row");

  await begin(first, id.adminA);
  const aborted = await invoice(first);
  await begin(second, id.adminB);
  const followingAbortedInsert = settle(invoice(second));
  await assertSecondIsBlocked("a second allocation waits for an uncommitted document insert");
  await first.query("rollback");
  const resumed = await followingAbortedInsert;
  assert.ifError(resumed.error); await second.query("commit");
  equal(resumed.value.invoice_number, aborted.invoice_number, "an aborted insert does not burn or duplicate a committed document number");

  await begin(first, id.adminA);
  await invoice(first);
  const independent = await authenticated(second, id.adminB, async () => {
    await second.query("set local statement_timeout='2s'");
    return invoice(second, id.foreign);
  });
  equal(Number(independent.invoice_number.split("-").at(-1)), 1, "another tenant allocates independently while the first tenant is locked");
  await first.query("rollback");

  await begin(first, id.adminA);
  await invoice(first);
  const otherType = await authenticated(second, id.adminB, async () => {
    await second.query("set local statement_timeout='2s'");
    return one(second, "insert into supplier_invoices(organization_id,supplier_id,invoice_number,invoice_date) values($1,$2,'',$3::date) returning invoice_number", [id.org, id.supplier, period]);
  });
  equal(Number(otherType.invoice_number.split("-").at(-1)), 1, "another document type allocates independently in the same tenant");
  await first.query("rollback");

  const committed = await observer.query("select invoice_number from customer_invoices where organization_id=$1 order by invoice_number", [id.org]);
  equal(committed.rows.length, 5, "exactly the five intended invoices committed");
  equal(new Set(committed.rows.map((row) => row.invoice_number)).size, 5, "committed invoice numbers are unique across independent sessions");
  await cleanup();
  const report = { passed: true, syntheticOnly: true, engine: "Native PostgreSQL 18.6", independentAuthenticatedSessions: 2, realLockWaitsVerified: true, fixtureCleanupVerified: true, checks, results };
  const folder = resolve("training/numbering-counters/20261031"); await mkdir(folder, { recursive: true });
  await writeFile(resolve(folder, "native-concurrency.json"), JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify({ ...report, results: undefined }));
} catch (error) {
  console.error(JSON.stringify({ passed: false, checks, message: error.message, code: error.code }));
  await cleanup().catch((cleanupError) => console.error(JSON.stringify({ cleanupFailed: true, message: cleanupError.message })));
  process.exitCode = 1;
} finally { await Promise.all(clients.map((client) => client.end().catch(() => {}))); }
