"use server";

import { revalidatePath } from "next/cache";
import { requireActiveWorkspace } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { parseThirdPartyCsv, reviewThirdPartyRows, type ThirdPartyImportRow } from "@/lib/tiers/third-party-import";

export type ThirdPartyImportState = {
  success: boolean;
  error?: string;
  errors: string[];
  rows: ThirdPartyImportRow[];
  imported?: number;
};

const empty: ThirdPartyImportState = { success: false, errors: [], rows: [] };

async function fileText(formData: FormData): Promise<{ error: string } | { text: string }> {
  const file = formData.get("file");
  if (file instanceof File && file.size > 0) {
    const name = file.name.toLowerCase();
    if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
      return { error: "Enregistrez le classeur au format CSV (séparateur point-virgule), puis réessayez. Le modèle se télécharge sur cette page." };
    }
    return { text: await file.text() };
  }
  return { text: String(formData.get("csv") ?? "") };
}

async function existingParties(organizationId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.from("third_parties").select("name, ice").eq("organization_id", organizationId).limit(5000);
  if (error) throw new Error("Impossible de vérifier les doublons de votre entreprise.");
  return (data ?? []) as { name: string; ice: string | null }[];
}

async function reviewed(formData: FormData, organizationId: string) {
  const source = await fileText(formData);
  if ("error" in source) return { error: source.error, errors: [] as string[], rows: [] as ThirdPartyImportRow[] };
  const parsed = parseThirdPartyCsv(source.text);
  if (parsed.headerError) return { error: parsed.headerError, errors: [] as string[], rows: [] as ThirdPartyImportRow[] };
  const duplicates = reviewThirdPartyRows(parsed.rows, await existingParties(organizationId));
  const errors = [...parsed.issues, ...duplicates].map((item) => item.message);
  return { errors, rows: parsed.rows };
}

export async function previewThirdPartyImportAction(_prev: ThirdPartyImportState, formData: FormData): Promise<ThirdPartyImportState> {
  const workspace = await requireActiveWorkspace({ modules: ["ventes", "achats"], level: "write" });
  try {
    const result = await reviewed(formData, workspace.organization.id);
    if (result.error) return { ...empty, error: result.error };
    return { success: result.errors.length === 0 && result.rows.length > 0, errors: result.errors, rows: result.rows };
  } catch (error) {
    return { ...empty, error: error instanceof Error ? error.message : "La lecture du fichier a échoué." };
  }
}

export async function confirmThirdPartyImportAction(_prev: ThirdPartyImportState, formData: FormData): Promise<ThirdPartyImportState> {
  const workspace = await requireActiveWorkspace({ modules: ["ventes", "achats"], level: "write" });
  try {
    const result = await reviewed(formData, workspace.organization.id);
    if (result.error || result.errors.length || result.rows.length === 0) {
      return { success: false, error: result.error ?? "Aucune ligne n’a été enregistrée. Corrigez le fichier puis confirmez à nouveau.", errors: result.errors, rows: result.rows };
    }
    const supabase = await createClient();
    const payload = result.rows.map((row) => ({
      organization_id: workspace.organization.id,
      primary_type: row.type,
      types: [row.type],
      name: row.name,
      ice: row.ice || null,
      email: row.email || null,
      phone: row.phone || null,
      city: row.city || null,
      address: row.address || null,
      country: "MA",
      status: "active",
      created_by: workspace.userId,
    }));
    const { error } = await supabase.from("third_parties").insert(payload);
    if (error) return { success: false, error: "L’enregistrement a été refusé. Aucune ligne de ce fichier n’a été ajoutée.", errors: [], rows: result.rows };
    revalidatePath("/tiers");
    return { success: true, errors: [], rows: [], imported: result.rows.length };
  } catch (error) {
    return { ...empty, error: error instanceof Error ? error.message : "L’import a échoué. Aucune ligne n’a été ajoutée." };
  }
}
