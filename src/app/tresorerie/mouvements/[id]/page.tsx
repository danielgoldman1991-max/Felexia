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
import { requireActiveWorkspace } from "@/lib/auth";
import { hasFullErpAccess } from "@/lib/launch-access";
import { isOperatorRole } from "@/lib/auth/operator-access";
import { isAdminRole } from "@/lib/auth/roles";
import { canWriteWorkspaceSubscription } from "@/lib/subscriptions/subscription-access";

export const dynamic = "force-dynamic";

export default async function TreasuryTransactionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const workspace = await requireActiveWorkspace();
  const fullAccess = !isOperatorRole(workspace.role) && await hasFullErpAccess(workspace.organization.id);
  const tx = await getTreasuryTransactionDetail(id);
  const canManage = isAdminRole(workspace.role) && canWriteWorkspaceSubscription(workspace.subscription);
  return (
    <ModulePage>
      <PageHeader title={tx?.label ?? "Mouvement introuvable"} actions={<Button variant="secondary" asChild><Link href="/tresorerie/mouvements"><ArrowLeft className="h-4 w-4" /> Retour</Link></Button>} />
      {tx && ["transfer_in", "transfer_out"].includes(tx.transaction_type) ? <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 text-sm"><p>Pour corriger ce transfert, enregistrez un transfert inverse entre les mêmes comptes.</p>{canManage ? <Button variant="secondary" asChild><Link href="/tresorerie/mouvements/new">Enregistrer un transfert inverse</Link></Button> : null}</div> : null}
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
            {fullAccess ? <p><span className="text-[var(--muted)]">Rapprochement :</span> {RECONCILIATION_STATUS_LABELS[tx.reconciliation_status]}</p> : null}
            <p className="md:col-span-2"><span className="text-[var(--muted)]">Description :</span> {tx.description ?? "-"}</p>
          </CardContent>
        </Card>
      ) : null}
    </ModulePage>
  );
}
