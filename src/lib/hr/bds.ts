export type BdsEmployee = {
  cnssNumber: string;
  lastName: string;
  firstName: string;
  days: number;
  gross: number;
  capped: number;
};

/** Extrait préparatoire inspiré d'un bordereau de salaires. Ce n'est pas un dépôt Damancom. */
export function buildPreparatoryBds(period: string, employees: BdsEmployee[]): string {
  const lines = [
    `BDS;PREPARATOIRE;PERIODE;${period}`,
    "TYPE;CNSS;NOM;PRENOM;JOURS;SALAIRE_BRUT;SALAIRE_PLAFONNE",
  ];
  for (const employee of employees) {
    lines.push([
      "SAL",
      employee.cnssNumber || "A_COMPLETER",
      employee.lastName,
      employee.firstName,
      String(employee.days),
      employee.gross.toFixed(2),
      employee.capped.toFixed(2),
    ].join(";"));
  }
  lines.push(`FIN;${employees.length}`);
  return `${lines.join("\n")}\n`;
}
