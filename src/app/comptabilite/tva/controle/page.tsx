import { ModulePage } from "@/components/erp/module-page";
import { PageHeader } from "@/components/erp/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, Th } from "@/components/ui/table";
import { EmptyState } from "@/components/erp/empty-state";
import { cn } from "@/lib/utils";
import { ShieldCheck, Search, AlertTriangle, FileText, ArrowLeftRight } from "lucide-react";

const futureSections = [
  {
    title: "Contrôle TVA collectée",
    description: "Vérification de la TVA facturée aux clients vs comptes 4455.",
    icon: Search,
    color: "text-blue-600",
    bg: "bg-blue-50",
  },
  {
    title: "Contrôle TVA récupérable",
    description: "Vérification de la TVA sur achats vs comptes 3455.",
    icon: Search,
    color: "text-emerald-600",
    bg: "bg-emerald-50",
  },
  {
    title: "Factures sans TVA",
    description: "Factures validées sans ligne de TVA associée.",
    icon: AlertTriangle,
    color: "text-amber-600",
    bg: "bg-amber-50",
  },
  {
    title: "Écritures TVA sans facture source",
    description: "Lignes d'écriture sur comptes TVA sans document source.",
    icon: FileText,
    color: "text-rose-600",
    bg: "bg-rose-50",
  },
  {
    title: "Écarts facturation / comptabilité",
    description: "Comparaison entre TVA des factures et écritures comptabilisées.",
    icon: ArrowLeftRight,
    color: "text-purple-600",
    bg: "bg-purple-50",
  },
];

export default function VatControlPage() {
  return (
    <ModulePage>
      <PageHeader
        title="États de contrôle TVA"
        description="Contrôlez la cohérence entre factures, écritures comptables et comptes TVA."
      />

      <Card className="mb-6 border-dashed bg-[linear-gradient(180deg,#fff_0%,#fbfcff_100%)]">
        <CardContent className="flex items-start gap-4 p-5">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-amber-50">
            <ShieldCheck className="h-6 w-6 text-amber-600" />
          </div>
          <div>
            <h3 className="font-semibold text-[var(--foreground)]">
              Contrôles TVA en préparation
            </h3>
            <p className="mt-1 text-sm leading-6 text-[var(--muted)]">
              Cette page permettra de vérifier les écarts entre la TVA issue des factures, la TVA comptabilisée et les soldes des comptes de TVA.
            </p>
          </div>
        </CardContent>
      </Card>

      <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-[var(--muted)]">
        Contrôles disponibles
      </h3>
      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {futureSections.map((section) => {
          const Icon = section.icon;
          return (
            <Card key={section.title}>
              <CardContent className="p-5">
                <div className="flex items-start gap-4">
                  <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", section.bg)}>
                    <Icon className={cn("h-5 w-5", section.color)} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="truncate font-medium text-[var(--foreground)]">{section.title}</h4>
                    </div>
                    <p className="mt-1 text-xs leading-5 text-[var(--muted)]">{section.description}</p>
                    <Badge tone="warning" className="mt-2">Bientôt disponible</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-[var(--muted)]">
        Résultats de contrôle
      </h3>
      <Table>
        <thead>
          <tr>
            <Th>Type contrôle</Th>
            <Th>Période</Th>
            <Th>Écart détecté</Th>
            <Th>Gravité</Th>
            <Th>Statut</Th>
            <Th>Actions</Th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td colSpan={6} className="border-t border-[var(--border)] px-4 py-8">
              <EmptyState
                title="Aucun contrôle TVA lancé"
                description="Aucun contrôle TVA lancé pour le moment."
              />
            </td>
          </tr>
        </tbody>
      </Table>
    </ModulePage>
  );
}
