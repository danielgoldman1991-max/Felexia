import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { positivePage } from "@/lib/listing";

export function ListPagination({ page, totalPages, total, params }: { page: number; totalPages: number; total: number; params: Record<string, string | string[] | undefined> }) {
  const safeTotalPages = Math.max(1, Number.isFinite(totalPages) && totalPages > 0 ? Math.floor(totalPages) : 1);
  const safePage = Math.min(positivePage(page), safeTotalPages);
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
    <p className="text-sm text-[var(--muted)]">{total} résultat{total > 1 ? "s" : ""} · Page {safePage} sur {safeTotalPages}</p>
    <div className="flex gap-2">
      {safePage > 1 ? <Button variant="secondary" asChild><Link href={href(safePage - 1)}><ChevronLeft className="h-4 w-4" />Précédente</Link></Button> : null}
      {safePage < safeTotalPages ? <Button variant="secondary" asChild><Link href={href(safePage + 1)}>Suivante<ChevronRight className="h-4 w-4" /></Link></Button> : null}
    </div>
  </nav>;
}
