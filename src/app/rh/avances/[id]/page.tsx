import { HrRecordDetail } from "@/components/hr/hr-record-detail";

export const dynamic = "force-dynamic";

export default async function AdvanceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <HrRecordDetail id={id} table="hr_advances" kind="advance" title="Avance sur salaire" backHref="/rh/avances" statuses={["draft", "approved", "paid", "cancelled"]} fields={[{ key: "advance_number", label: "Numéro" }, { key: "request_date", label: "Date" }, { key: "amount", label: "Montant MAD" }, { key: "notes", label: "Note" }]} />;
}
