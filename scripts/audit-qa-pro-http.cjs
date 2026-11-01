/* eslint-disable @typescript-eslint/no-require-imports -- explicitly scoped hosted QA HTTP harness */
// No product POST, Stripe call, email, DGI transmission or cron execution.
// Only the existing synthetic company's plan_code/plan_id may change temporarily.
// Auth uses its existing public QA admin. Original contract and recovery journal
// stay outside Git. PostgreSQL's updated_at audit timestamp necessarily advances.
const fs = require("node:fs");
const path = require("node:path");
const { createHash } = require("node:crypto");
const root = path.resolve(__dirname, "..");
const EXPECTED_ORG = "1eabead7-02ca-4d44-b147-2831d8799eaa";
const EXPECTED_RUN = "essential-final-20261031202921";
const MARKER = "felexia-qa-pro-http-20261101";
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const arg = key => process.argv.find(value => value.startsWith(`--${key}=`))?.slice(key.length + 3);
const digest = value => createHash("sha256").update(JSON.stringify(stable(value))).digest("hex");
function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  return value && typeof value === "object" ? Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])])) : value;
}
const businessRow = row => Object.fromEntries(Object.entries(row).filter(([key]) => key !== "updated_at"));
function verifyManifest(m) {
  if (m.run !== EXPECTED_RUN || m.organizationId !== EXPECTED_ORG || m.companyName !== "FELEXIA RECETTE ESSENTIELLE 20261031202921") throw Error("QA_MANIFEST_SCOPE_MISMATCH");
  const [mailbox, domain] = String(m.authorizedMailbox ?? "").toLowerCase().split("@");
  const admin = m.users?.admin; const email = String(admin?.email ?? "").toLowerCase();
  const prefix = `${mailbox}+recette`; const suffix = `admin@${domain}`;
  if (!mailbox || !domain || !email.startsWith(prefix) || !email.endsWith(suffix) || !/^\d+$/.test(email.slice(prefix.length, -suffix.length)) || !uuid.test(admin?.id ?? "") || !admin?.password) throw Error("QA_ADMIN_SCOPE_MISMATCH");
}
function privatePath(filename, existing = false) {
  const directory = fs.realpathSync(path.resolve(root, "../backups"));
  const target = existing ? fs.realpathSync(path.resolve(filename)) : path.join(fs.realpathSync(path.dirname(path.resolve(filename))), path.basename(filename));
  const relative = path.relative(directory, target);
  if (relative.startsWith("..") || path.isAbsolute(relative)) throw Error("PRIVATE_BACKUP_PATH_REQUIRED");
  return target;
}
async function limited(values, callback, max = 3) {
  let next = 0; const results = [];
  await Promise.all(Array.from({ length: Math.min(max, values.length) }, async () => {
    for (;;) { const index = next++; if (index >= values.length) return; results[index] = await callback(values[index], index); }
  }));
  return results;
}
const financialCore = ["customer_invoices", "customer_invoice_lines", "supplier_invoices", "supplier_invoice_lines",
  "customer_credit_notes", "customer_credit_note_lines", "customer_credit_note_applications", "supplier_credit_notes", "supplier_credit_note_lines", "supplier_credit_note_applications",
  "customer_payments", "customer_payment_allocations", "supplier_payments", "supplier_payment_allocations", "treasury_accounts", "treasury_transactions", "accounting_entries", "accounting_entry_lines"];
const financialExtra = ["sales_documents", "sales_document_lines", "purchase_documents", "purchase_document_lines", "stock_moves", "stock_levels", "bank_statement_imports", "bank_statement_lines",
  "treasury_forecast_items", "vat_declarations", "hr_employees", "hr_contracts", "hr_payroll_periods", "hr_payslips", "hr_advances", "hr_loans", "hr_expense_reports"];
const references = ["accounting_accounts", "accounting_journals", "accounting_settings", "company_settings", "document_settings", "document_templates", "organization_modules",
  "hr_departments", "hr_positions", "hr_leave_types", "hr_salary_items", "hr_settings", "units", "tax_rates", "product_categories", "warehouses"];
async function scopedRows(db, table, optional = false) {
  const rows = [];
  for (;;) {
    let query = db.from(table).select("*").eq("organization_id", EXPECTED_ORG);
    query = table === "stock_levels" ? query.order("warehouse_id").order("product_id") : query.order("id");
    const result = await query.range(rows.length, rows.length + 499);
    if (result.error) {
      if (optional && ["42P01", "42703", "PGRST204", "PGRST205"].includes(result.error.code)) return { unavailable: true, code: result.error.code };
      throw Error(`QA_SCOPED_READ_FAILED_${table}`);
    }
    if (result.data.some(row => row.organization_id !== EXPECTED_ORG)) throw Error("QA_ROW_TENANT_MISMATCH");
    rows.push(...result.data); if (result.data.length < 500) return rows;
  }
}
async function snapshot(db, tables, optional) { return Object.fromEntries(await limited(tables, async table => [table, await scopedRows(db, table, optional)])); }
function fingerprints(tables) { return Object.fromEntries(Object.entries(tables).map(([table, rows]) => [table, Array.isArray(rows) ? { count: rows.length, sha256: digest(rows) } : rows])); }
function referenceChanges(before, after) {
  return Object.keys(before).map(table => ({ table, before: Array.isArray(before[table]) ? before[table].length : null, after: Array.isArray(after[table]) ? after[table].length : null,
    changed: digest(before[table]) !== digest(after[table]) })).filter(row => row.changed);
}
const dynamicSources = [
  ["/achats/avoirs/", "supplier_credit_notes"], ["/achats/commandes/", "purchase_documents", "supplier_order"], ["/achats/receptions/", "purchase_documents", "supplier_receipt"],
  ["/achats/factures/", "supplier_invoices"], ["/achats/paiements/", "supplier_payments"], ["/articles/categories/", "product_categories"], ["/articles/tva/", "tax_rates"], ["/articles/unites/", "units"], ["/articles/", "products"],
  ["/comptabilite/tva/declarations/", "vat_declarations"], ["/comptabilite/comptes/", "accounting_accounts"], ["/comptabilite/ecritures/", "accounting_entries"], ["/comptabilite/journaux/", "accounting_journals"],
  ["/documents/", "documents"], ["/facturation/avoirs/", "customer_credit_notes"], ["/facturation/factures/", "customer_invoices"], ["/facturation/paiements/", "customer_payments"],
  ["/rh/employes/", "hr_employees"], ["/rh/contrats/", "hr_contracts"], ["/rh/paie/periodes/", "hr_payroll_periods"], ["/rh/paie/bulletins/", "hr_payslips"],
  ["/stock/emplacements/", "warehouses"], ["/tiers/", "third_parties"], ["/tresorerie/comptes/", "treasury_accounts"], ["/tresorerie/mouvements/", "treasury_transactions"], ["/tresorerie/previsions/", "treasury_forecast_items"], ["/tresorerie/releves/", "bank_statement_imports"],
  ["/vente/devis/", "sales_documents", "quote"], ["/vente/commandes/", "sales_documents", "order"], ["/vente/livraisons/", "sales_documents", "delivery_note"], ["/vente/retours/", "sales_documents", "return_note"],
];
function visible(html) { return html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "").replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " "); }
function isEligibleEdit(route, row) {
  if (route === "/facturation/factures/[id]/edit") return row.status === "draft";
  if (route === "/facturation/paiements/[id]/edit") return !(Number(row.allocated_amount) > 0 || row.status === "cancelled");
  return true;
}
function redacted(value) { return String(value).replace(/[0-9a-f]{8}-[0-9a-f-]{27,}/gi, "[qa-id]").replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[email]").slice(0, 220); }
function cas(query, row) {
  for (const key of ["id", "organization_id", "plan_code", "plan_id", "updated_at"]) query = row[key] == null ? query.is(key, null) : query.eq(key, row[key]);
  return query;
}
async function readSubscription(service) {
  const result = await service.from("organization_subscriptions").select("*").eq("organization_id", EXPECTED_ORG).limit(2);
  if (result.error || result.data?.length !== 1) throw Error("QA_UNIQUE_SUBSCRIPTION_REQUIRED");
  return result.data[0];
}
async function restore(service, recovery, save) {
  if (!recovery.planUpdateAttempted) return;
  const current = await readSubscription(service);
  const expected = { ...recovery.originalSubscription, plan_code: "premium", plan_id: recovery.premiumPlanId };
  if (digest(businessRow(current)) === digest(businessRow(recovery.originalSubscription))) { recovery.restorationRequired = false; save(); return; }
  if (digest(businessRow(current)) !== digest(businessRow(expected))) throw Error("QA_RESTORE_CONTRACT_DRIFT");
  const result = await cas(service.from("organization_subscriptions").update({ plan_code: recovery.originalSubscription.plan_code, plan_id: recovery.originalSubscription.plan_id }), current).select("*");
  if (result.error || result.data?.length !== 1) throw Error("QA_RESTORE_CAS_FAILED");
  const verified = await readSubscription(service);
  if (digest(businessRow(verified)) !== digest(businessRow(recovery.originalSubscription))) throw Error("QA_RESTORE_VERIFICATION_FAILED");
  recovery.restorationRequired = false; recovery.restoredAt = new Date().toISOString(); recovery.restoredSubscription = verified; save();
}
async function main() {
  const manifestPath = privatePath(arg("manifest") ?? path.resolve(root, "../backups/essential-fixes-e2e-private.json"), true);
  const m = JSON.parse(fs.readFileSync(manifestPath, "utf8")); verifyManifest(m);
  const origin = arg("origin") ?? "http://localhost:3112";
  if (!["http://localhost:3112", "http://127.0.0.1:3112", "https://www.felexia.pro"].includes(origin)) throw Error("QA_HTTP_ORIGIN_NOT_ALLOWED");
  const inventory = JSON.parse(fs.readFileSync(path.join(root, "training/pro-full-audit/20261101/route-matrix.json"), "utf8"));
  const pages = inventory.rows.filter(row => row.kind === "Page" && !["Public ou alias", "Authentification", "Onboarding"].includes(row.module));
  if (!process.argv.includes("--execute-qa-pro")) {
    console.log(JSON.stringify({ action: "plan-only", origin, staticPages: pages.filter(row => !row.route.includes("[")).length,
      dynamicTemplates: pages.filter(row => row.route.includes("[")).length, maxConcurrency: 3, syntheticQaOnly: true,
      temporaryFields: ["plan_code", "plan_id"], restoreAllContractFields: true, updatedAtAuditMayAdvance: true,
      referenceInitialization: "Permitted and journaled in QA only", noProductPosts: true, noEmailsPaymentsDgiCron: true })); return;
  }
  require("@next/env").loadEnvConfig(root);
  const { createClient } = require("@supabase/supabase-js"); const { createServerClient } = require("@supabase/ssr");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL; const publicKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !publicKey || !serviceKey || publicKey === serviceKey || publicKey.startsWith("sb_secret_")) throw Error("QA_PUBLIC_AUTH_AND_SERVER_FIXTURE_CONFIG_REQUIRED");
  const service = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const restoreOnly = arg("restore-only");
  if (restoreOnly) {
    const target = privatePath(restoreOnly, true); const recovery = JSON.parse(fs.readFileSync(target, "utf8"));
    if (recovery.marker !== MARKER || recovery.organizationId !== EXPECTED_ORG || recovery.run !== EXPECTED_RUN) throw Error("QA_RECOVERY_SCOPE_MISMATCH");
    await restore(service, recovery, () => fs.writeFileSync(target, JSON.stringify(recovery, null, 2) + "\n"));
    console.log(JSON.stringify({ restored: !recovery.restorationRequired, contractFieldsRestored: true, updatedAtAuditMayAdvance: true })); return;
  }
  const lockPath = privatePath(path.resolve(root, "../backups/qa-pro-http-audit.lock"));
  const backups = path.dirname(lockPath);
  for (const filename of fs.readdirSync(backups).filter(name => /^qa-pro-http-.*\.json$/.test(name))) {
    const pending = JSON.parse(fs.readFileSync(path.join(backups, filename), "utf8"));
    if (pending.marker === MARKER && pending.restorationRequired) throw Error("QA_PENDING_RECOVERY_MUST_BE_RESTORED_FIRST");
  }
  let lock; try { lock = fs.openSync(lockPath, "wx"); fs.writeFileSync(lock, String(process.pid)); } catch { throw Error("QA_AUDIT_LOCK_EXISTS_REVIEW_RECOVERY_FIRST"); }
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const recoveryPath = privatePath(path.resolve(root, `../backups/qa-pro-http-${stamp}.json`));
  let recovery = { marker: MARKER, run: m.run, organizationId: EXPECTED_ORG, origin, startedAt: new Date().toISOString(), planUpdateAttempted: false, restorationRequired: false };
  const save = () => fs.writeFileSync(recoveryPath, JSON.stringify(recovery, null, 2) + "\n", { mode: 0o600 });
  const report = { date: new Date().toISOString(), origin, scope: "Existing synthetic QA company only; public Auth admin; real GET pages/forms/details/prints/exports; max concurrency3",
    success: false, maxConcurrency: 3, productPosts: 0, emailsPaymentsDgiCron: 0, routes: [], skipped: [], referenceInitialization: [], limitations: [], restored: false };
  const output = path.join(root, `training/pro-full-audit/20261101/${origin.startsWith("http:") ? "host" : "public"}-qa-pro.json`);
  let authClient;
  try {
    const organization = await service.from("organizations").select("id,name").eq("id", EXPECTED_ORG).single();
    if (organization.error || organization.data?.name !== m.companyName) throw Error("QA_LIVE_ORGANIZATION_SCOPE_MISMATCH");
    const jar = new Map();
    const client = createServerClient(url, publicKey, { cookies: { getAll: () => [...jar].map(([name, value]) => ({ name, value })), setAll: values => { for (const cookie of values) if (cookie.options?.maxAge === 0) jar.delete(cookie.name); else jar.set(cookie.name, cookie.value); } }, auth: { autoRefreshToken: false, detectSessionInUrl: false } });
    authClient = client;
    const signed = await client.auth.signInWithPassword({ email: m.users.admin.email, password: m.users.admin.password });
    if (signed.error || signed.data.user?.id !== m.users.admin.id || signed.data.user?.email?.toLowerCase() !== m.users.admin.email.toLowerCase() || jar.size === 0) throw Error("QA_PUBLIC_ADMIN_AUTH_FAILED");
    const members = await client.from("organization_members").select("organization_id,role:roles(name)").eq("user_id", signed.data.user.id).eq("status", "active");
    const member = members.data?.[0]; const role = Array.isArray(member?.role) ? member.role[0]?.name : member?.role?.name;
    if (members.error || members.data?.length !== 1 || member.organization_id !== EXPECTED_ORG || !["owner", "admin"].includes(role)) throw Error("QA_ADMIN_MEMBERSHIP_MISMATCH");
    const capabilities = await client.rpc("erp_get_capabilities", { p_organization_id: EXPECTED_ORG });
    if (capabilities.error || capabilities.data?.pro_write_guards !== true || capabilities.data?.workflow_version < 104) throw Error("QA_PRO_SQL_CAPABILITY_REQUIRED");
    const original = await readSubscription(service);
    const trialEnd = original.trial_ends_at ?? original.trial_end;
    if (original.plan_code !== "essentiel" || !["trial", "trialing"].includes(original.status) || !trialEnd || Date.parse(trialEnd) <= Date.now() || original.stripe_subscription_id) throw Error("QA_UNPAID_USABLE_ESSENTIEL_TRIAL_REQUIRED");
    const premium = await service.from("subscription_plans").select("id,code").eq("code", "premium").single();
    if (premium.error || !uuid.test(premium.data?.id ?? "")) throw Error("QA_PREMIUM_PLAN_REFERENCE_REQUIRED");
    const beforeCore = await snapshot(service, financialCore, false); const beforeExtra = await snapshot(service, financialExtra, true); const beforeRefs = await snapshot(service, references, true);
    recovery = { ...recovery, originalSubscription: original, premiumPlanId: premium.data.id, financialBefore: { ...beforeCore, ...beforeExtra }, referenceBefore: beforeRefs }; save();
    const before = fingerprints(recovery.financialBefore); report.financesBefore = before;
    const sourceTables = [...new Set(dynamicSources.map(item => item[1]))];
    const data = { ...recovery.financialBefore, ...beforeRefs, ...await snapshot(service, sourceTables.filter(table => !(table in recovery.financialBefore) && !(table in beforeRefs)), true) };
    const routes = pages.filter(row => !row.route.includes("[")).map(row => ({ ...row, target: row.route }));
    for (const row of pages.filter(item => item.route.includes("["))) {
      const source = dynamicSources.find(([prefix]) => row.route.startsWith(prefix));
      const candidates = source && Array.isArray(data[source[1]]) ? data[source[1]].filter(item => !item.archived_at && (!source[2] || item.document_type === source[2])) : [];
      if (!source || !candidates.length || (row.route.match(/\[/g)?.length ?? 0) !== 1) { report.skipped.push({ route: row.route, reason: source ? "No suitable existing scoped QA row" : "Dynamic source not mapped; no invented record" }); continue; }
      const editable = candidates.find(candidate => isEligibleEdit(row.route, candidate));
      const selected = editable ?? candidates[0];
      routes.push({ ...row, target: row.route.replace(/\[[^\]]+\]/, selected.id), expectedStatus: editable ? 200 : 404,
        ...(!editable ? { expectedRestriction: "Existing QA row is not editable under the page's explicit business-state guard" } : {}) });
    }
    for (const kind of ["sales", "purchases", "supplier-credits", "contacts", "treasury", "treasury-ledger"]) routes.push({ route: `/api/exports/${kind}`, target: `/api/exports/${kind}`, module: "Export CSV", state: "Existing export" });
    if (Array.isArray(beforeRefs.accounting_journals)) for (const journal of beforeRefs.accounting_journals) routes.push({ route: "/comptabilite/journaux/[id]/export", target: `/comptabilite/journaux/${journal.id}/export`, module: "Export Excel", state: "Existing export" });
    recovery.planUpdateAttempted = true; recovery.restorationRequired = true; save();
    const changed = await cas(service.from("organization_subscriptions").update({ plan_code: "premium", plan_id: premium.data.id }), original).select("*");
    if (changed.error || changed.data?.length !== 1) throw Error("QA_TEMPORARY_PLAN_CAS_FAILED");
    recovery.temporarySubscription = changed.data[0]; save();
    if (digest(businessRow(changed.data[0])) !== digest(businessRow({ ...original, plan_code: "premium", plan_id: premium.data.id }))) throw Error("QA_TEMPORARY_PLAN_CHANGED_OTHER_CONTRACT_FIELDS");
    async function request(item) {
      const started = Date.now(); let target = item.target; const redirects = [];
      try {
        for (let hop = 0; hop < 5; hop++) {
          const response = await fetch(origin + target, { method: "GET", redirect: "manual", signal: AbortSignal.timeout(45000), headers: { Cookie: [...jar].map(([name, value]) => `${name}=${value}`).join("; ") } });
          for (const cookie of response.headers.getSetCookie()) { const pair = cookie.split(";")[0]; const split = pair.indexOf("="); if (split > 0) { const name = pair.slice(0, split); const value = pair.slice(split + 1); if (value) jar.set(name, value); else jar.delete(name); } }
          if ([301, 302, 303, 307, 308].includes(response.status)) {
            const next = new URL(response.headers.get("location"), origin);
            redirects.push({ status: response.status, path: redacted(next.pathname) });
            if (next.origin !== origin || /^\/(?:login|auth)(?:\/|$)/.test(next.pathname) || next.pathname === "/parametres/modules") throw Error("QA_UNEXPECTED_AUTH_OR_MODULE_REDIRECT");
            target = next.pathname + next.search; continue;
          }
          const body = await response.text(); const text = visible(body);
          const appError = /Application error:|a server-side exception|This page could not be displayed|Internal Server Error|NEXT_HTTP_ERROR_FALLBACK;500/i.test(body);
          return { route: item.route, module: item.module, state: item.state, finalPath: redacted(target), status: response.status, expectedStatus: item.expectedStatus ?? 200,
            passed: response.status === (item.expectedStatus ?? 200) && !appError, ...(item.expectedRestriction ? { expectedRestriction: item.expectedRestriction } : {}),
            appError, contentType: response.headers.get("content-type"), bytes: Buffer.byteLength(body), sha256: createHash("sha256").update(body).digest("hex"), ms: Date.now() - started, redirects,
            ...(response.status >= 400 || appError ? { excerpt: redacted(text) } : {}) };
        }
        throw Error("QA_TOO_MANY_REDIRECTS");
      } catch (error) { return { route: item.route, module: item.module, state: item.state, passed: false, error: /^QA_/.test(error.message ?? "") ? error.message : "QA_HTTP_REQUEST_FAILED", ms: Date.now() - started, redirects }; }
    }
    report.routes = await limited(routes, request, 3);
    const afterCore = await snapshot(service, financialCore, false); const afterExtra = await snapshot(service, financialExtra, true); const afterRefs = await snapshot(service, references, true);
    recovery.financialAfter = { ...afterCore, ...afterExtra }; recovery.referenceAfter = afterRefs; save();
    report.financesAfter = fingerprints(recovery.financialAfter);
    report.financesUnchanged = digest(report.financesBefore) === digest(report.financesAfter);
    report.referenceInitialization = referenceChanges(beforeRefs, afterRefs);
    report.failed = report.routes.filter(row => !row.passed).map(row => row.route);
    report.limitations.push("HTTP GET verifies loading/rendering only; no form submission or complete financial workflow is inferred.", "Reserved/preparatory routes retain their inventory classification.", "Only existing QA details are tested; empty modules have no invented records.", "Reference initialization is allowed solely inside this synthetic QA company.");
    report.success = report.financesUnchanged && report.failed.length === 0;
  } catch (error) {
    report.failure = /^QA_/.test(error.message ?? "") ? error.message : "QA_HTTP_AUDIT_FAILED";
  } finally {
    try { await restore(service, recovery, save); report.restored = !recovery.restorationRequired; }
    catch (error) { report.restorationFailure = /^QA_/.test(error.message ?? "") ? error.message : "QA_RESTORATION_FAILED"; report.success = false; }
    if (authClient) {
      try { const result = await authClient.auth.signOut({ scope: "local" }); report.qaAuthSessionSignedOut = !result.error; }
      catch { report.qaAuthSessionSignedOut = false; }
    }
    report.contractFieldsRestored = report.restored && Boolean(recovery.originalSubscription);
    report.auditUpdatedAtMayAdvance = recovery.planUpdateAttempted;
    report.restorationPending = recovery.restorationRequired;
    report.success = report.success && report.restored;
    report.completedAt = new Date().toISOString(); fs.writeFileSync(output, JSON.stringify(report, null, 2) + "\n");
    if (lock !== undefined) { fs.closeSync(lock); fs.unlinkSync(lockPath); }
    console.log(JSON.stringify({ success: report.success, routes: report.routes.length, failed: report.routes.filter(row => !row.passed).map(row => row.route), financesUnchanged: report.financesUnchanged,
      restored: report.restored, restorationPending: report.restorationPending, failure: report.failure, output }));
    if (!report.success) process.exitCode = 1;
  }
}
module.exports = { EXPECTED_ORG, EXPECTED_RUN, verifyManifest, limited, businessRow, cas, restore, isEligibleEdit };
if (require.main === module) main().catch(error => { console.error(/^[A-Z0-9_]+$/.test(error.message ?? "") ? error.message : "QA_HTTP_PREPARATION_FAILED"); process.exitCode = 1; });
