/* Réparation d'intégrité TVA — module Vente.
 * DRY RUN par défaut : seul le rapport est généré (statuts AUTO_FIXED /
 * MANUAL_REVIEW / UNCHANGED). Applique uniquement avec APPLY_FIX=true
 * (ou argument --apply).
 * AUTO_FIX (non ambigu) : ligne de document VENTE brouillon sans tax_rate_id
 * dont le produit porte un taux global -> restaurer tax_rate_id/tax_rate,
 * recalculer tax_amount/total_ttc de la ligne puis les totaux du document.
 * MANUAL_REVIEW : produits actifs sans taux, factures/avoirs payés ou
 * validés, lignes sans produit ou sans taux produit.
 * Sortie : database-checks/fix-sales-vat-<timestamp>.json
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

type Row = Record<string, unknown>;

const APPLY_FIX = process.env.APPLY_FIX === "true" || process.argv.includes("--apply");

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
  console.log(APPLY_FIX ? "=== FIX TVA VENTES (APPLIQUÉ) ===" : "=== FIX TVA VENTES (DRY RUN — utilisez APPLY_FIX=true ou --apply) ===");

  const { rows: globalRates } = await fetchAll(
    supabase.from("tax_rates").select("id, code, rate").is("organization_id", null).eq("is_system", true),
  );
  const globalRateById = new Map(globalRates.map((r) => [String(r.id), r]));
  if (globalRates.length === 0) {
    console.log("Aucun taux global : exécutez d'abord la migration 20260811120000_tax_rates_global_access_fix.sql.");
  }

  const autoFixed: Row[] = [];
  const manualReview: Row[] = [];
  const unchanged: Row[] = [];

  const { rows: products } = await fetchAll(
    supabase.from("products").select("id, organization_id, sku, name, status, tax_rate_id"),
  );
  const productById = new Map(products.map((p) => [String(p.id), p]));

  const { rows: lines } = await fetchAll(
    supabase.from("sales_document_lines").select("id, document_id, product_id, tax_rate_id, tax_rate, subtotal_ht, tax_amount, total_ttc"),
  );
  const { rows: docs } = await fetchAll(
    supabase.from("sales_documents").select("id, organization_id, document_number, document_type, status, subtotal_ht, tax_total, total_ttc"),
  );

  const missingTaxLines = lines.filter((l) => !l.tax_rate_id);
  const docsById = new Map(docs.map((d) => [String(d.id), d]));

  for (const line of missingTaxLines) {
    const doc = docsById.get(String(line.document_id));
    const product = line.product_id ? productById.get(String(line.product_id)) : undefined;
    const docStatus = String(doc?.status ?? "");
    const docType = String(doc?.document_type ?? "");
    const draftDoc = ["draft"].includes(docStatus) && ["quote", "order", "delivery_note", "return_note"].includes(docType);
    const productGlobalRateId = draftDoc && product?.tax_rate_id ? globalRateById.get(String(product.tax_rate_id)) : undefined;

    if (productGlobalRateId) {
      const tax = globalRateById.get(String(product!.tax_rate_id));
      const subtotalHt = Number(line.subtotal_ht ?? 0);
      const taxAmount = round2((subtotalHt * Number(tax!.rate)) / 100);
      const totalTtc = round2(subtotalHt + taxAmount);
      if (APPLY_FIX) {
        await supabase
          .from("sales_document_lines")
          .update({ tax_rate_id: product!.tax_rate_id, tax_rate: Number(tax!.rate), tax_amount: taxAmount, total_ttc: totalTtc })
          .eq("id", line.id);
      }
      autoFixed.push({
        line_id: line.id,
        document_number: doc?.document_number,
        document_type: docType,
        status: docStatus,
        organization_id: doc?.organization_id,
        product_sku: product?.sku,
        restored_tax_rate_id: product!.tax_rate_id,
        restored_tax_rate: Number(tax!.rate),
        tax_amount: taxAmount,
        total_ttc: totalTtc,
      });
    } else {
      manualReview.push({
        line_id: line.id,
        document_number: doc?.document_number,
        document_type: docType,
        status: docStatus,
        organization_id: doc?.organization_id,
        product_sku: product?.sku ?? null,
        product_tax_rate_id: product?.tax_rate_id ?? null,
        reason: !draftDoc ? "document non brouillon" : product ? "produit sans taux global" : "ligne sans produit",
      });
    }
  }

  for (const product of products) {
    if (product.status === "active" && !product.tax_rate_id) {
      manualReview.push({
        product_id: product.id,
        organization_id: product.organization_id,
        sku: product.sku,
        name: product.name,
        reason: "produit actif sans taux de TVA",
      });
    }
  }

  for (const line of lines) {
    if (line.tax_rate_id) unchanged.push({ line_id: line.id });
  }

  if (APPLY_FIX && autoFixed.length > 0) {
    const touchedDocIds = Array.from(new Set(missingTaxLines.filter((l) => autoFixed.some((f) => f.line_id === l.id)).map((l) => String(l.document_id))));
    for (const docId of touchedDocIds) {
      const docLines = lines.filter((l) => String(l.document_id) === docId);
      const sums = { tax: 0, ttc: 0, ht: 0 };
      for (const l of docLines) {
        const fixed = autoFixed.find((f) => f.line_id === l.id);
        const taxAmount = fixed ? Number(fixed.tax_amount) : Number(l.tax_amount ?? 0);
        const totalTtc = fixed ? Number(fixed.total_ttc) : Number(l.total_ttc ?? 0);
        sums.tax = round2(sums.tax + taxAmount);
        sums.ttc = round2(sums.ttc + totalTtc);
        sums.ht = round2(sums.ht + Number(l.subtotal_ht ?? 0));
      }
      await supabase
        .from("sales_documents")
        .update({ subtotal_ht: sums.ht, tax_total: sums.tax, total_ttc: sums.ttc })
        .eq("id", docId);
    }
  }

  const report = {
    generated_at: new Date().toISOString(),
    mode: APPLY_FIX ? "applied" : "dry-run",
    stats: {
      AUTO_FIXED: autoFixed.length,
      MANUAL_REVIEW: manualReview.length,
      UNCHANGED: unchanged.length,
    },
    auto_fixed: autoFixed,
    manual_review: manualReview,
  };

  const outDir = resolve(process.cwd(), "database-checks");
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outPath = resolve(outDir, `fix-sales-vat-${stamp}.json`);
  if (!existsSync(outDir)) writeFileSync(outDir, "", { flag: "a" });
  writeFileSync(outPath, JSON.stringify(report, null, 2), "utf8");

  console.log(JSON.stringify(report.stats, null, 2));
  console.log("Rapport :", outPath);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
