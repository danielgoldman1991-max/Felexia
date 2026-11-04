import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ModulePage } from "@/components/erp/module-page";
import { PageHeader } from "@/components/erp/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { BankStatementLinesTable } from "@/components/treasury/bank-statement-lines-table";
import { getBankStatementImportDetail } from "@/lib/treasury";

export const dynamic = "force-dynamic";

export default async function BankStatementImportDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ imported?: string; skipped?: string }> }) {
  const { id } = await params;
  const query = await searchParams;
  const skipped = Number(query.skipped ?? 0);
  const { statementImport, lines } = await getBankStatementImportDetail(id);
  return (
    <ModulePage>
      <PageHeader
        title={statementImport?.file_name ?? "Releve introuvable"}
        description={skipped > 0 ? `${query.imported ?? lines.length} lignes nouvelles. ${skipped} lignes déjà présentes ont été ignorées.` : "Lignes de relevé importées pour le rapprochement bancaire."}
        actions={<Button variant="secondary" asChild><Link href="/tresorerie/releves"><ArrowLeft className="h-4 w-4" /> Retour</Link></Button>}
      />
      <Card><CardContent><BankStatementLinesTable rows={lines} /></CardContent></Card>
    </ModulePage>
  );
}
