import Link from "next/link";
import { Check, HelpCircle } from "lucide-react";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { SUBSCRIPTION_PLANS } from "@/lib/subscriptions/plans";
import { filterPubliclyAvailablePlans } from "@/lib/subscriptions/commercial-offers";

export const metadata = {
  title: "Tarifs - Felexia",
  description: "Une seule offre, Essentiel, pour gerer les ventes, achats, documents, paiements et la comptabilite de votre PME.",
};

const faqs = [
  {
    question: "Felexia propose-t-il plusieurs offres ?",
    answer: "FelexiaERP propose une seule offre : Essentiel. Elle rassemble toutes les fonctions essentielles pour piloter votre PME au quotidien.",
  },
  {
    question: "Y a-t-il une periode d'essai ?",
    answer: "Oui, les nouvelles entreprises demarrent avec un essai Essentiel gratuit, sans carte bancaire.",
  },
  {
    question: "Peut-on ajouter des utilisateurs ?",
    answer: "Oui, l'offre Essentiel inclut jusqu'a 3 utilisateurs.",
  },
  {
    question: "Felexia est-il adapte aux PME marocaines ?",
    answer: "Oui. L'offre integre les usages de gestion commerciale, TVA, documents et comptabilite au Maroc.",
  },
];

export default function PricingPage() {
  const plans = filterPubliclyAvailablePlans(SUBSCRIPTION_PLANS);

  return (
    <main className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <Link href="/" className="flex items-center gap-3">
          <span className="inline-block rounded-xl bg-white/95 px-3 py-2 shadow-sm ring-1 ring-black/5">
            <BrandLogo variant="horizontal" size="md" />
          </span>
        </Link>
        <nav className="flex items-center gap-3">
          <Link
            href="/login"
            className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--card)] px-4 py-2 text-sm font-semibold text-[var(--foreground)] transition hover:bg-[var(--surface-soft)]"
          >
            Connexion
          </Link>
          <Link
            href="/login?mode=register"
            className="rounded-[var(--radius-md)] bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-[var(--primary-foreground)] shadow-[var(--shadow-sm)] transition hover:brightness-110"
          >
            Démarrer gratuitement
          </Link>
        </nav>
      </header>

      <section className="mx-auto max-w-5xl px-6 pb-10 pt-14 text-center">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
          Une offre simple pour gérer votre PME
        </h1>
        <p className="mx-auto mt-5 max-w-3xl text-lg text-[var(--muted-strong)]">
          FelexiaERP Essentiel rassemble les fonctions dont une PME a besoin pour piloter son
          activité au quotidien : ventes, achats, stock, trésorerie et comptabilité.
        </p>
      </section>

      <section className="mx-auto grid max-w-4xl gap-5 px-6 pb-16 lg:grid-cols-1">
        {plans.map((plan) => (
          <article
            key={plan.code}
            className="relative flex flex-col rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--card)] p-6 shadow-[var(--shadow-sm)]"
          >
            <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
              <div>
                <h2 className="text-2xl font-bold">{plan.name}</h2>
                <p className="mt-2 max-w-lg text-sm text-[var(--muted)]">{plan.description}</p>
              </div>
              <p className="text-4xl font-bold">
                {plan.monthlyPrice} MAD
                <span className="text-base font-medium text-[var(--muted)]"> / mois</span>
              </p>
            </div>
            <ul className="mt-6 grid gap-3 sm:grid-cols-2">
              {plan.featureHighlights.map((feature) => (
                <li key={feature} className="flex items-start gap-2 text-sm text-[var(--foreground)]/85">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-[var(--success)]" />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
            <div className="mt-6 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-soft)]/60 p-3 text-xs leading-6 text-[var(--muted-strong)]">
              {plan.limitHighlights.join(" · ")}
            </div>
            <Link
              href="/login?mode=register"
              className="mt-6 inline-flex h-11 items-center justify-center rounded-[var(--radius-md)] bg-[var(--primary)] px-4 text-sm font-semibold text-[var(--primary-foreground)] transition hover:brightness-110"
            >
              Démarrer gratuitement
            </Link>
          </article>
        ))}
      </section>

      <section className="mx-auto max-w-5xl px-6 pb-20">
        <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--card)] p-6 shadow-[var(--shadow-sm)]">
          <div className="mb-5 flex items-center gap-2">
            <HelpCircle className="h-5 w-5 text-[var(--primary)]" />
            <h2 className="text-xl font-semibold">Questions fréquentes</h2>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {faqs.map((faq) => (
              <div key={faq.question} className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-soft)]/50 p-4">
                <h3 className="font-semibold">{faq.question}</h3>
                <p className="mt-2 text-sm leading-6 text-[var(--muted-strong)]">{faq.answer}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
