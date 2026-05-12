import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ModulePage } from "@/components/erp/module-page";
import { PageHeader } from "@/components/erp/page-header";
import { MoneyDisplay } from "@/components/erp/money-display";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getTreasuryTransactionDetail } from "@/lib/treasury";
import { RECONCILIATION_STATUS_LABELS, TREASURY_TRANSACTION_TYPE_LABELS } from "@/lib/treasury-types";

export const dynamic = "force-dynamic";

export default async function TreasuryTransactionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const tx = await getTreasuryTransactionDetail(id);
  return (
    <ModulePage>
      <PageHeader title={tx?.label ?? "Mouvement introuvable"} actions={<Link href="/tresorerie/mouvements"><Button variant="secondary"><ArrowLeft className="h-4 w-4" /> Retour</Button></Link>} />
      {tx ? (
        <Card>
          <CardHeader><h2 className="font-semibold">Detail mouvement</h2></CardHeader>
          <CardContent className="grid gap-3 text-sm md:grid-cols-2">
            <p><span className="text-[var(--muted)]">Compte :</span> {tx.account_name ?? tx.treasury_account_id}</p>
            <p><span className="text-[var(--muted)]">Type :</span> {TREASURY_TRANSACTION_TYPE_LABELS[tx.transaction_type]}</p>
            <p><span className="text-[var(--muted)]">Sens :</span> <Badge tone={tx.direction === "in" ? "success" : "warning"}>{tx.direction === "in" ? "Entree" : "Sortie"}</Badge></p>
            <p><span className="text-[var(--muted)]">Montant :</span> <MoneyDisplay value={tx.amount} /></p>
            <p><span className="text-[var(--muted)]">Date :</span> {tx.transaction_date}</p>
            <p><span className="text-[var(--muted)]">Reference :</span> {tx.reference ?? "-"}</p>
            <p><span className="text-[var(--muted)]">Tiers :</span> {tx.third_party_name ?? "-"}</p>
            <p><span className="text-[var(--muted)]">Rapprochement :</span> {RECONCILIATION_STATUS_LABELS[tx.reconciliation_status]}</p>
            <p className="md:col-span-2"><span className="text-[var(--muted)]">Description :</span> {tx.description ?? "-"}</p>
          </CardContent>
        </Card>
      ) : null}
    </ModulePage>
  );
}
