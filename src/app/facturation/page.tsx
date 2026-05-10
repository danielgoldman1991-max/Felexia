import Link from "next/link";
import { Clock, FileCheck2, FileText, Send } from "lucide-react";
import { ModulePage } from "@/components/erp/module-page";
import { PageHeader } from "@/components/erp/page-header";
import { StatCard } from "@/components/erp/stat-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { MoneyDisplay } from "@/components/erp/money-display";
import { getInvoiceCounters } from "@/lib/invoices";
import { getPaymentCounters } from "@/lib/payments";

export const dynamic = "force-dynamic";

export default async function BillingDashboardPage() {
  const [counters, paymentCounters] = await Promise.all([getInvoiceCounters(), getPaymentCounters()]);

  return (
    <ModulePage>
      <PageHeader
        title="Facturation"
        description="Suivi des factures clients, validations et encours."
        actions={<Link href="/facturation/factures/new"><Button>Nouvelle facture</Button></Link>}
      />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Brouillons" value={counters.draft} caption="Factures a valider" icon={<FileText className="h-5 w-5" />} />
        <StatCard title="Validees" value={counters.validated} caption="Documents officiels" icon={<FileCheck2 className="h-5 w-5" />} />
        <StatCard title="Envoyees" value={counters.sent} caption="En attente paiement" icon={<Send className="h-5 w-5" />} />
        <StatCard title="En retard" value={counters.overdue} caption="Echeance depassee" icon={<Clock className="h-5 w-5" />} />
      </div>
      <Card>
        <CardHeader><h2 className="font-semibold">Synthese financiere</h2></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] p-4">
            <p className="text-sm font-medium text-[var(--muted)]">Total facture</p>
            <p className="mt-2 text-xl font-semibold"><MoneyDisplay value={counters.invoicedTotal} /></p>
          </div>
          <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] p-4">
            <p className="text-sm font-medium text-[var(--muted)]">Total encaisse</p>
            <p className="mt-2 text-xl font-semibold"><MoneyDisplay value={counters.paidTotal} /></p>
          </div>
          <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] p-4">
            <p className="text-sm font-medium text-[var(--muted)]">Reste a encaisser</p>
            <p className="mt-2 text-xl font-semibold"><MoneyDisplay value={counters.remainingTotal} /></p>
          </div>
          <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] p-4">
            <p className="text-sm font-medium text-[var(--muted)]">Paiements recus</p>
            <p className="mt-2 text-xl font-semibold"><MoneyDisplay value={paymentCounters.receivedTotal} /></p>
          </div>
          <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] p-4">
            <p className="text-sm font-medium text-[var(--muted)]">A affecter</p>
            <p className="mt-2 text-xl font-semibold"><MoneyDisplay value={paymentCounters.availableTotal} /></p>
          </div>
          <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] p-4">
            <p className="text-sm font-medium text-[var(--muted)]">Factures partielles</p>
            <p className="mt-2 text-xl font-semibold">{paymentCounters.partiallyPaidInvoices}</p>
          </div>
        </CardContent>
      </Card>
    </ModulePage>
  );
}
