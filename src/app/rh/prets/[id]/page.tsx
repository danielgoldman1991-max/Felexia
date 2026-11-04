import { HrRecordDetail } from "@/components/hr/hr-record-detail";

export const dynamic = "force-dynamic";

export default async function LoanDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <HrRecordDetail id={id} table="hr_loans" kind="loan" title="Prêt salarié" backHref="/rh/prets" statuses={["active", "suspended", "closed", "cancelled"]} fields={[{ key: "loan_number", label: "Numéro" }, { key: "amount", label: "Montant MAD" }, { key: "monthly_deduction", label: "Retenue mensuelle" }, { key: "remaining_amount", label: "Reste dû" }, { key: "notes", label: "Note" }]} />;
}
