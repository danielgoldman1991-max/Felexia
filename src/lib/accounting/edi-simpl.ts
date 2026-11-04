export type SimplLine = {
  code: string;
  base: number;
  tax: number;
};

/** Déclaration préparatoire au format texte SIMPL. Ce n'est pas un télé-dépôt DGI. */
export function buildEdiSimpl(ice: string, period: string, lines: SimplLine[], fiscalId?: string | null): string {
  const body = [
    `SIMPL;PREPARATOIRE;ICE;${ice};IF;${fiscalId?.trim() || "A_COMPLETER"};PERIODE;${period}`,
    "CODE;BASE;TAXE",
    ...lines.map((line) => `${line.code};${line.base.toFixed(2)};${line.tax.toFixed(2)}`),
  ];
  const tax = lines.reduce((sum, line) => sum + line.tax, 0);
  body.push(`TOTAL;;${tax.toFixed(2)}`);
  return `${body.join("\n")}\n`;
}
