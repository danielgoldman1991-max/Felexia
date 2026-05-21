import { createClient } from "@/lib/supabase/server";
import { requireActiveWorkspace } from "@/lib/auth";
import type { VatDeclarationRecord } from "@/lib/tax/vat-declaration-types";

function isMissingTableError(error: { message?: string; code?: string } | null): boolean {
  if (!error) return false;
  const msg = (error.message ?? "").toLowerCase();
  return msg.includes("could not find the table") || msg.includes("does not exist") || msg.includes("schema cache") || msg.includes("relation") || error.code === "42P01";
}

export type VatDeclarationsListResult = {
  declarations: VatDeclarationRecord[];
  ready: boolean;
  message?: string;
};

export async function listVatDeclarations(filters?: { status?: string; frequency?: string; search?: string }): Promise<VatDeclarationsListResult> {
  try {
    const supabase = await createClient();
    const workspace = await requireActiveWorkspace();

    let query = supabase
      .from("vat_declarations")
      .select("*")
      .eq("organization_id", workspace.organization.id)
      .is("archived_at", null)
      .order("created_at", { ascending: false });

    if (filters?.status) query = query.eq("status", filters.status);
    if (filters?.frequency) query = query.eq("frequency", filters.frequency);
    if (filters?.search) {
      query = query.or(`declaration_number.ilike.%${filters.search}%,notes.ilike.%${filters.search}%`);
    }

    const { data, error } = await query;
    if (error) {
      if (isMissingTableError(error)) {
        return {
          declarations: [],
          ready: false,
          message: "Le module Déclarations TVA n'est pas encore initialisé. Appliquez les migrations Supabase (supabase db push).",
        };
      }
      throw new Error(error.message);
    }
    return { declarations: (data ?? []) as VatDeclarationRecord[], ready: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.toLowerCase().includes("could not find the table") || message.toLowerCase().includes("schema cache")) {
      return {
        declarations: [],
        ready: false,
        message: "Le module Déclarations TVA n'est pas encore initialisé. Appliquez les migrations Supabase (supabase db push).",
      };
    }
    throw err;
  }
}

export async function getVatDeclarationById(id: string): Promise<VatDeclarationRecord | null> {
  try {
    const supabase = await createClient();
    const workspace = await requireActiveWorkspace();
    const { data, error } = await supabase
      .from("vat_declarations")
      .select("*")
      .eq("id", id)
      .eq("organization_id", workspace.organization.id)
      .maybeSingle();

    if (error) {
      if (isMissingTableError(error)) return null;
      throw new Error(error.message);
    }
    return data as VatDeclarationRecord | null;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.toLowerCase().includes("could not find the table") || message.toLowerCase().includes("schema cache")) {
      return null;
    }
    throw err;
  }
}

export async function getVatDeclarationCounters(): Promise<{
  draft: number;
  validated: number;
  exported: number;
  totalCollected: number;
  totalDeductible: number;
  totalVatDue: number;
  totalCredit: number;
  ready: boolean;
  message?: string;
}> {
  try {
    const supabase = await createClient();
    const workspace = await requireActiveWorkspace();

    const { data, error } = await supabase
      .from("vat_declarations")
      .select("status, collected_vat, deductible_vat, vat_due, credit_to_carry_forward")
      .eq("organization_id", workspace.organization.id)
      .is("archived_at", null);

    if (error) {
      if (isMissingTableError(error)) {
        return { draft: 0, validated: 0, exported: 0, totalCollected: 0, totalDeductible: 0, totalVatDue: 0, totalCredit: 0, ready: false, message: "Module non initialisé." };
      }
      throw new Error(error.message);
    }

    const rows = (data ?? []) as Array<{ status: string; collected_vat: number; deductible_vat: number; vat_due: number; credit_to_carry_forward: number }>;

    return {
      draft: rows.filter((r) => r.status === "draft" || r.status === "under_review").length,
      validated: rows.filter((r) => r.status === "validated").length,
      exported: rows.filter((r) => r.status === "exported").length,
      totalCollected: rows.reduce((s, r) => s + Number(r.collected_vat), 0),
      totalDeductible: rows.reduce((s, r) => s + Number(r.deductible_vat), 0),
      totalVatDue: rows.reduce((s, r) => s + Number(r.vat_due), 0),
      totalCredit: rows.reduce((s, r) => s + Number(r.credit_to_carry_forward), 0),
      ready: true,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.toLowerCase().includes("could not find the table") || message.toLowerCase().includes("schema cache")) {
      return { draft: 0, validated: 0, exported: 0, totalCollected: 0, totalDeductible: 0, totalVatDue: 0, totalCredit: 0, ready: false, message: "Module non initialisé." };
    }
    throw err;
  }
}

export async function getLastVatDeclarationPeriod(): Promise<{ period_end: string | null; credit_to_carry_forward: number | null } | null> {
  try {
    const supabase = await createClient();
    const workspace = await requireActiveWorkspace();
    const { data, error } = await supabase
      .from("vat_declarations")
      .select("period_end, credit_to_carry_forward")
      .eq("organization_id", workspace.organization.id)
      .is("archived_at", null)
      .order("period_end", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      if (isMissingTableError(error)) return null;
      throw new Error(error.message);
    }

    return data as { period_end: string | null; credit_to_carry_forward: number | null } | null;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.toLowerCase().includes("could not find the table") || message.toLowerCase().includes("schema cache")) {
      return null;
    }
    throw err;
  }
}
