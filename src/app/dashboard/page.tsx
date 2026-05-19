import Link from "next/link";
import { CalendarDays, AlertTriangle, ArrowRight, Banknote, Building2, CheckCircle2, FileClock, Receipt, TrendingUp } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
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
      <div className="space-y-8">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
          <div>
            <Logo size={20} withText className="text-blue-600" />
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">Dashboard</h1>
            <p className="mt-2 text-slate-500">Bonjour {firstName}, voici un apercu de votre activite.</p>
          </div>
          <button type="button" className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50">
            <CalendarDays className="h-4 w-4 text-blue-600" />
            Ce mois
          </button>
        </div>

        {showTrialBanner ? <TrialStartedBanner forceOpen={trialStartedParam === "1"} /> : null}

        {showOnboardingCard ? (
          <Link
            href="/bienvenue"
            className="flex flex-col gap-4 rounded-2xl border border-blue-100 bg-blue-50 p-5 shadow-sm transition hover:border-blue-200 hover:bg-blue-50/80 md:flex-row md:items-center md:justify-between"
          >
            <div className="flex items-start gap-4">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white text-blue-600 shadow-sm">
                <CheckCircle2 className="h-5 w-5" />
              </span>
              <div>
                <p className="font-semibold text-slate-950">Complétez la configuration de votre entreprise</p>
                <p className="mt-1 text-sm text-slate-600">
                  {checklist.completedCount}/{checklist.totalCount} étapes complétées. Continuez le guide pour finaliser votre espace.
                </p>
                <div className="mt-3 h-2 max-w-sm overflow-hidden rounded-full bg-white">
                  <div className="h-full rounded-full bg-blue-600" style={{ width: `${checklist.progress}%` }} />
                </div>
              </div>
            </div>
            <span className="inline-flex items-center gap-2 text-sm font-semibold text-blue-700">
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
              <Link key={stat.label} href={stat.href} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
                    <Icon className="h-5 w-5" />
                  </div>
                  <span className="text-2xl font-bold text-slate-950">{stat.value}</span>
                </div>
                <p className="mt-4 text-sm font-semibold text-slate-900">{stat.label}</p>
                <p className="mt-1 text-sm text-slate-500">{stat.amount}</p>
              </Link>
            );
          })}
        </div>

        <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
          <ActivityFeed items={data.recentActivities} />
          <TopClients clients={data.topClients} />
        </div>

        <MobileAppBanner />
      </div>
    </ModulePage>
  );
}
