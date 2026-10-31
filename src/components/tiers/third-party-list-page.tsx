import Link from "next/link";
import {
  Building2, CalendarClock, ChevronLeft, ChevronRight, CreditCard, Plus, SearchX, Star, Store, Truck, Users,
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
import { requireActiveWorkspace } from "@/lib/auth";
import { hasFullErpAccess } from "@/lib/launch-access";

type PageMeta = { title: string; description: string; buttonLabel: string; buttonHref: string };

const titles: Record<ThirdPartyKind | "all", PageMeta> = {
  all: {
    title: "Tiers",
    description: "Tous les contacts de votre entreprise, au même endroit.",
    buttonLabel: "Nouveau tiers",
    buttonHref: "/tiers/new",
  },
  prospect: {
    title: "Prospects",
    description: "Retrouvez vos prospects et préparez vos prochaines ventes.",
    buttonLabel: "Nouveau prospect",
    buttonHref: "/tiers/new?type=prospect",
  },
  customer: {
    title: "Clients",
    description: "Vos clients et leurs coordonnées, prêts pour la facturation.",
    buttonLabel: "Nouveau client",
    buttonHref: "/tiers/new?type=customer",
  },
  supplier: {
    title: "Fournisseurs",
    description: "Vos fournisseurs et leurs coordonnées pour vos achats.",
    buttonLabel: "Nouveau fournisseur",
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
          <Button variant="secondary" asChild><Link href={href(page - 1)}>
              <ChevronLeft className="h-4 w-4" /> Précédente
            </Link></Button>
        ) : null}
        {page < totalPages ? (
          <Button variant="secondary" asChild><Link href={href(page + 1)}>
              Suivante <ChevronRight className="h-4 w-4" />
            </Link></Button>
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
  const workspace = await requireActiveWorkspace();
  const fullAccess = await hasFullErpAccess(workspace.organization.id);
  const filters = filtersFromSearchParams(params, forcedType);
  const meta = titles[forcedType ?? "all"];
  const hasFilters = Boolean(filters.query || filters.city || (filters.status && filters.status !== "active") || (filters.vat && filters.vat !== "all") || (!forcedType && filters.type && filters.type !== "all"));
  const contactLabel = forcedType === "customer" ? "client" : forcedType === "supplier" ? "fournisseur" : forcedType === "prospect" ? "prospect" : "contact";
  const ContactIcon = forcedType === "supplier" ? Truck : Users;
  const createAction = <Button asChild><Link href={meta.buttonHref}><Plus className="h-4 w-4" aria-hidden="true" />{meta.buttonLabel}</Link></Button>;

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
      showCounters && fullAccess ? getThirdPartyCounters() : Promise.resolve(counters),
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
          actions={createAction}
        />
        <EmptyState
          title="Impossible de charger vos contacts"
          description={fullAccess ? `Appliquez la migration 002_third_parties_complete.sql. Detail: ${errorMessage}` : "Réessayez dans un instant ou contactez l'assistance."}
          icon={<ContactIcon className="h-6 w-6" />}
        />
      </ModulePage>
    );
  }

  return (
    <ModulePage>
      <PageHeader
        title={meta.title}
        description={meta.description}
        actions={createAction}
      />
      {showCounters && fullAccess ? (
        <div className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-7">
          <StatCard title="Total tiers" value={counters.total} icon={<Building2 className="h-5 w-5" />} />
          <StatCard title="Prospects actifs" value={counters.prospects} icon={<Users className="h-5 w-5" />} />
          <StatCard title="Clients actifs" value={counters.customers} icon={<Store className="h-5 w-5" />} />
          <StatCard title="Fournisseurs actifs" value={counters.suppliers} icon={<Truck className="h-5 w-5" />} />
          <StatCard title="Prospects à relancer" value={counters.followUps} icon={<CalendarClock className="h-5 w-5" />} />
          <StatCard title="Limites de crédit" value={counters.creditLimits} icon={<CreditCard className="h-5 w-5" />} />
          <StatCard title="Fournisseurs évalués" value={counters.ratedSuppliers} icon={<Star className="h-5 w-5" />} />
        </div>
      ) : null}
      <ThirdPartyFilters filters={filters} forcedType={forcedType} fullAccess={fullAccess} />
      {rows.length ? (
        <>
          <ThirdPartyTable rows={rows} fullAccess={fullAccess} />
          <PaginationBar page={pagination.page} totalPages={pagination.totalPages} searchParams={params} />
        </>
      ) : (
        <EmptyState
          title={hasFilters ? `Aucun ${contactLabel} ne correspond` : `Aucun ${contactLabel} pour le moment`}
          description={hasFilters ? "Essayez un autre nom ou réinitialisez les filtres pour retrouver vos contacts." : forcedType === "supplier" ? "Ajoutez un fournisseur pour enregistrer vos factures d’achat et suivre vos paiements." : forcedType === "customer" ? "Ajoutez un client pour créer votre première facture de vente et suivre ses règlements." : "Ajoutez vos contacts pour les retrouver facilement dans vos documents."}
          icon={hasFilters ? <SearchX className="h-6 w-6" /> : <ContactIcon className="h-6 w-6" />}
          action={hasFilters ? <Button variant="secondary" asChild><Link href="?">Réinitialiser les filtres</Link></Button> : undefined}
        />
      )}    
    </ModulePage>
  );
}


