"use client";

import Link from "next/link";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

export function PrintActions({
  backHref,
  backLabel,
}: {
  backHref: string;
  backLabel: string;
}) {
  return (
    <div className="no-print mx-auto mb-4 flex max-w-[210mm] items-center justify-end gap-3 px-4 pt-4 print:hidden">
      <Link href={backHref}>
        <Button type="button" variant="secondary">{backLabel}</Button>
      </Link>
      <Button type="button" onClick={() => window.print()}>
        <Printer className="h-4 w-4" />
        Imprimer
      </Button>
    </div>
  );
}
