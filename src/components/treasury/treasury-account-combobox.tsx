import { Select } from "@/components/ui/select";
import type { TreasuryAccountRecord } from "@/lib/treasury-types";

export function TreasuryAccountCombobox({ accounts, name = "treasury_account_id", defaultValue }: { accounts: TreasuryAccountRecord[]; name?: string; defaultValue?: string }) {
  return (
    <Select name={name} defaultValue={defaultValue ?? accounts[0]?.id ?? ""}>
      <option value="">Selectionner un compte</option>
      {accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}
    </Select>
  );
}
