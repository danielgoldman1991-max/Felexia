import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { MoneyDisplay } from "@/components/erp/money-display";
import { PageHeader } from "@/components/erp/page-header";
import type { PurchaseCounters } from "@/lib/purchase-types";

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="space-y-1">
        <p className="text-xs font-medium uppercase text-[var(--muted)]">{label}</p>
        <div className="text-2xl font-semibold text-[var(--foreground)]">{value}</div>
      </CardContent>
    </Card>
  );
}

export function PurchaseDashboard({ counters }: { counters: PurchaseCounters }) {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Achats"
        description="Gestion des achats et fournisseurs."
        actions={<Link href="/achats/commandes/new"><Button>Nouvelle commande</Button></Link>}
      />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Stat label="Commandes brouillon" value={counters.draftOrders} />
        <Stat label="Commandes confirmees" value={counters.confirmedOrders} />
        <Stat label="Receptions brouillon" value={counters.draftReceipts} />
        <Stat label="Factures impayees" value={counters.unpaidInvoices} />
        <Stat label="Montant a payer" value={<MoneyDisplay value={counters.totalToPay} />} />
        <Stat label="Paiements non affectes" value={<MoneyDisplay value={counters.unallocatedPayments} />} />
      </div>
    </div>
  );
}
