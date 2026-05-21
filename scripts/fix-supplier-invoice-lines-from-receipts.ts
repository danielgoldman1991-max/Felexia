import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const applyFix = process.env.APPLY_FIX === "true";

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Variables manquantes : NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function amount(value: unknown) {
  return Math.round((Number(value ?? 0) || 0) * 100) / 100;
}

function calc(quantity: number, price: number, discountRate: number, taxRate: number) {
  const base = quantity * price;
  const discount = amount(base * (discountRate / 100));
  const subtotal = amount(base - discount);
  const tax = amount(subtotal * (taxRate / 100));
  return { subtotal, discount, tax, total: amount(subtotal + tax) };
}

async function main() {
  const { data: lines, error } = await supabase
    .from("supplier_invoice_lines")
    .select("id, organization_id, invoice_id, source_document_id, source_line_id, product_id, quantity, unit_id, unit_name, unit_price_ht, discount_rate, tax_rate_id, tax_rate")
    .or("unit_price_ht.eq.0,tax_rate.is.null,unit_id.is.null")
    .not("source_document_id", "is", null)
    .limit(1000);

  if (error) throw error;

  let inspected = 0;
  let repairable = 0;
  let fixed = 0;
  const touchedInvoices = new Set<string>();

  for (const line of lines ?? []) {
    inspected++;
    const { data: receiptLine } = line.source_line_id
      ? await supabase
          .from("purchase_document_lines")
          .select("id, source_line_id, unit_id, unit_name, unit_price_ht, discount_rate, tax_rate_id, tax_rate")
          .eq("organization_id", line.organization_id)
          .eq("id", line.source_line_id)
          .maybeSingle()
      : { data: null };

    const { data: orderLine } = receiptLine?.source_line_id
      ? await supabase
          .from("purchase_document_lines")
          .select("id, unit_id, unit_name, unit_price_ht, discount_rate, tax_rate_id, tax_rate")
          .eq("organization_id", line.organization_id)
          .eq("id", receiptLine.source_line_id)
          .maybeSingle()
      : { data: null };

    const { data: product } = line.product_id
      ? await supabase
          .from("products")
          .select("id, unit_id, purchase_price_ht, tax_rate_id, tax_rate:tax_rate_id(rate)")
          .eq("organization_id", line.organization_id)
          .eq("id", line.product_id)
          .maybeSingle()
      : { data: null };

    const productTax = Array.isArray(product?.tax_rate) ? product.tax_rate[0] : product?.tax_rate;
    const unitId = line.unit_id ?? receiptLine?.unit_id ?? orderLine?.unit_id ?? product?.unit_id ?? null;
    const unitName = line.unit_name ?? receiptLine?.unit_name ?? orderLine?.unit_name ?? null;
    const price = amount(line.unit_price_ht) || amount(receiptLine?.unit_price_ht) || amount(orderLine?.unit_price_ht) || amount(product?.purchase_price_ht);
    const discountRate = amount(line.discount_rate) || amount(receiptLine?.discount_rate) || amount(orderLine?.discount_rate);
    const taxRateId = line.tax_rate_id ?? receiptLine?.tax_rate_id ?? orderLine?.tax_rate_id ?? product?.tax_rate_id ?? null;
    const taxRate = amount(line.tax_rate) || amount(receiptLine?.tax_rate) || amount(orderLine?.tax_rate) || amount(productTax?.rate);

    if (!unitId && !unitName && price <= 0 && !taxRateId && taxRate <= 0) continue;

    repairable++;
    console.log(`[repairable] line=${line.id} invoice=${line.invoice_id} price=${line.unit_price_ht}->${price} tax=${line.tax_rate}->${taxRate}`);

    if (!applyFix) continue;

    const totals = calc(amount(line.quantity), price, discountRate, taxRate);
    const { error: updateError } = await supabase
      .from("supplier_invoice_lines")
      .update({
        unit_id: unitId,
        unit_name: unitName,
        unit_price_ht: price,
        discount_rate: discountRate,
        tax_rate_id: taxRateId,
        tax_rate: taxRate,
        subtotal_ht: totals.subtotal,
        discount_amount: totals.discount,
        tax_amount: totals.tax,
        total_ttc: totals.total,
        updated_at: new Date().toISOString(),
      })
      .eq("id", line.id)
      .eq("organization_id", line.organization_id);

    if (!updateError) {
      fixed++;
      touchedInvoices.add(String(line.invoice_id));
    }
  }

  for (const invoiceId of touchedInvoices) {
    const { data: invoiceLines } = await supabase
      .from("supplier_invoice_lines")
      .select("organization_id, subtotal_ht, discount_amount, tax_amount, total_ttc")
      .eq("invoice_id", invoiceId);
    const subtotalHt = amount((invoiceLines ?? []).reduce((sum, line) => sum + Number(line.subtotal_ht ?? 0), 0));
    const discountTotal = amount((invoiceLines ?? []).reduce((sum, line) => sum + Number(line.discount_amount ?? 0), 0));
    const taxTotal = amount((invoiceLines ?? []).reduce((sum, line) => sum + Number(line.tax_amount ?? 0), 0));
    const totalTtc = amount((invoiceLines ?? []).reduce((sum, line) => sum + Number(line.total_ttc ?? 0), 0));
    const organizationId = invoiceLines?.[0]?.organization_id;
    if (!organizationId) continue;
    await supabase
      .from("supplier_invoices")
      .update({ subtotal_ht: subtotalHt, discount_total: discountTotal, tax_total: taxTotal, total_ttc: totalTtc, updated_at: new Date().toISOString() })
      .eq("id", invoiceId)
      .eq("organization_id", organizationId);
  }

  console.log(`Résumé: ${inspected} lignes inspectées, ${repairable} réparables, ${fixed} corrigées, ${touchedInvoices.size} factures recalculées.`);
  if (!applyFix) console.log("Mode rapport uniquement. Relancez avec APPLY_FIX=true pour appliquer les corrections.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
