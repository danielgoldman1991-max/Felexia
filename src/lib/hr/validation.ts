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
