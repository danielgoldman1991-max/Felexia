import Link from "next/link";
import { BrandLogo } from "@/components/brand/BrandLogo";

const produitLinks = [
  { label: "Fonctionnalités", href: "#features" },
  { label: "Tarifs", href: "#pricing" },
  { label: "Ressources", href: "#resources" },
  { label: "Contact", href: "#contact" },
  { label: "Commencer gratuitement", href: "/login?mode=register" },
];

const moduleLinks = [
  "Factures de vente",
  "Factures d’achat",
  "Règlements",
  "Trésorerie",
  "Journaux",
];

const legalLinks = [
  { label: "Mentions légales", href: "/mentions-legales" },
  { label: "Confidentialité", href: "/confidentialite" },
  { label: "Conditions générales", href: "/conditions" },
];

export function LandingFooter() {
  return (
    <footer className="border-t border-slate-200 bg-white">
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <BrandLogo size="md" priority />
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-slate-600">
              Felexia Pro — Vos factures de vente et d’achat, leurs règlements, votre trésorerie et vos journaux dans un espace simple.
            </p>
          </div>

          <div>
            <h3 className="text-sm font-bold text-slate-900">Produit</h3>
            <ul className="mt-4 space-y-2.5">
              {produitLinks.map((link) => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    className="text-sm text-slate-600 transition-colors hover:text-[#0B2A5B]"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-bold text-slate-900">Au quotidien</h3>
            <ul className="mt-4 space-y-2.5">
              {moduleLinks.map((label) => (
                <li key={label}>
                  <a href="#modules" className="text-sm text-slate-600 transition-colors hover:text-[#0B2A5B]">
                    {label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-bold text-slate-900">Légal</h3>
            <ul className="mt-4 space-y-2.5">
              {legalLinks.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-slate-600 transition-colors hover:text-[#0B2A5B]"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <p className="mt-12 rounded-xl border border-slate-200 bg-slate-50 px-5 py-4 text-xs leading-relaxed text-slate-500">
          Les fonctions fiscales, sociales et comptables de Felexia sont préparatoires : elles ne
          se substituent ni à l&apos;expertise d&apos;un professionnel (expert-comptable, conseiller
          fiscal) ni aux obligations déclaratives applicables au Maroc.
        </p>

        <div className="mt-8 flex flex-col items-center justify-between gap-3 border-t border-slate-100 pt-6 sm:flex-row">
          <p className="text-sm text-slate-500">
            &copy; {new Date().getFullYear()} Felexia Conseils. FelexiaERP — Tous droits réservés.
          </p>
          <p className="text-sm text-slate-500">La gestion simple pour les PME marocaines.</p>
        </div>
      </div>
    </footer>
  );
}
