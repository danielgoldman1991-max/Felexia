import Link from "next/link";
import { ModulePage } from "@/components/erp/module-page";
import { PageHeader } from "@/components/erp/page-header";
import { globalSearch } from "@/lib/global-search";

export const dynamic = "force-dynamic";

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const query = (await searchParams).q?.trim() ?? "";
  const results = query.length >= 2 ? await globalSearch(query) : [];
  return (
    <ModulePage>
      <PageHeader title="Recherche" description={query ? `Résultats pour « ${query} ».` : "Saisissez au moins deux caractères."} />
      <form className="mb-4 flex gap-2" action="/recherche">
        <input name="q" defaultValue={query} className="h-11 flex-1 rounded-[var(--radius-md)] border border-[var(--border)] px-3" placeholder="Salarié, facture, tiers…" />
        <button className="h-11 rounded-[var(--radius-md)] bg-[var(--primary)] px-4 font-medium text-white" type="submit">Rechercher</button>
      </form>
      {query.length >= 2 && results.length === 0 ? <p className="text-sm text-[var(--muted)]">Aucun résultat.</p> : null}
      <ul className="divide-y divide-[var(--border)] rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--card)]">
        {results.map((result) => (
          <li key={result.id}>
            <Link href={result.href} className="block px-4 py-3 hover:bg-[var(--surface-soft)]">
              <span className="font-medium">{result.title}</span>
              <span className="mt-1 block text-sm text-[var(--muted)]">{result.category} · {result.subtitle}</span>
            </Link>
          </li>
        ))}
      </ul>
    </ModulePage>
  );
}
