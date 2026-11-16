import { decodeXmlEntities } from "@/lib/spreadsheet/xml-entities";

export const THIRD_PARTY_IMPORT_HEADERS = ["Nom", "Type", "ICE", "IF", "RC", "Email", "Téléphone", "Ville", "Adresse"] as const;

export const THIRD_PARTY_IMPORT_INSTRUCTIONS = [
  "Une ligne par contact. Le type est Client ou Fournisseur.",
  "ICE : 15 chiffres, s’il est connu. IF : 7 ou 8 chiffres. RC : 4 à 12 caractères.",
  "Téléphone : chiffres marocains, par exemple 0612000000. L’e-mail doit contenir @.",
  "Les lignes en erreur sont signalées et ne sont pas importées. Les autres le sont.",
].join(" ");

export const THIRD_PARTY_IMPORT_TEMPLATE = [
  `# ${THIRD_PARTY_IMPORT_INSTRUCTIONS}`,
  THIRD_PARTY_IMPORT_HEADERS.join(";"),
  "Atelier Démo;Client;001234567000018;12345678;12345;contact@exemple.test;0612000000;Casablanca;1 rue Démo",
].join("\r\n");

const HEADER_FIELDS: Record<string, "name" | "type" | "ice" | "ifNumber" | "rc" | "email" | "phone" | "city" | "address"> = {
  nom: "name",
  "raison sociale": "name",
  type: "type",
  ice: "ice",
  if: "ifNumber",
  "identifiant fiscal": "ifNumber",
  rc: "rc",
  email: "email",
  "e-mail": "email",
  telephone: "phone",
  tel: "phone",
  ville: "city",
  adresse: "address",
};

export type ThirdPartyImportKind = "customer" | "supplier";

export type ThirdPartyImportRow = {
  line: number;
  name: string;
  type: ThirdPartyImportKind;
  ice: string;
  ifNumber: string;
  rc: string;
  email: string;
  phone: string;
  city: string;
  address: string;
};

export type ThirdPartyImportIssue = { line: number; message: string };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_ROWS = 2000;

export function phoneDigits(value: string) {
  return value.replace(/[^\d]/g, "");
}

function fold(value: string) {
  return decodeXmlEntities(value).normalize("NFC").normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/\s+/g, " ").trim();
}

function parseCsv(text: string) {
  const rows: string[][] = [];
  let cell = "";
  let row: string[] = [];
  let quoted = false;
  const source = text.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (quoted && char === "\"" && source[index + 1] === "\"") {
      cell += "\"";
      index += 1;
    } else if (char === "\"") {
      quoted = !quoted;
    } else if (!quoted && char === ";") {
      row.push(decodeXmlEntities(cell).trim());
      cell = "";
    } else if (!quoted && char === "\n") {
      row.push(decodeXmlEntities(cell).trim());
      if (row.some((item) => item !== "")) rows.push(row);
      row = [];
      cell = "";
    } else cell += char;
  }
  row.push(decodeXmlEntities(cell).trim());
  if (row.some((item) => item !== "")) rows.push(row);
  return rows;
}

function kindFrom(value: string): ThirdPartyImportKind | null {
  const folded = fold(value);
  if (["client", "clients", "customer"].includes(folded)) return "customer";
  if (["fournisseur", "fournisseurs", "supplier"].includes(folded)) return "supplier";
  return null;
}

export function parseThirdPartyTable(table: string[][]): { rows: ThirdPartyImportRow[]; issues: ThirdPartyImportIssue[]; headerError?: string } {
  const source = table.filter((row) => !(row[0] ?? "").trim().startsWith("#"));
  if (source.length === 0) return { rows: [], issues: [], headerError: "Le fichier est vide." };
  const headers = source[0].map(fold);
  const unknown = source[0].filter((header) => header && !HEADER_FIELDS[fold(header)]);
  if (unknown.length) return { rows: [], issues: [], headerError: `Colonne inconnue : ${unknown.join(", ")}. Colonnes attendues : ${THIRD_PARTY_IMPORT_HEADERS.join(", ")}.` };
  if (!headers.includes("nom") && !headers.includes("raison sociale")) return { rows: [], issues: [], headerError: "La colonne Nom est obligatoire." };
  if (!headers.includes("type")) return { rows: [], issues: [], headerError: "La colonne Type est obligatoire (Client ou Fournisseur)." };
  const body = source.slice(1);
  if (body.length > MAX_ROWS) return { rows: [], issues: [], headerError: "Le fichier dépasse 2 000 lignes." };
  const rows: ThirdPartyImportRow[] = [];
  const issues: ThirdPartyImportIssue[] = [];
  body.forEach((cells, index) => {
    const line = index + 2;
    const value = (field: "name" | "type" | "ice" | "ifNumber" | "rc" | "email" | "phone" | "city" | "address") => {
      const column = headers.findIndex((header) => HEADER_FIELDS[header] === field);
      return column >= 0 ? cells[column] ?? "" : "";
    };
    const name = value("name");
    const type = kindFrom(value("type"));
    const ice = value("ice").replace(/\s/g, "");
    const ifNumber = value("ifNumber").replace(/\s/g, "");
    const rc = value("rc").replace(/\s/g, "");
    const email = value("email");
    const phone = value("phone");
    if (!name) issues.push({ line, message: `Ligne ${line} : le nom est obligatoire.` });
    if (!type) issues.push({ line, message: `Ligne ${line} : le type doit être Client ou Fournisseur.` });
    if (ice && !/^\d{15}$/.test(ice)) issues.push({ line, message: `Ligne ${line} : l’ICE doit contenir exactement 15 chiffres.` });
    if (ifNumber && !/^\d{7,8}$/.test(ifNumber)) issues.push({ line, message: `Ligne ${line} : l’IF doit contenir 7 ou 8 chiffres.` });
    if (rc && !/^[0-9A-Za-z/-]{4,12}$/.test(rc)) issues.push({ line, message: `Ligne ${line} : le RC n’a pas un format reconnu.` });
    if (email && !EMAIL.test(email)) issues.push({ line, message: `Ligne ${line} : l’e-mail n’est pas valide.` });
    const digits = phoneDigits(phone);
    if (phone && (digits.length < 9 || digits.length > 13)) issues.push({ line, message: `Ligne ${line} : le téléphone n’a pas un nombre de chiffres reconnu.` });
    if (name && type) rows.push({ line, name, type, ice, ifNumber, rc, email, phone, city: value("city"), address: value("address") });
  });
  return { rows, issues };
}

export function parseThirdPartyCsv(text: string): { rows: ThirdPartyImportRow[]; issues: ThirdPartyImportIssue[]; headerError?: string } {
  return parseThirdPartyTable(parseCsv(decodeXmlEntities(text)));
}

export function reviewThirdPartyRows(
  rows: ThirdPartyImportRow[],
  existing: { name: string; ice: string | null }[],
) {
  const issues: ThirdPartyImportIssue[] = [];
  const seenIce = new Map<string, number>();
  const seenName = new Map<string, number>();
  const knownIce = new Set(existing.map((item) => (item.ice ?? "").replace(/\s/g, "")).filter(Boolean));
  const knownName = new Set(existing.map((item) => fold(item.name)));
  for (const row of rows) {
    const nameKey = fold(row.name);
    if (row.ice) {
      const previous = seenIce.get(row.ice);
      if (previous) issues.push({ line: row.line, message: `Ligne ${row.line} : cet ICE est déjà utilisé ligne ${previous}.` });
      else seenIce.set(row.ice, row.line);
      if (knownIce.has(row.ice)) issues.push({ line: row.line, message: `Ligne ${row.line} : cet ICE existe déjà dans votre entreprise.` });
    }
    const previousName = seenName.get(nameKey);
    if (previousName) issues.push({ line: row.line, message: `Ligne ${row.line} : ce nom est déjà utilisé ligne ${previousName}.` });
    else seenName.set(nameKey, row.line);
    if (knownName.has(nameKey)) issues.push({ line: row.line, message: `Ligne ${row.line} : ce nom existe déjà dans votre entreprise.` });
  }
  return issues;
}
