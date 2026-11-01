import { listChartOfAccountExportRows } from "@/lib/accounting";
import { csvResponse } from "@/lib/listing";
import type { ChartOfAccountFilters } from "@/lib/accounting-types";
import { ACCOUNT_CLASS_LABELS, ACCOUNT_TYPE_LABELS } from "@/lib/accounting-types";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const filters: ChartOfAccountFilters = {
    q: searchParams.get("q") || undefined,
    account_class: searchParams.get("account_class") || undefined,
    account_type: searchParams.get("account_type") || undefined,
    is_auxiliary: searchParams.get("is_auxiliary") ? searchParams.get("is_auxiliary") === "1" : undefined,
    is_active: searchParams.get("is_active") || undefined,
  };

  const rows = await listChartOfAccountExportRows(filters);
  return csvResponse(`plan-comptable-${new Date().toISOString().slice(0, 10)}`,
    ["Numéro", "Intitulé", "Classe", "Type", "Parent", "Auxiliaire", "Statut"],
    rows.map(account => [account.code, account.name, ACCOUNT_CLASS_LABELS[account.class_number] ?? account.class_number,
      ACCOUNT_TYPE_LABELS[account.type] ?? account.type ?? "", account.parent_code ?? "",
      account.is_auxiliary ? "Oui" : "Non", account.is_active ? "Actif" : "Inactif"]));
}
