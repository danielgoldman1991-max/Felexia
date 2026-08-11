import Link from "next/link";
import { ArrowLeft, Info, Mail } from "lucide-react";
import type { ReactNode } from "react";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { LEGAL_CONFIG, legalValue } from "@/lib/legal/legal-config";

export type LegalTocItem = { id: string; title: string };

const LEGAL_LINKS = [
  { label: "Mentions légales", href: "/mentions-legales" },
  { label: "Confidentialité", href: "/confidentialite" },
  { label: "Conditions générales", href: "/conditions" },
] as const;

export function LegalSection({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-28">
      <h2 className="mt-12 text-xl font-bold tracking-tight text-[#0B2A5B]">{title}</h2>
      <div className="mt-4 space-y-4">{children}</div>
    </section>
  );
}

export function LegalSubSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div>
      <h3 className="text-base font-semibold text-slate-900">{title}</h3>
      <div className="mt-2 space-y-2">{children}</div>
    </div>
  );
}

export function LegalParagraph({ children }: { children: ReactNode }) {
  return <p className="text-[15px] leading-7 text-slate-600">{children}</p>;
}

export function LegalList({ items }: { items: ReactNode[] }) {
  return (
    <ul className="space-y-2">
      {items.map((item, index) => (
        <li key={index} className="flex gap-2.5 text-[15px] leading-7 text-slate-600">
          <span className="mt-[11px] h-1.5 w-1.5 shrink-0 rounded-full bg-[#1456B8]" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

export function LegalCallout({
  children,
  tone = "info",
}: {
  children: ReactNode;
  tone?: "info" | "warning";
}) {
  const styles =
    tone === "warning"
      ? "border-amber-200 bg-amber-50 text-[#7A4E00]"
      : "border-blue-100 bg-blue-50/70 text-[#0F2548]";
  return (
    <div className={`flex gap-3 rounded-xl border px-4 py-3.5 text-sm leading-6 ${styles}`}>
      <Info className="mt-0.5 h-4 w-4 shrink-0" />
      <div>{children}</div>
    </div>
  );
}

/**
 * Ligne de données éditeur. Masquée si la valeur n'est pas renseignée
 * (aucun "null", aucun "undefined" affiché).
 */
export function LegalDataRow({ label, value }: { label: string; value: string | null }) {
  const v = legalValue(value);
  if (!v) return null;
  return (
    <div className="flex flex-col gap-0.5 py-3 sm:grid sm:grid-cols-[220px_1fr] sm:gap-6">
      <dt className="text-sm font-medium text-slate-500">{label}</dt>
      <dd className="text-sm font-medium text-slate-800">{v}</dd>
    </div>
  );
}

export function LegalDataList({ children }: { children: ReactNode }) {
  return (
    <dl className="divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white px-4 sm:px-6">
      {children}
    </dl>
  );
}

function LegalToc({ toc }: { toc: LegalTocItem[] }) {
  return (
    <nav aria-label="Sommaire">
      <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Sommaire</p>
      <ul className="mt-3 space-y-1">
        {toc.map((item) => (
          <li key={item.id}>
            <a
              href={`#${item.id}`}
              className="block py-1 text-sm leading-6 text-slate-600 transition-colors hover:text-[#1456B8]"
            >
              {item.title}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export function LegalPageLayout({
  title,
  intro,
  toc,
  children,
}: {
  title: string;
  intro: ReactNode;
  toc: LegalTocItem[];
  children: ReactNode;
}) {
  const publisher = legalValue(LEGAL_CONFIG.publisherName) ?? "Felexia Conseils";

  return (
    <div className="min-h-screen bg-white text-slate-900">
      <header className="sticky top-0 z-40 border-b border-slate-200/70 bg-white/95 backdrop-blur-xl">
        <div className="mx-auto flex h-20 max-w-5xl items-center justify-between gap-4 px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <BrandLogo size="sm" priority />
            <span className="hidden h-8 w-px bg-slate-200 sm:block" />
            <span className="hidden truncate text-sm text-slate-500 sm:block">
              Produit édité par {publisher}
            </span>
          </div>
          <Link
            href="/"
            className="flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-[#0B2A5B]"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Retour à l&apos;accueil</span>
            <span className="sm:hidden">Accueil</span>
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_220px]">
          <article>
            <h1 className="text-3xl font-bold tracking-tight text-[#0B2A5B] sm:text-4xl">
              {title}
            </h1>
            <div className="mt-4 space-y-4 text-[15px] leading-7 text-slate-600">{intro}</div>

            <details className="mt-6 rounded-xl border border-slate-200 bg-slate-50/60 px-4 py-3 lg:hidden">
              <summary className="cursor-pointer text-sm font-semibold text-slate-700">
                Sommaire
              </summary>
              <ul className="mt-3 space-y-1">
                {toc.map((item) => (
                  <li key={item.id}>
                    <a href={`#${item.id}`} className="block py-1 text-sm text-slate-600">
                      {item.title}
                    </a>
                  </li>
                ))}
              </ul>
            </details>

            {children}
          </article>

          <aside className="hidden lg:block">
            <div className="sticky top-28">
              <LegalToc toc={toc} />
            </div>
          </aside>
        </div>
      </main>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
          <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
            <p className="text-sm text-slate-500">
              {LEGAL_CONFIG.productName} — produit édité par {publisher}.
            </p>
            <nav aria-label="Pages légales" className="flex flex-wrap items-center gap-x-5 gap-y-2">
              {LEGAL_LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="text-sm text-slate-600 transition-colors hover:text-[#1456B8]"
                >
                  {link.label}
                </Link>
              ))}
              <Link
                href="/"
                className="text-sm text-slate-600 transition-colors hover:text-[#1456B8]"
              >
                Retour à l&apos;accueil
              </Link>
            </nav>
          </div>
          <div className="mt-6 flex flex-col gap-2 border-t border-slate-100 pt-6 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between">
            <p>
              &copy; {new Date().getFullYear()} {LEGAL_CONFIG.companyName}. Tous droits
              réservés.
            </p>
            <a
              href={`mailto:${LEGAL_CONFIG.legalEmail}`}
              className="inline-flex items-center gap-1.5 text-slate-600 transition-colors hover:text-[#1456B8]"
            >
              <Mail className="h-3.5 w-3.5" />
              {LEGAL_CONFIG.legalEmail}
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
