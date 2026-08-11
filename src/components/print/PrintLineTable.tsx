import type { ReactNode } from "react";

type Props = {
  head: ReactNode;
  children: ReactNode;
};

export function PrintLineTable({ head, children }: Props) {
  return (
    <table className="print-table">
      <thead>
        <tr>{head}</tr>
      </thead>
      <tbody>{children}</tbody>
    </table>
  );
}
