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
  matricule: ["matricule"],
  prenom: ["prenom"],
  nom: ["nom"],
  date: ["date d embauche", "date embauche"],
  salaire: ["salaire", "salaire de base"],
  cin: ["cin"],
  cnss: ["cnss", "numero cnss", "n cnss"],
  rib: ["rib"],
  email: ["email", "e mail"],
  ville: ["ville"],
  dependents: ["personnes a charge"],
} as const;

function foldHeader(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function splitCsvLine(line: string) {
  return line.split(";").map((cell) => cell.trim().replace(/^"(.*)"$/, "$1").trim());
}

function headerIndex(headers: string[], names: readonly string[]) {
  return headers.findIndex((header) => names.includes(header));
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
  const folded = splitCsvLine(lines[0] ?? "").map(foldHeader);
  const mapped = folded.includes("matricule") && folded.includes("nom");
  const index = mapped
    ? {
      matricule: headerIndex(folded, CSV_COLUMNS.matricule),
      prenom: headerIndex(folded, CSV_COLUMNS.prenom),
      nom: headerIndex(folded, CSV_COLUMNS.nom),
      date: headerIndex(folded, CSV_COLUMNS.date),
      salaire: headerIndex(folded, CSV_COLUMNS.salaire),
      cin: headerIndex(folded, CSV_COLUMNS.cin),
      cnss: headerIndex(folded, CSV_COLUMNS.cnss),
      rib: headerIndex(folded, CSV_COLUMNS.rib),
      email: headerIndex(folded, CSV_COLUMNS.email),
      ville: headerIndex(folded, CSV_COLUMNS.ville),
      dependents: headerIndex(folded, CSV_COLUMNS.dependents),
    }
    : { matricule: 0, prenom: 1, nom: 2, date: 3, salaire: 4, cin: 5, cnss: 6, rib: 7, email: 8, ville: 9, dependents: 10 };
  if (mapped && (index.prenom < 0 || index.date < 0 || index.salaire < 0)) {
    return { rows: [], errors: ["La première ligne doit contenir les colonnes Matricule, Prénom, Nom, Date d'embauche et Salaire."] };
  }
  const seen = new Set<string>();
  lines.slice(mapped ? 1 : 0).forEach((line, offset) => {
    const cells = splitCsvLine(line);
    const lineNumber = offset + (mapped ? 2 : 1);
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
