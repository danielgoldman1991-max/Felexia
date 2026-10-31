"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireWritableSubscription } from "@/lib/auth/require-subscription";
import { isAdminRole } from "@/lib/auth/roles";
import { financialErrorMessage } from "@/lib/financial-errors";
import { ensureAccountingBaseSetup, getAccountByNumber, getAccountingSettings, getJournalByCode } from "@/lib/accounting";
import { getSupplierCreditNoteDetail } from "@/lib/supplier-credit-notes";
import type { SupplierCreditNoteActionResult } from "@/lib/supplier-credit-note-types";

const text = (form: FormData, key: string) => String(form.get(key) ?? "").trim();
function creditError(error: unknown): string {
  const value = error && typeof error === "object" ? error as { message?: string; code?: string } : {};
  const message = value.message ?? "";
  if (message.includes("SUPPLIER_CREDIT_REFERENCE_REQUIRED")) return "Renseignez la référence figurant sur l’avoir du fournisseur.";
  if (message.includes("SUPPLIER_CREDIT_REFERENCE_EXISTS") || value.code === "23505") return "Un avoir avec cette référence existe déjà pour ce fournisseur.";
  if (message.includes("CREDIT_HAS_APPLICATIONS")) return "Retirez d’abord les affectations de cet avoir avant de l’annuler.";
  if (message.includes("CREDIT_NOTE_POSTED_READ_ONLY")) return "Cet avoir est comptabilisé. Son annulation et ses montants sont verrouillés pour préserver le journal.";
  if (message.includes("CREDIT_NOTE_VALIDATED_READ_ONLY") || message.includes("CREDIT_DRAFT_REQUIRED")) return "Seul un avoir brouillon peut être modifié.";
  if (message.includes("CREDIT_INVOICE_BALANCE_EXCEEDED") || message.includes("SUPPLIER_INVOICE_BALANCE_EXCEEDED")) return "L’affectation dépasse le montant restant à payer sur la facture.";
  if (message.includes("CREDIT_INSUFFICIENT_AVAILABLE")) return "Le montant à affecter dépasse le solde disponible de cet avoir.";
  if (message.includes("CREDIT_INVALID_LINES") || message.includes("CREDIT_INVALID_TOTAL")) return "Vérifiez les lignes de l’avoir : description, quantité, prix, remise et TVA.";
  if (message.includes("CREDIT_INVALID_") || message.includes("CREDIT_NOTE_TENANT_MISMATCH")) return "Sélectionnez un fournisseur et des documents valides appartenant à votre entreprise.";
  if (message.includes("CREDIT_WRITE_REQUIRED")) return "Votre profil ne permet pas de modifier cet avoir.";
  if (message.includes("CREDIT_NOT_AVAILABLE")) return "Validez cet avoir et vérifiez son solde disponible avant de l’affecter.";
  if (message.startsWith("Votre espace est en consultation")) return message;
  return financialErrorMessage(value);
}
function refresh(id?: string) {
  for (const path of ["/achats/avoirs", "/achats/factures", "/dashboard", "/comptabilite/journaux", "/comptabilite/ecritures"]) revalidatePath(path);
  if (id) revalidatePath(`/achats/avoirs/${id}`);
}
async function save(form: FormData, editing: boolean): Promise<SupplierCreditNoteActionResult & { savedId?: string }> {
  try {
    const workspace = await requireWritableSubscription(); const db = await createClient();
    const id = editing ? text(form, "id") : null;
    if (editing && !id) return { success: false, error: "Avoir introuvable." };
    if (!text(form, "supplier_id")) return { success: false, error: "Sélectionnez un fournisseur." };
    if (!text(form, "supplier_credit_note_number")) return { success: false, error: "Renseignez la référence figurant sur l’avoir du fournisseur." };
    let lines: unknown;
    try { lines = JSON.parse(text(form, "lines") || "[]"); } catch { return { success: false, error: "Vérifiez les lignes de l’avoir." }; }
    if (!Array.isArray(lines) || lines.length === 0 || lines.length > 500) return { success: false, error: "Ajoutez entre une et 500 lignes à l’avoir." };
    const { data, error } = await db.rpc("save_supplier_credit_note_atomic", {
      p_organization_id: workspace.organization.id, p_credit_note_id: id,
      p_header: { supplier_id: text(form, "supplier_id"), supplier_credit_note_number: text(form, "supplier_credit_note_number"), source_invoice_id: text(form, "source_invoice_id") || null, credit_note_date: text(form, "credit_note_date") || new Date().toISOString().slice(0, 10), reason: text(form, "reason") || null, notes: text(form, "notes") || null, internal_notes: text(form, "internal_notes") || null },
      p_lines: lines,
    });
    if (error || !data) return { success: false, error: creditError(error) };
    return { success: true, savedId: String(data) };
  } catch (error) { return { success: false, error: creditError(error) }; }
}
export async function createSupplierCreditNote(_prev: SupplierCreditNoteActionResult, form: FormData): Promise<SupplierCreditNoteActionResult> {
  const result = await save(form, false); if (!result.success || !result.savedId) return result;
  refresh(result.savedId); redirect(`/achats/avoirs/${result.savedId}`);
}
export async function updateSupplierCreditNote(_prev: SupplierCreditNoteActionResult, form: FormData): Promise<SupplierCreditNoteActionResult> {
  const result = await save(form, true); if (!result.success || !result.savedId) return result;
  refresh(result.savedId); redirect(`/achats/avoirs/${result.savedId}`);
}
export async function validateSupplierCreditNote(_prev: SupplierCreditNoteActionResult, form: FormData): Promise<SupplierCreditNoteActionResult> {
  try {
    const workspace = await requireWritableSubscription(); const db = await createClient(); const id = text(form, "id");
    const { data: note, error: readError } = await db.from("supplier_credit_notes").select("id,total_ttc,status").eq("organization_id", workspace.organization.id).eq("id", id).maybeSingle();
    if (readError || !note) return { success: false, error: "Avoir introuvable." };
    if (note.status !== "draft") return { success: false, error: "Seul un avoir brouillon peut être validé." };
    const { error } = await db.from("supplier_credit_notes").update({ status: "validated", validated_at: new Date().toISOString(), available_amount: Number(note.total_ttc) }).eq("organization_id", workspace.organization.id).eq("id", id).eq("status", "draft");
    if (error) return { success: false, error: creditError(error) };
    refresh(id); return { success: true };
  } catch (error) { return { success: false, error: creditError(error) }; }
}
export async function cancelSupplierCreditNote(_prev: SupplierCreditNoteActionResult, form: FormData): Promise<SupplierCreditNoteActionResult> {
  try {
    const workspace = await requireWritableSubscription(); const db = await createClient(); const id = text(form, "id");
    const { data: note, error: readError } = await db.from("supplier_credit_notes").select("id,status,applied_amount").eq("organization_id", workspace.organization.id).eq("id", id).maybeSingle();
    if (readError || !note) return { success: false, error: "Avoir introuvable." };
    if (note.status === "cancelled") return { success: true };
    if (Number(note.applied_amount) > 0) return { success: false, error: "Retirez d’abord les affectations de l’avoir avant de l’annuler." };
    const { error } = await db.from("supplier_credit_notes").update({ status: "cancelled", cancelled_at: new Date().toISOString(), available_amount: 0 }).eq("organization_id", workspace.organization.id).eq("id", id);
    if (error) return { success: false, error: creditError(error) };
    refresh(id); return { success: true };
  } catch (error) { return { success: false, error: creditError(error) }; }
}
export async function applySupplierCreditNote(_prev: SupplierCreditNoteActionResult, form: FormData): Promise<SupplierCreditNoteActionResult> {
  try {
    const workspace = await requireWritableSubscription(); const db = await createClient(); const id = text(form, "id");
    const applications: unknown = JSON.parse(text(form, "applications") || "[]");
    if (!Array.isArray(applications) || applications.length === 0) return { success: false, error: "Indiquez une facture et le montant à affecter." };
    const { error } = await db.rpc("apply_supplier_credit_note_atomic", { p_organization_id: workspace.organization.id, p_credit_note_id: id, p_applications: applications });
    if (error) return { success: false, error: creditError(error) };
    refresh(id); return { success: true };
  } catch (error) { return { success: false, error: creditError(error) }; }
}
export async function unapplySupplierCreditNote(_prev: SupplierCreditNoteActionResult, form: FormData): Promise<SupplierCreditNoteActionResult> {
  try {
    const workspace = await requireWritableSubscription(); const db = await createClient();
    const { data, error } = await db.rpc("unapply_supplier_credit_note_atomic", { p_organization_id: workspace.organization.id, p_application_id: text(form, "application_id") });
    if (error) return { success: false, error: creditError(error) };
    refresh(data ? String(data) : undefined); return { success: true };
  } catch (error) { return { success: false, error: creditError(error) }; }
}
export async function postSupplierCreditNoteToAccounting(_prev: SupplierCreditNoteActionResult, form: FormData): Promise<SupplierCreditNoteActionResult> {
  try {
    const workspace = await requireWritableSubscription();
    if (!isAdminRole(workspace.role)) return { success: false, error: "La comptabilisation est réservée à l’administrateur." };
    const id = text(form, "id"); const detail = await getSupplierCreditNoteDetail(id); const note = detail.creditNote;
    if (!note || ["draft", "cancelled"].includes(note.status)) return { success: false, error: "Validez l’avoir avant de le comptabiliser." };
    if (detail.accountingEntry?.entry) return { success: true, data: { entry_id: String(detail.accountingEntry.entry.id), entry_number: String(detail.accountingEntry.entry.entry_number) } };
    await ensureAccountingBaseSetup(workspace.organization.id);
    const org = workspace.organization.id; const settings = await getAccountingSettings(org);
    const [journal, supplier, purchases, services, vat] = await Promise.all([
      getJournalByCode(org, "AC"), getAccountByNumber(org, String(settings?.default_supplier_account_code ?? "4411")),
      getAccountByNumber(org, String(settings?.default_purchase_account_code ?? "6111")), getAccountByNumber(org, "6122"),
      getAccountByNumber(org, String(settings?.default_purchase_vat_account_code ?? "3455")),
    ]);
    const effectiveVat = vat ?? await getAccountByNumber(org, "3455");
    if (!journal || !supplier || !purchases || !services || (!effectiveVat && note.tax_total > 0)) return { success: false, error: "Vérifiez les comptes fournisseur, achats et TVA ainsi que le journal AC avant de comptabiliser." };
    const amounts = new Map<string, number>();
    for (const line of detail.lines) { const account = line.product_id ? purchases : services; amounts.set(account.id, (amounts.get(account.id) ?? 0) + line.subtotal_ht); }
    const lines = [{ account_id: supplier.id, debit: note.total_ttc, credit: 0, label: `Avoir fournisseur ${note.credit_note_number}` }, ...[...amounts].filter(([, amount]) => amount > 0).map(([account_id, amount]) => ({ account_id, debit: 0, credit: Math.round((amount + Number.EPSILON) * 100) / 100, label: note.reason ?? "Correction achats" }))];
    if (note.tax_total > 0 && effectiveVat) lines.push({ account_id: effectiveVat.id, debit: 0, credit: note.tax_total, label: "TVA récupérable sur avoir fournisseur" });
    const db = await createClient(); const { data, error } = await db.rpc("save_accounting_entry_atomic", {
      p_organization_id: org, p_entry_id: null,
      p_header: { journal_id: journal.id, entry_date: note.credit_note_date, status: "posted", label: `Avoir fournisseur ${note.credit_note_number} · ${note.supplier_name ?? "Fournisseur"}`, source_module: "purchases", source_document_type: "supplier_credit_note", source_document_id: note.id, source_number: note.credit_note_number },
      p_lines: lines,
    });
    if (error) return { success: false, error: creditError(error) };
    const entry = Array.isArray(data) ? data[0] : data; refresh(note.id);
    return { success: true, data: { entry_id: entry?.entry_id, entry_number: entry?.entry_number } };
  } catch (error) { return { success: false, error: creditError(error) }; }
}
