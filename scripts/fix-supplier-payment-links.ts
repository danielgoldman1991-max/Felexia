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

function scorePayment(payment: Record<string, unknown>, invoice: Record<string, unknown>) {
  let score = 0;
  const invoiceNumber = String(invoice.supplier_invoice_number ?? invoice.invoice_number ?? "").toLowerCase();
  const paymentText = `${payment.reference ?? ""} ${payment.notes ?? ""} ${payment.payment_number ?? ""}`.toLowerCase();
  const paymentAmount = amount(payment.amount);
  const paidAmount = amount(invoice.paid_amount);
  const totalTtc = amount(invoice.total_ttc);

  if (invoiceNumber && paymentText.includes(invoiceNumber)) score += 70;
  if (paidAmount > 0 && Math.abs(paymentAmount - paidAmount) <= 0.01) score += 35;
  else if (totalTtc > 0 && Math.abs(paymentAmount - totalTtc) <= 0.01) score += 30;

  const invoiceTime = invoice.invoice_date ? new Date(String(invoice.invoice_date)).getTime() : NaN;
  const paymentTime = payment.payment_date ? new Date(String(payment.payment_date)).getTime() : NaN;
  if (Number.isFinite(invoiceTime) && Number.isFinite(paymentTime)) {
    const days = (paymentTime - invoiceTime) / 86400000;
    if (days >= 0 && days <= 90) score += 15;
  }

  return score;
}

async function main() {
  const { data: invoices, error: invoiceError } = await supabase
    .from("supplier_invoices")
    .select("id, organization_id, supplier_id, invoice_number, supplier_invoice_number, invoice_date, total_ttc, paid_amount, payment_status, status")
    .in("payment_status", ["paid", "partial"])
    .is("archived_at", null)
    .limit(500);

  if (invoiceError) throw invoiceError;

  let inspected = 0;
  let candidates = 0;
  let fixed = 0;

  for (const invoice of invoices ?? []) {
    inspected++;
    const { data: allocations } = await supabase
      .from("supplier_payment_allocations")
      .select("id")
      .eq("organization_id", invoice.organization_id)
      .eq("invoice_id", invoice.id)
      .is("cancelled_at", null)
      .limit(1);

    if ((allocations?.length ?? 0) > 0) continue;

    const { data: payments } = await supabase
      .from("supplier_payments")
      .select("id, organization_id, supplier_id, payment_number, payment_date, amount, allocated_amount, available_amount, status, reference, notes")
      .eq("organization_id", invoice.organization_id)
      .eq("supplier_id", invoice.supplier_id)
      .in("status", ["confirmed", "partially_allocated", "allocated"])
      .is("archived_at", null)
      .limit(100);

    const best = (payments ?? [])
      .map((payment) => ({ payment, score: scorePayment(payment as Record<string, unknown>, invoice as Record<string, unknown>) }))
      .sort((a, b) => b.score - a.score)[0];

    if (!best || best.score < 45) continue;

    candidates++;
    console.log(`[candidate] invoice=${invoice.invoice_number} supplier_ref=${invoice.supplier_invoice_number ?? "-"} payment=${best.payment.payment_number} score=${best.score} amount=${best.payment.amount}`);

    if (!applyFix) continue;

    const allocationAmount = Math.min(amount(invoice.paid_amount) || amount(invoice.total_ttc), amount(best.payment.amount));
    const { error: insertError } = await supabase.from("supplier_payment_allocations").insert({
      organization_id: invoice.organization_id,
      payment_id: best.payment.id,
      invoice_id: invoice.id,
      supplier_id: invoice.supplier_id,
      allocation_date: best.payment.payment_date,
      amount: allocationAmount,
      notes: "Réparation automatique de liaison paiement/facture fournisseur",
    });

    if (insertError) {
      console.error(`[error] allocation failed invoice=${invoice.id}: ${insertError.message}`);
      continue;
    }

    await supabase
      .from("supplier_payments")
      .update({
        allocated_amount: allocationAmount,
        available_amount: Math.max(amount(best.payment.amount) - allocationAmount, 0),
        status: amount(best.payment.amount) - allocationAmount <= 0.01 ? "allocated" : "partially_allocated",
      })
      .eq("id", best.payment.id)
      .eq("organization_id", invoice.organization_id);

    await supabase
      .from("treasury_transactions")
      .update({ supplier_invoice_id: invoice.id })
      .eq("organization_id", invoice.organization_id)
      .eq("supplier_payment_id", best.payment.id)
      .is("archived_at", null);

    fixed++;
  }

  console.log(`Résumé: ${inspected} factures inspectées, ${candidates} correspondances probables, ${fixed} liaisons appliquées.`);
  if (!applyFix) console.log("Mode rapport uniquement. Relancez avec APPLY_FIX=true pour appliquer les corrections.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
