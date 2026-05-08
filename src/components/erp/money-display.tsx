import { formatMoney } from "@/lib/format";

export function MoneyDisplay({ value }: { value: number | null | undefined }) {
  return <span className="font-mono tabular-nums">{formatMoney(value)}</span>;
}
