"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireActiveWorkspace } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

export type DocState = { error: string | null; success: boolean };

export async function updateDocumentSettingsAction(
  _prev: DocState,
  formData: FormData,
): Promise<DocState> {
  try {
    const workspace = await requireActiveWorkspace();

    if (workspace.role !== "owner" && workspace.role !== "admin") {
      return { error: "Vous n'avez pas les droits nécessaires.", success: false };
    }

    const supabase = await createClient();
    const getVal = (key: string): string | null => {
      const v = formData.get(key);
      return typeof v === "string" ? v.trim() || null : null;
    };
    const getBool = (key: string): boolean => formData.get(key) === "on";
    const getInt = (key: string, def: number): number => {
      const v = formData.get(key);
      return typeof v === "string" && v.trim() ? parseInt(v, 10) || def : def;
    };

    const data = {
      quote_prefix: getVal("quote_prefix") ?? "DEV",
      invoice_prefix: getVal("invoice_prefix") ?? "FAC",
      credit_note_prefix: getVal("credit_note_prefix") ?? "AV",
      delivery_note_prefix: getVal("delivery_note_prefix") ?? "BL",
      payment_prefix: getVal("payment_prefix") ?? "REG",
      numbering_format: getVal("numbering_format") ?? "{PREFIX}-{YEAR}-{NUMBER}",
      invoice_terms: getVal("invoice_terms"),
      legal_mentions: getVal("legal_mentions"),
      footer_note: getVal("footer_note"),
      primary_color: getVal("primary_color") ?? "#111827",
      show_ice: getBool("show_ice"),
      show_rc: getBool("show_rc"),
      show_stamp_signature: getBool("show_stamp_signature"),
      next_quote_number: getInt("next_quote_number", 1),
      next_invoice_number: getInt("next_invoice_number", 1),
      next_credit_note_number: getInt("next_credit_note_number", 1),
      next_delivery_note_number: getInt("next_delivery_note_number", 1),
    };

    const { error } = await supabase
      .from("document_settings")
      .upsert({
        organization_id: workspace.organization.id,
        ...data,
      }, { onConflict: "organization_id" });

    if (error) return { error: error.message, success: false };

    await logAudit(
      workspace.organization.id,
      "update_document_settings",
      "document_settings",
      workspace.organization.id,
      data,
    );

    revalidatePath("/parametres/documents");
    return { error: null, success: true };
  } catch (err) {
    return { error: (err as Error).message, success: false };
  }
}
