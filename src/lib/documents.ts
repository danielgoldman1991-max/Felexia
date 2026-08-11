import { createClient } from "@/lib/supabase/server";
import { requireActiveWorkspace } from "@/lib/auth";
import {
  DOCUMENT_ORIGINS,
  DOCUMENT_SOURCE_MODULES,
  DOCUMENT_STATUSES,
  DOCUMENT_TYPES,
  type DocumentOriginValue,
  type DocumentStatusValue,
  type DocumentTypeValue,
} from "@/lib/document-types";

export { DOCUMENT_ORIGINS, DOCUMENT_SOURCE_MODULES, DOCUMENT_STATUSES, DOCUMENT_TYPES };
export type { DocumentOriginValue, DocumentStatusValue, DocumentTypeValue };

export type DocumentRecord = {
  id: string;
  organization_id: string;
  title: string;
  original_name: string | null;
  file_name: string | null;
  size_bytes: number | null;
  category: string | null;
  source_id: string | null;
  notes: string | null;
  uploaded_by: string | null;
  name: string;
  document_type: string;
  origin: string;
  source_module: string | null;
  linked_reference: string | null;
  linked_entity_type: string | null;
  linked_entity_id: string | null;
  linked_entity_name: string | null;
  file_url: string | null;
  file_path: string | null;
  mime_type: string | null;
  file_size: number | null;
  document_date: string | null;
  status: string;
  description: string | null;
  metadata: Record<string, unknown>;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
  deleted_at: string | null;
};

export type DocumentFilters = {
  query?: string;
  documentType?: string;
  sourceModule?: string;
  status?: string;
  dateFrom?: string;
  dateTo?: string;
};

export type DocumentsStats = {
  total: number;
  generated: number;
  imported: number;
  archived: number;
};

export type DocumentsListResult = {
  rows: DocumentRecord[];
  stats: DocumentsStats;
  setupMissing: boolean;
};

export type UnifiedDocumentRecord = {
  id: string;
  source: "upload" | "sales_document" | "customer_invoice" | "customer_credit_note" | "purchase_document" | "supplier_invoice";
  source_label: string;
  source_table: string;
  source_id: string;
  document_type: string;
  document_type_label: string;
  document_number: string | null;
  title: string;
  third_party_name: string | null;
  status: string | null;
  issue_date: string | null;
  total_ttc: number | null;
  file_name: string | null;
  file_path: string | null;
  file_url: string | null;
  print_url: string | null;
  created_at: string;
  uploaded_document?: DocumentRecord;
};

export type CreateDocumentRecordInput = {
  organization_id: string;
  name: string;
  document_type: DocumentTypeValue | string;
  origin?: DocumentOriginValue | string;
  source_module?: string | null;
  linked_reference?: string | null;
  linked_entity_type?: string | null;
  linked_entity_id?: string | null;
  file_url?: string | null;
  file_path?: string | null;
  mime_type?: string | null;
  file_size?: number | null;
  document_date?: string | null;
  status?: DocumentStatusValue | string;
  description?: string | null;
  metadata?: Record<string, unknown>;
};

const DOCUMENT_SELECT = `
  id, organization_id, uploaded_by, title, original_name, file_name,
  size_bytes, category, source_id, name, document_type, origin, source_module,
  linked_reference, linked_entity_type, linked_entity_id, file_url, file_path,
  mime_type, file_size, document_date, status, notes, description, metadata,
  created_by, created_at, updated_at, archived_at, deleted_at
`;

function labelFor(options: readonly { value: string; label: string }[], value: string | null | undefined) {
  if (!value) return "-";
  return options.find((option) => option.value === value)?.label ?? value;
}

export function getDocumentTypeLabel(value: string | null | undefined) {
  return labelFor(DOCUMENT_TYPES, value);
}

export function getDocumentOriginLabel(value: string | null | undefined) {
  return labelFor(DOCUMENT_ORIGINS, value);
}

export function getDocumentStatusLabel(value: string | null | undefined) {
  if (value === "active") return "Disponible";
  if (value === "partial") return "Partiellement payé";
  if (value === "canceled") return "Annulé";
  return labelFor(DOCUMENT_STATUSES, value);
}

export function getDocumentSourceModuleLabel(value: string | null | undefined) {
  return labelFor(DOCUMENT_SOURCE_MODULES, value);
}

export function formatFileSize(size: number | null | undefined) {
  if (!size || size <= 0) return "-";
  if (size < 1024) return `${size} o`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} Ko`;
  return `${(size / (1024 * 1024)).toFixed(1)} Mo`;
}

function emptyResult(setupMissing = false): DocumentsListResult {
  return {
    rows: [],
    stats: { total: 0, generated: 0, imported: 0, archived: 0 },
    setupMissing,
  };
}

function matchesFilters(document: UnifiedDocumentRecord, filters: DocumentFilters) {
  const query = filters.query?.trim().toLowerCase();
  if (query) {
    const haystack = [
      document.title,
      document.document_number,
      document.third_party_name,
      document.file_name,
    ].filter(Boolean).join(" ").toLowerCase();
    if (!haystack.includes(query)) return false;
  }
  if (filters.documentType && document.document_type !== filters.documentType) return false;
  if (filters.sourceModule && document.source !== filters.sourceModule && document.source_label.toLowerCase() !== filters.sourceModule) return false;
  if (filters.status) {
    const isAvailableAlias = filters.status === "available" && document.status === "active";
    if (document.status !== filters.status && !isAvailableAlias) return false;
  }
  if (filters.dateFrom && (!document.issue_date || document.issue_date < filters.dateFrom)) return false;
  if (filters.dateTo && (!document.issue_date || document.issue_date > filters.dateTo)) return false;
  return true;
}

function salesPrintUrl(type: string, id: string) {
  if (type === "quote") return `/vente/devis/${id}/print`;
  if (type === "order") return `/vente/commandes/${id}/print`;
  if (type === "delivery_note") return `/vente/livraisons/${id}/print`;
  if (type === "return_note") return `/vente/retours/${id}/print`;
  return null;
}

function purchasePrintUrl(type: string, id: string) {
  if (type === "supplier_order") return `/achats/commandes/${id}/print`;
  if (type === "supplier_receipt") return `/achats/receptions/${id}/print`;
  return null;
}

function salesTypeLabel(type: string) {
  if (type === "quote") return "Devis";
  if (type === "order") return "Commande client";
  if (type === "delivery_note") return "Bon de livraison";
  if (type === "return_note") return "Bon de retour";
  return type;
}

function purchaseTypeLabel(type: string) {
  if (type === "supplier_order") return "Commande fournisseur";
  if (type === "supplier_receipt") return "Réception fournisseur";
  return type;
}

function isMissingDocumentsTable(error: { message?: string; code?: string } | null) {
  return error?.code === "42P01" || error?.message?.toLowerCase().includes("documents") || false;
}

function objectValue(value: unknown) {
  if (!value || Array.isArray(value) || typeof value !== "object") return null;
  return value as Record<string, unknown>;
}

function mapDocument(row: Record<string, unknown>, entityById: Map<string, string>): DocumentRecord {
  const linkedEntityId = row.linked_entity_id as string | null;
  const title = (row.title as string | null) || (row.name as string);
  const originalName = (row.original_name as string | null) || (row.name as string | null);
  const fileName = (row.file_name as string | null) || originalName;
  const sizeBytes = row.size_bytes ?? row.file_size;
  const category = (row.category as string | null) || (row.document_type as string | null);
  return {
    id: row.id as string,
    organization_id: row.organization_id as string,
    title,
    original_name: originalName,
    file_name: fileName,
    size_bytes: sizeBytes === null || sizeBytes === undefined ? null : Number(sizeBytes),
    category,
    source_id: (row.source_id as string) ?? null,
    notes: ((row.notes as string | null) || (row.description as string | null)) ?? null,
    uploaded_by: (row.uploaded_by as string) ?? null,
    name: title,
    document_type: row.document_type as string,
    origin: row.origin as string,
    source_module: (row.source_module as string) ?? null,
    linked_reference: (row.linked_reference as string) ?? null,
    linked_entity_type: (row.linked_entity_type as string) ?? null,
    linked_entity_id: linkedEntityId,
    linked_entity_name: linkedEntityId ? entityById.get(linkedEntityId) ?? null : null,
    file_url: (row.file_url as string) ?? null,
    file_path: (row.file_path as string) ?? null,
    mime_type: (row.mime_type as string) ?? null,
    file_size: sizeBytes === null || sizeBytes === undefined ? null : Number(sizeBytes),
    document_date: (row.document_date as string) ?? null,
    status: row.status as string,
    description: (row.description as string) ?? null,
    metadata: (row.metadata as Record<string, unknown>) ?? {},
    created_by: (row.created_by as string) ?? null,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
    archived_at: (row.archived_at as string) ?? null,
    deleted_at: (row.deleted_at as string) ?? null,
  };
}

export async function listDocuments(filters: DocumentFilters = {}): Promise<DocumentsListResult> {
  const workspace = await requireActiveWorkspace();
  const supabase = await createClient();
  const statsResult = await supabase
    .from("documents")
    .select("id, origin, status, archived_at")
    .eq("organization_id", workspace.organization.id);

  let query = supabase
    .from("documents")
    .select(DOCUMENT_SELECT)
    .eq("organization_id", workspace.organization.id)
    .order("created_at", { ascending: false })
    .limit(200);

  const search = filters.query?.trim();
  if (search) {
    query = query.or(`title.ilike.%${search}%,name.ilike.%${search}%,original_name.ilike.%${search}%,linked_reference.ilike.%${search}%`);
  }
  if (filters.documentType) query = query.or(`document_type.eq.${filters.documentType},category.eq.${filters.documentType}`);
  if (filters.sourceModule) query = query.eq("source_module", filters.sourceModule);
  if (filters.status) {
    query = query.eq("status", filters.status);
  } else {
    query = query.not("status", "in", "(archived,deleted)");
  }
  if (filters.dateFrom) query = query.gte("document_date", filters.dateFrom);
  if (filters.dateTo) query = query.lte("document_date", filters.dateTo);

  const { data, error } = await query;
  if (error) {
    if (isMissingDocumentsTable(error)) return emptyResult(true);
    throw new Error(error.message);
  }
  if (statsResult.error && isMissingDocumentsTable(statsResult.error)) return emptyResult(true);

  const rawRows = (data ?? []) as Record<string, unknown>[];
  const linkedEntityIds = Array.from(new Set(rawRows.map((row) => row.linked_entity_id).filter(Boolean))) as string[];
  let entityById = new Map<string, string>();

  if (linkedEntityIds.length > 0) {
    const { data: entities } = await supabase
      .from("third_parties")
      .select("id, name, commercial_name")
      .eq("organization_id", workspace.organization.id)
      .in("id", linkedEntityIds);
    entityById = new Map(
      (entities ?? []).map((entity) => [
        entity.id as string,
        ((entity.commercial_name as string | null) || (entity.name as string | null) || "-"),
      ]),
    );
  }

  const rows = rawRows.map((row) => mapDocument(row, entityById));
  const statsRows = ((statsResult.data ?? []) as Record<string, unknown>[]);
  return {
    rows,
    stats: {
      total: statsRows.length,
      generated: statsRows.filter((row) => row.origin === "generated").length,
      imported: statsRows.filter((row) => row.origin === "manual_import").length,
      archived: statsRows.filter((row) => row.status === "archived" || row.origin === "archived" || Boolean(row.archived_at)).length,
    },
    setupMissing: false,
  };
}

export async function listUnifiedDocuments(filters: DocumentFilters = {}): Promise<{
  rows: UnifiedDocumentRecord[];
  stats: DocumentsStats;
  setupMissing: boolean;
}> {
  const workspace = await requireActiveWorkspace();
  const supabase = await createClient();
  const uploadsResult = await listDocuments(filters);

  const [
    salesResult,
    customerInvoicesResult,
    customerCreditNotesResult,
    purchaseDocumentsResult,
    supplierInvoicesResult,
  ] = await Promise.all([
    supabase
      .from("sales_documents")
      .select("id, document_type, document_number, status, document_date, total_ttc, created_at, customer:customer_id(name, commercial_name)")
      .eq("organization_id", workspace.organization.id)
      .is("archived_at", null),
    supabase
      .from("customer_invoices")
      .select("id, invoice_number, status, invoice_date, total_ttc, created_at, customer:customer_id(name, commercial_name)")
      .eq("organization_id", workspace.organization.id)
      .is("archived_at", null),
    supabase
      .from("customer_credit_notes")
      .select("id, credit_note_number, status, credit_note_date, total_ttc, created_at, customer:customer_id(name, commercial_name)")
      .eq("organization_id", workspace.organization.id)
      .is("archived_at", null),
    supabase
      .from("purchase_documents")
      .select("id, document_type, document_number, status, document_date, receipt_date, total_ttc, created_at, supplier:supplier_id(name, commercial_name)")
      .eq("organization_id", workspace.organization.id)
      .is("archived_at", null),
    supabase
      .from("supplier_invoices")
      .select("id, invoice_number, supplier_invoice_number, status, invoice_date, total_ttc, created_at, supplier:supplier_id(name, commercial_name)")
      .eq("organization_id", workspace.organization.id)
      .is("archived_at", null),
  ]);

  const rows: UnifiedDocumentRecord[] = [
    ...uploadsResult.rows.map((document) => ({
      id: `documents:${document.id}`,
      source: "upload" as const,
      source_label: "Upload",
      source_table: "documents",
      source_id: document.id,
      document_type: document.category ?? document.document_type,
      document_type_label: getDocumentTypeLabel(document.category ?? document.document_type),
      document_number: document.linked_reference,
      title: document.title,
      third_party_name: document.linked_entity_name,
      status: document.status,
      issue_date: document.document_date,
      total_ttc: null,
      file_name: document.file_name ?? document.original_name,
      file_path: document.file_path,
      file_url: document.file_url,
      print_url: `/documents/${document.id}/download`,
      created_at: document.created_at,
      uploaded_document: document,
    })),
    ...(((salesResult.data ?? []) as Record<string, unknown>[]).map((row) => {
      const type = row.document_type as string;
      const number = row.document_number as string;
      const customer = objectValue(row.customer);
      return {
        id: `sales_documents:${row.id as string}`,
        source: "sales_document" as const,
        source_label: "Vente",
        source_table: "sales_documents",
        source_id: row.id as string,
        document_type: type,
        document_type_label: salesTypeLabel(type),
        document_number: number,
        title: `${salesTypeLabel(type)} ${number}`,
        third_party_name: ((customer?.commercial_name as string | null) || (customer?.name as string | null)) ?? null,
        status: row.status as string | null,
        issue_date: row.document_date as string | null,
        total_ttc: row.total_ttc === null || row.total_ttc === undefined ? null : Number(row.total_ttc),
        file_name: null,
        file_path: null,
        file_url: null,
        print_url: salesPrintUrl(type, row.id as string),
        created_at: row.created_at as string,
      };
    })),
    ...(((customerInvoicesResult.data ?? []) as Record<string, unknown>[]).map((row) => {
      const customer = objectValue(row.customer);
      const number = row.invoice_number as string;
      return {
        id: `customer_invoices:${row.id as string}`,
        source: "customer_invoice" as const,
        source_label: "Facturation",
        source_table: "customer_invoices",
        source_id: row.id as string,
        document_type: "customer_invoice",
        document_type_label: "Facture client",
        document_number: number,
        title: `Facture client ${number}`,
        third_party_name: ((customer?.commercial_name as string | null) || (customer?.name as string | null)) ?? null,
        status: row.status as string | null,
        issue_date: row.invoice_date as string | null,
        total_ttc: row.total_ttc === null || row.total_ttc === undefined ? null : Number(row.total_ttc),
        file_name: null,
        file_path: null,
        file_url: null,
        print_url: `/facturation/factures/${row.id as string}/print`,
        created_at: row.created_at as string,
      };
    })),
    ...(((customerCreditNotesResult.data ?? []) as Record<string, unknown>[]).map((row) => {
      const customer = objectValue(row.customer);
      const number = row.credit_note_number as string;
      return {
        id: `customer_credit_notes:${row.id as string}`,
        source: "customer_credit_note" as const,
        source_label: "Facturation",
        source_table: "customer_credit_notes",
        source_id: row.id as string,
        document_type: "customer_credit_note",
        document_type_label: "Avoir client",
        document_number: number,
        title: `Avoir client ${number}`,
        third_party_name: ((customer?.commercial_name as string | null) || (customer?.name as string | null)) ?? null,
        status: row.status as string | null,
        issue_date: row.credit_note_date as string | null,
        total_ttc: row.total_ttc === null || row.total_ttc === undefined ? null : Number(row.total_ttc),
        file_name: null,
        file_path: null,
        file_url: null,
        print_url: `/facturation/avoirs/${row.id as string}/print`,
        created_at: row.created_at as string,
      };
    })),
    ...(((purchaseDocumentsResult.data ?? []) as Record<string, unknown>[]).map((row) => {
      const type = row.document_type as string;
      const number = row.document_number as string;
      const supplier = objectValue(row.supplier);
      return {
        id: `purchase_documents:${row.id as string}`,
        source: "purchase_document" as const,
        source_label: "Achats",
        source_table: "purchase_documents",
        source_id: row.id as string,
        document_type: type,
        document_type_label: purchaseTypeLabel(type),
        document_number: number,
        title: `${purchaseTypeLabel(type)} ${number}`,
        third_party_name: ((supplier?.commercial_name as string | null) || (supplier?.name as string | null)) ?? null,
        status: row.status as string | null,
        issue_date: (row.document_date as string | null) ?? (row.receipt_date as string | null),
        total_ttc: row.total_ttc === null || row.total_ttc === undefined ? null : Number(row.total_ttc),
        file_name: null,
        file_path: null,
        file_url: null,
        print_url: purchasePrintUrl(type, row.id as string),
        created_at: row.created_at as string,
      };
    })),
    ...(((supplierInvoicesResult.data ?? []) as Record<string, unknown>[]).map((row) => {
      const supplier = objectValue(row.supplier);
      const number = (row.supplier_invoice_number as string | null) || (row.invoice_number as string);
      return {
        id: `supplier_invoices:${row.id as string}`,
        source: "supplier_invoice" as const,
        source_label: "Achats",
        source_table: "supplier_invoices",
        source_id: row.id as string,
        document_type: "supplier_invoice",
        document_type_label: "Facture fournisseur",
        document_number: number,
        title: `Facture fournisseur ${number}`,
        third_party_name: ((supplier?.commercial_name as string | null) || (supplier?.name as string | null)) ?? null,
        status: row.status as string | null,
        issue_date: row.invoice_date as string | null,
        total_ttc: row.total_ttc === null || row.total_ttc === undefined ? null : Number(row.total_ttc),
        file_name: null,
        file_path: null,
        file_url: null,
        print_url: `/achats/factures/${row.id as string}/print`,
        created_at: row.created_at as string,
      };
    })),
  ];

  const filteredRows = rows
    .filter((row) => matchesFilters(row, filters))
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  return {
    rows: filteredRows,
    stats: {
      total: filteredRows.length,
      generated: filteredRows.filter((row) => row.source !== "upload").length,
      imported: filteredRows.filter((row) => row.source === "upload").length,
      archived: filteredRows.filter((row) => row.status === "archived").length,
    },
    setupMissing: uploadsResult.setupMissing,
  };
}

export async function createDocumentRecord(input: CreateDocumentRecordInput) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("documents")
    .insert({
      organization_id: input.organization_id,
      name: input.name,
      title: input.name,
      original_name: input.name,
      file_name: input.name,
      document_type: input.document_type,
      origin: input.origin ?? "generated",
      source_module: input.source_module ?? null,
      linked_reference: input.linked_reference ?? null,
      linked_entity_type: input.linked_entity_type ?? null,
      linked_entity_id: input.linked_entity_id ?? null,
      file_url: input.file_url ?? null,
      file_path: input.file_path ?? null,
      mime_type: input.mime_type ?? null,
      file_size: input.file_size ?? null,
      size_bytes: input.file_size ?? null,
      category: input.document_type,
      source_id: input.linked_entity_id ?? null,
      document_date: input.document_date ?? null,
      status: input.status ?? "available",
      description: input.description ?? null,
      notes: input.description ?? null,
      metadata: input.metadata ?? {},
    })
    .select(DOCUMENT_SELECT)
    .single();

  if (error) throw new Error(error.message);
  return data;
}
