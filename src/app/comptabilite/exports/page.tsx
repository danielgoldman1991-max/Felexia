import { ModulePage } from "@/components/erp/module-page";
import { PageHeader } from "@/components/erp/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { FileSpreadsheet, FileText, Download } from "lucide-react";

const exportOptions = [
  { title: "Balance", format: "CSV / Excel", description: "Export de la balance des comptes" },
  { title: "Grand livre", format: "CSV / Excel", description: "Export du grand livre general" },
  { title: "Journal general", format: "CSV / Excel", description: "Export chronologique des ecritures" },
  { title: "Ecritures", format: "CSV / Excel", description: "Export detaille des ecritures" },
  { title: "Plan comptable", format: "CSV / Excel", description: "Export de la structure des comptes" },
  { title: "FEC", format: "Fichier FEC", description: "Fichier des Ecritures Comptables (DGI)" },
];

export default function AccountingExportsPage() {
  return (
    <ModulePage>
      <PageHeader title="Exports comptables" description="Exports pour cabinet comptable et rapprochements." />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {exportOptions.map((opt) => (
          <Card key={opt.title} className="transition-opacity hover:opacity-80">
            <CardContent className="flex items-start gap-4 p-5">
              <div className="rounded-md bg-[var(--primary-soft)] p-2.5">
                {opt.format === "Fichier FEC" ? <FileText className="h-5 w-5 text-[var(--primary)]" /> : <FileSpreadsheet className="h-5 w-5 text-[var(--primary)]" />}
              </div>
              <div>
                <h3 className="font-medium text-[var(--foreground)]">{opt.title}</h3>
                <p className="mt-0.5 text-xs text-[var(--muted)]">{opt.description}</p>
                <p className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-[var(--primary)]">
                  <Download className="h-3 w-3" /> {opt.format}
                </p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </ModulePage>
  );
}
