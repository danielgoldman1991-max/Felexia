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

const countedStatuses = new Set(["confirmed", "partially_allocated", "allocated", "validated", "paid", "completed", "posted", "reconciled", "active"]);

function money(value: unknown) {
  return Math.round((Number(value ?? 0) || 0) * 100) / 100;
}

function paymentStatusFor(totalTtc: number, paidAmount: number) {
  if (paidAmount <= 0.01) return "unpaid";
  if (paidAmount > totalTtc + 0.01) return "paid";
  if (paidAmount >= totalTtc - 0.01) return "paid";
  return "partial";
}

function documentStatusFor(current: string, paymentStatus: string) {
  if (current === "cancelled" || current === "draft") return current;
  if (paymentStatus === "paid") return "paid";
  if (paymentStatus === "partial") return "partially_paid";
  if (["paid", "partially_paid"].includes(current)) return "validated";
  return current;
}

async function main() {
  const { data: invoices, error } = await supabase
    .from("supplier_invoices")
    .select("id, organization_id, supplier_id, invoice_number, supplier_invoice_number, total_ttc, paid_amount, remaining_amount, payment_status, status")
    .is("archived_at", null)
    .limit(1000);

  if (error) throw error;

  let missingAttachedPayments = 0;
  let overpaid = 0;
  let fixedStatuses = 0;

  for (const invoice of invoices ?? []) {
    const { data: allocations } = await supabase
      .from("supplier_payment_allocations")
      .select("amount, payment:payment_id(id, status, archived_at)")
      .eq("organization_id", invoice.organization_id)
      .eq("invoice_id", invoice.id)
      .is("cancelled_at", null);

    const confirmedPaid = money((allocations ?? []).reduce((sum, allocation) => {
      const payment = Array.isArray(allocation.payment) ? allocation.payment[0] : allocation.payment;
      const status = String(payment?.status ?? "confirmed").toLowerCase();
      if (payment?.archived_at || !countedStatuses.has(status)) return sum;
      return sum + Number(allocation.amount ?? 0);
    }, 0));

    const totalTtc = money(invoice.total_ttc);
    const expectedPaymentStatus = paymentStatusFor(totalTtc, confirmedPaid);
    const expectedRemaining = Math.max(money(totalTtc - confirmedPaid), 0);

    if (["paid", "partial"].includes(String(invoice.payment_status ?? "")) && confirmedPaid <= 0.01) {
      missingAttachedPayments++;
      console.log(`[missing] invoice=${invoice.invoice_number} supplier_ref=${invoice.supplier_invoice_number ?? "-"} stored=${invoice.payment_status}`);

      const { data: candidates } = await supabase
        .from("supplier_payments")
        .select("id, payment_number, supplier_id, reference, amount, payment_date, status")
        .eq("organization_id", invoice.organization_id)
        .eq("supplier_id", invoice.supplier_id)
        .in("status", ["confirmed", "partially_allocated", "allocated"])
        .is("archived_at", null)
        .ilike("reference", `%${invoice.supplier_invoice_number ?? invoice.invoice_number}%`)
        .limit(5);

      const exact = (candidates ?? []).find((payment) => Math.abs(money(payment.amount) - money(invoice.paid_amount || invoice.total_ttc)) <= 0.01);
      if (exact) {
        console.log(`  [exact-candidate] payment=${exact.payment_number} amount=${exact.amount} (liaison non créée par ce script)`);
      }
    }

    if (confirmedPaid > totalTtc + 0.01) {
      overpaid++;
      console.log(`[overpaid] invoice=${invoice.invoice_number} total=${totalTtc} paid=${confirmedPaid}`);
    }

    if (money(invoice.paid_amount) !== confirmedPaid || money(invoice.remaining_amount) !== expectedRemaining || invoice.payment_status !== expectedPaymentStatus) {
      console.log(`[status] invoice=${invoice.invoice_number} stored=${invoice.payment_status}/${invoice.paid_amount} computed=${expectedPaymentStatus}/${confirmedPaid}`);
      if (applyFix) {
        const { error: updateError } = await supabase
          .from("supplier_invoices")
          .update({
            paid_amount: confirmedPaid,
            remaining_amount: expectedRemaining,
            payment_status: expectedPaymentStatus,
            status: documentStatusFor(String(invoice.status), expectedPaymentStatus),
            updated_at: new Date().toISOString(),
          })
          .eq("id", invoice.id)
          .eq("organization_id", invoice.organization_id);
        if (!updateError) fixedStatuses++;
      }
    }
  }

  console.log(`Résumé: ${invoices?.length ?? 0} factures inspectées, ${missingAttachedPayments} payées sans paiement attaché, ${overpaid} surpayées, ${fixedStatuses} statuts recalculés.`);
  if (!applyFix) console.log("Mode rapport uniquement. Relancez avec APPLY_FIX=true pour recalculer uniquement les statuts et montants depuis les paiements attachés.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
