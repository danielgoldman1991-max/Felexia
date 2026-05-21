import { Calendar, Download, FileSpreadsheet, FileText, ShieldCheck } from "lucide-react";
import { generateDgiVatXmlAction } from "@/lib/tax/dgi-vat-export-actions";
import { DGI_VAT_XLSX_AVAILABLE } from "@/lib/tax/dgi-vat-xlsx";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

export function DgiExportWizard({
  periodStart,
  periodEnd,
  frequency,
}: {
  periodStart: string;
  periodEnd: string;
  frequency: "monthly" | "quarterly";
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold text-[var(--foreground)]">Paramètres de l&apos;export</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">Lancez les pré-contrôles puis générez les fichiers XML et CSV préparatoires.</p>
          </div>
          <Badge tone="info">Préparatoire</Badge>
        </div>
      </CardHeader>
      <CardContent>
        <form action={generateDgiVatXmlAction} className="grid gap-4">
          <div className="grid gap-4 md:grid-cols-4">
            <label className="grid gap-2 text-sm">
              <span className="font-medium text-[var(--muted)]">Date début</span>
              <Input name="periodStart" type="date" defaultValue={periodStart} required />
            </label>
            <label className="grid gap-2 text-sm">
              <span className="font-medium text-[var(--muted)]">Date fin</span>
              <Input name="periodEnd" type="date" defaultValue={periodEnd} required />
            </label>
            <label className="grid gap-2 text-sm">
              <span className="font-medium text-[var(--muted)]">Fréquence</span>
              <Select name="frequency" defaultValue={frequency}>
                <option value="monthly">Mensuelle</option>
                <option value="quarterly">Trimestrielle</option>
              </Select>
            </label>
            <label className="grid gap-2 text-sm">
              <span className="font-medium text-[var(--muted)]">Crédit TVA antérieur</span>
              <Input name="priorCreditMad" type="number" step="0.01" min="0" defaultValue="0" />
            </label>
          </div>

          <div className="grid gap-3 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface-soft)] p-4 md:grid-cols-4">
            <label className="flex items-center gap-2 text-sm text-[var(--foreground)]">
              <input type="checkbox" name="includeXml" defaultChecked className="h-4 w-4" />
              XML préparatoire
            </label>
            <label className="flex items-center gap-2 text-sm text-[var(--foreground)]">
              <input type="checkbox" name="includeCsv" defaultChecked className="h-4 w-4" />
              CSV contrôle
            </label>
            <label className="flex items-center gap-2 text-sm text-[var(--muted)]">
              <input type="checkbox" name="includeXlsx" disabled={!DGI_VAT_XLSX_AVAILABLE} className="h-4 w-4" />
              Excel {DGI_VAT_XLSX_AVAILABLE ? "" : "(bientôt)"}
            </label>
            <label className="flex items-center gap-2 text-sm text-[var(--foreground)]">
              <input type="checkbox" name="forceRegenerate" className="h-4 w-4" />
              Régénérer
            </label>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button type="submit" name="previewOnly" value="true" variant="secondary">
              <ShieldCheck className="h-4 w-4" />
              Lancer les contrôles
            </Button>
            <Button type="submit">
              <FileText className="h-4 w-4" />
              Générer XML préparatoire DGI
            </Button>
            <Button type="button" variant="secondary" disabled>
              <Download className="h-4 w-4" />
              Télécharger CSV après génération
            </Button>
            <Button type="button" variant="secondary" disabled>
              <FileSpreadsheet className="h-4 w-4" />
              Excel
              <Badge tone="warning">Bientôt</Badge>
            </Button>
          </div>

          <div className="flex items-start gap-3 rounded-[var(--radius-md)] border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
            <Calendar className="mt-0.5 h-4 w-4 shrink-0" />
            <p>
              Felexia génère un export XML préparatoire structuré selon les exigences fiscales connues et les pièces justificatives attendues. Ce fichier ne constitue pas une homologation officielle DGI. Le dépôt officiel reste à effectuer selon les modalités DGI/SIMPL applicables.
            </p>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
