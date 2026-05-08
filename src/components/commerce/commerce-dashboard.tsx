import Link from "next/link";
import { FileText, ShoppingCart, Truck } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { MoneyDisplay } from "@/components/erp/money-display";
import type { CommerceCounters } from "@/lib/commerce-types";

function MetricCard({ title, value, href, icon }: { title: string; value: string | number | React.ReactNode; href?: string; icon?: React.ReactNode }) {
  const inner = (
    <Card className="transition-shadow hover:shadow-md">
      <CardContent className="flex items-center justify-between py-5">
        <div className="space-y-1">
          <p className="text-xs font-medium uppercase text-[var(--muted)]">{title}</p>
          <p className="text-2xl font-semibold">{value}</p>
        </div>
        {icon ? <div className="text-[var(--muted)]">{icon}</div> : null}
      </CardContent>
    </Card>
  );

  if (href) return <Link href={href}>{inner}</Link>;
  return inner;
}

const defaultCounters: CommerceCounters = {
  draftQuotes: 0,
  sentQuotes: 0,
  acceptedQuotes: 0,
  confirmedOrders: 0,
  pendingDeliveries: 0,
  quoteAmount: 0,
  orderAmount: 0,
};

export function CommerceDashboard({ counters }: { counters?: CommerceCounters }) {
  const c = counters ?? defaultCounters;
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Devis brouillon"
          value={c.draftQuotes}
          href="/devis?status=draft"
          icon={<FileText className="h-5 w-5" />}
        />
        <MetricCard
          title="Devis envoyes"
          value={c.sentQuotes}
          href="/devis?status=sent"
          icon={<FileText className="h-5 w-5" />}
        />
        <MetricCard
          title="Devis acceptes"
          value={c.acceptedQuotes}
          href="/devis?status=accepted"
          icon={<FileText className="h-5 w-5" />}
        />
        <MetricCard
          title="Commandes confirmees"
          value={c.confirmedOrders}
          href="/commandes?status=confirmed"
          icon={<ShoppingCart className="h-5 w-5" />}
        />
        <MetricCard
          title="Livraisons en attente"
          value={c.pendingDeliveries}
          href="/livraisons?status=draft"
          icon={<Truck className="h-5 w-5" />}
        />
        <MetricCard
          title="Montant devis"
          value={<MoneyDisplay value={c.quoteAmount} />}
          icon={<FileText className="h-5 w-5" />}
        />
        <MetricCard
          title="Montant commandes"
          value={<MoneyDisplay value={c.orderAmount} />}
          icon={<ShoppingCart className="h-5 w-5" />}
        />
      </div>
    </div>
  );
}
