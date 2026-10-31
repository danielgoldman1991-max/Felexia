import type { ReactNode } from "react";

type Props = {
  rows: Array<{ label: string; value: ReactNode }>;
};

/** Ventilation de la TVA par taux (Total HT, Taux, Base, TVA). */
export function PrintTaxSummary({ rows }: Props) {
  if (rows.length === 0) return null;
  return (
    <section className="print-tax-summary">
      <div className="print-tax-summary-box">
        <h2 className="print-tax-summary-title">Ventilation de la TVA</h2>
        {rows.map((row) => (
          <div key={row.label} className="print-tax-summary-row">
            <span>{row.label}</span>
            <span className="print-amount">{row.value}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
