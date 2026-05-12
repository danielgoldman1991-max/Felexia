import Link from "next/link";
import { cn } from "@/lib/utils";
import type { CustomerInvoiceAccountingStatus } from "@/lib/invoice-types";

const labels: Record<CustomerInvoiceAccountingStatus, string> = {
  posted: "Comptabilisee",
  not_posted: "Non comptabilisee",
  pending_validation: "A valider d'abord",
  not_applicable: "Non applicable",
};

const styles: Record<CustomerInvoiceAccountingStatus, string> = {
  posted: "border-emerald-200 bg-emerald-50 text-emerald-700",
  not_posted: "border-amber-200 bg-amber-50 text-amber-700",
  pending_validation: "border-slate-200 bg-slate-50 text-slate-600",
  not_applicable: "border-slate-200 bg-slate-100 text-slate-500",
};

export function AccountingStatusBadge({
  status = "not_posted",
  entryId,
  entryNumber,
}: {
  status?: CustomerInvoiceAccountingStatus;
  entryId?: string | null;
  entryNumber?: string | null;
}) {
  const content = (
    <span className={cn("inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold", styles[status])}>
      {labels[status]}
    </span>
  );

  if (status !== "posted" || !entryId) {
    return (
      <div className="space-y-1">
        {content}
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <Link href={`/comptabilite/ecritures/${entryId}`} className="inline-flex">
        {content}
      </Link>
      {entryNumber ? (
        <Link href={`/comptabilite/ecritures/${entryId}`} className="block text-xs font-medium text-indigo-700 hover:text-indigo-900 hover:underline">
          {entryNumber}
        </Link>
      ) : null}
    </div>
  );
}
