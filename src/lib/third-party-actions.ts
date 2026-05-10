"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireActiveWorkspace } from "@/lib/auth";
import { PAYMENT_TERMS_OPTIONS, PAYMENT_METHOD_OPTIONS } from "@/lib/payment-options";
import type { ThirdPartyKind } from "@/lib/third-party-types";

const ATTACHMENTS_BUCKET = "third-party-attachments";
const MAX_ATTACHMENT_SIZE = 10 * 1024 * 1024;
const ALLOWED_ATTACHMENT_MIME_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);
const ALLOWED_ATTACHMENT_EXTENSIONS = new Set(["pdf", "jpg", "jpeg", "png", "webp", "doc", "docx"]);

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

async function logThirdPartyActivity({
  organizationId,
  userId,
  thirdPartyId,
  action,
  changes,
}: {
  organizationId: string;
  userId: string;
  thirdPartyId: string;
  action: string;
  changes?: Record<string, unknown>;
}) {
  const supabase = await createClient();
  await supabase.from("audit_logs").insert({
    organization_id: organizationId,
    actor_id: userId,
    table_name: "third_parties",
    record_id: thirdPartyId,
    action,
    changes: changes ?? {},
  });
}

function safeFileName(fileName: string) {
  const normalized = fileName.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  return normalized.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").toLowerCase();
}

function fileExtension(fileName: string) {
  return fileName.split(".").pop()?.toLowerCase() ?? "";
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
      paymentTermsValue: string | null;
      paymentMethodValue: string | null;
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

  const paymentTermsValue = text(formData, "payment_terms");
  const paymentMethodValue = text(formData, "payment_method");
  const validTerms = PAYMENT_TERMS_OPTIONS.map((o) => o.value);
  const validMethods = PAYMENT_METHOD_OPTIONS.map((o) => o.value);

  if (paymentTermsValue && !(validTerms as readonly string[]).includes(paymentTermsValue)) {
    return { error: "Condition de paiement invalide." };
  }
  if (paymentMethodValue && !(validMethods as readonly string[]).includes(paymentMethodValue)) {
    return { error: "Modalite de paiement invalide." };
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
    paymentTermsValue,
    paymentMethodValue,
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
    payment_terms: parsed.paymentTermsValue,
    payment_method: parsed.paymentMethodValue,
    custom_payment_terms: text(formData, "custom_payment_terms"),
    custom_payment_method: text(formData, "custom_payment_method"),
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

  await logThirdPartyActivity({
    organizationId: workspace.organization.id,
    userId: workspace.userId,
    thirdPartyId: data.id,
    action: "create",
    changes: { message: "Creation du tiers." },
  });

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

  await logThirdPartyActivity({
    organizationId: workspace.organization.id,
    userId: workspace.userId,
    thirdPartyId: id,
    action: "update",
    changes: { message: "Modification du tiers." },
  });

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

  await logThirdPartyActivity({
    organizationId: workspace.organization.id,
    userId: workspace.userId,
    thirdPartyId: id,
    action: "archive",
    changes: { message: "Archivage du tiers." },
  });

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
  const { data, error } = await supabase.from("third_party_contacts").insert({
    organization_id: workspace.organization.id,
    third_party_id: thirdPartyId,
    full_name: fullName,
    job_title: text(formData, "job_title"),
    phone: text(formData, "phone"),
    mobile: text(formData, "mobile"),
    email: text(formData, "email"),
    is_primary: formData.get("is_primary") === "on",
    notes: text(formData, "notes"),
  }).select("id").single();

  if (error) {
    return { success: false, error: "Impossible d'ajouter ce contact." };
  }

  await logThirdPartyActivity({
    organizationId: workspace.organization.id,
    userId: workspace.userId,
    thirdPartyId,
    action: "create_contact",
    changes: { message: `Contact ajoute: ${fullName}.`, contact_id: data.id },
  });

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

  await logThirdPartyActivity({
    organizationId: workspace.organization.id,
    userId: workspace.userId,
    thirdPartyId,
    action: "update_contact",
    changes: { message: "Contact modifie.", contact_id: id },
  });

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

  await logThirdPartyActivity({
    organizationId: workspace.organization.id,
    userId: workspace.userId,
    thirdPartyId,
    action: "delete_contact",
    changes: { message: "Contact archive.", contact_id: id },
  });

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
  const { data, error } = await supabase.from("third_party_addresses").insert({
    organization_id: workspace.organization.id,
    third_party_id: thirdPartyId,
    label,
    type: text(formData, "type") ?? "other",
    address,
    postal_code: text(formData, "postal_code"),
    city: text(formData, "city"),
    country: text(formData, "country") ?? "MA",
    is_default: formData.get("is_default") === "on",
  }).select("id").single();

  if (error) {
    return { success: false, error: "Impossible d'ajouter cette adresse." };
  }

  await logThirdPartyActivity({
    organizationId: workspace.organization.id,
    userId: workspace.userId,
    thirdPartyId,
    action: "create_address",
    changes: { message: `Adresse ajoutee: ${label}.`, address_id: data.id },
  });

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

  await logThirdPartyActivity({
    organizationId: workspace.organization.id,
    userId: workspace.userId,
    thirdPartyId,
    action: "update_address",
    changes: { message: "Adresse modifiee.", address_id: id },
  });

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

  await logThirdPartyActivity({
    organizationId: workspace.organization.id,
    userId: workspace.userId,
    thirdPartyId,
    action: "delete_address",
    changes: { message: "Adresse archivee.", address_id: id },
  });

  revalidatePath(`/tiers/${thirdPartyId}`);
  return { success: true };
}

export async function uploadThirdPartyAttachment(
  previousState: ThirdPartyActionResult,
  formData: FormData,
): Promise<ThirdPartyActionResult> {
  void previousState;
  const workspace = await requireActiveWorkspace();
  const thirdPartyId = text(formData, "third_party_id");
  const file = formData.get("file");

  if (!thirdPartyId) {
    return { success: false, error: "Identifiant tiers manquant." };
  }

  if (!(file instanceof File) || file.size === 0) {
    return { success: false, error: "Selectionnez un fichier a joindre." };
  }

  if (file.size > MAX_ATTACHMENT_SIZE) {
    return { success: false, error: "Le fichier ne doit pas depasser 10 Mo." };
  }

  const extension = fileExtension(file.name);
  if (!ALLOWED_ATTACHMENT_EXTENSIONS.has(extension) || !ALLOWED_ATTACHMENT_MIME_TYPES.has(file.type)) {
    return { success: false, error: "Format non autorise. Utilisez PDF, image JPG/PNG/WEBP ou Word." };
  }

  const supabase = await createClient();
  const { data: thirdParty, error: thirdPartyError } = await supabase
    .from("third_parties")
    .select("id")
    .eq("organization_id", workspace.organization.id)
    .eq("id", thirdPartyId)
    .maybeSingle();

  if (thirdPartyError || !thirdParty) {
    return { success: false, error: "Ce tiers est introuvable dans votre organisation." };
  }

  const fileName = safeFileName(file.name) || `piece-jointe.${extension}`;
  const timestamp = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
  const filePath = `${workspace.organization.id}/third_parties/${thirdPartyId}/${timestamp}-${fileName}`;
  const { error: uploadError } = await supabase.storage
    .from(ATTACHMENTS_BUCKET)
    .upload(filePath, file, { contentType: file.type, upsert: false });

  if (uploadError) {
    return { success: false, error: `Upload impossible. Verifiez le bucket Storage "${ATTACHMENTS_BUCKET}".` };
  }

  const { error: insertError } = await supabase.from("third_party_attachments").insert({
    organization_id: workspace.organization.id,
    third_party_id: thirdPartyId,
    file_name: file.name,
    file_path: filePath,
    file_type: extension,
    mime_type: file.type,
    file_size: file.size,
    uploaded_by: workspace.userId,
  });

  if (insertError) {
    await supabase.storage.from(ATTACHMENTS_BUCKET).remove([filePath]);
    return { success: false, error: "Fichier envoye, mais impossible d'enregistrer la piece jointe." };
  }

  await logThirdPartyActivity({
    organizationId: workspace.organization.id,
    userId: workspace.userId,
    thirdPartyId,
    action: "upload_attachment",
    changes: { message: `Piece jointe ajoutee: ${file.name}.`, file_name: file.name },
  });

  revalidatePath(`/tiers/${thirdPartyId}`);
  return { success: true };
}

export async function archiveThirdPartyAttachment(
  previousState: ThirdPartyActionResult,
  formData: FormData,
): Promise<ThirdPartyActionResult> {
  void previousState;
  const workspace = await requireActiveWorkspace();
  const id = text(formData, "id");
  const thirdPartyId = text(formData, "third_party_id");

  if (!id || !thirdPartyId) {
    return { success: false, error: "Identifiants de piece jointe requis." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("third_party_attachments")
    .update({ archived_at: new Date().toISOString() })
    .eq("organization_id", workspace.organization.id)
    .eq("third_party_id", thirdPartyId)
    .eq("id", id);

  if (error) {
    return { success: false, error: "Impossible d'archiver cette piece jointe." };
  }

  await logThirdPartyActivity({
    organizationId: workspace.organization.id,
    userId: workspace.userId,
    thirdPartyId,
    action: "archive_attachment",
    changes: { message: "Piece jointe archivee.", attachment_id: id },
  });

  revalidatePath(`/tiers/${thirdPartyId}`);
  return { success: true };
}
