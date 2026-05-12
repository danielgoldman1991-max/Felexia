import { ModulePage } from "@/components/erp/module-page";
import { PageHeader } from "@/components/erp/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, Th } from "@/components/ui/table";
import { EmptyState } from "@/components/erp/empty-state";
import { cn } from "@/lib/utils";
import { Download, FileText, FileSpreadsheet, Archive } from "lucide-react";

const exportTypes = [
  {
    title: "Déclaration TVA",
    description: "Export des données pour le formulaire de déclaration TVA.",
    icon: FileText,
    color: "text-blue-600",
    bg: "bg-blue-50",
    format: "CSV / PDF",
  },
  {
    title: "Relevé des déductions",
    description: "Détail de la TVA récupérable par facture.",
    icon: FileSpreadsheet,
    color: "text-emerald-600",
    bg: "bg-emerald-50",
    format: "CSV",
  },
  {
    title: "État de contrôle",
    description: "Synthèse des contrôles TVA pour justificatif.",
    icon: FileText,
    color: "text-amber-600",
    bg: "bg-amber-50",
    format: "PDF",
  },
  {
    title: "Archive justificative",
    description: "Ensemble des pièces justificatives TVA pour la période.",
    icon: Archive,
    color: "text-purple-600",
    bg: "bg-purple-50",
    format: "ZIP",
  },
];

export default function VatExportsPage() {
  return (
    <ModulePage>
      <PageHeader
        title="Exports DGI"
        description="Préparation des fichiers fiscaux destinés aux déclarations et contrôles."
      />

      <Card className="mb-6 border-dashed bg-[linear-gradient(180deg,#fff_0%,#fbfcff_100%)]">
        <CardContent className="flex items-start gap-4 p-5">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-50">
            <Download className="h-6 w-6 text-emerald-600" />
          </div>
          <div>
            <h3 className="font-semibold text-[var(--foreground)]">
              Exports DGI en préparation
            </h3>
            <p className="mt-1 text-sm leading-6 text-[var(--muted)]">
              Les exports vers les formats requis pour les déclarations fiscales seront disponibles dans une prochaine itération.
            </p>
          </div>
        </CardContent>
      </Card>

      <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-[var(--muted)]">
        Types d&apos;export disponibles
      </h3>
      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {exportTypes.map((exp) => {
          const Icon = exp.icon;
          return (
            <Card key={exp.title}>
              <CardContent className="p-5">
                <div className="flex items-start gap-4">
                  <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", exp.bg)}>
                    <Icon className={cn("h-5 w-5", exp.color)} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="truncate font-medium text-[var(--foreground)]">{exp.title}</h4>
                      <Badge tone="info">{exp.format}</Badge>
                    </div>
                    <p className="mt-1 text-xs leading-5 text-[var(--muted)]">{exp.description}</p>
                    <Badge tone="warning" className="mt-2">Bientôt disponible</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-[var(--muted)]">
        Exports générés
      </h3>
      <Table>
        <thead>
          <tr>
            <Th>Période</Th>
            <Th>Type export</Th>
            <Th>Format</Th>
            <Th>Statut</Th>
            <Th>Généré le</Th>
            <Th>Actions</Th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td colSpan={6} className="border-t border-[var(--border)] px-4 py-8">
              <EmptyState
                title="Aucun export généré"
                description="Aucun export généré pour le moment."
              />
            </td>
          </tr>
        </tbody>
      </Table>
    </ModulePage>
  );
}
