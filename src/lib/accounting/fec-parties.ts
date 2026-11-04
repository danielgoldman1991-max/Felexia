import type { SupabaseClient } from "@supabase/supabase-js";
import type { EntryHeader } from "@/lib/accounting/entry-lines";

const SOURCE_PARTY: Record<string, { table: string; column: string }> = {
  customer_invoice: { table: "customer_invoices", column: "customer_id" },
  customer_payment: { table: "customer_payments", column: "third_party_id" },
  customer_credit_note: { table: "customer_credit_notes", column: "customer_id" },
  supplier_invoice: { table: "supplier_invoices", column: "supplier_id" },
  supplier_payment: { table: "supplier_payments", column: "supplier_id" },
  supplier_credit_note: { table: "supplier_credit_notes", column: "supplier_id" },
};

export function controlAccountSide(account: string) {
  const code = account.replace(/\s/g, "");
  if (code.startsWith("3421")) return "customer" as const;
  if (code.startsWith("4411")) return "supplier" as const;
  return null;
}

export function partyAuxiliaryCode(code: string | null | undefined, id: string) {
  const explicit = (code ?? "").trim();
  if (explicit) return explicit.replace(/\s+/g, "").slice(0, 24);
  return id.replace(/-/g, "").slice(0, 8);
}

/** 3421/4411 lines without a stored auxiliary take the third-party code and name. */
export function fecAuxiliaryColumns(
  account: string,
  stored: { code: string; name: string } | undefined,
  party: { code: string; name: string } | null,
) {
  if (stored?.code || stored?.name) return { number: stored.code ?? "", label: stored.name ?? "" };
  if (controlAccountSide(account) && party) return { number: party.code, label: party.name };
  return { number: "", label: "" };
}

export async function loadEntryThirdParties(
  supabase: SupabaseClient,
  organizationId: string,
  headers: Map<string, EntryHeader>,
) {
  const byEntry = new Map<string, { code: string; name: string }>();
  const idsBySource = new Map<string, Set<string>>();
  for (const header of headers.values()) {
    if (!header.sourceType || !header.sourceId || !SOURCE_PARTY[header.sourceType]) continue;
    const bucket = idsBySource.get(header.sourceType) ?? new Set<string>();
    bucket.add(header.sourceId);
    idsBySource.set(header.sourceType, bucket);
  }
  const partyBySource = new Map<string, string>();
  for (const [sourceType, ids] of idsBySource) {
    const source = SOURCE_PARTY[sourceType];
    const rows = await supabase.from(source.table).select(`id, ${source.column}`).eq("organization_id", organizationId).in("id", [...ids]);
    if (rows.error) continue;
    for (const row of (rows.data ?? []) as unknown as Array<Record<string, unknown>>) {
      const partyId = row[source.column];
      if (typeof partyId === "string" && partyId) partyBySource.set(`${sourceType}:${row.id}`, partyId);
    }
  }
  const partyIds = [...new Set(partyBySource.values())];
  if (partyIds.length === 0) return byEntry;
  const parties = await supabase.from("third_parties").select("id, code, name").eq("organization_id", organizationId).in("id", partyIds);
  if (parties.error) return byEntry;
  const partyById = new Map((parties.data ?? []).map((party) => [String(party.id), {
    code: partyAuxiliaryCode(party.code as string | null, String(party.id)),
    name: String(party.name ?? ""),
  }]));
  for (const [entryId, header] of headers) {
    if (!header.sourceType || !header.sourceId) continue;
    const partyId = partyBySource.get(`${header.sourceType}:${header.sourceId}`);
    const party = partyId ? partyById.get(partyId) : undefined;
    if (party) byEntry.set(entryId, party);
  }
  return byEntry;
}
