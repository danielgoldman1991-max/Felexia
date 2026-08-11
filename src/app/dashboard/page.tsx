import Link from "next/link";
import { CalendarDays, AlertTriangle, ArrowRight, Banknote, Building2, CheckCircle2, FileClock, Receipt, Sparkles, TrendingUp } from "lucide-react";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { ModulePage } from "@/components/erp/module-page";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { DashboardChart } from "@/components/dashboard/dashboard-chart";
import { SalesDonut } from "@/components/dashboard/sales-donut";
import { ActivityFeed } from "@/components/dashboard/activity-feed";
import { TopClients } from "@/components/dashboard/top-clients";
import { MobileAppBanner } from "@/components/dashboard/mobile-app-banner";
import { TrialStartedBanner } from "@/components/dashboard/trial-started-banner";
import { getDashboardData } from "@/lib/dashboard-data";
import { requireActiveWorkspace } from "@/lib/auth";
import { getOnboardingChecklist, isOnboardingChecklistComplete } from "@/lib/onboarding";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams?: Promise<{ trial_started?: string | string[] }>;
}) {
  const workspace = await requireActiveWorkspace();
  const params = await searchParams;
  const firstName = workspace.profile?.full_name?.split(" ")[0] || "Youssef";
  const [data, checklist] = await Promise.all([
    getDashboardData(),
    getOnboardingChecklist(workspace.organization.id),
  ]);
  const showOnboardingCard = !isOnboardingChecklistComplete(checklist);
  const trialStartedParam = Array.isArray(params?.trial_started)
    ? params?.trial_started[0]
    : params?.trial_started;
  const showTrialBanner = trialStartedParam === "1" || workspace.subscription?.status === "trialing";

  const kpiCards = [
    {
      title: "Chiffre d'affaires",
      value: `${new Intl.NumberFormat("fr-MA", { minimumFractionDigits: 2 }).format(data.revenue)} DH`,
      change: "+",
      caption: "Ce mois",
      tone: "success" as const,
      icon: TrendingUp,
    },
    {
      title: "Encaissements",
      value: `${new Intl.NumberFormat("fr-MA", { minimumFractionDigits: 2 }).format(data.collections)} DH`,
      change: "+",
      caption: "Ce mois",
      tone: "success" as const,
      icon: Banknote,
    },
    {
      title: "Impayes",
      value: `${new Intl.NumberFormat("fr-MA", { minimumFractionDigits: 2 }).format(data.unpaidAmount)} DH`,
      change: "+",
      caption: "Total",
      tone: "danger" as const,
      icon: AlertTriangle,
    },
    {
      title: "Tresorerie disponible",
      value: `${new Intl.NumberFormat("fr-MA", { minimumFractionDigits: 2 }).format(data.availableCash)} DH`,
      change: "+",
      caption: "Tous comptes confondus",
      tone: "success" as const,
      icon: Building2,
    },
  ];

  const operationalStats = [
    {
      label: "Devis en attente",
      value: String(data.pendingQuotesCount),
      amount: `${new Intl.NumberFormat("fr-MA", { minimumFractionDigits: 2 }).format(data.pendingQuotesAmount)} DH`,
      icon: FileClock,
      href: "/vente/devis",
    },
    {
      label: "Commandes en cours",
      value: String(data.activeOrdersCount),
      amount: `${new Intl.NumberFormat("fr-MA", { minimumFractionDigits: 2 }).format(data.activeOrdersAmount)} DH`,
      icon: Receipt,
      href: "/vente/commandes",
    },
    {
      label: "Livraisons a faire",
      value: String(data.deliveriesToDoCount),
      amount: `${new Intl.NumberFormat("fr-MA", { minimumFractionDigits: 2 }).format(data.deliveriesToDoAmount)} DH`,
      icon: Receipt,
      href: "/vente/livraisons",
    },
    {
      label: "Stocks faibles",
      value: String(data.lowStockCount),
      amount: "Voir les alertes",
      icon: AlertTriangle,
      href: "/stock",
    },
  ];

  return (
    <ModulePage>
      <div className="min-w-0 space-y-8">
        <div className="premium-card luxury-border overflow-hidden rounded-[32px] p-6 md:p-8">
          <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
            <div className="min-w-0">
              <div className="flex min-w-0 flex-wrap items-center gap-3">
                <BrandLogo variant="horizontal" size="sm" />
                <span className="rounded-full border border-[color-mix(in_srgb,var(--accent)_25%,transparent)] bg-[var(--accent-soft)] px-3 py-1 text-xs font-medium text-[var(--accent)]">Pilotage</span>
              </div>
              <h1 className="mt-4 text-3xl font-semibold tracking-tight text-[var(--foreground)] sm:text-5xl">Bonjour {firstName}</h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--muted)] md:text-base">
                Vue consolidée de votre activité, de votre trésorerie et des points qui méritent votre attention.
              </p>
            </div>
            <button type="button" className="inline-flex items-center gap-2 rounded-2xl border border-[var(--border)] bg-[var(--card)] px-4 py-2.5 text-sm font-medium text-[var(--foreground)] shadow-[var(--shadow-sm)] transition hover:bg-[var(--surface-soft)]">
              <CalendarDays className="h-4 w-4 text-[var(--accent)]" />
              Ce mois
            </button>
          </div>
        </div>

        {showTrialBanner ? (
          <TrialStartedBanner
            forceOpen={trialStartedParam === "1"}
            planCode={workspace.subscription?.planCode}
          />
        ) : null}

        {showOnboardingCard ? (
          <Link
            href="/bienvenue"
            className="rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--card)] flex flex-col gap-4 p-5 shadow-[var(--shadow-sm)] transition hover:bg-[var(--surface-soft)]/60 hover:-translate-y-0.5 md:flex-row md:items-center md:justify-between"
          >
            <div className="flex min-w-0 items-start gap-4">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent)] shadow-[var(--shadow-sm)] ring-1 ring-[var(--border)]">
                <CheckCircle2 className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <p className="font-semibold text-[var(--foreground)]">Complétez la configuration de votre entreprise</p>
                <p className="mt-1 text-sm text-[var(--muted)]">
                  {checklist.completedCount}/{checklist.totalCount} étapes complétées. Continuez le guide pour finaliser votre espace.
                </p>
                <div className="mt-3 h-2 max-w-sm overflow-hidden rounded-full bg-[var(--surface-soft)]">
                  <div className="h-full rounded-full bg-gradient-to-r from-[var(--primary)] to-[var(--secondary)]" style={{ width: `${checklist.progress}%` }} />
                </div>
              </div>
            </div>
            <span className="inline-flex min-w-0 flex-wrap items-center gap-2 text-sm font-semibold text-[var(--primary)]">
              Continuer la configuration
              <ArrowRight className="h-4 w-4" />
            </span>
          </Link>
        ) : null}

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {kpiCards.map((card) => <KpiCard key={card.title} {...card} />)}
        </div>

        <div className="grid gap-5 xl:grid-cols-[1.65fr_0.95fr]">
          <DashboardChart data={data.revenueSeries} />
          <SalesDonut data={data.salesBreakdown} total={data.revenue} />
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {operationalStats.map((stat) => {
            const Icon = stat.icon;
            return (
              <Link key={stat.label} href={stat.href} className="rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--card)] group p-5 shadow-[var(--shadow-sm)] transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-md)]">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--info-soft)] text-[var(--info)] ring-1 ring-[var(--border)]">
                    <Icon className="h-5 w-5" />
                  </div>
                  <span className="text-2xl font-semibold text-[var(--foreground)]">{stat.value}</span>
                </div>
                <p className="mt-4 text-sm font-semibold text-[var(--foreground)]">{stat.label}</p>
                <p className="mt-1 text-sm text-[var(--muted)]">{stat.amount}</p>
              </Link>
            );
          })}
        </div>

        <section className="rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--card)] p-5 shadow-[var(--shadow-sm)]">
          <div className="flex items-start gap-4">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent)] ring-1 ring-[var(--border)]">
              <Sparkles className="h-5 w-5" />
            </span>
            <div>
              <p className="text-base font-semibold text-[var(--foreground)]">Ce qui mérite votre attention</p>
              <p className="mt-1 text-sm text-[var(--muted)]">
                Surveillez les impayés, les livraisons à convertir, les réceptions non facturées et les écritures à comptabiliser depuis ce cockpit.
              </p>
            </div>
          </div>
        </section>

        <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
          <ActivityFeed items={data.recentActivities} />
          <TopClients clients={data.topClients} />
        </div>

        <MobileAppBanner />
      </div>
    </ModulePage>
  );
}
