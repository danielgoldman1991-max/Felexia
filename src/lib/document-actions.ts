"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireActiveWorkspace } from "@/lib/auth";

export type DocumentActionState = {
  success: boolean;
  error?: string | null;
};

const DOCUMENTS_BUCKET = "organization-documents";
const MAX_DOCUMENT_SIZE = 20 * 1024 * 1024;
const ALLOWED_DOCUMENT_MIME_TYPES = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/csv",
]);

function text(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function safeFileName(name: string) {
  const parts = name.split(".");
  const extension = parts.length > 1 ? parts.pop()?.toLowerCase() : "";
  const base = parts.join(".") || "document";
  const normalized = base
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
  return `${normalized || "document"}${extension ? `.${extension}` : ""}`;
}

function documentTypeFromCategory(category: string | null) {
  return category || "imported_document";
}

async function loadDocumentForWorkspace(id: string) {
  const workspace = await requireActiveWorkspace();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("documents")
    .select("id, organization_id, uploaded_by, file_path, status")
    .eq("organization_id", workspace.organization.id)
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return { workspace, supabase, document: data as { id: string; organization_id: string; uploaded_by: string | null; file_path: string | null; status: string } | null };
}

export async function uploadDocumentAction(
  previousState: DocumentActionState,
  formData: FormData,
): Promise<DocumentActionState> {
  void previousState;
  const workspace = await requireActiveWorkspace();
  const file = formData.get("file");

  if (!(file instanceof File) || file.size === 0) {
    return { success: false, error: "Aucun fichier sélectionné." };
  }
  if (file.size > MAX_DOCUMENT_SIZE) {
    return { success: false, error: "Le fichier dépasse 20 Mo." };
  }
  if (!ALLOWED_DOCUMENT_MIME_TYPES.has(file.type)) {
    return { success: false, error: "Format non autorisé." };
  }

  const supabase = await createClient();
  const documentId = randomUUID();
  const originalName = file.name;
  const fileName = safeFileName(originalName);
  const title = text(formData, "title") ?? originalName.replace(/\.[^.]+$/, "");
  const category = text(formData, "category") ?? "imported_document";
  const sourceModule = text(formData, "source_module") ?? "documents";
  const linkedReference = text(formData, "linked_reference");
  const notes = text(formData, "notes");
  const filePath = `organizations/${workspace.organization.id}/documents/${documentId}/${fileName}`;

  const { error: uploadError } = await supabase.storage
    .from(DOCUMENTS_BUCKET)
    .upload(filePath, file, {
      contentType: file.type,
      upsert: false,
    });

  if (uploadError) {
    return {
      success: false,
      error: `Le stockage des documents n'est pas configuré. Appliquez les migrations Supabase.`,
    };
  }

  const { error: insertError } = await supabase.from("documents").insert({
    id: documentId,
    organization_id: workspace.organization.id,
    uploaded_by: workspace.userId,
    created_by: workspace.userId,
    title,
    name: title,
    original_name: originalName,
    file_name: fileName,
    document_type: documentTypeFromCategory(category),
    category,
    origin: "manual_import",
    source_module: sourceModule,
    linked_reference: linkedReference,
    linked_entity_type: null,
    linked_entity_id: null,
    source_id: null,
    file_path: filePath,
    file_url: null,
    mime_type: file.type,
    file_size: file.size,
    size_bytes: file.size,
    document_date: text(formData, "document_date"),
    status: "active",
    notes,
    description: notes,
    metadata: {},
  });

  if (insertError) {
    await supabase.storage.from(DOCUMENTS_BUCKET).remove([filePath]);
    return { success: false, error: "Fichier envoyé, mais impossible d'enregistrer le document." };
  }

  revalidatePath("/documents");
  revalidatePath("/documents/import-export");
  redirect("/documents?uploaded=1");
}

export async function archiveDocumentAction(formData: FormData) {
  const id = text(formData, "id");
  if (!id) return;

  const { supabase, document } = await loadDocumentForWorkspace(id);
  if (!document) return;

  await supabase
    .from("documents")
    .update({
      status: "archived",
      archived_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", document.id)
    .eq("organization_id", document.organization_id);

  revalidatePath("/documents");
}

export async function deleteDocumentAction(formData: FormData) {
  const id = text(formData, "id");
  if (!id) return;

  const { supabase, document } = await loadDocumentForWorkspace(id);
  if (!document) return;

  await supabase
    .from("documents")
    .update({
      status: "deleted",
      deleted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", document.id)
    .eq("organization_id", document.organization_id);

  revalidatePath("/documents");
}
