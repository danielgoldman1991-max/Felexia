import { requireActiveWorkspace } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getTreasuryForecast, type TreasuryForecastScenario } from "@/lib/treasury/treasury-forecast";

export const dynamic = "force-dynamic";

function csvCell(value: unknown) {
  const text = value === null || value === undefined ? "" : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

function sourceLabel(sourceType: string) {
  if (sourceType === "customer_invoice") return "Facture client";
  if (sourceType === "supplier_invoice") return "Facture fournisseur";
  if (sourceType === "scheduled_payment") return "Paiement programme";
  return "Prevision manuelle";
}

export async function GET(request: Request) {
  const workspace = await requireActiveWorkspace();
  const { searchParams } = new URL(request.url);

  const from = searchParams.get("from") ?? "";
  const to = searchParams.get("to") ?? "";
  const scenario = (searchParams.get("scenario") ?? "realistic") as TreasuryForecastScenario;
  const includeOverdue = searchParams.get("overdue") !== "0";
  const accountId = searchParams.get("account") || null;
  const direction = (searchParams.get("type") ?? "all") as "inflow" | "outflow" | "all";

  const supabase = await createClient();
  const forecast = await getTreasuryForecast(supabase, workspace.organization.id, {
    from,
    to,
    scenario,
    includeOverdue,
    treasuryAccountId: accountId,
    direction,
  });

  const rows = [...forecast.inflows, ...forecast.outflows].sort((a, b) => a.dueDate.localeCompare(b.dueDate));

  const balanceByDate = new Map(forecast.daily.map((day) => [day.date, day.closingBalance]));

  const header = [
    "Date",
    "Direction",
    "Source",
    "Tiers",
    "Document",
    "Libelle",
    "Montant",
    "Probabilite (%)",
    "Montant pondere",
    "Statut",
    "Solde previsionnel",
  ];

  const csvRows = rows.map((item) => {
    const balance = balanceByDate.get(item.dueDate < from ? from : item.dueDate);
    return [
      item.dueDate,
      item.direction === "inflow" ? "Entree" : "Sortie",
      sourceLabel(item.sourceType),
      item.thirdPartyName ?? "",
      item.documentNumber ?? "",
      item.label,
      item.remainingAmount.toFixed(2),
      Math.round(item.probability),
      item.weightedAmount.toFixed(2),
      item.status,
      balance === undefined ? "" : balance.toFixed(2),
    ];
  });

  const csv = [header, ...csvRows].map((row) => row.map(csvCell).join(",")).join("\n");
  const filename = `previsions-tresorerie-${new Date().toISOString().slice(0, 10)}.csv`;

  return new Response(`\uFEFF${csv}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
