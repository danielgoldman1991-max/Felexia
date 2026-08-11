import type { ReactNode } from "react";

type Props = {
  title: string;
  documentNumber?: string | null;
  /** Lignes de métadonnées (Date, Validité, Statut...). */
  children?: ReactNode;
};

export function PrintDocumentTitle({ title, documentNumber, children }: Props) {
  return (
    <div className="print-title">
      <p className="print-title-main">{title}</p>
      {documentNumber ? <p className="print-title-number">{documentNumber}</p> : null}
      {children ? <div className="print-title-meta">{children}</div> : null}
    </div>
  );
}
