import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function AccountingReportFilters({ dateFrom, dateTo }: { dateFrom?: string; dateTo?: string }) {
  return (
    <form className="flex flex-wrap items-end gap-3 rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--card)] p-4" method="get">
      <label className="grid gap-1.5 text-sm font-medium">
        Du
        <Input type="date" name="date_from" defaultValue={dateFrom} />
      </label>
      <label className="grid gap-1.5 text-sm font-medium">
        Au
        <Input type="date" name="date_to" defaultValue={dateTo} />
      </label>
      <Button type="submit" variant="secondary">Appliquer</Button>
    </form>
  );
}
