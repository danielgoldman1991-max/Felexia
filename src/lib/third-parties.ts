import { createClient } from "@/lib/supabase/server";
import { requireActiveWorkspace } from "@/lib/auth";
import type {
  PaginatedResult,
  ThirdPartyAddress,
  ThirdPartyContact,
  ThirdPartyFilters,
  ThirdPartyKind,
  ThirdPartyRecord,
} from "@/lib/third-party-types";

const SELECT_COLUMNS = `
  id, organization_id, code, primary_type, types, name, alternative_name,
  commercial_name, address, postal_code, city, country, department, phone,
  mobile, fax, website, email, rc, patente, if_number, cnss, ice,
  vat_subject, vat_number, payment_terms_days, credit_limit,
  cumulative_revenue, current_outstanding, default_discount_rate,
  customer_category, risk_level, preferred_payment_method, prospect_source,
  prospect_status, potential_value, next_follow_up_date, interest_level,
  sales_owner, prospect_notes, supplier_product_categories,
  supplier_payment_terms, supplier_rating, supplier_delivery_delay_days,
  supplier_main_contact, supplier_payment_method, supplier_notes, status,
  notes, converted_at, created_at, updated_at, archived_at
`;

export async function listThirdParties(
  filters: ThirdPartyFilters = {},
): Promise<PaginatedResult<ThirdPartyRecord>> {
  const workspace = await requireActiveWorkspace();
  const supabase = await createClient();
  const page = filters.page ?? 1;
  const limit = filters.limit ?? 25;
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  let query = supabase
    .from("third_parties")
    .select(SELECT_COLUMNS, { count: "exact" })
    .eq("organization_id", workspace.organization.id)
    .is("archived_at", null)
    .order("created_at", { ascending: false })
    .range(from, to);

  if (filters.type && filters.type !== "all") {
    query = query.contains("types", [filters.type]);
  }

  if (filters.city) {
    query = query.ilike("city", `%${filters.city}%`);
  }

  if (filters.status && filters.status !== "all") {
    query = query.eq("status", filters.status);
  }

  if (filters.vat === "yes") {
    query = query.eq("vat_subject", true);
  }

  if (filters.vat === "no") {
    query = query.eq("vat_subject", false);
  }

  if (filters.query) {
    const value = filters.query.replaceAll(",", " ").trim();
    if (value) {
      query = query.or(
        [
          `name.ilike.%${value}%`,
          `code.ilike.%${value}%`,
          `ice.ilike.%${value}%`,
          `phone.ilike.%${value}%`,
          `mobile.ilike.%${value}%`,
          `email.ilike.%${value}%`,
          `city.ilike.%${value}%`,
        ].join(","),
      );
    }
  }

  const { data, error, count } = await query;

  if (error) {
    throw new Error(error.message);
  }

  return {
    rows: (data ?? []) as ThirdPartyRecord[],
    total: count ?? 0,
    page,
    limit,
    totalPages: Math.max(1, Math.ceil((count ?? 0) / limit)),
  };
}

export async function getThirdParty(id: string) {
  const workspace = await requireActiveWorkspace();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("third_parties")
    .select(SELECT_COLUMNS)
    .eq("organization_id", workspace.organization.id)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return {
    workspace,
    thirdParty: data as ThirdPartyRecord | null,
  };
}

export async function getThirdPartyDetail(id: string) {
  const { workspace, thirdParty } = await getThirdParty(id);

  if (!thirdParty) {
    return { workspace, thirdParty: null, contacts: [], addresses: [] };
  }

  const supabase = await createClient();
  const [contactsResult, addressesResult] = await Promise.all([
    supabase
      .from("third_party_contacts")
      .select("*")
      .eq("organization_id", workspace.organization.id)
      .eq("third_party_id", id)
      .is("archived_at", null)
      .order("is_primary", { ascending: false })
      .order("created_at", { ascending: true }),
    supabase
      .from("third_party_addresses")
      .select("*")
      .eq("organization_id", workspace.organization.id)
      .eq("third_party_id", id)
      .is("archived_at", null)
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: true }),
  ]);

  if (contactsResult.error) {
    throw new Error(contactsResult.error.message);
  }

  if (addressesResult.error) {
    throw new Error(addressesResult.error.message);
  }

  return {
    workspace,
    thirdParty,
    contacts: (contactsResult.data ?? []) as ThirdPartyContact[],
    addresses: (addressesResult.data ?? []) as ThirdPartyAddress[],
  };
}

export async function getThirdPartyCounters() {
  const workspace = await requireActiveWorkspace();
  const supabase = await createClient();

  function base() {
    return supabase
      .from("third_parties")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", workspace.organization.id)
      .is("archived_at", null);
  }

  const [{ count: total }, { count: prospects }, { count: customers }, { count: suppliers }, { count: followUps }, { count: creditLimits }, { count: ratedSuppliers }] =
    await Promise.all([
      base(),
      base().contains("types", ["prospect"]),
      base().contains("types", ["customer"]),
      base().contains("types", ["supplier"]),
      base().contains("types", ["prospect"]).not("next_follow_up_date", "is", null),
      base().gt("credit_limit", 0),
      base().gt("supplier_rating", 0),
    ]);

  return {
    total: total ?? 0,
    prospects: prospects ?? 0,
    customers: customers ?? 0,
    suppliers: suppliers ?? 0,
    followUps: followUps ?? 0,
    creditLimits: creditLimits ?? 0,
    ratedSuppliers: ratedSuppliers ?? 0,
  };
}

export function filtersFromSearchParams(
  searchParams: Record<string, string | string[] | undefined>,
  forcedType?: ThirdPartyKind,
): ThirdPartyFilters {
  const pick = (key: string) => {
    const value = searchParams[key];
    return Array.isArray(value) ? value[0] : value;
  };

  const rawPage = pick("page");
  const page = rawPage ? Number(rawPage) : undefined;

  return {
    query: pick("q") ?? "",
    type: forcedType ?? ((pick("type") as ThirdPartyFilters["type"]) || "all"),
    city: pick("city") ?? "",
    status: pick("status") ?? "active",
    vat: (pick("vat") as ThirdPartyFilters["vat"]) || "all",
    page: page && Number.isFinite(page) && page >= 1 ? page : undefined,
    limit: 25,
  };
}
