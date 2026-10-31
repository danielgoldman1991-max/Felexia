import type { ReactNode } from "react";

type Props = {
  head: ReactNode;
  children: ReactNode;
  currency?: string;
  caption?: string;
  variant?: "lines" | "report";
};

export function PrintLineTable({ head, children, currency, caption, variant = "lines" }: Props) {
  return (
    <table className={`print-table ${variant === "report" ? "print-report-table" : "print-line-table"}`}>
      {caption || currency ? <caption className="print-table-caption">{caption}{caption && currency ? " · " : ""}{currency ? `Montants en ${currency}` : ""}</caption> : null}
      <thead>
        <tr>{head}</tr>
      </thead>
      <tbody>{children}</tbody>
    </table>
  );
}
