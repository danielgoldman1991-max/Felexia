"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireActiveWorkspace } from "@/lib/auth";
import { financialErrorMessage } from "@/lib/financial-errors";
import { calculateCommercialAmounts } from "@/lib/invoice-calculations";
import { createClient } from "@/lib/supabase/server";
import { isMissingSchema } from "@/lib/optional-schema";
import {
  SCAN_BUCKET,
  assertPendingScanPath,
  matchSupplier,
  mimeFrom,
  reviewOcrInvoice,
  type OcrSupplierInvoice,
  type SupplierMatch,
} from "@/lib/purchases/supplier-invoice-ocr";

export type OcrAnalysis = {
  configured: boolean;
  error?: string;
  invoice?: OcrSupplierInvoice;
  warnings: string[];
  match?: SupplierMatch;
  duplicate: boolean;
  path?: string;
};

async function workspace() {
  return requireActiveWorkspace({ module: "achats", level: "write" });
}

export async function getSupplierInvoiceScan(invoiceId: string) {
  const current = await requireActiveWorkspace({ module: "achats" });
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("supplier_invoice_attachments")
    .select("id, file_name, file_path, mime_type")
    .eq("organization_id", current.organization.id)
    .eq("supplier_invoice_id", invoiceId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  const path = String(data.file_path);
  if (!path.startsWith(`organizations/${current.organization.id}/`)) return null;
  return { id: String(data.id), fileName: String(data.file_name), path, mimeType: String(data.mime_type ?? "application/octet-stream") };
}

export async function discardSupplierInvoiceScan(path: string) {
  const current = await workspace();
  assertPendingScanPath(path, current.organization.id);
  const supabase = await createClient();
  await supabase.storage.from(SCAN_BUCKET).remove([path]);
}

export async function matchScannedSupplier(invoice: OcrSupplierInvoice): Promise<OcrAnalysis> {
  const current = await workspace();
  const supabase = await createClient();
  const { data: parties } = await supabase.from("third_parties").select("id, name, ice").eq("organization_id", current.organization.id).limit(5000);
  const match = matchSupplier({ name: invoice.supplierName, ice: invoice.ice }, (parties ?? []) as { id: string; name: string; ice: string | null }[]);
  const review = reviewOcrInvoice(invoice);
  let duplicate = false;
  if (match.status === "matched" && invoice.invoiceNumber) {
    const { data } = await supabase.from("supplier_invoices").select("id").eq("organization_id", current.organization.id).eq("supplier_id", match.id).eq("supplier_invoice_number", invoice.invoiceNumber).neq("status", "cancelled").maybeSingle();
    duplicate = Boolean(data);
  }
  if (duplicate) review.warnings.unshift("Une facture avec ce numéro existe déjà pour ce fournisseur.");
  return { configured: true, invoice, warnings: review.warnings, match, duplicate };
}

function text(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

export async function saveScannedSupplierInvoice(_prev: { error?: string }, formData: FormData): Promise<{ error?: string }> {
  const current = await workspace();
  const path = text(formData, "scan_path");
  try { assertPendingScanPath(path, current.organization.id); }
  catch (error) { return { error: error instanceof Error ? error.message : "Document introuvable." }; }
  const invoiceNumber = text(formData, "invoice_number");
  if (!invoiceNumber) return { error: "Le numéro de facture fournisseur est obligatoire." };
  const invoiceDate = text(formData, "invoice_date") || new Date().toISOString().slice(0, 10);
  const lines = JSON.parse(text(formData, "lines") || "[]") as { description?: string; quantity?: number; unitPriceHt?: number; vatRate?: number }[];
  if (!Array.isArray(lines) || lines.length === 0) return { error: "Ajoutez au moins une ligne." };
  const supabase = await createClient();
  const supplierId = text(formData, "supplier_id");
  if (!supplierId) return { error: "La facture ne peut pas être enregistrée sans fournisseur." };
  const { data: duplicate } = await supabase.from("supplier_invoices").select("id").eq("organization_id", current.organization.id).eq("supplier_id", supplierId).eq("supplier_invoice_number", invoiceNumber).neq("status", "cancelled").maybeSingle();
  if (duplicate) return { error: "Une facture avec ce numéro existe déjà pour ce fournisseur." };
  const downloaded = await supabase.storage.from(SCAN_BUCKET).download(path);
  if (downloaded.error || !downloaded.data) return { error: "Le document n’est plus disponible. Reprenez l’import. Aucune facture n’a été enregistrée." };
  const bytes = Buffer.from(await downloaded.data.arrayBuffer());
  const mime = mimeFrom("", path, bytes) ?? "application/pdf";
  const payload = lines.map((line) => {
    const amounts = calculateCommercialAmounts({ quantity: Number(line.quantity) || 0, unitPriceHt: Number(line.unitPriceHt) || 0, discountRate: 0, taxRate: Number(line.vatRate) || 0 });
    return {
      description: line.description || "Ligne",
      quantity: amounts.quantity,
      unit_name: "unité",
      unit_price_ht: amounts.unitPriceHt,
      discount_rate: 0,
      tax_rate: amounts.taxRate,
      subtotal_ht: amounts.grossHt,
      discount_amount: amounts.discountAmount,
      tax_amount: amounts.taxAmount,
      total_ttc: amounts.totalTtc,
    };
  });
  const { data: invoiceId, error } = await supabase.rpc("save_supplier_invoice_atomic", {
    p_organization_id: current.organization.id,
    p_invoice_id: null,
    p_header: {
      supplier_id: supplierId,
      supplier_invoice_number: invoiceNumber,
      source_type: "manual",
      invoice_date: invoiceDate,
      due_date: text(formData, "due_date") || null,
      notes: text(formData, "notes") || null,
      internal_notes: "Brouillon prérempli par OCR. À vérifier avant validation.",
    },
    p_lines: payload,
  });
  if (error || !invoiceId) return { error: financialErrorMessage(error, "Impossible de créer la facture fournisseur.") };
  const fileName = path.split("/").pop() || `${randomUUID()}.pdf`;
  const finalPath = `organizations/${current.organization.id}/invoices/${String(invoiceId)}/${fileName}`;
  const uploaded = await supabase.storage.from(SCAN_BUCKET).upload(finalPath, bytes, { contentType: mime, upsert: false });
  if (!uploaded.error) {
    await supabase.storage.from(SCAN_BUCKET).remove([path]);
    const confidence = Number(text(formData, "confidence") || "0");
    const attached = await supabase.from("supplier_invoice_attachments").insert({
      organization_id: current.organization.id,
      supplier_invoice_id: String(invoiceId),
      file_name: fileName,
      file_path: finalPath,
      mime_type: mime,
      file_size: bytes.length,
      ocr_provider: "felexia",
      ocr_model: "pdfjs+tesseract-fra-eng",
      field_confidence: { average: Number.isFinite(confidence) ? confidence : 0 },
      uploaded_by: current.userId,
    });
    if (attached.error && !isMissingSchema(attached.error)) {
      return { error: "La facture est créée, mais la pièce jointe n’a pas été liée. Ouvrez la facture avant de recommencer." };
    }
  }
  revalidatePath("/achats/factures");
  redirect(`/achats/factures/${String(invoiceId)}`);
}
