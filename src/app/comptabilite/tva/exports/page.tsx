import { ModulePage } from "@/components/erp/module-page";
import { PageHeader } from "@/components/erp/page-header";
import { TvaExportsPage } from "@/components/comptabilite/tva/tva-exports-page";
import { createClient } from "@/lib/supabase/server";
import { requireActiveWorkspace } from "@/lib/auth";
import { getDgiVatExportData } from "@/lib/tax/dgi-vat-query";
import { validateDgiVatExport } from "@/lib/tax/dgi-vat-validation";
import type { DgiVatExportData, DgiVatExportHistoryRow, DgiVatValidationIssue, VatFrequency } from "@/lib/tax/dgi-vat-types";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  from?: string;
  to?: string;
  frequency?: string;
  generation?: string;
  batch?: string;
}>;

function currentMonthRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return {
    from: start.toISOString().slice(0, 10),
    to: end.toISOString().slice(0, 10),
  };
}

function validDate(value: string | undefined, fallback: string) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return fallback;
  return value;
}

function withIssues(data: DgiVatExportData, issues: DgiVatValidationIssue[]): DgiVatExportData {
  return {
    ...data,
    validationIssues: issues,
    summary: {
      ...data.summary,
      blockingErrorsCount: issues.filter((issue) => issue.severity === "blocking").length,
      warningsCount: issues.filter((issue) => issue.severity === "warning").length,
    },
  };
}

async function getHistory(organizationId: string): Promise<DgiVatExportHistoryRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("tax_export_batches")
    .select("id, export_number, export_type, period_start, period_end, frequency, status, schema_version, xml_path, csv_path, xlsx_path, manifest_path, validation_report_path, totals, warnings, validation_errors, download_count, downloaded_at, generated_at, created_at")
    .eq("organization_id", organizationId)
    .eq("export_type", "dgi_vat_xml_prep")
    .order("created_at", { ascending: false })
    .limit(25);

  return (data ?? []) as DgiVatExportHistoryRow[];
}

export default async function VatDgiExportsPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const workspace = await requireActiveWorkspace();
  const month = currentMonthRange();
  const periodStart = validDate(params.from, month.from);
  const periodEnd = validDate(params.to, month.to);
  const frequency = (params.frequency === "quarterly" ? "quarterly" : "monthly") as VatFrequency;

  const rawData = await getDgiVatExportData({
    organizationId: workspace.organization.id,
    periodStart,
    periodEnd,
    frequency,
    generatedBy: workspace.userId,
  });
  const data = withIssues(rawData, validateDgiVatExport(rawData));
  const history = await getHistory(workspace.organization.id);

  return (
    <ModulePage>
      <PageHeader
        title="Exports TVA DGI"
        description="Préparez vos exports TVA, contrôlez les anomalies et générez un XML préparatoire structuré."
      />
      <TvaExportsPage
        data={data}
        history={history}
        periodStart={periodStart}
        periodEnd={periodEnd}
        frequency={frequency}
        generation={params.generation}
        batch={params.batch}
      />
    </ModulePage>
  );
}
