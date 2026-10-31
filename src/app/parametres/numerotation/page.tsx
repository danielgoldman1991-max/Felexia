import { PageHeader } from "@/components/erp/page-header";
import { NumberingSettings } from "@/components/settings/numbering-settings";
import { getNumberingSettings } from "@/lib/numbering";
import { correctNumberingCounterAction } from "@/lib/actions/numbering";

export const dynamic = "force-dynamic";

export default async function NumberingSettingsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const period = Array.isArray(params.period) ? params.period[0] : params.period;
  const data = await getNumberingSettings(period);
  return <div>
    <PageHeader title="Numérotation" description="Consultez et corrigez les prochains numéros de vos documents." />
    <NumberingSettings data={data} saveAction={correctNumberingCounterAction} />
  </div>;
}
