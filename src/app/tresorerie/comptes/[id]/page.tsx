import Link from "next/link";
import { ArrowLeft, Pencil } from "lucide-react";
import { ModulePage } from "@/components/erp/module-page";
import { PageHeader } from "@/components/erp/page-header";
import { MoneyDisplay } from "@/components/erp/money-display";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TreasuryTransactionsTable } from "@/components/treasury/treasury-transactions-table";
import { getTreasuryAccountDetail } from "@/lib/treasury";
import { TREASURY_ACCOUNT_TYPE_LABELS } from "@/lib/treasury-types";

export const dynamic = "force-dynamic";

export default async function TreasuryAccountDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { account, transactions } = await getTreasuryAccountDetail(id);
  if (!account) {
    return <ModulePage><PageHeader title="Compte introuvable" actions={<Button variant="secondary" asChild><Link href="/tresorerie/comptes"><ArrowLeft className="h-4 w-4" /> Retour</Link></Button>} /></ModulePage>;
  }
  return (
    <ModulePage>
      <PageHeader
        title={account.name}
        description="Fiche compte de tresorerie et derniers mouvements."
        actions={<><Button variant="secondary" asChild><Link href="/tresorerie/comptes"><ArrowLeft className="h-4 w-4" /> Retour</Link></Button><Button asChild><Link href={`/tresorerie/comptes/${account.id}/edit`}><Pencil className="h-4 w-4" /> Modifier</Link></Button></>}
      />
      <div className="grid gap-5 lg:grid-cols-[1fr_2fr]">
        <Card>
          <CardHeader><h2 className="font-semibold">Informations</h2></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p><span className="text-[var(--muted)]">Code :</span> {account.code ?? "-"}</p>
            <p><span className="text-[var(--muted)]">Type :</span> {TREASURY_ACCOUNT_TYPE_LABELS[account.account_type]}</p>
            <p><span className="text-[var(--muted)]">Banque :</span> {account.bank_name ?? "-"}</p>
            <p><span className="text-[var(--muted)]">Devise :</span> {account.currency}</p>
            <p><span className="text-[var(--muted)]">Solde actuel :</span> <MoneyDisplay value={account.current_balance} /></p>
            <p><span className="text-[var(--muted)]">Statut :</span> <Badge tone={account.status === "active" ? "success" : "neutral"}>{account.status}</Badge></p>
            <p><span className="text-[var(--muted)]">Par defaut :</span> {account.is_default ? "Oui" : "Non"}</p>
            <p><span className="text-[var(--muted)]">Notes :</span> {account.notes ?? "-"}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><h2 className="font-semibold">Derniers mouvements</h2></CardHeader>
          <CardContent><TreasuryTransactionsTable rows={transactions} /></CardContent>
        </Card>
      </div>
    </ModulePage>
  );
}
