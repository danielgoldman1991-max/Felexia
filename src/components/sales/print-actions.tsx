"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, FileText, Maximize2, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

export function PrintActions({
  backHref,
  backLabel,
}: {
  backHref: string;
  backLabel: string;
}) {
  const toolbarRef = useRef<HTMLDivElement>(null);
  const [actualSize, setActualSize] = useState(false);
  useEffect(() => {
    const preview = toolbarRef.current?.closest<HTMLElement>(".print-preview");
    if (preview) preview.dataset.previewScale = actualSize ? "actual" : "fit";
  }, [actualSize]);

  return (
    <div ref={toolbarRef} className="print-toolbar no-print print-no-print">
      <div className="print-toolbar-heading"><FileText className="h-5 w-5" aria-hidden="true" /><span><strong>Aperçu du document</strong><span>Prêt pour l’impression ou l’enregistrement en PDF</span></span></div>
      <div className="print-toolbar-actions">
      <Button type="button" variant="secondary" asChild><Link href={backHref}><ArrowLeft className="h-4 w-4" aria-hidden="true" />{backLabel}</Link></Button>
      <Button type="button" variant="secondary" aria-pressed={actualSize} onClick={() => setActualSize((value) => !value)}><Maximize2 className="h-4 w-4" aria-hidden="true" />{actualSize ? "Ajuster à l’écran" : "Taille réelle"}</Button>
      <Button type="button" onClick={() => window.print()}>
        <Printer className="h-4 w-4" />
        Imprimer / PDF
      </Button>
      </div>
    </div>
  );
}
