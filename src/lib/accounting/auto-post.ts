import { createClient } from "@/lib/supabase/server";

export type AutoPostKind =
  | "customer_invoice"
  | "supplier_invoice"
  | "customer_credit_note"
  | "supplier_credit_note"
  | "customer_payment"
  | "supplier_payment";

/** Comptabilise après validation seulement si l'entreprise a activé l'option. N'échoue jamais la validation. */
export async function autoPostOnValidation(organizationId: string, kind: AutoPostKind, documentId: string) {
  try {
    const supabase = await createClient();
    const settings = await supabase
      .from("accounting_settings")
      .select("auto_post_on_validation")
      .eq("organization_id", organizationId)
      .maybeSingle();
    if (settings.error) {
      if (settings.error.code !== "42703") console.error("[accounting] auto-post setting", { code: settings.error.code, message: settings.error.message });
      return;
    }
    if (settings.data?.auto_post_on_validation !== true) return;
    const formData = new FormData();
    formData.set("id", documentId);
    const previous = { success: true as const };
    let result: { success: boolean; error?: string } = { success: true };
    if (kind === "customer_invoice" || kind === "supplier_invoice" || kind === "customer_payment" || kind === "supplier_payment") {
      const actions = await import("@/lib/accounting-actions");
      const poster = {
        customer_invoice: actions.postCustomerInvoiceToAccounting,
        supplier_invoice: actions.postSupplierInvoiceToAccounting,
        customer_payment: actions.postCustomerPaymentToAccounting,
        supplier_payment: actions.postSupplierPaymentToAccounting,
      }[kind];
      result = await poster(previous, formData);
    } else if (kind === "customer_credit_note") {
      const { postCustomerCreditNote } = await import("@/lib/credit-note-actions");
      result = await postCustomerCreditNote(previous, formData);
    } else {
      const { postSupplierCreditNoteToAccounting } = await import("@/lib/supplier-credit-note-actions");
      result = await postSupplierCreditNoteToAccounting(previous, formData);
    }
    if (!result.success) console.error("[accounting] auto-post", { kind, documentId, error: result.error });
  } catch (error) {
    console.error("[accounting] auto-post", { kind, documentId, message: error instanceof Error ? error.message : "unknown" });
  }
}
