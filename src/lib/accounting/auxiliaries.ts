import type { SupabaseClient } from "@supabase/supabase-js";

type PartyAuxiliary = {
  id: string;
  name: string;
  code?: string | null;
  ice?: string | null;
  if_number?: string | null;
  rc?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  types: string[];
};

function partyCode(party: PartyAuxiliary) {
  const explicit = party.code?.trim();
  if (explicit) return explicit.replace(/\s+/g, "").slice(0, 24);
  return party.id.replace(/-/g, "").slice(0, 8);
}

function rolesFor(types: string[]) {
  const roles: { type: "customer" | "supplier"; general: "3421" | "4411" }[] = [];
  if (types.includes("customer")) roles.push({ type: "customer", general: "3421" });
  if (types.includes("supplier")) roles.push({ type: "supplier", general: "4411" });
  return roles;
}

export async function upsertThirdPartyAuxiliaries(supabase: SupabaseClient, organizationId: string, party: PartyAuxiliary) {
  const roles = rolesFor(party.types);
  if (roles.length === 0) return { created: 0 };
  let created = 0;
  for (const role of roles) {
    const existing = await supabase
      .from("accounting_auxiliaries")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("linked_entity_type", role.type)
      .eq("linked_entity_id", party.id)
      .maybeSingle();
    if (existing.error) {
      console.error("[accounting] auxiliary lookup", { code: existing.error.code, message: existing.error.message });
      continue;
    }
    const row = {
      organization_id: organizationId,
      code: `${role.general}-${partyCode(party)}`,
      name: party.name,
      type: role.type,
      general_account_code: role.general,
      linked_entity_type: role.type,
      linked_entity_id: party.id,
      ice: party.ice ?? null,
      if_number: party.if_number ?? null,
      rc: party.rc ?? null,
      phone: party.phone ?? null,
      email: party.email ?? null,
      address: party.address ?? null,
      is_active: true,
    };
    if (existing.data?.id) {
      const { code, ...update } = row;
      void code;
      await supabase.from("accounting_auxiliaries").update(update).eq("organization_id", organizationId).eq("id", existing.data.id);
      continue;
    }
    const inserted = await supabase.from("accounting_auxiliaries").insert(row);
    if (inserted.error?.code === "23505") {
      const retry = await supabase.from("accounting_auxiliaries").insert({ ...row, code: `${row.code}-${party.id.slice(0, 4)}` });
      if (!retry.error) created += 1;
      else console.error("[accounting] auxiliary insert", { code: retry.error.code, message: retry.error.message });
    } else if (inserted.error) {
      console.error("[accounting] auxiliary insert", { code: inserted.error.code, message: inserted.error.message });
    } else {
      created += 1;
    }
  }
  return { created };
}

export async function backfillOrganizationAuxiliaries(supabase: SupabaseClient, organizationId: string) {
  const { data, error } = await supabase
    .from("third_parties")
    .select("id, name, code, ice, if_number, rc, phone, email, address, types")
    .eq("organization_id", organizationId)
    .is("archived_at", null);
  if (error) return { created: 0, error: error.message };
  let created = 0;
  for (const party of data ?? []) {
    const result = await upsertThirdPartyAuxiliaries(supabase, organizationId, {
      id: party.id as string,
      name: party.name as string,
      code: party.code as string | null,
      ice: party.ice as string | null,
      if_number: party.if_number as string | null,
      rc: party.rc as string | null,
      phone: party.phone as string | null,
      email: party.email as string | null,
      address: party.address as string | null,
      types: (party.types as string[] | null) ?? [],
    });
    created += result.created;
  }
  return { created, error: null as string | null };
}
