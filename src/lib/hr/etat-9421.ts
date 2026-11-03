export type AnnualIrRow = {
  employeeNumber: string;
  fullName: string;
  cin: string;
  taxable: number;
  irWithheld: number;
  dependents: number;
};

/** État 9421 préparatoire : cumul annuel imposable et IR retenu. Pas le dépôt EDI officiel. */
export function buildEtat9421(year: number, rows: AnnualIrRow[]): string {
  const header = ["Matricule", "Nom", "CIN", "Revenu imposable", "IR retenu", "Personnes a charge"];
  const body = rows.map((row) => [
    row.employeeNumber,
    row.fullName,
    row.cin || "",
    row.taxable.toFixed(2),
    row.irWithheld.toFixed(2),
    String(row.dependents),
  ].join(";"));
  const taxable = rows.reduce((sum, row) => sum + row.taxable, 0);
  const ir = rows.reduce((sum, row) => sum + row.irWithheld, 0);
  return [`ETAT9421;PREPARATOIRE;ANNEE;${year}`, header.join(";"), ...body, `TOTAL;;${taxable.toFixed(2)};${ir.toFixed(2)};`, ""].join("\n");
}
