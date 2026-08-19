"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState } from "react";
import { CheckCircle2, Pencil, Trash2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatMoney, formatDate } from "@/lib/format";
import {
  archiveTreasuryForecastItem,
  setTreasuryForecastItemStatus,
} from "@/lib/treasury-forecast-actions";
import type { TreasuryActionResult } from "@/lib/treasury-types";
import type { TreasuryForecastItem } from "@/lib/treasury/treasury-forecast";

const STATUS_LABELS: Record<string, string> = {
  planned: "Planifiee",
  confirmed: "Confirmee",
  realized: "Realisee",
  cancelled: "Annulee",
  ignored: "Ignoree",
};

const STATUS_TONES: Record<string, "neutral" | "info" | "success" | "warning" | "danger"> = {
  planned: "neutral",
  confirmed: "info",
  realized: "success",
  cancelled: "danger",
  ignored: "warning",
};

export function TreasuryForecastManualItem({
  item,
}: {
  item: TreasuryForecastItem;
}) {
  const router = useRouter();
  const [, setStatusAction, pendingStatus] = useActionState(
    async (prev: TreasuryActionResult, formData: FormData) => {
      const result = await setTreasuryForecastItemStatus(prev, formData);
      if (result.success) router.refresh();
      return result;
    },
    { success: true },
  );
  const [, archiveAction, pendingArchive] = useActionState(
    async (prev: TreasuryActionResult, formData: FormData) => {
      const result = await archiveTreasuryForecastItem(prev, formData);
      if (result.success) router.refresh();
      return result;
    },
    { success: true },
  );

  const isDone = item.status === "realized" || item.status === "cancelled" || item.status === "ignored";

  return (
    <tr>
      <td className="p-3 text-sm text-[var(--muted)]">{formatDate(item.dueDate)}</td>
      <td className="p-3">
        <Badge tone={item.direction === "inflow" ? "success" : "danger"}>
          {item.direction === "inflow" ? "Entree" : "Sortie"}
        </Badge>
      </td>
      <td className="max-w-[260px] p-3">
        <Link href={`/tresorerie/previsions/${item.sourceId}/edit`} className="block truncate font-medium text-[var(--foreground)] hover:text-[var(--primary)] hover:underline">
          {item.label}
        </Link>
        {item.category ? <span className="block truncate text-xs text-[var(--muted)]">{item.category}</span> : null}
      </td>
      <td className="p-3 text-sm">{formatMoney(item.amount)}</td>
      <td className="p-3 text-sm text-[var(--muted)]">{Math.round(item.probability)} %</td>
      <td className="p-3 text-sm font-medium">{formatMoney(item.weightedAmount)}</td>
      <td className="p-3"><Badge tone={STATUS_TONES[item.status] ?? "neutral"}>{STATUS_LABELS[item.status] ?? item.status}</Badge></td>
      <td className="p-3">
        <div className="flex flex-wrap gap-1">
          <Button type="button" variant="ghost" className="h-8 px-2" title="Modifier" asChild><Link href={`/tresorerie/previsions/${item.sourceId}/edit`}><Pencil className="h-4 w-4" /></Link></Button>
          {!isDone ? (
            <form action={setStatusAction}>
              <input type="hidden" name="id" value={item.sourceId ?? ""} />
              <input type="hidden" name="status" value="realized" />
              <Button type="submit" variant="ghost" className="h-8 px-2" title="Marquer realisee" disabled={pendingStatus}>
                <CheckCircle2 className="h-4 w-4 text-[var(--success)]" />
              </Button>
            </form>
          ) : null}
          {!isDone ? (
            <form action={setStatusAction}>
              <input type="hidden" name="id" value={item.sourceId ?? ""} />
              <input type="hidden" name="status" value="cancelled" />
              <Button type="submit" variant="ghost" className="h-8 px-2" title="Annuler" disabled={pendingStatus}>
                <XCircle className="h-4 w-4 text-[var(--muted)]" />
              </Button>
            </form>
          ) : null}
          <form action={archiveAction}>
            <input type="hidden" name="id" value={item.sourceId ?? ""} />
            <Button type="submit" variant="ghost" className="h-8 px-2" title="Archiver" disabled={pendingArchive}>
              <Trash2 className="h-4 w-4 text-[var(--danger)]" />
            </Button>
          </form>
        </div>
      </td>
    </tr>
  );
}
