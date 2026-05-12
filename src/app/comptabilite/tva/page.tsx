import { ModulePage } from "@/components/erp/module-page";
import { PageHeader } from "@/components/erp/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calculator, FileText, ShieldCheck, Download, Calendar } from "lucide-react";
import Link from "next/link";
import { getVatPreparationSummary } from "@/lib/accounting";
import { cn } from "@/lib/utils";

function formatEuro(value: number | null): string {
  if (value === null) return "—";
  return `${value.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} DH`;
}

export default async function AccountingVatPage() {
  const summary = await getVatPreparationSummary();

  const navCards = [
    {
      title: "Déclarations TVA",
      description: "Préparez et suivez vos déclarations périodiques de TVA.",
      href: "/comptabilite/tva/declarations",
      icon: FileText,
      color: "bg-blue-50 text-blue-600",
    },
    {
      title: "États de contrôle",
      description: "Contrôlez la cohérence entre factures, écritures et comptes TVA.",
      href: "/comptabilite/tva/controle",
      icon: ShieldCheck,
      color: "bg-amber-50 text-amber-600",
    },
    {
      title: "Exports DGI",
      description: "Préparez les fichiers fiscaux destinés aux déclarations et contrôles.",
      href: "/comptabilite/tva/exports",
      icon: Download,
      color: "bg-emerald-50 text-emerald-600",
    },
  ];

  const summaryCards = [
    {
      title: "TVA collectée",
      value: formatEuro(summary.collectedVat),
      icon: Calculator,
      color: "text-blue-600",
      bg: "bg-blue-50",
      pending: summary.collectedVat === null,
    },
    {
      title: "TVA récupérable",
      value: formatEuro(summary.deductibleVat),
      icon: Calculator,
      color: "text-emerald-600",
      bg: "bg-emerald-50",
      pending: summary.deductibleVat === null,
    },
    {
      title: "Solde TVA estimé",
      value: formatEuro(summary.estimatedVatBalance),
      icon: Calculator,
      color: "text-purple-600",
      bg: "bg-purple-50",
      pending: summary.estimatedVatBalance === null,
    },
    {
      title: "Prochaine déclaration",
      value: summary.nextPeriod ?? "À configurer",
      icon: Calendar,
      color: "text-rose-600",
      bg: "bg-rose-50",
      pending: false,
    },
  ];

  return (
    <ModulePage>
      <PageHeader
        title="TVA"
        description="Préparation des déclarations de TVA, contrôles et exports fiscaux."
      />

      <Card className="mb-8 border-dashed bg-[linear-gradient(180deg,#fff_0%,#fbfcff_100%)]">
        <CardContent className="flex flex-col items-center py-12 text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50">
            <Calculator className="h-7 w-7 text-blue-600" />
          </div>
          <h2 className="text-xl font-semibold text-[var(--foreground)]">
            Module TVA en préparation
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted)]">
            Les déclarations de TVA, états de contrôle et exports vers la DGI seront disponibles dans une prochaine itération.
          </p>
          <p className="mt-1 max-w-2xl text-xs leading-5 text-[var(--muted)]">
            Cette rubrique centralisera prochainement la TVA collectée, la TVA récupérable, les soldes de TVA, les périodes déclaratives et les contrôles avant déclaration.
          </p>
        </CardContent>
      </Card>

      <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-[var(--muted)]">
        Synthèse TVA
      </h3>
      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {summaryCards.map((card) => (
          <Card key={card.title}>
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div className={cn("flex h-10 w-10 items-center justify-center rounded-xl", card.bg)}>
                  <card.icon className={cn("h-5 w-5", card.color)} />
                </div>
                {card.pending ? (
                  <Badge tone="warning">Bientôt disponible</Badge>
                ) : null}
              </div>
              <p className="mt-4 text-xs font-medium text-[var(--muted)]">{card.title}</p>
              <p className={cn("mt-1 text-xl font-bold", card.pending ? "text-[var(--muted)]" : "text-[var(--foreground)]")}>
                {card.value}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-[var(--muted)]">
        Rubriques TVA
      </h3>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {navCards.map((nav) => {
          const Icon = nav.icon;
          return (
            <Link key={nav.href} href={nav.href} className="block">
              <Card className="h-full transition-shadow hover:shadow-md">
                <CardContent className="p-5">
                  <div className="flex items-start gap-4">
                    <div className={cn("flex h-12 w-12 shrink-0 items-center justify-center rounded-xl", nav.color)}>
                      <Icon className="h-6 w-6" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-[var(--foreground)]">{nav.title}</h4>
                      <p className="mt-1 text-xs leading-5 text-[var(--muted)]">{nav.description}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>

      <div className="mt-6 text-center">
        <Link
          href="/comptabilite/ecritures"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--primary)] hover:underline"
        >
          <Calculator className="h-3.5 w-3.5" />
          Voir les écritures comptables
        </Link>
      </div>
    </ModulePage>
  );
}
