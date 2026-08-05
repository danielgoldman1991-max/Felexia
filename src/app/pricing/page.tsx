import Link from "next/link";
import { Check, HelpCircle } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { Badge } from "@/components/ui/badge";
import { SUBSCRIPTION_PLANS } from "@/lib/subscriptions/plans";
import { cn } from "@/lib/utils";

export const metadata = {
  title: "Tarifs - Felexia",
  description: "Trois packs simples pour gerer les ventes, achats, documents, paiements et la pre-comptabilite de votre PME.",
};

const faqs = [
  {
    question: "Puis-je changer de pack ?",
    answer: "Oui. Vous pouvez passer d'un pack a l'autre selon l'evolution de votre entreprise.",
  },
  {
    question: "Y a-t-il une periode d'essai ?",
    answer: "Oui, les nouvelles entreprises demarrent avec un essai Essentiel gratuit, sans carte bancaire.",
  },
  {
    question: "Les donnees sont-elles conservees ?",
    answer: "Oui. Le changement de pack modifie les limites et fonctionnalites, pas vos donnees.",
  },
  {
    question: "Felexia est-il adapte aux PME marocaines ?",
    answer: "Oui. Les packs integrent les usages de gestion commerciale, TVA, documents et pre-comptabilite au Maroc.",
  },
  {
    question: "Peut-on ajouter des utilisateurs ?",
    answer: "Oui, dans la limite du pack choisi : 3, 10 ou 25 utilisateurs.",
  },
];

export default function PricingPage() {
  return (
    <main className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <Link href="/" className="flex items-center gap-3">
          <Logo size={36} />
          <span className="text-xl font-bold">Felexia</span>
        </Link>
        <nav className="flex items-center gap-3">
          <Link
            href="/login"
            className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--card)] px-4 py-2 text-sm font-semibold text-[var(--foreground)] transition hover:bg-[var(--surface-soft)]"
          >
            Connexion
          </Link>
          <Link
            href="/onboarding/inscription"
            className="rounded-[var(--radius-md)] bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-[var(--primary-foreground)] shadow-[var(--shadow-sm)] transition hover:brightness-110"
          >
            Essai gratuit
          </Link>
        </nav>
      </header>

      <section className="mx-auto max-w-5xl px-6 pb-10 pt-14 text-center">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
          Choisissez le pack Felexia adapté à votre entreprise
        </h1>
        <p className="mx-auto mt-5 max-w-3xl text-lg text-[var(--muted-strong)]">
          Une solution simple pour gérer vos ventes, vos achats, vos documents, vos paiements et votre pré-comptabilité.
        </p>
      </section>

      <section className="mx-auto grid max-w-6xl gap-5 px-6 pb-16 lg:grid-cols-3">
        {SUBSCRIPTION_PLANS.map((plan) => (
          <article
            key={plan.code}
            className={cn(
              "relative flex flex-col rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--card)] p-6 shadow-[var(--shadow-sm)]",
              plan.isRecommended && "border-[var(--primary)] ring-1 ring-[color-mix(in_srgb,var(--primary)_30%,transparent)]",
            )}
          >
            {plan.isRecommended && (
              <div className="absolute right-5 top-5">
                <Badge tone="info">Le plus choisi</Badge>
              </div>
            )}
            <h2 className="text-2xl font-bold">{plan.name}</h2>
            <p className="mt-2 min-h-12 text-sm text-[var(--muted)]">{plan.description}</p>
            <p className="mt-6 text-4xl font-bold">
              {plan.monthlyPrice} MAD
              <span className="text-base font-medium text-[var(--muted)]"> / mois</span>
            </p>
            <ul className="mt-6 space-y-3">
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
              href="/onboarding/inscription"
              className={cn(
                "mt-6 inline-flex h-11 items-center justify-center rounded-[var(--radius-md)] px-4 text-sm font-semibold transition",
                plan.isRecommended ? "bg-[var(--primary)] text-[var(--primary-foreground)] hover:brightness-110" : "bg-[var(--surface-soft)] text-[var(--foreground)] hover:bg-[var(--border-strong)]/60",
              )}
            >
              Choisir {plan.name}
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
