import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ListPagination({ page, totalPages, total, params }: { page: number; totalPages: number; total: number; params: Record<string, string | string[] | undefined> }) {
  const href = (nextPage: number) => {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (key === "page" || value === undefined) continue;
      for (const item of Array.isArray(value) ? value : [value]) query.append(key, item);
    }
    query.set("page", String(nextPage));
    return `?${query}`;
  };
  return <nav aria-label="Pagination" className="mt-4 flex flex-wrap items-center justify-between gap-3">
    <p className="text-sm text-[var(--muted)]">{total} résultat{total > 1 ? "s" : ""} · Page {page} sur {totalPages}</p>
    <div className="flex gap-2">
      {page > 1 ? <Button variant="secondary" asChild><Link href={href(page - 1)}><ChevronLeft className="h-4 w-4" />Précédente</Link></Button> : null}
      {page < totalPages ? <Button variant="secondary" asChild><Link href={href(page + 1)}>Suivante<ChevronRight className="h-4 w-4" /></Link></Button> : null}
    </div>
  </nav>;
}
