import type { ReactNode } from "react";

export function PrintSummary({ aside, children }: { aside?: ReactNode; children: ReactNode }) {
  return <div className="print-document-summary">{aside ? <div className="print-document-summary-aside">{aside}</div> : null}<div className="print-document-summary-totals">{children}</div></div>;
}
