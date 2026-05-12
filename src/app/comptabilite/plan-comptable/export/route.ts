import { listChartOfAccounts } from "@/lib/accounting";
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
    pageSize: 5000,
  };

  const result = await listChartOfAccounts(filters);

  const header = "Numero;Intitule;Classe;Type;Parent;Auxiliaire;Statut";
  const rows = result.rows.map((a) => {
    const cls = ACCOUNT_CLASS_LABELS[a.class_number] ?? a.class_number;
    const typ = ACCOUNT_TYPE_LABELS[a.type] ?? a.type ?? "";
    const parent = a.parent_code ?? "";
    const aux = a.is_auxiliary ? "Oui" : "Non";
    const statut = a.is_active ? "Actif" : "Inactif";
    return `${a.code};${a.name};${cls};${typ};${parent};${aux};${statut}`;
  });

  const csv = `\uFEFF${header}\n${rows.join("\n")}`;

  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="plan-comptable-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}