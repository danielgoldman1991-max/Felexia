import type { ReactNode } from "react";

type Props = {
  title?: string;
  children: ReactNode;
};

export function PrintTerms({ title = "Notes et observations", children }: Props) {
  return (
    <section className="print-terms">
      <h2 className="print-terms-title">{title}</h2>
      <p className="print-terms-body">{children}</p>
    </section>
  );
}
