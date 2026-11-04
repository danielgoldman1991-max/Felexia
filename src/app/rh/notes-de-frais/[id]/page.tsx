import { HrRecordDetail } from "@/components/hr/hr-record-detail";

export const dynamic = "force-dynamic";

export default async function ExpenseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <HrRecordDetail id={id} table="hr_expense_reports" kind="expense" title="Note de frais" backHref="/rh/notes-de-frais" statuses={["submitted", "approved", "rejected", "paid"]} fields={[{ key: "expense_number", label: "Numéro" }, { key: "expense_date", label: "Date" }, { key: "category", label: "Catégorie" }, { key: "amount_ht", label: "HT" }, { key: "tax_amount", label: "TVA" }, { key: "amount_ttc", label: "TTC" }, { key: "notes", label: "Note" }]} />;
}
