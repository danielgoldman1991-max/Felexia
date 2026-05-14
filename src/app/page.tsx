import Link from "next/link";
import { Logo } from "@/components/brand/Logo";

const modules = [
  { icon: "📊", name: "Dashboard", desc: "Vision globale de votre entreprise en temps réel" },
  { icon: "🛒", name: "Achats", desc: "Gestion des fournisseurs, commandes et réceptions" },
  { icon: "💰", name: "Ventes & Devis", desc: "Devis, commandes clients et bons de livraison" },
  { icon: "🧾", name: "Facturation", desc: "Factures, avoirs, paiements et relances" },
  { icon: "📦", name: "Stock", desc: "Produits, emplacements et mouvements" },
  { icon: "🏦", name: "Trésorerie", desc: "Comptes, rapprochement et prévisions" },
  { icon: "🤝", name: "CRM", desc: "Clients, prospects et activités commerciales" },
  { icon: "📒", name: "Comptabilité", desc: "Écritures, journaux, balance et TVA" },
];

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-[#06111f] text-white">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <Link href="/" className="flex items-center gap-3">
          <Logo size={36} />
          <span className="text-xl font-bold">Felexia</span>
        </Link>
        <nav className="flex items-center gap-4">
          <Link href="/pricing" className="text-sm text-white/70 hover:text-white transition-colors">
            Tarifs
          </Link>
          <Link
            href="/login"
            className="rounded-xl bg-white/10 px-5 py-2.5 text-sm font-semibold text-white transition-all hover:bg-white/20 ring-1 ring-white/10"
          >
            Connexion
          </Link>
          <Link
            href="/onboarding"
            className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition-all hover:bg-blue-500 shadow-lg shadow-blue-600/25"
          >
            Essai gratuit
          </Link>
        </nav>
      </header>

      <section className="mx-auto max-w-5xl px-6 pt-24 pb-20 text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-sm text-white/60 mb-8">
          <span className="h-2 w-2 rounded-full bg-emerald-400" />
          Mini-ERP pour PME marocaines
        </div>
        <h1 className="text-5xl font-bold tracking-tight leading-tight sm:text-6xl">
          Gérez toute votre{" "}
          <span className="bg-gradient-to-r from-blue-400 to-cyan-300 bg-clip-text text-transparent">
            PME
          </span>{" "}
          depuis un seul outil
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-white/50 leading-relaxed">
          Felexia réunit achats, ventes, facturation, stock, trésorerie, CRM et comptabilité
          dans une plateforme simple et puissante. Essayez gratuitement pendant 15 jours.
        </p>
        <div className="mt-10 flex items-center justify-center gap-4">
          <Link
            href="/onboarding"
            className="rounded-2xl bg-blue-600 px-8 py-4 text-base font-bold text-white transition-all hover:bg-blue-500 hover:scale-105 shadow-xl shadow-blue-600/30"
          >
            Commencer l&apos;essai gratuit
          </Link>
          <Link
            href="/pricing"
            className="rounded-2xl border border-white/10 bg-white/5 px-8 py-4 text-base font-semibold text-white/80 transition-all hover:bg-white/10 hover:text-white"
          >
            Voir les tarifs
          </Link>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-28">
        <h2 className="text-center text-2xl font-bold mb-4">Tous les modules dont vous avez besoin</h2>
        <p className="text-center text-white/40 mb-12 max-w-xl mx-auto">
          Choisissez les modules adaptés à votre activité. Prix à partir de 0 MAD/mois.
        </p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {modules.map((mod) => (
            <div
              key={mod.name}
              className="rounded-2xl border border-white/10 bg-white/5 p-5 transition-all hover:bg-white/[0.07] hover:border-white/20"
            >
              <span className="text-2xl">{mod.icon}</span>
              <h3 className="mt-3 font-semibold text-white">{mod.name}</h3>
              <p className="mt-1 text-sm text-white/45">{mod.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-white/10 py-8 text-center text-sm text-white/30">
        <p>&copy; {new Date().getFullYear()} Felexia. Mini-ERP pour PME marocaines.</p>
      </footer>
    </main>
  );
}
