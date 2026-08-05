import { notFound } from "next/navigation";
import { ModulePage } from "@/components/erp/module-page";
import { PageHeader } from "@/components/erp/page-header";
import { TreasuryForecastForm } from "@/components/treasury/treasury-forecast-form";
import { listActiveTreasuryAccounts } from "@/lib/treasury";
import { createClient } from "@/lib/supabase/server";
import { requireActiveWorkspace } from "@/lib/auth";
import { updateTreasuryForecastItem } from "@/lib/treasury-forecast-actions";

export const dynamic = "force-dynamic";

export default async function EditTreasuryForecastPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const workspace = await requireActiveWorkspace();
  const supabase = await createClient();
  const [accounts, itemResult] = await Promise.all([
    listActiveTreasuryAccounts(),
    supabase
      .from("treasury_forecast_items")
      .select("id, direction, label, forecast_date, amount, probability, status, category, treasury_account_id, notes")
      .eq("organization_id", workspace.organization.id)
      .eq("id", id)
      .is("archived_at", null)
      .maybeSingle(),
  ]);
  if (itemResult.error) throw new Error(itemResult.error.message);
  const row = itemResult.data;
  if (!row) notFound();

  const item = {
    id: row.id as string,
    direction: row.direction as "inflow" | "outflow",
    label: row.label as string,
    forecast_date: (row.forecast_date as string).slice(0, 10),
    amount: Number(row.amount ?? 0),
    probability: Number(row.probability ?? 100),
    status: row.status as string,
    category: (row.category as string | null) ?? undefined,
    treasury_account_id: (row.treasury_account_id as string | null) ?? undefined,
    notes: (row.notes as string | null) ?? undefined,
  };

  return (
    <ModulePage>
      <PageHeader
        title="Modifier la prevision"
        description="Ajustez le flux prevu, sa probabilite ou son statut."
      />
      <TreasuryForecastForm accounts={accounts} item={item} action={updateTreasuryForecastItem} />
    </ModulePage>
  );
}
