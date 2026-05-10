"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireActiveWorkspace } from "@/lib/auth";
import type { ThirdPartyKind } from "@/lib/third-party-types";

export type ThirdPartyActionResult = {
  success: boolean;
  error?: string;
  data?: unknown;
};

function text(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? "").trim();
  return value === "" ? null : value;
}

function numberValue(formData: FormData, key: string) {
  const raw = text(formData, key);
  if (!raw) {
    return null;
  }
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : NaN;
}

function integerValue(formData: FormData, key: string) {
  const value = numberValue(formData, key);
  return value === null ? null : Math.trunc(value);
}

function numberOrZero(formData: FormData, key: string) {
  const value = numberValue(formData, key);
  return value === null || Number.isNaN(value) ? 0 : value;
}

function integerOrZero(formData: FormData, key: string) {
  return Math.trunc(numberOrZero(formData, key));
}

function optionalInteger(formData: FormData, key: string) {
  const value = integerValue(formData, key);
  return value === null || Number.isNaN(value) ? undefined : value;
}

function selectedTypes(formData: FormData): ThirdPartyKind[] {
  const allowed: ThirdPartyKind[] = ["prospect", "customer", "supplier"];
  return allowed.filter((type) => formData.get(`type_${type}`) === "on");
}

function primaryType(types: ThirdPartyKind[]): ThirdPartyKind {
  const priority: ThirdPartyKind[] = ["customer", "prospect", "supplier"];
  for (const p of priority) {
    if (types.includes(p)) return p;
  }
  return "prospect";
}

type ParsedThirdParty =
  | { error: string }
  | {
      error: null;
      types: ThirdPartyKind[];
      name: string;
      primaryType: ThirdPartyKind;
      paymentTerms: number;
      creditLimit: number;
      potentialValue: number;
      supplierRating: number | undefined;
    };

function validateThirdParty(formData: FormData): ParsedThirdParty {
  const types = selectedTypes(formData);
  const name = text(formData, "name");
  const email = text(formData, "email");
  const ice = text(formData, "ice");
  const creditLimit = numberOrZero(formData, "credit_limit");
  const potentialValue = numberOrZero(formData, "potential_value");
  const supplierRating = optionalInteger(formData, "supplier_rating");
  const paymentTerms = integerOrZero(formData, "payment_terms_days");

  if (!name) {
    return { error: "Le nom du tiers est obligatoire." };
  }

  if (types.length === 0) {
    return { error: "Selectionnez au moins un type: Prospect, Client ou Fournisseur." };
  }

  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: "L'adresse email n'est pas valide." };
  }

  if (ice && !/^\d{15}$/.test(ice)) {
    return { error: "L'ICE doit contenir exactement 15 chiffres." };
  }

  if (!Number.isFinite(creditLimit) || creditLimit < 0) {
    return { error: "La limite de credit doit etre positive." };
  }

  if (!Number.isFinite(potentialValue) || potentialValue < 0) {
    return { error: "La valeur potentielle doit etre positive." };
  }

  if (supplierRating !== undefined && (supplierRating < 1 || supplierRating > 5)) {
    return { error: "L'evaluation fournisseur doit etre comprise entre 1 et 5." };
  }

  if (paymentTerms < 0) {
    return { error: "Les conditions de paiement doivent etre positives." };
  }

  return {
    error: null,
    types,
    name,
    primaryType: primaryType(types),
    paymentTerms,
    creditLimit,
    potentialValue,
    supplierRating,
  };
}

function thirdPartyPayload(
  formData: FormData,
  organizationId: string,
  userId: string,
  parsed: Extract<ParsedThirdParty, { error: null }>,
) {
  return {
    organization_id: organizationId,
    primary_type: parsed.primaryType,
    types: parsed.types,
    name: parsed.name,
    commercial_name: text(formData, "commercial_name"),
    address: text(formData, "address"),
    postal_code: text(formData, "postal_code"),
    city: text(formData, "city"),
    country: text(formData, "country") ?? "MA",
    phone: text(formData, "phone"),
    mobile: text(formData, "mobile"),
    website: text(formData, "website"),
    email: text(formData, "email"),
    rc: text(formData, "rc"),
    patente: text(formData, "patente"),
    if_number: text(formData, "if_number"),
    cnss: text(formData, "cnss"),
    ice: text(formData, "ice"),
    vat_subject: formData.get("vat_subject") === "on",
    vat_number: text(formData, "vat_number"),
    payment_terms_days: parsed.paymentTerms,
    credit_limit: parsed.creditLimit,
    cumulative_revenue: numberOrZero(formData, "cumulative_revenue"),
    current_outstanding: numberOrZero(formData, "current_outstanding"),
    default_discount_rate: numberOrZero(formData, "default_discount_rate"),
    customer_category: text(formData, "customer_category"),
    risk_level: text(formData, "risk_level"),
    preferred_payment_method: text(formData, "preferred_payment_method"),
    prospect_source: text(formData, "prospect_source"),
    prospect_status: text(formData, "prospect_status"),
    potential_value: parsed.potentialValue,
    next_follow_up_date: text(formData, "next_follow_up_date"),
    interest_level: text(formData, "interest_level"),
    sales_owner: text(formData, "sales_owner"),
    prospect_notes: text(formData, "prospect_notes"),
    supplier_product_categories: text(formData, "supplier_product_categories"),
    supplier_payment_terms: text(formData, "supplier_payment_terms"),
    supplier_rating: parsed.supplierRating,
    supplier_delivery_delay_days: optionalInteger(formData, "supplier_delivery_delay_days"),
    supplier_main_contact: text(formData, "supplier_main_contact"),
    supplier_payment_method: text(formData, "supplier_payment_method"),
    supplier_notes: text(formData, "supplier_notes"),
    status: text(formData, "status") ?? "active",
    notes: text(formData, "notes"),
    created_by: userId,
  };
}

export async function createThirdParty(
  previousState: ThirdPartyActionResult,
  formData: FormData,
): Promise<ThirdPartyActionResult> {
  void previousState;
  const workspace = await requireActiveWorkspace();
  const parsed = validateThirdParty(formData);
  if (parsed.error !== null) {
    return { success: false, error: parsed.error };
  }

  const supabase = await createClient();
  const payload = thirdPartyPayload(formData, workspace.organization.id, workspace.userId, parsed);
  const { data, error } = await supabase.from("third_parties").insert(payload).select("id").single();

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath("/tiers");
  redirect(`/tiers/${data.id}`);
}

export async function updateThirdParty(
  previousState: ThirdPartyActionResult,
  formData: FormData,
): Promise<ThirdPartyActionResult> {
  void previousState;
  const workspace = await requireActiveWorkspace();
  const id = text(formData, "id");
  if (!id) {
    return { success: false, error: "Identifiant tiers manquant." };
  }

  const parsed = validateThirdParty(formData);
  if (parsed.error !== null) {
    return { success: false, error: parsed.error };
  }

  const supabase = await createClient();
  const payload = thirdPartyPayload(formData, workspace.organization.id, workspace.userId, parsed);
  const { error } = await supabase
    .from("third_parties")
    .update(payload)
    .eq("organization_id", workspace.organization.id)
    .eq("id", id);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath("/tiers");
  revalidatePath(`/tiers/${id}`);
  redirect(`/tiers/${id}`);
}

export async function archiveThirdParty(
  previousState: ThirdPartyActionResult,
  formData: FormData,
): Promise<ThirdPartyActionResult> {
  void previousState;
  const workspace = await requireActiveWorkspace();
  const id = text(formData, "id");

  if (!id) {
    return { success: false, error: "Identifiant tiers manquant." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("third_parties")
    .update({ status: "archived", archived_at: new Date().toISOString() })
    .eq("organization_id", workspace.organization.id)
    .eq("id", id);

  if (error) {
    return { success: false, error: "Impossible d'archiver ce tiers." };
  }

  revalidatePath("/tiers");
  redirect("/tiers");
}

export async function convertProspectToCustomer(
  previousState: ThirdPartyActionResult,
  formData: FormData,
): Promise<ThirdPartyActionResult> {
  void previousState;
  const workspace = await requireActiveWorkspace();
  const id = text(formData, "id");

  if (!id) {
    return { success: false, error: "Identifiant tiers manquant." };
  }

  const supabase = await createClient();
  const { data: thirdParty, error: fetchError } = await supabase
    .from("third_parties")
    .select("id, types")
    .eq("organization_id", workspace.organization.id)
    .eq("id", id)
    .single();

  if (fetchError || !thirdParty?.types?.includes("prospect")) {
    return { success: false, error: "Ce tiers n'est pas un prospect de votre organisation." };
  }

  const currentTypes = Array.isArray(thirdParty.types) ? thirdParty.types as string[] : [];
  const types = Array.from(new Set(currentTypes.filter((type) => type !== "prospect").concat("customer")));
  const { error } = await supabase
    .from("third_parties")
    .update({
      types,
      primary_type: "customer",
      prospect_status: "gagne",
      converted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("organization_id", workspace.organization.id)
    .eq("id", id);

  if (error) {
    return { success: false, error: "Impossible de convertir ce prospect en client." };
  }

  await supabase.from("audit_logs").insert({
    organization_id: workspace.organization.id,
    actor_id: workspace.userId,
    table_name: "third_parties",
    record_id: id,
    action: "CONVERT_PROSPECT_TO_CUSTOMER",
    changes: { previous_types: currentTypes, next_types: types },
  });

  revalidatePath(`/tiers/${id}`);
  redirect(`/tiers/${id}`);
}

export async function createThirdPartyContact(
  previousState: ThirdPartyActionResult,
  formData: FormData,
): Promise<ThirdPartyActionResult> {
  void previousState;
  const workspace = await requireActiveWorkspace();
  const thirdPartyId = text(formData, "third_party_id");
  const fullName = text(formData, "full_name");

  if (!thirdPartyId || !fullName) {
    return { success: false, error: "Le nom et l'identifiant du tiers sont requis." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("third_party_contacts").insert({
    organization_id: workspace.organization.id,
    third_party_id: thirdPartyId,
    full_name: fullName,
    job_title: text(formData, "job_title"),
    phone: text(formData, "phone"),
    mobile: text(formData, "mobile"),
    email: text(formData, "email"),
    is_primary: formData.get("is_primary") === "on",
    notes: text(formData, "notes"),
  });

  if (error) {
    return { success: false, error: "Impossible d'ajouter ce contact." };
  }

  revalidatePath(`/tiers/${thirdPartyId}`);
  return { success: true };
}

export async function updateThirdPartyContact(
  previousState: ThirdPartyActionResult,
  formData: FormData,
): Promise<ThirdPartyActionResult> {
  void previousState;
  const workspace = await requireActiveWorkspace();
  const id = text(formData, "id");
  const thirdPartyId = text(formData, "third_party_id");

  if (!id || !thirdPartyId) {
    return { success: false, error: "Identifiants du contact et du tiers requis." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("third_party_contacts")
    .update({
      full_name: text(formData, "full_name"),
      job_title: text(formData, "job_title"),
      phone: text(formData, "phone"),
      mobile: text(formData, "mobile"),
      email: text(formData, "email"),
      is_primary: formData.get("is_primary") === "on",
      notes: text(formData, "notes"),
    })
    .eq("organization_id", workspace.organization.id)
    .eq("id", id);

  if (error) {
    return { success: false, error: "Impossible de modifier ce contact." };
  }

  revalidatePath(`/tiers/${thirdPartyId}`);
  return { success: true };
}

export async function deleteThirdPartyContact(
  previousState: ThirdPartyActionResult,
  formData: FormData,
): Promise<ThirdPartyActionResult> {
  void previousState;
  const workspace = await requireActiveWorkspace();
  const id = text(formData, "id");
  const thirdPartyId = text(formData, "third_party_id");

  if (!id || !thirdPartyId) {
    return { success: false, error: "Identifiants du contact et du tiers requis." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("third_party_contacts")
    .update({ archived_at: new Date().toISOString() })
    .eq("organization_id", workspace.organization.id)
    .eq("id", id);

  if (error) {
    return { success: false, error: "Impossible de supprimer ce contact." };
  }

  revalidatePath(`/tiers/${thirdPartyId}`);
  return { success: true };
}

export async function createThirdPartyAddress(
  previousState: ThirdPartyActionResult,
  formData: FormData,
): Promise<ThirdPartyActionResult> {
  void previousState;
  const workspace = await requireActiveWorkspace();
  const thirdPartyId = text(formData, "third_party_id");
  const label = text(formData, "label");
  const address = text(formData, "address");

  if (!thirdPartyId || !label || !address) {
    return { success: false, error: "Le libelle et l'adresse sont requis." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("third_party_addresses").insert({
    organization_id: workspace.organization.id,
    third_party_id: thirdPartyId,
    label,
    type: text(formData, "type") ?? "other",
    address,
    postal_code: text(formData, "postal_code"),
    city: text(formData, "city"),
    country: text(formData, "country") ?? "MA",
    is_default: formData.get("is_default") === "on",
  });

  if (error) {
    return { success: false, error: "Impossible d'ajouter cette adresse." };
  }

  revalidatePath(`/tiers/${thirdPartyId}`);
  return { success: true };
}

export async function updateThirdPartyAddress(
  previousState: ThirdPartyActionResult,
  formData: FormData,
): Promise<ThirdPartyActionResult> {
  void previousState;
  const workspace = await requireActiveWorkspace();
  const id = text(formData, "id");
  const thirdPartyId = text(formData, "third_party_id");

  if (!id || !thirdPartyId) {
    return { success: false, error: "Identifiants de l'adresse et du tiers requis." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("third_party_addresses")
    .update({
      label: text(formData, "label"),
      type: text(formData, "type") ?? "other",
      address: text(formData, "address"),
      postal_code: text(formData, "postal_code"),
      city: text(formData, "city"),
      country: text(formData, "country") ?? "MA",
      is_default: formData.get("is_default") === "on",
    })
    .eq("organization_id", workspace.organization.id)
    .eq("id", id);

  if (error) {
    return { success: false, error: "Impossible de modifier cette adresse." };
  }

  revalidatePath(`/tiers/${thirdPartyId}`);
  return { success: true };
}

export async function deleteThirdPartyAddress(
  previousState: ThirdPartyActionResult,
  formData: FormData,
): Promise<ThirdPartyActionResult> {
  void previousState;
  const workspace = await requireActiveWorkspace();
  const id = text(formData, "id");
  const thirdPartyId = text(formData, "third_party_id");

  if (!id || !thirdPartyId) {
    return { success: false, error: "Identifiants de l'adresse et du tiers requis." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("third_party_addresses")
    .update({ archived_at: new Date().toISOString() })
    .eq("organization_id", workspace.organization.id)
    .eq("id", id);

  if (error) {
    return { success: false, error: "Impossible de supprimer cette adresse." };
  }

  revalidatePath(`/tiers/${thirdPartyId}`);
  return { success: true };
}
