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

/** CSV séparateur point-virgule : matricule;prenom;nom;date_embauche;salaire;cin;cnss;rib;email;ville;personnes_a_charge */
export function parseEmployeeCsv(text: string): { rows: EmployeeCsvRow[]; errors: string[] } {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const errors: string[] = [];
  const rows: EmployeeCsvRow[] = [];
  const start = lines[0]?.toLowerCase().includes("matricule") ? 1 : 0;
  lines.slice(start).forEach((line, index) => {
    const cells = line.split(";").map((cell) => cell.trim());
    const lineNumber = index + start + 1;
    try {
      const employeeNumber = cells[0] ?? "";
      const firstName = cells[1] ?? "";
      const lastName = cells[2] ?? "";
      const hireDate = cells[3] ?? "";
      if (!employeeNumber || !firstName || !lastName || !/^\d{4}-\d{2}-\d{2}$/.test(hireDate)) {
        throw new Error("matricule, prénom, nom et date AAAA-MM-JJ sont obligatoires.");
      }
      rows.push({
        employeeNumber,
        firstName,
        lastName,
        hireDate,
        baseSalary: parseHrSalary(cells[4] ?? ""),
        cin: validateCin(cells[5]),
        cnss: validateCnss(cells[6]),
        rib: validateRib(cells[7]),
        email: cells[8] || null,
        city: cells[9] || null,
        dependents: Math.max(0, Math.min(6, Math.round(Number(cells[10] || 0) || 0))),
      });
    } catch (error) {
      errors.push(`Ligne ${lineNumber} : ${error instanceof Error ? error.message : "ligne illisible."}`);
    }
  });
  return { rows, errors };
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
