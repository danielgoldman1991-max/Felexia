import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function AccountingReportFilters({
  dateFrom,
  dateTo,
  accountCode,
  thirdParty,
  accounts = [],
}: {
  dateFrom?: string;
  dateTo?: string;
  accountCode?: string;
  thirdParty?: string;
  accounts?: { code: string; name: string }[];
}) {
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
      <label className="grid min-w-48 gap-1.5 text-sm font-medium">
        Compte
        <select name="account" defaultValue={accountCode ?? ""} className="h-10 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--card)] px-3">
          <option value="">Tous les comptes</option>
          {accounts.map((account) => <option key={account.code} value={account.code}>{account.code} · {account.name}</option>)}
        </select>
      </label>
      <label className="grid min-w-48 gap-1.5 text-sm font-medium">
        Tiers
        <Input name="tiers" defaultValue={thirdParty} placeholder="Nom du client ou fournisseur" />
      </label>
      <Button type="submit" variant="secondary">Appliquer</Button>
    </form>
  );
}
