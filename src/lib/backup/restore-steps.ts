import { BACKUP_TABLES, RESTORE_BATCH_ROWS, type BackupTableName, type RestorePlan } from "@/lib/backup/org-backup";

/** A posted entry is checked with its lines at the end of the transaction. Keep each document whole, and cap the batch by line count. */
export const RESTORE_LINE_BUDGET = 200;

export type RestoreGroup = {
  parent: BackupTableName;
  child: BackupTableName;
  childKey: string;
  label: string;
};

/** The only DEFERRABLE constraint in the migrations is the posted-entry balance.
 *  Invoices, credit notes and payments are grouped with their lines for the same reason:
 *  a validated parent and its lines must be restored in one call. */
export const RESTORE_GROUPS: RestoreGroup[] = [
  { parent: "accounting_entries", child: "accounting_entry_lines", childKey: "entry_id", label: "Écritures comptables" },
  { parent: "customer_invoices", child: "customer_invoice_lines", childKey: "invoice_id", label: "Factures clients" },
  { parent: "supplier_invoices", child: "supplier_invoice_lines", childKey: "invoice_id", label: "Factures fournisseurs" },
  { parent: "customer_credit_notes", child: "customer_credit_note_lines", childKey: "credit_note_id", label: "Avoirs clients" },
  { parent: "supplier_credit_notes", child: "supplier_credit_note_lines", childKey: "credit_note_id", label: "Avoirs fournisseurs" },
  { parent: "customer_payments", child: "customer_payment_allocations", childKey: "payment_id", label: "Règlements clients" },
  { parent: "supplier_payments", child: "supplier_payment_allocations", childKey: "payment_id", label: "Règlements fournisseurs" },
  { parent: "sales_documents", child: "sales_document_lines", childKey: "document_id", label: "Documents de vente" },
  { parent: "purchase_documents", child: "purchase_document_lines", childKey: "document_id", label: "Documents d’achat" },
];

export type RestoreStep = {
  label: string;
  phase: "rehearse" | "write" | "purge";
  parent: BackupTableName;
  child?: BackupTableName;
  childKey?: string;
  parentIds: string[];
  offset?: number;
  /** Dry run that only checks references from tables that are not in the file. */
  probe?: "external";
};

const GROUP_BY_PARENT = new Map(RESTORE_GROUPS.map((group) => [group.parent, group]));
const CHILD_TABLES = new Set(RESTORE_GROUPS.map((group) => group.child));

function rowsOf(plan: RestorePlan, name: string) {
  return plan.tables.find((table) => table.name === name)?.rows ?? [];
}

function pack(parentRows: Record<string, unknown>[], childRows: Record<string, unknown>[], childKey: string) {
  const children = new Map<string, number>();
  for (const row of childRows) {
    const key = String(row[childKey] ?? "");
    children.set(key, (children.get(key) ?? 0) + 1);
  }
  const packs: string[][] = [];
  let current: string[] = [];
  let lines = 0;
  for (const row of parentRows) {
    const id = String(row.id ?? "");
    if (!id) continue;
    const count = children.get(id) ?? 0;
    if (current.length > 0 && lines + count > RESTORE_LINE_BUDGET) {
      packs.push(current);
      current = [];
      lines = 0;
    }
    current.push(id);
    lines += count;
  }
  if (current.length > 0) packs.push(current);
  return packs;
}

export function buildRestoreSteps(plan: RestorePlan, mode: "merge" | "replace"): RestoreStep[] {
  const writes: RestoreStep[] = [];
  const rehearsals: RestoreStep[] = [];
  const purges: RestoreStep[] = [];
  for (const table of BACKUP_TABLES) {
    if (CHILD_TABLES.has(table.name)) continue;
    const present = plan.tables.some((item) => item.name === table.name);
    if (!present) continue;
    const group = GROUP_BY_PARENT.get(table.name);
    if (group) {
      const parents = rowsOf(plan, group.parent);
      const children = rowsOf(plan, group.child);
      const packs = pack(parents, children, group.childKey);
      for (const parentIds of packs) {
        const step: RestoreStep = { label: group.label, phase: "write", parent: group.parent, child: group.child, childKey: group.childKey, parentIds };
        writes.push(step);
        if (mode === "replace") rehearsals.push({ ...step, phase: "rehearse" });
      }
      if (mode === "replace") {
        const keepIds = parents.map((row) => String(row.id ?? "")).filter(Boolean);
        purges.push({ label: group.label, phase: "purge", parent: group.parent, child: group.child, childKey: group.childKey, parentIds: keepIds });
        rehearsals.push({ label: group.label, phase: "rehearse", parent: group.parent, child: group.child, childKey: group.childKey, parentIds: keepIds, probe: "external" });
      }
      continue;
    }
    if (table.name === "company_settings") {
      writes.push({ label: table.label, phase: "write", parent: table.name, parentIds: [] });
      continue;
    }
    const count = rowsOf(plan, table.name).length;
    const chunks = Math.max(1, Math.ceil(count / RESTORE_BATCH_ROWS));
    for (let index = 0; index < chunks; index += 1) {
      writes.push({ label: table.label, phase: "write", parent: table.name, parentIds: [], offset: index * RESTORE_BATCH_ROWS });
    }
    if (mode === "replace") {
      const keepIds = rowsOf(plan, table.name).map((row) => String(row.id ?? "")).filter(Boolean);
      purges.push({ label: table.label, phase: "purge", parent: table.name, parentIds: keepIds });
      rehearsals.push({ label: table.label, phase: "rehearse", parent: table.name, parentIds: keepIds, probe: "external" });
    }
  }
  return mode === "replace" ? [...rehearsals, ...writes, ...purges.reverse()] : writes;
}

export function restoreProgress(step: RestoreStep, index: number, total: number) {
  const position = `${index + 1}/${total}`;
  if (step.phase === "rehearse") return `Essai à blanc : ${step.label} ${position} …`;
  if (step.phase === "purge") return `Retrait des données absentes du fichier : ${step.label} ${position} …`;
  return `Restauration : ${step.label} ${position} …`;
}
