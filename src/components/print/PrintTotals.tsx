import type { ReactNode } from "react";

type Props = {
  rows: Array<{ label: string; value: ReactNode }>;
  grandTotalLabel?: string;
  grandTotalValue?: ReactNode;
};

export function PrintTotals({ rows, grandTotalLabel, grandTotalValue }: Props) {
  return (
    <section className="print-totals">
      <div className="print-totals-box">
        {rows.map((row) => (
          <div key={row.label} className="print-totals-row">
            <span>{row.label}</span>
            <span>{row.value}</span>
          </div>
        ))}
        {grandTotalLabel !== undefined && grandTotalValue !== undefined ? (
          <div className="print-totals-row print-totals-grand">
            <span>{grandTotalLabel}</span>
            <span>{grandTotalValue}</span>
          </div>
        ) : null}
      </div>
    </section>
  );
}
