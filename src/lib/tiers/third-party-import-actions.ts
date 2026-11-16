"use server";

import { revalidatePath } from "next/cache";
import { requireActiveWorkspace } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { readSpreadsheet } from "@/lib/spreadsheet/read-table";
import { parseThirdPartyCsv, parseThirdPartyTable, reviewThirdPartyRows, type ThirdPartyImportRow } from "@/lib/tiers/third-party-import";

export type ThirdPartyImportState = {
  success: boolean;
  error?: string;
  errors: string[];
  rows: ThirdPartyImportRow[];
  readyRows: ThirdPartyImportRow[];
  imported?: number;
  skipped?: number;
};

const empty: ThirdPartyImportState = { success: false, errors: [], rows: [], readyRows: [] };

async function parsedFile(formData: FormData) {
  const file = formData.get("file");
  if (file instanceof File && file.size > 0) {
    const name = file.name.toLowerCase();
    if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
      const sheet = readSpreadsheet(Buffer.from(await file.arrayBuffer()), file.name);
      if (sheet.error) return { headerError: sheet.error, rows: [] as ThirdPartyImportRow[], issues: [] };
      return parseThirdPartyTable(sheet.rows);
    }
    return parseThirdPartyCsv(await file.text());
  }
  return parseThirdPartyCsv(String(formData.get("csv") ?? ""));
}

async function existingParties(organizationId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.from("third_parties").select("name, ice").eq("organization_id", organizationId).limit(5000);
  if (error) throw new Error("Impossible de vérifier les doublons de votre entreprise.");
  return (data ?? []) as { name: string; ice: string | null }[];
}

async function reviewed(formData: FormData, organizationId: string) {
  const parsed = await parsedFile(formData);
  if (parsed.headerError) return { error: parsed.headerError, errors: [] as string[], rows: [] as ThirdPartyImportRow[], readyRows: [] as ThirdPartyImportRow[] };
  const duplicates = reviewThirdPartyRows(parsed.rows, await existingParties(organizationId));
  const issues = [...parsed.issues, ...duplicates];
  const blocked = new Set(issues.map((item) => item.line));
  return { errors: issues.map((item) => item.message), rows: parsed.rows, readyRows: parsed.rows.filter((row) => !blocked.has(row.line)) };
}

export async function previewThirdPartyImportAction(_prev: ThirdPartyImportState, formData: FormData): Promise<ThirdPartyImportState> {
  const workspace = await requireActiveWorkspace({ modules: ["ventes", "achats"], level: "write" });
  try {
    const result = await reviewed(formData, workspace.organization.id);
    if (result.error) return { ...empty, error: result.error };
    return { success: result.readyRows.length > 0, errors: result.errors, rows: result.rows, readyRows: result.readyRows };
  } catch (error) {
    return { ...empty, error: error instanceof Error ? error.message : "La lecture du fichier a échoué." };
  }
}

export async function confirmThirdPartyImportAction(_prev: ThirdPartyImportState, formData: FormData): Promise<ThirdPartyImportState> {
  const workspace = await requireActiveWorkspace({ modules: ["ventes", "achats"], level: "write" });
  try {
    const result = await reviewed(formData, workspace.organization.id);
    if (result.error || result.readyRows.length === 0) {
      return { success: false, error: result.error ?? "Aucune ligne valide n’a été enregistrée.", errors: result.errors, rows: result.rows, readyRows: [] };
    }
    const supabase = await createClient();
    const payload = result.readyRows.map((row) => ({
      organization_id: workspace.organization.id,
      primary_type: row.type,
      types: [row.type],
      name: row.name,
      ice: row.ice || null,
      if_number: row.ifNumber || null,
      rc: row.rc || null,
      email: row.email || null,
      phone: row.phone || null,
      city: row.city || null,
      address: row.address || null,
      country: "MA",
      status: "active",
      created_by: workspace.userId,
    }));
    const { error } = await supabase.from("third_parties").insert(payload);
    if (error) return { success: false, error: "L’enregistrement a été refusé. Aucune ligne de ce fichier n’a été ajoutée.", errors: result.errors, rows: result.rows, readyRows: result.readyRows };
    revalidatePath("/tiers");
    return { success: true, errors: [], rows: [], readyRows: [], imported: result.readyRows.length, skipped: result.rows.length - result.readyRows.length };
  } catch (error) {
    return { ...empty, error: error instanceof Error ? error.message : "L’import a échoué. Aucune ligne n’a été ajoutée." };
  }
}
