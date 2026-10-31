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
    // Numbering is managed by its audited RPC, never by presentation settings.
    const data = {
      invoice_terms: getVal("invoice_terms"),
      legal_mentions: getVal("legal_mentions"),
      footer_note: getVal("footer_note"),
      primary_color: getVal("primary_color") ?? "#111827",
      show_ice: getBool("show_ice"),
      show_rc: getBool("show_rc"),
      show_stamp_signature: getBool("show_stamp_signature"),
    };

    const { data: existing, error: readError } = await supabase.from("document_settings")
      .select("id").eq("organization_id", workspace.organization.id).maybeSingle();
    if (readError) return { error: readError.message, success: false };
    const { error } = existing
      ? await supabase.from("document_settings").update(data).eq("organization_id", workspace.organization.id)
      : await supabase.from("document_settings").insert({ organization_id: workspace.organization.id, ...data });

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
