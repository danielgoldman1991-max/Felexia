import type { ReactNode } from "react";

type Props = {
  rows: Array<{ label: string; value: ReactNode }>;
  grandTotalLabel?: string;
  grandTotalValue?: ReactNode;
  settlementRows?: Array<{ label: string; value: ReactNode }>;
};

export function PrintTotals({ rows, grandTotalLabel, grandTotalValue, settlementRows = [] }: Props) {
  return (
    <section className="print-totals">
      <div className="print-totals-box">
        {rows.map((row) => (
          <div key={row.label} className="print-totals-row">
            <span>{row.label}</span>
            <span className="print-amount">{row.value}</span>
          </div>
        ))}
        {grandTotalLabel !== undefined && grandTotalValue !== undefined ? (
          <div className="print-totals-row print-totals-grand">
            <span>{grandTotalLabel}</span>
            <span className="print-amount">{grandTotalValue}</span>
          </div>
        ) : null}
        {settlementRows.map((row) => <div key={row.label} className="print-totals-row print-totals-settlement"><span>{row.label}</span><span className="print-amount">{row.value}</span></div>)}
      </div>
    </section>
  );
}
