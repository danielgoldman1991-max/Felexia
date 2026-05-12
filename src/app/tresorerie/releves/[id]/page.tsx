import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ModulePage } from "@/components/erp/module-page";
import { PageHeader } from "@/components/erp/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { BankStatementLinesTable } from "@/components/treasury/bank-statement-lines-table";
import { getBankStatementImportDetail } from "@/lib/treasury";

export const dynamic = "force-dynamic";

export default async function BankStatementImportDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { statementImport, lines } = await getBankStatementImportDetail(id);
  return (
    <ModulePage>
      <PageHeader
        title={statementImport?.file_name ?? "Releve introuvable"}
        description="Lignes de releve importees pour rapprochement bancaire."
        actions={<Link href="/tresorerie/releves"><Button variant="secondary"><ArrowLeft className="h-4 w-4" /> Retour</Button></Link>}
      />
      <Card><CardContent><BankStatementLinesTable rows={lines} /></CardContent></Card>
    </ModulePage>
  );
}
