import Link from "next/link";
import {
  Building2, CalendarClock, ChevronLeft, ChevronRight, CreditCard, Star, Store, Truck, Users,
} from "lucide-react";
import { EmptyState } from "@/components/erp/empty-state";
import { PageHeader } from "@/components/erp/page-header";
import { StatCard } from "@/components/erp/stat-card";
import { ModulePage } from "@/components/erp/module-page";
import { Button } from "@/components/ui/button";
import { ThirdPartyFilters } from "@/components/tiers/third-party-filters";
import { ThirdPartyTable } from "@/components/tiers/third-party-table";
import { filtersFromSearchParams, getThirdPartyCounters, listThirdParties } from "@/lib/third-parties";
import type { ThirdPartyKind, ThirdPartyRecord } from "@/lib/third-party-types";

type PageMeta = { title: string; description: string; buttonLabel: string; buttonHref: string };

const titles: Record<ThirdPartyKind | "all", PageMeta> = {
  all: {
    title: "Tiers",
    description: "Prospects, clients et fournisseurs filtres par organisation active.",
    buttonLabel: "Nouveau tiers",
    buttonHref: "/tiers/new",
  },
  prospect: {
    title: "Prospects",
    description: "Pipeline commercial et relances prospect.",
    buttonLabel: "Nouveau Prospect",
    buttonHref: "/tiers/new?type=prospect",
  },
  customer: {
    title: "Clients",
    description: "Clients actifs, encours et informations fiscales.",
    buttonLabel: "Nouveau Client",
    buttonHref: "/tiers/new?type=customer",
  },
  supplier: {
    title: "Fournisseurs",
    description: "Fournisseurs, conditions d'achat et evaluations.",
    buttonLabel: "Nouveau Fournisseur",
    buttonHref: "/tiers/new?type=supplier",
  },
};

function PaginationBar({
  page,
  totalPages,
  searchParams,
}: {
  page: number;
  totalPages: number;
  searchParams: Record<string, string | string[] | undefined>;
}) {
  function href(p: number) {
    const sp = new URLSearchParams();
    for (const [key, value] of Object.entries(searchParams)) {
      if (key === "page") continue;
      if (Array.isArray(value)) {
        for (const v of value) sp.append(key, v);
      } else if (value !== undefined) {
        sp.set(key, value);
      }
    }
    sp.set("page", String(p));
    return `?${sp.toString()}`;
  }

  return (
    <div className="mt-4 flex items-center justify-between">
      <p className="text-sm text-[var(--muted)]">
        Page {page} sur {totalPages}
      </p>
      <div className="flex items-center gap-2">
        {page > 1 ? (
          <Link href={href(page - 1)}>
            <Button variant="secondary">
              <ChevronLeft className="h-4 w-4" /> Precedente
            </Button>
          </Link>
        ) : null}
        {page < totalPages ? (
          <Link href={href(page + 1)}>
            <Button variant="secondary">
              Suivante <ChevronRight className="h-4 w-4" />
            </Button>
          </Link>
        ) : null}
      </div>
    </div>
  );
}

export async function ThirdPartyListPage({
  searchParams,
  forcedType,
  showCounters = true,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
  forcedType?: ThirdPartyKind;
  showCounters?: boolean;
}) {
  const params = await searchParams;
  const filters = filtersFromSearchParams(params, forcedType);
  const meta = titles[forcedType ?? "all"];

  let rows: ThirdPartyRecord[] = [];
  let counters = {
    total: 0,
    prospects: 0,
    customers: 0,
    suppliers: 0,
    followUps: 0,
    creditLimits: 0,
    ratedSuppliers: 0,
  };
  let pagination = { page: 1, totalPages: 1 };
  let errorMessage: string | null = null;

  try {
    const [listResult, counterResult] = await Promise.all([
      listThirdParties(filters),
      showCounters ? getThirdPartyCounters() : Promise.resolve(counters),
    ]);
    rows = listResult.rows;
    counters = counterResult;
    pagination = { page: listResult.page, totalPages: listResult.totalPages };
  } catch (error) {
    errorMessage = error instanceof Error ? error.message : "erreur inconnue";
  }

  if (errorMessage) {
    return (
      <ModulePage>
        <PageHeader
          title={meta.title}
          description={meta.description}
          actions={<Link href={meta.buttonHref}><Button>{meta.buttonLabel}</Button></Link>}
        />
        <EmptyState
          title="Module Tiers pret, migration requise"
          description={`Appliquez la migration 002_third_parties_complete.sql. Detail: ${errorMessage}`}
          action={<Link href={meta.buttonHref}><Button>{meta.buttonLabel}</Button></Link>}
        />
      </ModulePage>
    );
  }

  return (
    <ModulePage>
      <PageHeader
        title={meta.title}
        description={meta.description}
        actions={<Link href={meta.buttonHref}><Button>{meta.buttonLabel}</Button></Link>}
      />
      {showCounters ? (
        <div className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-7">
          <StatCard title="Total tiers" value={counters.total} icon={<Building2 className="h-5 w-5" />} />
          <StatCard title="Prospects actifs" value={counters.prospects} icon={<Users className="h-5 w-5" />} />
          <StatCard title="Clients actifs" value={counters.customers} icon={<Store className="h-5 w-5" />} />
          <StatCard title="Fournisseurs actifs" value={counters.suppliers} icon={<Truck className="h-5 w-5" />} />
          <StatCard title="Prospects a relancer" value={counters.followUps} icon={<CalendarClock className="h-5 w-5" />} />
          <StatCard title="Limites credit" value={counters.creditLimits} icon={<CreditCard className="h-5 w-5" />} />
          <StatCard title="Fournisseurs evalues" value={counters.ratedSuppliers} icon={<Star className="h-5 w-5" />} />
        </div>
      ) : null}
      <ThirdPartyFilters filters={filters} forcedType={forcedType} />
      {rows.length ? (
        <>
          <ThirdPartyTable rows={rows} />
          <PaginationBar page={pagination.page} totalPages={pagination.totalPages} searchParams={params} />
        </>
      ) : (
        <EmptyState
          title="Aucun tiers trouve"
          description="Ajustez les filtres ou creez un nouveau tiers pour alimenter la base."
          action={<Link href={meta.buttonHref}><Button>{meta.buttonLabel}</Button></Link>}
        />
      )}    
    </ModulePage>
  );
}


