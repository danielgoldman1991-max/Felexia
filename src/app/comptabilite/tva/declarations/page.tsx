import { ModulePage } from "@/components/erp/module-page";
import { PageHeader } from "@/components/erp/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, Th } from "@/components/ui/table";
import { EmptyState } from "@/components/erp/empty-state";
import { FileText, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function VatDeclarationsPage() {
  return (
    <ModulePage>
      <PageHeader
        title="Déclarations TVA"
        description="Préparez et suivez vos déclarations périodiques de TVA."
      />

      <Card className="mb-6 border-dashed bg-[linear-gradient(180deg,#fff_0%,#fbfcff_100%)]">
        <CardContent className="flex items-start gap-4 p-5">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-50">
            <FileText className="h-6 w-6 text-blue-600" />
          </div>
          <div>
            <h3 className="font-semibold text-[var(--foreground)]">
              Déclarations TVA en préparation
            </h3>
            <p className="mt-1 text-sm leading-6 text-[var(--muted)]">
              Cette page permettra de préparer les déclarations de TVA par période, de contrôler les montants de TVA collectée et récupérable, puis de générer les états nécessaires à la déclaration.
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-[var(--muted)]">
          Déclarations
        </h3>
        <Button variant="secondary" disabled className="cursor-not-allowed opacity-50">
          <Plus className="h-4 w-4" />
          Nouvelle déclaration TVA
          <Badge tone="warning" className="ml-1.5">Bientôt disponible</Badge>
        </Button>
      </div>

      <Table>
        <thead>
          <tr>
            <Th>Période</Th>
            <Th>Régime</Th>
            <Th>TVA collectée</Th>
            <Th>TVA récupérable</Th>
            <Th>Solde à payer / Crédit TVA</Th>
            <Th>Statut</Th>
            <Th>Date limite</Th>
            <Th>Actions</Th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td colSpan={8} className="border-t border-[var(--border)] px-4 py-8">
              <EmptyState
                title="Aucune déclaration TVA"
                description="Aucune déclaration TVA créée pour le moment."
              />
            </td>
          </tr>
        </tbody>
      </Table>
    </ModulePage>
  );
}
