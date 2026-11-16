import { createHash } from "node:crypto";
import { unzip, zipStore } from "@/lib/export/archive";

export const BACKUP_FORMAT = "felexia-backup";
export const BACKUP_SCHEMA_VERSION = 1;

/** Parents before children. Restore inserts in this order and deletes in reverse. */
export const BACKUP_TABLES = [
  { name: "company_settings", label: "Paramètres de l’entreprise", conflict: "organization_id" },
  { name: "third_parties", label: "Clients et fournisseurs", conflict: "id" },
  { name: "products", label: "Articles", conflict: "id" },
  { name: "customer_invoices", label: "Factures clients", conflict: "id" },
  { name: "customer_invoice_lines", label: "Lignes de factures clients", conflict: "id" },
  { name: "customer_payments", label: "Règlements clients", conflict: "id" },
  { name: "supplier_invoices", label: "Factures fournisseurs", conflict: "id" },
  { name: "supplier_invoice_lines", label: "Lignes de factures fournisseurs", conflict: "id" },
  { name: "supplier_payments", label: "Règlements fournisseurs", conflict: "id" },
  { name: "supplier_invoice_attachments", label: "Références des pièces jointes fournisseurs", conflict: "id" },
  { name: "accounting_entries", label: "Écritures comptables", conflict: "id" },
  { name: "accounting_entry_lines", label: "Lignes d’écritures", conflict: "id" },
  { name: "treasury_accounts", label: "Comptes de trésorerie", conflict: "id" },
  { name: "treasury_movements", label: "Mouvements de trésorerie", conflict: "id" },
  { name: "hr_employees", label: "Salariés", conflict: "id" },
] as const;

export type BackupTableName = (typeof BACKUP_TABLES)[number]["name"];

export type BackupManifest = {
  format: typeof BACKUP_FORMAT;
  schemaVersion: number;
  createdAt: string;
  organizationId: string;
  organizationName: string;
  tables: { name: BackupTableName; label: string; count: number; sha256: string }[];
  omitted: { name: string; reason: string }[];
  checksum: string;
};

export type BackupTable = { name: BackupTableName; rows: Record<string, unknown>[] };

const TABLE_NAMES = new Set<string>(BACKUP_TABLES.map((table) => table.name));

function sha256(data: Buffer | string) {
  return createHash("sha256").update(data).digest("hex");
}

function tableFile(name: string) {
  return `tables/${name}.json`;
}

function canonicalRows(rows: Record<string, unknown>[]) {
  return Buffer.from(JSON.stringify(rows), "utf8");
}

function checksumOf(manifest: Omit<BackupManifest, "checksum">) {
  const lines = manifest.tables.map((table) => `${table.name}:${table.count}:${table.sha256}`).join("\n");
  return sha256(`${manifest.format}|${manifest.schemaVersion}|${manifest.organizationId}|${manifest.createdAt}|${lines}`);
}

export function buildOrganizationBackup(input: {
  organizationId: string;
  organizationName: string;
  createdAt: string;
  tables: BackupTable[];
  omitted?: BackupManifest["omitted"];
}) {
  const files: { name: string; data: Buffer }[] = [];
  const described = input.tables.map((table) => {
    const meta = BACKUP_TABLES.find((item) => item.name === table.name);
    if (!meta) throw new Error(`Table non autorisée : ${table.name}`);
    const data = canonicalRows(table.rows);
    files.push({ name: tableFile(table.name), data });
    return { name: table.name, label: meta.label, count: table.rows.length, sha256: sha256(data) };
  });
  const unsigned = {
    format: BACKUP_FORMAT,
    schemaVersion: BACKUP_SCHEMA_VERSION,
    createdAt: input.createdAt,
    organizationId: input.organizationId,
    organizationName: input.organizationName,
    tables: described,
    omitted: input.omitted ?? [],
  } satisfies Omit<BackupManifest, "checksum">;
  const manifest: BackupManifest = { ...unsigned, checksum: checksumOf(unsigned) };
  files.unshift({ name: "manifest.json", data: Buffer.from(JSON.stringify(manifest, null, 2), "utf8") });
  files.push({
    name: "lire-moi.txt",
    data: Buffer.from([
      "Sauvegarde Felexia de l’entreprise ouverte dans votre session.",
      "Chaque fichier JSON ne contient que les lignes de cette entreprise.",
      "Les pièces jointes sont citées par leur référence, pas recopiées.",
      "La restauration réécrit toujours l’identifiant d’entreprise avec celui de la session.",
      "Le mode par défaut ajoute ou met à jour. Il ne supprime rien.",
    ].join("\r\n"), "utf8"),
  });
  return { manifest, zip: zipStore(files) };
}

export function readOrganizationBackup(zip: Buffer): { manifest: BackupManifest; tables: BackupTable[] } {
  let files: Map<string, Buffer>;
  try {
    files = unzip(zip);
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : "Le fichier ZIP est illisible.");
  }
  const raw = files.get("manifest.json");
  if (!raw) throw new Error("Le manifeste est absent. Ce n’est pas une sauvegarde Felexia.");
  let manifest: BackupManifest;
  try {
    manifest = JSON.parse(raw.toString("utf8")) as BackupManifest;
  } catch {
    throw new Error("Le manifeste n’est pas un JSON valide.");
  }
  if (manifest.format !== BACKUP_FORMAT) throw new Error("Ce fichier n’est pas une sauvegarde Felexia.");
  if (manifest.schemaVersion !== BACKUP_SCHEMA_VERSION) throw new Error(`Version de sauvegarde non prise en charge (${manifest.schemaVersion}).`);
  if (!Array.isArray(manifest.tables)) throw new Error("Le manifeste ne décrit aucune table.");
  const { checksum, ...unsigned } = manifest;
  if (checksum !== checksumOf(unsigned)) throw new Error("Le manifeste a été modifié. La sauvegarde est refusée.");
  const tables: BackupTable[] = [];
  for (const table of manifest.tables) {
    if (!TABLE_NAMES.has(table.name)) throw new Error(`Table non autorisée dans la sauvegarde : ${table.name}.`);
    const data = files.get(tableFile(table.name));
    if (!data) throw new Error(`Le fichier ${table.name} est absent.`);
    if (sha256(data) !== table.sha256) throw new Error(`Le fichier ${table.label} a été modifié. La sauvegarde est refusée.`);
    let rows: unknown;
    try {
      rows = JSON.parse(data.toString("utf8"));
    } catch {
      throw new Error(`Le fichier ${table.label} n’est pas un JSON valide.`);
    }
    if (!Array.isArray(rows)) throw new Error(`Le fichier ${table.label} doit contenir une liste.`);
    if (rows.length !== table.count) throw new Error(`Le nombre de lignes de ${table.label} ne correspond pas au manifeste.`);
    tables.push({ name: table.name, rows: rows as Record<string, unknown>[] });
  }
  return { manifest, tables };
}

export type RestorePlan = {
  mode: "merge" | "replace";
  counts: { name: BackupTableName; label: string; incoming: number; foreignOrganizationRows: number }[];
  tables: { name: BackupTableName; conflict: "id" | "organization_id"; rows: Record<string, unknown>[] }[];
};

/** Forces every row onto the signed-in organization. A foreign id is counted, never trusted. */
export function planOrganizationRestore(backup: { manifest: BackupManifest; tables: BackupTable[] }, organizationId: string, mode: "merge" | "replace"): RestorePlan {
  const counts = backup.tables.map((table) => {
    const meta = BACKUP_TABLES.find((item) => item.name === table.name)!;
    const foreignOrganizationRows = table.rows.filter((row) => {
      const value = row.organization_id;
      return typeof value === "string" && value.length > 0 && value !== organizationId;
    }).length;
    return { name: table.name, label: meta.label, incoming: table.rows.length, foreignOrganizationRows };
  });
  const tables = backup.tables.map((table) => {
    const meta = BACKUP_TABLES.find((item) => item.name === table.name)!;
    return {
      name: table.name,
      conflict: meta.conflict,
      rows: table.rows.map((row) => ({ ...row, organization_id: organizationId })),
    };
  });
  return { mode, counts, tables };
}

/** Both confirmations are required before a replace can be sent. */
export function replaceConfirmationReady(checked: boolean, typedName: string, organizationName: string) {
  return checked && typedName.trim() === organizationName;
}

/** Turns a sanitized database failure into an admin message. Never echoes row contents. */
export function describeRestoreFailure(message: string | null | undefined, code: string | null | undefined) {
  const blocked = /RESTORE_BLOCKED\|([a-z0-9_]+)\|([0-9A-Z]{5})/.exec(message ?? "");
  if (blocked) {
    const known = BACKUP_TABLES.find((item) => item.name === blocked[1]);
    return {
      table: known ? blocked[1] : null,
      sqlstate: blocked[2],
      userMessage: known
        ? `La restauration a été annulée à la table « ${known.label} ». Aucune donnée n’a été modifiée.`
        : "La restauration a été annulée. Aucune donnée n’a été modifiée.",
    };
  }
  if (message === "RESTORE_FORBIDDEN") {
    return {
      table: null,
      sqlstate: "42501",
      userMessage: "Réservé au propriétaire ou à l’administrateur de l’entreprise. Aucune donnée n’a été modifiée.",
    };
  }
  const sqlstate = code && /^[0-9A-Z]{5}$/.test(code) ? code : null;
  const missing = /restore_organization_backup|schema cache|PGRST202/i.test(message ?? "");
  return {
    table: null,
    sqlstate,
    userMessage: missing
      ? "La restauration n’est pas encore installée sur la base (migration 147). Aucune donnée n’a été modifiée."
      : "La restauration a été annulée. Aucune donnée n’a été modifiée.",
  };
}
