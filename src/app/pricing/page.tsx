import Link from "next/link";
import { Logo } from "@/components/brand/Logo";
import { getModulesCatalog } from "@/lib/saas";
import { PricingClient } from "./client";

export const metadata = {
  title: "Tarifs - Felexia",
  description: "Choisissez vos modules et commencez gratuitement. Mini-ERP pour PME marocaines.",
};

export default async function PricingPage() {
  const modules = await getModulesCatalog();

  return (
    <main className="min-h-screen bg-[#06111f] text-white">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <Link href="/" className="flex items-center gap-3">
          <Logo size={36} />
          <span className="text-xl font-bold">Felexia</span>
        </Link>
        <nav className="flex items-center gap-4">
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

      <section className="mx-auto max-w-5xl px-6 pt-16 pb-12 text-center">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
          Une tarification à la carte
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-lg text-white/50">
          Sélectionnez uniquement les modules dont vous avez besoin. 
          Commencez par un essai gratuit de 15 jours, sans carte bancaire.
        </p>
      </section>

      <PricingClient modules={modules} />
    </main>
  );
}
