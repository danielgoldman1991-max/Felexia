const CIN_PATTERN = /^[A-Za-z]{1,2}\d+$/;
const CNSS_PATTERN = /^\d{9}$/;

export function normalizeIdentity(value: string | null | undefined) {
  return (value ?? "").replace(/[\s-]/g, "").trim();
}

/** CIN marocaine : 1 ou 2 lettres puis des chiffres. Vide accepté. */
export function validateCin(value: string | null | undefined): string | null {
  const cin = normalizeIdentity(value);
  if (!cin) return null;
  if (!CIN_PATTERN.test(cin)) throw new Error("La CIN doit commencer par 1 ou 2 lettres, suivies de chiffres.");
  return cin.toUpperCase();
}

/** Numéro CNSS : 9 chiffres. Vide accepté. */
export function validateCnss(value: string | null | undefined): string | null {
  const cnss = normalizeIdentity(value);
  if (!cnss) return null;
  if (!CNSS_PATTERN.test(cnss)) throw new Error("Le numéro CNSS doit contenir exactement 9 chiffres.");
  return cnss;
}

function ribRemainder(digits: string) {
  let remainder = 0;
  for (const char of digits) remainder = (remainder * 10 + Number(char)) % 97;
  return remainder;
}

/** Clé RIB : les 24 chiffres doivent être divisibles par 97. */
export function ribKeyIsValid(digits: string) {
  return digits.length === 24 && ribRemainder(digits) === 0;
}

/** RIB marocain : 24 chiffres avec clé. Vide accepté. */
export function validateRib(value: string | null | undefined): string | null {
  const rib = normalizeIdentity(value);
  if (!rib) return null;
  if (!/^\d{24}$/.test(rib) || !ribKeyIsValid(rib)) {
    throw new Error("Le RIB doit contenir 24 chiffres et une clé valide.");
  }
  return rib;
}

export type EmployeeCsvRow = {
  employeeNumber: string;
  firstName: string;
  lastName: string;
  hireDate: string;
  baseSalary: number;
  cin: string | null;
  cnss: string | null;
  rib: string | null;
  email: string | null;
  city: string | null;
  dependents: number;
};

const CSV_COLUMNS = {
  matricule: ["matricule", "employee number"],
  prenom: ["prenom", "first name"],
  nom: ["nom", "last name"],
  date: ["date d embauche", "date embauche", "hire date"],
  salaire: ["salaire", "salaire de base", "base salary"],
  cin: ["cin"],
  cnss: ["cnss", "numero cnss", "n cnss", "cnss number"],
  rib: ["rib"],
  email: ["email", "e mail"],
  ville: ["ville", "city"],
  dependents: ["personnes a charge", "dependents"],
} as const;

type CsvField = keyof typeof CSV_COLUMNS;

const REQUIRED_FIELDS: CsvField[] = ["matricule", "prenom", "nom", "date", "salaire"];
const FIELD_LABELS: Record<CsvField, string> = {
  matricule: "Matricule",
  prenom: "Prénom",
  nom: "Nom",
  date: "Date d'embauche",
  salaire: "Salaire",
  cin: "CIN",
  cnss: "CNSS",
  rib: "RIB",
  email: "Email",
  ville: "Ville",
  dependents: "Personnes à charge",
};

export const EMPLOYEE_CSV_HEADERS = ["Matricule", "Prénom", "Nom", "Date d'embauche", "Salaire", "CIN", "CNSS", "RIB", "Email", "Ville", "Personnes à charge"] as const;

export function employeeCsvTemplate() {
  const example = ["E001", "Sara", "Alami", "2024-01-15", "8000,00", "AB123456", "123456789", "000000000000000000000097", "sara@example.com", "Casablanca", "1"];
  return `${EMPLOYEE_CSV_HEADERS.join(";")}\n${example.join(";")}\n`;
}

function fieldForHeader(header: string): CsvField | null {
  const fields = Object.keys(CSV_COLUMNS) as CsvField[];
  return fields.find((field) => (CSV_COLUMNS[field] as readonly string[]).includes(header)) ?? null;
}

function headerProblem(missing: string[], unknown: string[]) {
  const parts = ["Les en-têtes du fichier ne sont pas reconnus."];
  if (missing.length > 0) parts.push(`Colonnes manquantes : ${missing.join(", ")}.`);
  if (unknown.length > 0) parts.push(`Colonnes inconnues : ${unknown.join(", ")}.`);
  return parts.join(" ");
}

function foldHeader(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function splitCsvLine(line: string) {
  return line.split(";").map((cell) => cell.trim().replace(/^"(.*)"$/, "$1").trim());
}

function parseHireDate(value: string) {
  const iso = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const french = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  const match = iso ? [iso[1], iso[2], iso[3]] : french ? [french[3], french[2], french[1]] : null;
  if (!match) throw new Error("la date d'embauche doit être au format AAAA-MM-JJ ou JJ/MM/AAAA.");
  const [year, month, day] = match;
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  if (date.getUTCFullYear() !== Number(year) || date.getUTCMonth() !== Number(month) - 1 || date.getUTCDate() !== Number(day)) {
    throw new Error("la date d'embauche n'existe pas.");
  }
  return `${year}-${month}-${day}`;
}

function parseDependents(value: string) {
  if (!value) return 0;
  if (!/^\d+$/.test(value)) throw new Error("les personnes à charge doivent être un entier entre 0 et 6.");
  const count = Number(value);
  if (count > 6) throw new Error("les personnes à charge doivent être un entier entre 0 et 6.");
  return count;
}

function parseEmail(value: string) {
  if (!value) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) throw new Error("l'email n'est pas valide.");
  return value;
}

/** CSV point-virgule. En-têtes français acceptés : Matricule, Prénom, Nom, Date d'embauche, Salaire, CIN, CNSS, RIB, Email, Ville, Personnes à charge. */
export function parseEmployeeCsv(text: string): { rows: EmployeeCsvRow[]; errors: string[] } {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const errors: string[] = [];
  const rows: EmployeeCsvRow[] = [];
  const originalHeaders = splitCsvLine(lines[0] ?? "");
  const folded = originalHeaders.map(foldHeader);
  const index = { matricule: -1, prenom: -1, nom: -1, date: -1, salaire: -1, cin: -1, cnss: -1, rib: -1, email: -1, ville: -1, dependents: -1 };
  const unknown: string[] = [];
  folded.forEach((header, position) => {
    if (!header) return;
    const field = fieldForHeader(header);
    if (!field) {
      unknown.push(originalHeaders[position] || header);
      return;
    }
    if (index[field] < 0) index[field] = position;
  });
  const missing = REQUIRED_FIELDS.filter((field) => index[field] < 0).map((field) => FIELD_LABELS[field]);
  if (missing.length > 0 || unknown.length > 0) {
    return { rows: [], errors: [headerProblem(missing, unknown)] };
  }
  const seen = new Set<string>();
  lines.slice(1).forEach((line, offset) => {
    const cells = splitCsvLine(line);
    const lineNumber = offset + 2;
    const cell = (position: number) => (position >= 0 ? cells[position] ?? "" : "");
    const problems: string[] = [];
    function readField(parse: () => string | number | null, fallback: string | number | null) {
      try {
        return parse();
      } catch (error) {
        problems.push(error instanceof Error ? error.message : "ligne illisible.");
        return fallback;
      }
    }
    const employeeNumber = cell(index.matricule);
    const firstName = cell(index.prenom);
    const lastName = cell(index.nom);
    if (!employeeNumber || !firstName || !lastName) problems.push("matricule, prénom et nom sont obligatoires.");
    const key = employeeNumber.toLowerCase();
    if (employeeNumber && seen.has(key)) problems.push("ce matricule est déjà présent dans le fichier.");
    if (employeeNumber) seen.add(key);
    const hireDate = readField(() => parseHireDate(cell(index.date)), "");
    const baseSalary = readField(() => parseHrSalary(cell(index.salaire)), 0);
    const cin = readField(() => validateCin(cell(index.cin)), null);
    const cnss = readField(() => validateCnss(cell(index.cnss)), null);
    const rib = readField(() => validateRib(cell(index.rib)), null);
    const email = readField(() => parseEmail(cell(index.email)), null);
    const dependents = readField(() => parseDependents(cell(index.dependents)), 0);
    if (problems.length > 0) {
      errors.push(`Ligne ${lineNumber} : ${problems.join(" ")}`);
      return;
    }
    rows.push({
      employeeNumber,
      firstName,
      lastName,
      hireDate: String(hireDate),
      baseSalary: Number(baseSalary),
      cin: typeof cin === "string" ? cin : null,
      cnss: typeof cnss === "string" ? cnss : null,
      rib: typeof rib === "string" ? rib : null,
      email: typeof email === "string" ? email : null,
      city: cell(index.ville) || null,
      dependents: Number(dependents),
    });
  });
  return { rows, errors };
}

/** Any line error refuses the whole file. Nothing is written. */
export function employeeImportDecision(parsed: { rows: EmployeeCsvRow[]; errors: string[] }) {
  if (parsed.errors.length > 0) {
    if (parsed.errors.length === 1 && parsed.errors[0].startsWith("Les en-têtes")) {
      return { ok: false as const, error: parsed.errors[0] };
    }
    return { ok: false as const, error: "Aucune ligne n'a été importée. Corrigez toutes les lignes signalées avant de recommencer." };
  }
  if (parsed.rows.length === 0) return { ok: false as const, error: "Le fichier ne contient aucun salarié." };
  return { ok: true as const, rows: parsed.rows };
}

/** Explicit decimal input; a failed parse must never silently become salary0. */
export function parseHrSalary(raw: FormDataEntryValue | null): number {
  if (typeof raw !== "string" || !raw.trim()) throw new Error("Le salaire de base est obligatoire. Saisissez 0 explicitement si nécessaire.");
  const input = raw.trim();
  const plain = /^\d+(?:[.,]\d{1,2})?$/;
  const grouped = /^\d{1,3}(?:[ \u00a0\u202f]\d{3})+(?:[.,]\d{1,2})?$/;
  if (!plain.test(input) && !grouped.test(input)) throw new Error("Le salaire doit être un montant positif ou nul avec au plus deux décimales.");
  const value = Number(input.replace(/[ \u00a0\u202f]/g, "").replace(",", "."));
  if (!Number.isFinite(value) || value < 0 || value > 999999999999.99) throw new Error("Le salaire de base est hors limites.");
  return value;
}
