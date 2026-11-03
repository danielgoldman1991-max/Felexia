"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isReadOnlyRole } from "@/lib/auth/roles";
import { requireActiveWorkspace } from "@/lib/auth";
import { hasFullErpAccess } from "@/lib/launch-access";
import { rankSupplierQuotes, type SupplierQuote } from "@/lib/purchases/rfq";
import { createClient } from "@/lib/supabase/server";

export type ProcurementResult = { success: boolean; error?: string };

function text(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function money(value: FormDataEntryValue | null) {
  const parsed = Number(String(value ?? "").replace(",", "."));
  return Number.isFinite(parsed) ? Math.round(parsed * 100) / 100 : 0;
}

async function guard() {
  const workspace = await requireActiveWorkspace();
  if (!(await hasFullErpAccess(workspace.organization.id))) {
    return { workspace, error: "Les demandes d'achat et les consultations sont incluses dans l'offre PRO." };
  }
  if (isReadOnlyRole(workspace.role)) {
    return { workspace, error: "Votre accès est en lecture seule." };
  }
  return { workspace, error: null as string | null };
}

function reference(prefix: string) {
  const now = new Date();
  const period = `${String(now.getUTCFullYear()).slice(2)}${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  return `${prefix}-${period}-${crypto.randomUUID().slice(0, 4).toUpperCase()}`;
}

export async function createPurchaseRequest(prev: ProcurementResult, formData: FormData): Promise<ProcurementResult> {
  void prev;
  const { workspace, error } = await guard();
  if (error) return { success: false, error };
  const title = text(formData, "title");
  const description = text(formData, "description");
  const quantity = Number(formData.get("quantity") ?? 1);
  if (!title || !description || !Number.isFinite(quantity) || quantity <= 0) {
    return { success: false, error: "Indiquez un objet, une description et une quantité." };
  }
  const supabase = await createClient();
  const { data, error: insertError } = await supabase.from("purchase_requests").insert({
    organization_id: workspace.organization.id,
    request_number: reference("DA"),
    title,
    needed_on: text(formData, "needed_on"),
    status: "submitted",
    notes: text(formData, "notes"),
    created_by: workspace.userId,
  }).select("id").single();
  if (insertError || !data) return { success: false, error: insertError?.message ?? "Demande non enregistrée." };
  const line = await supabase.from("purchase_request_lines").insert({
    organization_id: workspace.organization.id,
    request_id: data.id,
    description,
    quantity,
    unit_name: text(formData, "unit_name"),
    estimated_unit_price_ht: money(formData.get("estimated_unit_price_ht")),
  });
  if (line.error) return { success: false, error: line.error.message };
  revalidatePath("/achats/demandes");
  redirect(`/achats/demandes/${data.id}`);
}

export async function createPurchaseRfq(prev: ProcurementResult, formData: FormData): Promise<ProcurementResult> {
  void prev;
  const { workspace, error } = await guard();
  if (error) return { success: false, error };
  const title = text(formData, "title");
  if (!title) return { success: false, error: "Indiquez l'objet de la consultation." };
  const quotes: SupplierQuote[] = [1, 2, 3].flatMap((index) => {
    const supplier = text(formData, `supplier_${index}`);
    if (!supplier) return [];
    return [{
      id: String(index),
      supplier,
      totalHt: money(formData.get(`ht_${index}`)),
      totalTtc: money(formData.get(`ttc_${index}`)),
      leadDays: Math.max(0, Math.round(Number(formData.get(`lead_${index}`) ?? 0))),
    }];
  });
  if (quotes.length < 2) return { success: false, error: "Saisissez au moins deux offres pour les comparer." };
  const ranked = rankSupplierQuotes(quotes);
  const supabase = await createClient();
  const { data, error: insertError } = await supabase.from("purchase_rfqs").insert({
    organization_id: workspace.organization.id,
    rfq_number: reference("AO"),
    title,
    status: "compared",
    due_date: text(formData, "due_date"),
    notes: text(formData, "notes"),
    created_by: workspace.userId,
  }).select("id").single();
  if (insertError || !data) return { success: false, error: insertError?.message ?? "Consultation non enregistrée." };
  const rows = ranked.map((quote) => ({
    organization_id: workspace.organization.id,
    rfq_id: data.id,
    supplier_name: quote.supplier,
    total_ht: quote.totalHt,
    total_ttc: quote.totalTtc,
    lead_days: quote.leadDays,
    notes: quote.recommended ? "Offre recommandée" : null,
  }));
  const saved = await supabase.from("purchase_rfq_quotes").insert(rows).select("id, notes");
  if (saved.error) return { success: false, error: saved.error.message };
  const winner = saved.data?.find((row) => row.notes === "Offre recommandée");
  if (winner) {
    await supabase.from("purchase_rfqs").update({ awarded_quote_id: winner.id, status: "awarded", updated_at: new Date().toISOString() }).eq("id", data.id);
  }
  revalidatePath("/achats/consultations");
  redirect(`/achats/consultations/${data.id}`);
}
