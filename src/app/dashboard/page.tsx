import Link from "next/link";
import { CalendarDays } from "lucide-react";
import { ModulePage } from "@/components/erp/module-page";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { DashboardChart } from "@/components/dashboard/dashboard-chart";
import { SalesDonut } from "@/components/dashboard/sales-donut";
import { ActivityFeed } from "@/components/dashboard/activity-feed";
import { TopClients } from "@/components/dashboard/top-clients";
import { MobileAppBanner } from "@/components/dashboard/mobile-app-banner";
import { operationalStats, activityFeed, kpiCards, revenueSeries, salesSplit, topClients } from "@/lib/mock-dashboard-data";
import { requireActiveWorkspace } from "@/lib/auth";

export default async function DashboardPage() {
  const workspace = await requireActiveWorkspace();
  const firstName = workspace.profile?.full_name?.split(" ")[0] || "Youssef";

  return (
    <ModulePage>
      <div className="space-y-8">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
          <div>
            <p className="text-sm font-semibold text-blue-600">Felexia ERP</p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">Dashboard</h1>
            <p className="mt-2 text-slate-500">Bonjour {firstName}, voici un apercu de votre activite.</p>
          </div>
          <button type="button" className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50">
            <CalendarDays className="h-4 w-4 text-blue-600" />
            01 Mai - 31 Mai 2024
          </button>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {kpiCards.map((card) => <KpiCard key={card.title} {...card} />)}
        </div>

        <div className="grid gap-5 xl:grid-cols-[1.65fr_0.95fr]">
          <DashboardChart data={revenueSeries} />
          <SalesDonut data={salesSplit} />
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
          <ActivityFeed items={activityFeed} />
          <TopClients clients={topClients} />
        </div>

        <MobileAppBanner />
      </div>
    </ModulePage>
  );
}
