import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { MoneyDisplay } from "@/components/erp/money-display";
import { PageHeader } from "@/components/erp/page-header";
import type { SalesCounters } from "@/lib/sales-types";

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

export function SalesDashboard({ counters }: { counters: SalesCounters }) {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Vente"
        description="Flux commercial simplifie : devis, commandes clients et bons de livraison."
        actions={
          <Link href="/vente/devis/new">
            <Button>Nouveau devis</Button>
          </Link>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Stat label="Devis brouillons" value={counters.draftQuotes} />
        <Stat label="Devis envoyes" value={counters.sentQuotes} />
        <Stat label="Commandes confirmees" value={counters.confirmedOrders} />
        <Stat label="BL brouillons" value={counters.draftDeliveries} />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader><h2 className="font-semibold">Montant devis</h2></CardHeader>
          <CardContent className="text-2xl font-semibold">
            <MoneyDisplay value={counters.quoteAmount} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader><h2 className="font-semibold">Montant commandes</h2></CardHeader>
          <CardContent className="text-2xl font-semibold">
            <MoneyDisplay value={counters.orderAmount} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
