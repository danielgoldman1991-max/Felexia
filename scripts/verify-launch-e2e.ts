import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

type Check = { name: string; passed: boolean; observed?: unknown };
type Manifest = {
  run: string;
  adminEmail: string;
  password: string;
  organizationId: string;
  adminUserId?: string;
  records: { saleId: string; purchaseId: string; bankId: string; customerId: string; supplierId: string; customerPaymentIds?: string[]; supplierPaymentId?: string; supplierPaymentIds?: string[] };
};
type Row = Record<string, unknown>;
class VerificationError extends Error {}

// Only the public key is used. A service-role client would invalidate RLS checks.
function loadLocalEnv() {
  const envArgument = process.argv.find((arg) => arg.startsWith("--env-file="))?.slice("--env-file=".length);
  const path = resolve(envArgument ?? process.env.FELEXIA_E2E_ENV_FILE ?? resolve(process.cwd(), ".env.local"));
  if (!existsSync(path)) return;
  for (const raw of readFileSync(path, "utf8").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const separator = line.indexOf("=");
    if (separator < 1) continue;
    const key = line.slice(0, separator).trim();
    if (!process.env[key]) process.env[key] = line.slice(separator + 1).trim().replace(/^(["'])(.*)\1$/, "$2");
  }
}

const money = (value: unknown) => Math.round(Number(value ?? 0) * 100) / 100;
const equalMoney = (left: unknown, right: number) => Math.abs(money(left) - right) < 0.005;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const rows = (value: unknown): Row[] => Array.isArray(value) ? value as Row[] : [];

async function main() {
  loadLocalEnv();
  const manifestPath = process.argv.slice(2).find((arg) => !arg.startsWith("--")) ?? process.env.FELEXIA_E2E_MANIFEST;
  const phase = process.argv.includes("--phase=partial") ? "partial" : "final";
  if (!manifestPath) throw new VerificationError("Provide a manifest path or FELEXIA_E2E_MANIFEST.");
  const manifest = JSON.parse(readFileSync(resolve(manifestPath), "utf8")) as Manifest;
  if (!/^[a-z0-9_-]{1,100}$/i.test(manifest.run ?? "")) throw new VerificationError("Invalid run identifier.");
  for (const value of [manifest.organizationId, manifest.records?.saleId, manifest.records?.purchaseId, manifest.records?.bankId, manifest.records?.customerId, manifest.records?.supplierId]) {
    if (typeof value !== "string" || !uuid.test(value)) throw new VerificationError("The manifest must contain valid tenant and document IDs.");
  }
  for (const optionalIds of [manifest.records.customerPaymentIds, manifest.records.supplierPaymentIds]) {
    if (optionalIds !== undefined && (!Array.isArray(optionalIds) || optionalIds.some((id) => typeof id !== "string" || !uuid.test(id)))) throw new VerificationError("Optional payment IDs must be arrays of valid UUIDs.");
  }
  if (manifest.records.supplierPaymentId !== undefined && (typeof manifest.records.supplierPaymentId !== "string" || !uuid.test(manifest.records.supplierPaymentId))) throw new VerificationError("The optional supplier payment ID must be a valid UUID.");
  if (!manifest.adminEmail || !manifest.password || !manifest.records?.saleId || !manifest.records?.purchaseId || !manifest.records?.bankId) throw new VerificationError("The private manifest is incomplete.");
  const reportPath = resolve(process.cwd(), "training", "launch-e2e", manifest.run, "verification.json");
  const checks: Check[] = [];
  const report: Record<string, unknown> = { run: manifest.run, phase, organizationId: manifest.organizationId, startedAt: new Date().toISOString(), readOnly: true, checks };
  function check(name: string, passed: boolean, observed?: unknown) {
    checks.push({ name, passed, ...(observed === undefined ? {} : { observed }) });
  }
  async function read<T>(table: string, query: PromiseLike<{ data: T | null; error: { code?: string } | null }>): Promise<T> {
    const result = await query;
    if (result.error || result.data === null) throw new VerificationError(`Read failed for ${table}.`);
    return result.data;
  }

  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const publicKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !publicKey) throw new VerificationError("Public Supabase configuration is missing.");
    if (publicKey.startsWith("sb_secret_")) throw new VerificationError("A public Supabase key is required.");
    if (publicKey.split(".").length === 3) {
      const claims = JSON.parse(Buffer.from(publicKey.split(".")[1], "base64url").toString("utf8")) as { role?: string };
      if (claims.role !== "anon") throw new VerificationError("RLS verification requires an anonymous public key.");
    }
    const client = createClient(url, publicKey, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
    const auth = await client.auth.signInWithPassword({ email: manifest.adminEmail, password: manifest.password });
    if (auth.error || !auth.data.user) throw new VerificationError("Public administrator authentication failed.");
    check("public_admin_authentication", !manifest.adminUserId || auth.data.user.id === manifest.adminUserId);
    report.authenticatedUserId = auth.data.user.id;
    const orgId = manifest.organizationId;
    const { saleId, purchaseId, bankId } = manifest.records;
    const partial = phase === "partial";
    const expectedSalePaid = partial ? 100 : 240;
    const expectedSaleRemaining = partial ? 140 : 0;
    const expectedSupplierPaid = partial ? 0 : 120;
    const expectedBalanceDelta = partial ? 100 : 120;

    const [memberships, journals, taxRates, sales, purchases, saleLines, purchaseLines, customerAllocations, supplierAllocations, bankRows] = await Promise.all([
      read("organization_members", client.from("organization_members").select("organization_id,user_id,status").eq("organization_id", orgId).eq("user_id", auth.data.user.id)),
      read("accounting_journals", client.from("accounting_journals").select("code").eq("organization_id", orgId)),
      read("tax_rates", client.from("tax_rates").select("id,code,rate,is_default").is("organization_id", null).eq("is_system", true).eq("status", "active")),
      read("customer_invoices", client.from("customer_invoices").select("id,status,payment_status,subtotal_ht,tax_total,total_ttc,paid_amount,remaining_amount,source_type,source_document_id,source_order_id,source_delivery_id").eq("organization_id", orgId).eq("id", saleId)),
      read("supplier_invoices", client.from("supplier_invoices").select("id,status,payment_status,subtotal_ht,tax_total,total_ttc,paid_amount,remaining_amount,source_type,source_receipt_id").eq("organization_id", orgId).eq("id", purchaseId)),
      read("customer_invoice_lines", client.from("customer_invoice_lines").select("product_id,quantity,unit_price_ht,tax_rate,subtotal_ht,tax_amount,total_ttc,source_document_id").eq("organization_id", orgId).eq("invoice_id", saleId)),
      read("supplier_invoice_lines", client.from("supplier_invoice_lines").select("product_id,quantity,unit_name,unit_price_ht,tax_rate,subtotal_ht,tax_amount,total_ttc,source_document_id").eq("organization_id", orgId).eq("invoice_id", purchaseId)),
      read("customer_payment_allocations", client.from("customer_payment_allocations").select("payment_id,amount").eq("organization_id", orgId).eq("invoice_id", saleId).is("cancelled_at", null)),
      read("supplier_payment_allocations", client.from("supplier_payment_allocations").select("payment_id,amount").eq("organization_id", orgId).eq("invoice_id", purchaseId).is("cancelled_at", null)),
      read("treasury_accounts", client.from("treasury_accounts").select("id,opening_balance,current_balance,currency").eq("organization_id", orgId).eq("id", bankId)),
    ]);
    check("active_own_membership", rows(memberships).length === 1 && rows(memberships)[0].status === "active");
    check("five_default_journals", ["VE", "AC", "BQ", "CA", "OD"].every((code) => rows(journals).some((journal) => journal.code === code)));
    check("global_vat20_visible_to_new_user", rows(taxRates).some((rate) => rate.code === "VAT_20" && equalMoney(rate.rate, 20) && rate.is_default === true));
    const sale = rows(sales)[0];
    const purchase = rows(purchases)[0];
    check("sale_found_in_own_tenant", rows(sales).length === 1);
    check("purchase_found_in_own_tenant", rows(purchases).length === 1);
    if (!sale || !purchase) throw new VerificationError("A test invoice is missing in the authenticated tenant.");
    check("sale_totals_200_40_240", equalMoney(sale.subtotal_ht, 200) && equalMoney(sale.tax_total, 40) && equalMoney(sale.total_ttc, 240));
    check("purchase_totals_100_20_120", equalMoney(purchase.subtotal_ht, 100) && equalMoney(purchase.tax_total, 20) && equalMoney(purchase.total_ttc, 120));
    check("sale_payment_state", equalMoney(sale.paid_amount, expectedSalePaid) && equalMoney(sale.remaining_amount, expectedSaleRemaining) && sale.payment_status === (partial ? "partial" : "paid") && sale.status === (partial ? "partially_paid" : "paid"), { paid: money(sale.paid_amount), remaining: money(sale.remaining_amount), status: sale.status });
    check("purchase_payment_state", equalMoney(purchase.paid_amount, expectedSupplierPaid) && equalMoney(purchase.remaining_amount, partial ? 120 : 0) && purchase.payment_status === (partial ? "unpaid" : "paid") && purchase.status === (partial ? "validated" : "paid"), { paid: money(purchase.paid_amount), remaining: money(purchase.remaining_amount), status: purchase.status });
    check("manual_sale_without_delivery", sale.source_type === "manual" && !sale.source_document_id && !sale.source_order_id && !sale.source_delivery_id);
    check("manual_purchase_without_receipt", purchase.source_type === "manual" && !purchase.source_receipt_id);
    check("sale_free_line_2x100_vat20", rows(saleLines).length === 1 && rows(saleLines).every((line) => !line.product_id && !line.source_document_id && equalMoney(line.quantity, 2) && equalMoney(line.unit_price_ht, 100) && equalMoney(line.tax_rate, 20)));
    check("purchase_free_line_1x100_vat20_with_unit", rows(purchaseLines).length === 1 && rows(purchaseLines).every((line) => !line.product_id && !line.source_document_id && equalMoney(line.quantity, 1) && equalMoney(line.unit_price_ht, 100) && equalMoney(line.tax_rate, 20) && typeof line.unit_name === "string" && line.unit_name.length > 0));

    const customerIds = [...new Set(rows(customerAllocations).map((allocation) => String(allocation.payment_id)))];
    const supplierIds = [...new Set(rows(supplierAllocations).map((allocation) => String(allocation.payment_id)))];
    check("customer_allocations_match_paid_amount", customerIds.length === (partial ? 1 : 2) && equalMoney(rows(customerAllocations).reduce((sum, allocation) => sum + money(allocation.amount), 0), expectedSalePaid));
    check("supplier_allocations_match_paid_amount", supplierIds.length === (partial ? 0 : 1) && equalMoney(rows(supplierAllocations).reduce((sum, allocation) => sum + money(allocation.amount), 0), expectedSupplierPaid));
    const [customerPayments, supplierPayments, bankTransactions] = await Promise.all([
      customerIds.length ? read("customer_payments", client.from("customer_payments").select("id,amount,allocated_amount,available_amount,status,treasury_account_id,currency").eq("organization_id", orgId).in("id", customerIds).is("archived_at", null)) : Promise.resolve([]),
      supplierIds.length ? read("supplier_payments", client.from("supplier_payments").select("id,amount,allocated_amount,available_amount,status,treasury_account_id,currency").eq("organization_id", orgId).in("id", supplierIds).is("archived_at", null)) : Promise.resolve([]),
      read("treasury_transactions", client.from("treasury_transactions").select("id,amount,direction,currency,customer_payment_id,supplier_payment_id").eq("organization_id", orgId).eq("treasury_account_id", bankId).is("archived_at", null)),
    ]);
    const expectedCustomerAmounts = partial ? [100] : [100, 140];
    check("customer_payment_amounts", JSON.stringify(rows(customerPayments).map((payment) => money(payment.amount)).sort((a, b) => a - b)) === JSON.stringify(expectedCustomerAmounts));
    check("supplier_payment_amounts", partial ? rows(supplierPayments).length === 0 : rows(supplierPayments).length === 1 && equalMoney(rows(supplierPayments)[0].amount, 120));
    check("payments_fully_allocated_in_mad_bank", [...rows(customerPayments), ...rows(supplierPayments)].every((payment) => equalMoney(payment.allocated_amount, money(payment.amount)) && equalMoney(payment.available_amount, 0) && payment.status === "allocated" && payment.currency === "MAD" && payment.treasury_account_id === bankId));
    const movements = rows(bankTransactions);
    const expectedMovements = new Map([
      ...rows(customerPayments).map((payment): [string, { amount: number; direction: string }] => [String(payment.id), { amount: money(payment.amount), direction: "in" }]),
      ...rows(supplierPayments).map((payment): [string, { amount: number; direction: string }] => [String(payment.id), { amount: money(payment.amount), direction: "out" }]),
    ]);
    check("exact_payment_treasury_movements", movements.length === (partial ? 1 : 3) && movements.every((movement) => {
      const expected = expectedMovements.get(String(movement.customer_payment_id ?? movement.supplier_payment_id));
      return expected !== undefined && movement.currency === "MAD" && movement.direction === expected.direction && equalMoney(movement.amount, expected.amount);
    }));
    check("one_treasury_movement_per_payment", [...customerIds, ...supplierIds].every((id) => movements.filter((movement) => movement.customer_payment_id === id || movement.supplier_payment_id === id).length === 1));
    const netMovements = movements.reduce((sum, movement) => sum + (movement.direction === "in" ? 1 : -1) * money(movement.amount), 0);
    check("treasury_net_cash_flow", equalMoney(netMovements, expectedBalanceDelta), money(netMovements));
    const bank = rows(bankRows)[0];
    check("bank_balance_matches_opening_and_payments", Boolean(bank) && bank.currency === "MAD" && equalMoney(bank.opening_balance, 0) && equalMoney(bank.current_balance, money(bank.opening_balance) + expectedBalanceDelta), bank ? { opening: money(bank.opening_balance), current: money(bank.current_balance) } : null);

    const sourceIds = [saleId, purchaseId, ...customerIds, ...supplierIds];
    const entries = rows(await read("accounting_entries", client.from("accounting_entries").select("id,source_document_id,source_document_type,status,total_debit,total_credit").eq("organization_id", orgId).in("source_document_id", sourceIds).neq("status", "cancelled")));
    const entryIds = entries.map((entry) => String(entry.id));
    const entryLines = entryIds.length ? rows(await read("accounting_entry_lines", client.from("accounting_entry_lines").select("entry_id,account_id,account_code,debit,credit").eq("organization_id", orgId).in("entry_id", entryIds))) : [];
    const accountIds = [...new Set(entryLines.map((line) => String(line.account_id)))];
    const accounts = accountIds.length ? rows(await read("accounting_accounts", client.from("accounting_accounts").select("id,code").eq("organization_id", orgId).in("id", accountIds))) : [];
    const accountCodes = new Map(accounts.map((account) => [account.id, account.code]));
    check("accounting_source_uniqueness", sourceIds.every((id) => entries.filter((entry) => entry.source_document_id === id).length <= 1));
    check("accounting_codes_match_tenant_accounts", entryLines.every((line) => typeof line.account_code === "string" && line.account_code.length > 0 && line.account_code === accountCodes.get(line.account_id)));
    check("accounting_entries_balanced_with_lines", entries.every((entry) => {
      const lines = entryLines.filter((line) => line.entry_id === entry.id);
      const debit = lines.reduce((sum, line) => sum + money(line.debit), 0);
      const credit = lines.reduce((sum, line) => sum + money(line.credit), 0);
      return lines.length >= 2 && equalMoney(debit, credit) && equalMoney(entry.total_debit, debit) && equalMoney(entry.total_credit, credit);
    }));
    if (!partial) {
      check("five_posted_entries", entries.length === 5 && sourceIds.every((id) => entries.some((entry) => entry.source_document_id === id && entry.status === "posted")));
      const expectedTotals = new Map<string, number>([[saleId, 240], [purchaseId, 120], ...rows(customerPayments).map((payment): [string, number] => [String(payment.id), money(payment.amount)]), ...rows(supplierPayments).map((payment): [string, number] => [String(payment.id), money(payment.amount)])]);
      check("accounting_entry_amounts_match_sources", entries.every((entry) => equalMoney(entry.total_debit, expectedTotals.get(String(entry.source_document_id)) ?? -1)));
      const balances = new Map<string, number>();
      for (const line of entryLines) {
        const code = String(line.account_code);
        balances.set(code, (balances.get(code) ?? 0) + money(line.debit) - money(line.credit));
      }
      check("ledger_matches_sale_purchase_and_settlements", equalMoney(balances.get("3421"), 0) && equalMoney(balances.get("4411"), 0) && equalMoney(balances.get("5141"), 120) && equalMoney(balances.get("7124"), -200) && equalMoney(balances.get("6122"), 100) && equalMoney(balances.get("4455"), -40) && equalMoney((balances.get("3455") ?? 0) + (balances.get("34552") ?? 0), 20));
    }

    const stock = await client.from("stock_moves").select("id", { count: "exact", head: true }).eq("organization_id", orgId);
    if (stock.error) throw new VerificationError("Read failed for stock_moves.");
    check("no_stock_movements_for_manual_invoice_journey", stock.count === 0, stock.count);
    for (const table of ["organization_members", "third_parties", "customer_invoices", "supplier_invoices", "customer_payments", "supplier_payments", "treasury_accounts", "treasury_transactions", "accounting_entries", "accounting_entry_lines"]) {
      const foreign = await read(table, client.from(table).select("id").neq("organization_id", orgId).limit(1));
      check(`rls_no_foreign_${table}`, rows(foreign).length === 0);
    }
    const foreignOrganizations = await read("organizations", client.from("organizations").select("id").neq("id", orgId).limit(1));
    check("rls_no_foreign_organizations", rows(foreignOrganizations).length === 0);
    const foreignId = process.env.FELEXIA_E2E_FOREIGN_ORGANIZATION_ID;
    if (foreignId) {
      if (!uuid.test(foreignId) || foreignId === orgId) throw new VerificationError("Invalid foreign organization probe ID.");
      const foreign = await read("organizations", client.from("organizations").select("id").eq("id", foreignId));
      check("rls_known_foreign_organization_hidden", rows(foreign).length === 0);
    }
    report.financial = { salePaid: money(sale.paid_amount), saleRemaining: money(sale.remaining_amount), purchasePaid: money(purchase.paid_amount), purchaseRemaining: money(purchase.remaining_amount), treasuryMovementCount: movements.length, treasuryNet: money(netMovements), bankBalance: bank ? money(bank.current_balance) : null, postedEntryCount: entries.filter((entry) => entry.status === "posted").length };
    report.testIds = { saleId, purchaseId, bankId, customerPaymentIds: customerIds, supplierPaymentIds: supplierIds };
  } catch (error) {
    // Never serialize SDK errors, sessions, the private manifest or credentials.
    check("verification_completed", false, error instanceof VerificationError ? error.message : "Unexpected verification failure.");
  }
  report.completedAt = new Date().toISOString();
  report.success = checks.length > 0 && checks.every((item) => item.passed);
  mkdirSync(dirname(reportPath), { recursive: true });
  writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  const failures = checks.filter((item) => !item.passed).map((item) => item.name);
  console.log(JSON.stringify({ run: manifest.run, phase, success: report.success, checks: checks.length, failedChecks: failures, report: reportPath }));
  if (!report.success) process.exitCode = 1;
}

main().catch(() => {
  console.error("Launch verification could not start; check manifest and public environment configuration.");
  process.exitCode = 1;
});
