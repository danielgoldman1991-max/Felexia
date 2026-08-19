/* Audit d'intégrité TVA — module Vente (lecture seule, dry-run).
 * Analyse : produits sans taux, lignes de documents sans taux,
 * conversions ayant perdu la TVA, incohérences HT/TVA/TTC.
 * Sortie : database-checks/audit-sales-vat-<timestamp>.json
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

type Row = Record<string, unknown>;

function loadLocalEnv() {
  const envPath = resolve(process.cwd(), ".env.local");
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index <= 0) continue;
    process.env[trimmed.slice(0, index)] = trimmed.slice(index + 1);
  }
}

loadLocalEnv();
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY manquants dans .env.local");

const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

function round2(value: number) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

async function fetchAll(builder: { range: (from: number, to: number) => { then(onfulfilled: (value: { data: Row[] | null; error: { message: string } | null }) => unknown): unknown } }): Promise<{ rows: Row[]; error: string | null }> {
  const rows: Row[] = [];
  let from = 0;
  let error: string | null = null;
  for (;;) {
    const { data, error: err } = await builder.range(from, from + 999);
    if (err) { error = err.message; break; }
    rows.push(...(data ?? []));
    if (!data || data.length < 1000) break;
    from += 1000;
  }
  return { rows, error };
}

async function main() {
  const report: { generated_at: string; sections: Record<string, unknown>; totals?: Record<string, number> } = { generated_at: new Date().toISOString(), sections: {} };

  const { rows: globalRates } = await fetchAll(
    supabase.from("tax_rates").select("*").is("organization_id", null),
  );
  report.sections.global_tax_rates = {
    count: globalRates.length,
    rates: globalRates.map((r) => ({
      id: r.id, code: r.code, name: r.name, rate: r.rate,
      is_default: r.is_default, is_system: r.is_system, status: r.status, is_active: r.is_active,
    })),
  };

  const { rows: orgRates } = await fetchAll(
    supabase.from("tax_rates").select("*").not("organization_id", "is", null).is("archived_at", null),
  );
  report.sections.per_org_active_rates = {
    count: orgRates.length,
    rates: orgRates.map((r) => ({ id: r.id, organization_id: r.organization_id, code: r.code, name: r.name, rate: r.rate, is_default: r.is_default })),
  };

  const { rows: products, error: productsError } = await fetchAll(
    supabase.from("products").select("id, organization_id, sku, name, status, tax_rate_id"),
  );
  if (productsError) throw new Error(productsError);

  const productsWithoutTax = products.filter((p) => p.status === "active" && !p.tax_rate_id);
  report.sections.products_active_without_tax = {
    count: productsWithoutTax.length,
    products: productsWithoutTax.map((p) => ({ id: p.id, organization_id: p.organization_id, sku: p.sku, name: p.name })),
  };

  const globalIds = new Set(globalRates.map((r) => String(r.id)));
  const orgRateIds = new Set(orgRates.map((r) => String(r.id)));
  const productsWithLegacyRate = products.filter((p) => p.status === "active" && p.tax_rate_id && !globalIds.has(String(p.tax_rate_id)));
  report.sections.products_active_with_non_global_rate = {
    count: productsWithLegacyRate.length,
    products: productsWithLegacyRate.map((p) => ({ id: p.id, organization_id: p.organization_id, sku: p.sku, name: p.name, tax_rate_id: p.tax_rate_id, in_per_org_active: orgRateIds.has(String(p.tax_rate_id)) })),
  };

  const { rows: salesLines } = await fetchAll(
    supabase.from("sales_document_lines").select("id, document_id, description, tax_rate, tax_rate_id, quantity, unit_price_ht, subtotal_ht, tax_amount, total_ttc, product_id"),
  );
  const { rows: salesDocs } = await fetchAll(
    supabase.from("sales_documents").select("id, organization_id, document_number, document_type, status, subtotal_ht, tax_total, total_ttc"),
  );
  const docsById = new Map(salesDocs.map((d) => [String(d.id), d]));

  const salesLinesWithoutTax = salesLines.filter((l) => !l.tax_rate_id);
  report.sections.sales_document_lines_without_tax = {
    count: salesLinesWithoutTax.length,
    lines: salesLinesWithoutTax.map((l) => {
      const doc = docsById.get(String(l.document_id));
      return {
        id: l.id, document_id: l.document_id,
        document_number: doc?.document_number, document_type: doc?.document_type, status: doc?.status,
        organization_id: doc?.organization_id,
        description: String(l.description ?? "").slice(0, 80),
        tax_rate: l.tax_rate, subtotal_ht: l.subtotal_ht, total_ttc: l.total_ttc,
      };
    }),
  };

  const { rows: invoiceLines } = await fetchAll(
    supabase.from("customer_invoice_lines").select("id, invoice_id, description, tax_rate, tax_rate_id, subtotal_ht, tax_amount, total_ttc, product_id"),
  );
  const { rows: invoices } = await fetchAll(
    supabase.from("customer_invoices").select("id, organization_id, invoice_number, status, tax_total, total_ttc"),
  );
  const invoicesById = new Map(invoices.map((d) => [String(d.id), d]));
  const invoiceLinesWithoutTax = invoiceLines.filter((l) => !l.tax_rate_id);
  report.sections.customer_invoice_lines_without_tax = {
    count: invoiceLinesWithoutTax.length,
    lines: invoiceLinesWithoutTax.map((l) => {
      const inv = invoicesById.get(String(l.invoice_id));
      return {
        id: l.id, invoice_id: l.invoice_id, invoice_number: inv?.invoice_number, status: inv?.status,
        organization_id: inv?.organization_id, description: String(l.description ?? "").slice(0, 80),
        tax_rate: l.tax_rate, subtotal_ht: l.subtotal_ht, total_ttc: l.total_ttc,
      };
    }),
  };

  const { rows: creditNoteLines } = await fetchAll(
    supabase.from("customer_credit_note_lines").select("id, credit_note_id, description, tax_rate, tax_rate_id, subtotal_ht, tax_amount, total_ttc"),
  );
  const creditNoteLinesWithoutTax = creditNoteLines.filter((l) => !l.tax_rate_id);
  report.sections.customer_credit_note_lines_without_tax = {
    count: creditNoteLinesWithoutTax.length,
    lines: creditNoteLinesWithoutTax.map((l) => ({ id: l.id, credit_note_id: l.credit_note_id, description: String(l.description ?? "").slice(0, 80), tax_rate: l.tax_rate })),
  };

  const productById = new Map(products.map((p) => [String(p.id), p]));
  const taxableProductIds = new Set(products.filter((p) => p.tax_rate_id && globalIds.has(String(p.tax_rate_id))).map((p) => String(p.id)));
  const conversionLoss = salesLinesWithoutTax.filter((l) => l.product_id && taxableProductIds.has(String(l.product_id)));
  report.sections.conversion_vat_loss = {
    count: conversionLoss.length,
    lines: conversionLoss.map((l) => {
      const doc = docsById.get(String(l.document_id));
      const product = productById.get(String(l.product_id));
      return {
        id: l.id, document_id: l.document_id, document_number: doc?.document_number, document_type: doc?.document_type, status: doc?.status,
        product_sku: product?.sku, product_name: product?.name, product_tax_rate_id: product?.tax_rate_id,
      };
    }),
  };

  const lineTotalsByDoc = new Map<string, { tax: number; ttc: number }>();
  for (const line of salesLines) {
    const key = String(line.document_id);
    const acc = lineTotalsByDoc.get(key) ?? { tax: 0, ttc: 0 };
    acc.tax = round2(acc.tax + Number(line.tax_amount ?? 0));
    acc.ttc = round2(acc.ttc + Number(line.total_ttc ?? 0));
    lineTotalsByDoc.set(key, acc);
  }
  const docMismatches = salesDocs
    .map((doc) => {
      const sums = lineTotalsByDoc.get(String(doc.id)) ?? { tax: 0, ttc: 0 };
      return {
        id: doc.id, organization_id: doc.organization_id, document_number: doc.document_number,
        document_type: doc.document_type, status: doc.status,
        stored_tax_total: doc.tax_total, lines_tax_total: sums.tax,
        stored_total_ttc: doc.total_ttc, lines_total_ttc: sums.ttc,
        tax_diff: Math.abs(Number(doc.tax_total ?? 0) - sums.tax),
        ttc_diff: Math.abs(Number(doc.total_ttc ?? 0) - sums.ttc),
      };
    })
    .filter((d) => d.tax_diff > 0.01 || d.ttc_diff > 0.01);
  report.sections.document_totals_mismatch = { count: docMismatches.length, documents: docMismatches };

  const totals = {
    global_rates: globalRates.length,
    per_org_active_rates: orgRates.length,
    products_scanned: products.length,
    products_active_without_tax: productsWithoutTax.length,
    products_active_with_non_global_rate: productsWithLegacyRate.length,
    sales_lines_without_tax: salesLinesWithoutTax.length,
    invoice_lines_without_tax: invoiceLinesWithoutTax.length,
    credit_note_lines_without_tax: creditNoteLinesWithoutTax.length,
    conversion_vat_loss: conversionLoss.length,
    document_totals_mismatch: docMismatches.length,
  };
  report.totals = totals;

  const outDir = resolve(process.cwd(), "database-checks");
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outPath = resolve(outDir, `audit-sales-vat-${stamp}.json`);
  if (!existsSync(outDir)) writeFileSync(outDir, "", { flag: "a" });
  writeFileSync(outPath, JSON.stringify(report, null, 2), "utf8");

  console.log("=== AUDIT TVA VENTES ===");
  console.log(JSON.stringify(totals, null, 2));
  console.log("Rapport :", outPath);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
