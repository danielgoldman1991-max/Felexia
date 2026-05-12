import { Badge } from "@/components/ui/badge";

export const ACCOUNTING_SOURCE_LABELS: Record<string, string> = {
  customer_invoice: "Facture client",
  supplier_invoice: "Facture fournisseur",
  customer_payment: "Paiement client",
  supplier_payment: "Paiement fournisseur",
  credit_note: "Avoir client",
  manual: "Manuel",
};

export function AccountingSourceBadge({ source, number }: { source?: string | null; number?: string | null }) {
  const label = source ? ACCOUNTING_SOURCE_LABELS[source] ?? source : "Manuel";
  return (
    <div className="space-y-1">
      <Badge tone="neutral">{label}</Badge>
      {number ? <p className="text-xs text-[var(--muted)]">{number}</p> : null}
    </div>
  );
}
