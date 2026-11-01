import { ModulePage } from "@/components/erp/module-page";
import { PageHeader } from "@/components/erp/page-header";
import { Card, CardContent } from "@/components/ui/card";
import Link from "next/link";
import { FileSpreadsheet, ArrowUpRight, Download } from "lucide-react";

const exportOptions = [
  { title: "Plan comptable", href: "/comptabilite/plan-comptable/export", action: "Télécharger le CSV", download: true, description: "Télécharger les comptes de votre entreprise." },
  { title: "Journaux", href: "/comptabilite/journaux", action: "Choisir un journal", download: false, description: "Choisir un journal et une période, puis utiliser ses exports CSV ou Excel." },
  { title: "Balance", href: "/comptabilite/balance", action: "Consulter la balance", download: false, description: "Consulter les mouvements et soldes par compte sur la période choisie." },
  { title: "Grand livre", href: "/comptabilite/grand-livre", action: "Consulter le grand livre", download: false, description: "Consulter le détail chronologique des écritures par compte." },
];

export default function AccountingExportsPage() {
  return (
    <ModulePage>
      <PageHeader title="Exports et rapports comptables" description="Retrouvez les téléchargements disponibles et les rapports de votre entreprise." />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {exportOptions.map((opt) => (
          <Card key={opt.title}>
            <CardContent className="flex items-start gap-4 p-5">
              <div className="rounded-md bg-[var(--primary-soft)] p-2.5">
                <FileSpreadsheet className="h-5 w-5 text-[var(--primary)]" aria-hidden="true" />
              </div>
              <div>
                <h2 className="font-medium text-[var(--foreground)]">{opt.title}</h2>
                <p className="mt-0.5 text-xs text-[var(--muted)]">{opt.description}</p>
                <Link href={opt.href} className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-[var(--primary)] hover:underline">
                  {opt.download ? <Download className="h-4 w-4" aria-hidden="true" /> : <ArrowUpRight className="h-4 w-4" aria-hidden="true" />}{opt.action}
                </Link>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      <p className="text-sm text-[var(--muted)]">Un fichier FEC et une transmission officielle DGI ne sont pas disponibles depuis cet écran. Les exports destinés à une déclaration restent à valider avec votre conseil.</p>
    </ModulePage>
  );
}
