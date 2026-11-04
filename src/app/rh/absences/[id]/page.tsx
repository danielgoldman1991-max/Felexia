import { HrRecordDetail } from "@/components/hr/hr-record-detail";

export const dynamic = "force-dynamic";

export default async function AbsenceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <HrRecordDetail
      id={id}
      table="hr_absences"
      kind="absence"
      title="Absence"
      backHref="/rh/absences"
      statuses={["draft", "validated", "cancelled"]}
      fields={[{ key: "absence_date", label: "Date" }, { key: "absence_type", label: "Type" }, { key: "justified", label: "Justifiée" }, { key: "reason", label: "Motif" }]}
    />
  );
}
