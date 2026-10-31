"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireActiveWorkspace } from "@/lib/auth";
import { calculateInvoiceLine, calculateInvoiceTotals, getCustomerCreditNoteDetail, getCreditNoteReturnPreparation } from "@/lib/credit-notes";
import { createClient } from "@/lib/supabase/server";
import type { CreditNoteActionResult, CreditNoteLineFormValue } from "@/lib/credit-note-types";
import type { InvoiceLineFormValue } from "@/lib/invoice-types";
import { isAdminRole } from "@/lib/auth/roles";
import { buildCustomerInvoiceLines, getAccountByNumber, getAccountingSettings, getExistingEntryBySource, getJournalByCode } from "@/lib/accounting";
import { financialErrorMessage } from "@/lib/financial-errors";

function text(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? "").trim();
  return value === "" ? null : value;
}

function numberValue(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseLines(formData: FormData): CreditNoteLineFormValue[] {
  try {
    const parsed = JSON.parse(String(formData.get("lines") ?? "[]"));
    if (!Array.isArray(parsed)) return [];
    return parsed.map((raw, index) => {
      const item = raw as Record<string, unknown>;
      return {
        id: typeof item.id === "string" ? item.id : `line-${index}`,
        source_invoice_line_id: typeof item.source_line_id === "string" ? item.source_line_id : typeof item.source_invoice_line_id === "string" ? item.source_invoice_line_id : null,
        source_return_line_id: typeof item.source_return_line_id === "string" ? item.source_return_line_id : typeof item.return_line_id === "string" ? item.return_line_id : null,
        product_id: typeof item.product_id === "string" ? item.product_id : null,
        product_name: typeof item.product_name === "string" ? item.product_name : null,
        description: typeof item.description === "string" ? item.description : "",
        quantity: numberValue(item.quantity),
        unit_id: typeof item.unit_id === "string" ? item.unit_id : null,
        unit_name: typeof item.unit_name === "string" ? item.unit_name : null,
        unit_price_ht: numberValue(item.unit_price_ht),
        discount_rate: numberValue(item.discount_rate),
        tax_rate_id: typeof item.tax_rate_id === "string" ? item.tax_rate_id : null,
        tax_rate: numberValue(item.tax_rate),
      };
    });
  } catch {
    return [];
  }
}

function normalizeLine(line: CreditNoteLineFormValue): InvoiceLineFormValue {
  return calculateInvoiceLine({
    id: line.id,
    mode: line.product_id ? "product" : "free",
    product_id: line.product_id ?? "",
    product_name: line.product_name ?? "",
    description: line.description,
    quantity: line.quantity,
    unit_id: line.unit_id ?? "",
    unit_name: line.unit_name ?? "",
    unit_price_ht: line.unit_price_ht,
    discount_rate: line.discount_rate,
    tax_rate_id: line.tax_rate_id ?? "",
    tax_rate: line.tax_rate,
    subtotal_ht: 0,
    discount_amount: 0,
    tax_amount: 0,
    total_ttc: 0,
  });
}

function creditNoteError(error: { code?: string; message?: string } | null) {
  const message = error?.message || "";
  if (error?.code === "PGRST202" || error?.code === "42883") return "La mise à jour des avoirs doit être activée avant cette opération.";
  if (message.includes("POSTED")) return "Cet avoir est déjà comptabilisé. Une correction nécessite une contrepassation par l’administrateur.";
  if (message.includes("CREDIT_WRITE_REQUIRED")) return "Votre rôle ne permet pas de modifier les avoirs.";
  if (message.includes("DRAFT_REQUIRED") || message.includes("READ_ONLY")) return "Seul un avoir brouillon peut être modifié.";
  if (message.includes("AVAILABLE")) return "Le montant dépasse le disponible de l’avoir. Actualisez puis vérifiez les affectations.";
  if (message.includes("BALANCE_EXCEEDED")) return "Le montant dépasse le reste à régler de la facture.";
  if (message.includes("SUBSCRIPTION")) return "Votre abonnement ne permet pas de nouvelle écriture. Consultez Mon abonnement.";
  return "L’opération n’a pas pu être confirmée. Vérifiez le client, les lignes et les affectations, puis actualisez.";
}

async function saveCreditNote(formData: FormData, id: string | null): Promise<{ id?: string; error?: string }> {
  const workspace = await requireActiveWorkspace();
  const rawLines = parseLines(formData);
  if (!text(formData, "customer_id")) return { error: "Sélectionnez un client." };
  if (rawLines.length < 1 || rawLines.length > 500) return { error: "Ajoutez entre 1 et 500 lignes." };
  const lines = rawLines.map(normalizeLine);
  if (lines.some((line) => !line.description.trim() || line.quantity <= 0 || line.unit_price_ht < 0 || line.discount_rate < 0 || line.discount_rate > 100 || line.tax_rate < 0 || line.tax_rate > 100)) return { error: "Vérifiez les quantités, prix et taux des lignes." };
  if (calculateInvoiceTotals(lines).total_ttc <= 0) return { error: "Le total de l’avoir doit être supérieur à zéro." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("save_customer_credit_note_atomic", {
    p_organization_id: workspace.organization.id, p_credit_note_id: id,
    p_header: Object.fromEntries(["customer_id","source_invoice_id","source_return_id","source_type","credit_note_date","reason","notes","internal_notes"].map((key) => [key,text(formData,key)])),
    p_lines: lines.map((line,index) => ({...line,source_invoice_line_id:rawLines[index].source_invoice_line_id || null})),
  });
  if (error || !data) return { error: creditNoteError(error) };
  revalidatePath("/facturation/avoirs");
  return { id: String(data) };
}

export async function createCustomerCreditNote(prev: CreditNoteActionResult, formData: FormData): Promise<CreditNoteActionResult> {
  void prev;
  const result = await saveCreditNote(formData,null);
  if (result.error || !result.id) return { success: false, error: result.error || "Création non confirmée." };
  redirect("/facturation/avoirs/"+result.id);
}

export async function updateCustomerCreditNote(prev: CreditNoteActionResult, formData: FormData): Promise<CreditNoteActionResult> {
  void prev;
  const id=text(formData,"id");
  if (!id) return { success:false,error:"Avoir introuvable." };
  const result=await saveCreditNote(formData,id);
  if(result.error) return {success:false,error:result.error};
  revalidatePath("/facturation/avoirs/"+id);
  redirect("/facturation/avoirs/"+id);
}

export const createCreditNoteFromInvoice = createCustomerCreditNote;

export async function createCreditNoteFromReturn(prev: CreditNoteActionResult, formData: FormData): Promise<CreditNoteActionResult> {
  const returnId=text(formData,"source_return_id") || text(formData,"return_id");
  if(!returnId)return {success:false,error:"Bon de retour introuvable."};
  const preparation=await getCreditNoteReturnPreparation(returnId);
  if(!preparation.returnDocument || preparation.returnDocument.status!=="validated") return {success:false,error:"Validez le bon de retour avant de créer l’avoir."};
  formData.set("customer_id",preparation.returnDocument.customer_id);formData.set("source_type","return");formData.set("source_return_id",returnId);
  if(preparation.relatedInvoice?.id)formData.set("source_invoice_id",preparation.relatedInvoice.id);
  if(!text(formData,"reason"))formData.set("reason",preparation.returnDocument.return_reason || "Avoir suite retour client");
  return createCustomerCreditNote(prev,formData);
}

export async function validateCustomerCreditNote(prev: CreditNoteActionResult, formData: FormData): Promise<CreditNoteActionResult> {
  void prev;
  const workspace = await requireActiveWorkspace();
  const id = text(formData, "id");
  if (!id) return { success: false, error: "Avoir introuvable." };
  const supabase = await createClient();
  const { data: note } = await supabase.from("customer_credit_notes").select("id, status, total_ttc, source_return_id").eq("organization_id", workspace.organization.id).eq("id", id).maybeSingle();
  if (!note) return { success: false, error: "Avoir introuvable." };
  if (note.status !== "draft") return { success: false, error: "Seul un avoir brouillon peut etre valide." };
  if (Number(note.total_ttc ?? 0) <= 0) return { success: false, error: "Le total de l'avoir doit etre superieur a zero." };
  if (note.source_return_id) {
    const { data: returnDocument, error: returnError } = await supabase
      .from("sales_documents")
      .select("id, document_type, status")
      .eq("organization_id", workspace.organization.id)
      .eq("id", note.source_return_id)
      .maybeSingle();
    if (returnError) return { success: false, error: returnError.message };
    if (!returnDocument || returnDocument.document_type !== "return_note" || returnDocument.status !== "validated") {
      return { success: false, error: "Validez d'abord le bon de retour avant de valider cet avoir." };
    }
  }
  const { error } = await supabase.from("customer_credit_notes").update({ status: "validated", validated_at: new Date().toISOString(), available_amount: Number(note.total_ttc ?? 0) }).eq("organization_id", workspace.organization.id).eq("id", id);
  if (error) return { success: false, error: creditNoteError(error) };
  revalidatePath(`/facturation/avoirs/${id}`);
  return { success: true };
}

export async function cancelCustomerCreditNote(prev: CreditNoteActionResult, formData: FormData): Promise<CreditNoteActionResult> {
  void prev;
  const workspace = await requireActiveWorkspace();
  const id = text(formData, "id");
  if (!id) return { success: false, error: "Avoir introuvable." };
  const { creditNote, applications } = await getCustomerCreditNoteDetail(id);
  if (!creditNote) return { success: false, error: "Avoir introuvable." };
  if (applications.length > 0) return { success: false, error: "Retirez les affectations avant d'annuler l'avoir." };
  const supabase = await createClient();
  const { error } = await supabase.from("customer_credit_notes").update({ status: "cancelled", cancelled_at: new Date().toISOString(), available_amount: 0 }).eq("organization_id", workspace.organization.id).eq("id", id);
  if (error) return { success: false, error: creditNoteError(error) };
  revalidatePath(`/facturation/avoirs/${id}`);
  return { success: true };
}

function parseApplications(formData: FormData) {
  try {
    const parsed = JSON.parse(String(formData.get("applications") ?? "[]"));
    if (!Array.isArray(parsed)) return [];
    return parsed.map((item) => item as Record<string, unknown>).map((item) => ({ invoice_id: String(item.invoice_id ?? ""), amount: numberValue(item.amount) })).filter((item) => item.invoice_id && item.amount > 0);
  } catch {
    return [];
  }
}

export async function applyCreditNoteToInvoices(prev: CreditNoteActionResult, formData: FormData): Promise<CreditNoteActionResult> {
  void prev;
  const workspace=await requireActiveWorkspace();
  const id=text(formData,"credit_note_id");
  if(!id) return {success:false,error:"Avoir introuvable."};
  const applications=parseApplications(formData);
  if(!applications.length) return {success:false,error:"Saisissez au moins une affectation."};
  const supabase=await createClient();
  const {error}=await supabase.rpc("apply_customer_credit_note_atomic",{p_organization_id:workspace.organization.id,p_credit_note_id:id,p_applications:applications});
  if(error)return {success:false,error:creditNoteError(error)};
  revalidatePath("/facturation/avoirs/"+id); revalidatePath("/facturation/factures");
  redirect("/facturation/avoirs/"+id);
}

export async function unapplyCreditNoteFromInvoice(prev: CreditNoteActionResult, formData: FormData): Promise<CreditNoteActionResult> {
  void prev;
  const workspace=await requireActiveWorkspace();
  const applicationId=text(formData,"id");
  if(!applicationId)return {success:false,error:"Affectation introuvable."};
  const supabase=await createClient();
  const {data,error}=await supabase.rpc("unapply_customer_credit_note_atomic",{p_organization_id:workspace.organization.id,p_application_id:applicationId});
  if(error)return {success:false,error:creditNoteError(error)};
  revalidatePath("/facturation/avoirs/"+String(data));revalidatePath("/facturation/factures");
  return {success:true};
}

export async function postCustomerCreditNote(prev: CreditNoteActionResult, formData: FormData): Promise<CreditNoteActionResult> {
  void prev;
  const workspace = await requireActiveWorkspace();
  if (!isAdminRole(workspace.role)) return { success: false, error: "Seul un administrateur peut comptabiliser cet avoir." };
  const id = text(formData, "id");
  if (!id) return { success: false, error: "Avoir introuvable." };
  const existing = await getExistingEntryBySource(workspace.organization.id, "customer_credit_note", id);
  if (existing) return { success: true };
  const { creditNote, lines } = await getCustomerCreditNoteDetail(id);
  if (!creditNote || ["draft", "cancelled"].includes(creditNote.status) || !lines.length) return { success: false, error: "Validez l’avoir et vérifiez ses lignes avant de le comptabiliser." };
  if (creditNote.currency !== "MAD") return { success: false, error: "Ce parcours utilise le MAD. Les montants historiques de cet avoir sont conservés." };
  const settings = await getAccountingSettings(workspace.organization.id);
  const [journal, customer, product, service, vat] = await Promise.all([
    getJournalByCode(workspace.organization.id, "VE"),
    getAccountByNumber(workspace.organization.id, String(settings?.default_customer_account_code || "3421")),
    getAccountByNumber(workspace.organization.id, String(settings?.default_sales_account_code || "7111")),
    getAccountByNumber(workspace.organization.id, "7124"),
    getAccountByNumber(workspace.organization.id, String(settings?.default_sales_vat_account_code || "4455")),
  ]);
  if (!journal || !customer || !product || !service || !vat) return { success: false, error: "Le journal des ventes ou les comptes nécessaires ne sont pas configurés. Contactez l’assistance." };
  const accountingLines = buildCustomerInvoiceLines(lines, { sales_product: product.id, sales_service: service.id, customer: customer.id, sales_vat: vat.id }).map((line) => ({ account_id: line.account_id, label: `Avoir ${creditNote.credit_note_number} · ${line.label}`, debit: line.credit, credit: line.debit }));
  if (Math.abs(accountingLines.reduce((sum, line) => sum + line.debit, 0) - creditNote.total_ttc) > 0.005) return { success: false, error: "Les totaux de cet avoir nécessitent une vérification avant comptabilisation." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("save_accounting_entry_atomic", { p_organization_id: workspace.organization.id, p_entry_id: null, p_header: { journal_id: journal.id, entry_date: creditNote.credit_note_date, label: `Avoir client ${creditNote.credit_note_number}`, reference: creditNote.credit_note_number, status: "posted", source_module: "invoicing", source_document_type: "customer_credit_note", source_document_id: id, source_number: creditNote.credit_note_number }, p_lines: accountingLines });
  if (error) return { success: false, error: financialErrorMessage(error) };
  revalidatePath(`/facturation/avoirs/${id}`); revalidatePath("/comptabilite/journaux"); revalidatePath("/comptabilite/ecritures");
  return { success: true };
}
