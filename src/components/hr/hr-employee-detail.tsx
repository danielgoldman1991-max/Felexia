import Link from "next/link";
import { BriefcaseBusiness, CalendarDays, FileText, Pencil, WalletCards } from "lucide-react";
import { PageHeader } from "@/components/erp/page-header";
import { MoneyDisplay } from "@/components/erp/money-display";
import { StatusBadge } from "@/components/erp/status-badge";
import { Table, Td, Th } from "@/components/ui/table";

type Detail = {
  employee: DetailRecord;
  contracts: DetailRecord[];
  leaves: DetailRecord[];
  absences: DetailRecord[];
  advances: DetailRecord[];
  loans: DetailRecord[];
  documents: DetailRecord[];
  evaluations: DetailRecord[];
  discipline: DetailRecord[];
};

type DetailRecord = Record<string, unknown>;

export function HrEmployeeDetail({ detail }: { detail: Detail }) {
  const employee = detail.employee;
  return (
    <div className="space-y-6">
      <PageHeader
        title={getString(employee, "full_name")}
        description={`Matricule ${getString(employee, "employee_number")} · ${getNestedString(employee, "position", "title", "Poste à affecter")} · ${getNestedString(employee, "department", "name", "Département à affecter")}`}
        actions={
          <Link href={`/rh/employes/${getString(employee, "id")}/edit`} className="inline-flex h-10 items-center rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--card)] px-4 text-sm font-medium text-[var(--foreground)] transition hover:bg-[var(--surface-soft)]">
            <Pencil className="mr-2 h-4 w-4" />
            Modifier
          </Link>
        }
      />

      <div className="grid gap-4 md:grid-cols-4">
        <InfoCard title="Statut" value={<StatusBadge status={getString(employee, "employment_status")} />} icon={<BriefcaseBusiness className="h-4 w-4" />} />
        <InfoCard title="Salaire de base" value={<MoneyDisplay value={getNumber(employee, "base_salary")} />} icon={<WalletCards className="h-4 w-4" />} />
        <InfoCard title="CNSS" value={getString(employee, "cnss_number", "À compléter")} icon={<FileText className="h-4 w-4" />} />
        <InfoCard title="Date embauche" value={getString(employee, "hire_date", "À compléter")} icon={<CalendarDays className="h-4 w-4" />} />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <MiniTable title="Contrats" rows={detail.contracts} columns={["contract_number", "contract_type", "status"]} />
        <MiniTable title="Congés" rows={detail.leaves} columns={["start_date", "end_date", "status"]} />
        <MiniTable title="Absences" rows={detail.absences} columns={["absence_date", "absence_type", "status"]} />
        <MiniTable title="Avances" rows={detail.advances} columns={["advance_number", "amount", "status"]} moneyColumn="amount" />
        <MiniTable title="Prêts" rows={detail.loans} columns={["loan_number", "remaining_amount", "status"]} moneyColumn="remaining_amount" />
        <MiniTable title="Documents RH" rows={detail.documents} columns={["document_type", "title", "status"]} />
        <MiniTable title="Évaluations" rows={detail.evaluations} columns={["evaluation_date", "score", "status"]} />
        <MiniTable title="Discipline" rows={detail.discipline} columns={["action_date", "action_type", "status"]} />
      </div>
    </div>
  );
}

function InfoCard({ title, value, icon }: { title: string; value: React.ReactNode; icon: React.ReactNode }) {
  return (
    <div className="premium-card p-4">
      <div className="flex items-center justify-between text-[var(--muted)]">
        <span className="section-title">{title}</span>
        {icon}
      </div>
      <div className="mt-3 text-lg font-semibold">{value}</div>
    </div>
  );
}

function MiniTable({ title, rows, columns, moneyColumn }: { title: string; rows: DetailRecord[]; columns: string[]; moneyColumn?: string }) {
  return (
    <div className="premium-card p-5">
      <h2 className="mb-4 text-lg font-semibold">{title}</h2>
      {rows.length === 0 ? (
        <p className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-soft)] p-4 text-sm text-[var(--muted)]">Aucune donnée enregistrée.</p>
      ) : (
        <Table>
          <thead>
            <tr>{columns.map((column) => <Th key={column}>{column.replaceAll("_", " ")}</Th>)}</tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={getString(row, "id")}>
                {columns.map((column) => (
                  <Td key={column}>
                    {column === moneyColumn ? <MoneyDisplay value={getNumber(row, column)} /> : getString(row, column, "-")}
                  </Td>
                ))}
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </div>
  );
}

function getString(record: DetailRecord, key: string, fallback = ""): string {
  const value = record[key];
  if (value === null || value === undefined || value === "") return fallback;
  return String(value);
}

function getNumber(record: DetailRecord, key: string): number {
  const value = Number(record[key] ?? 0);
  return Number.isFinite(value) ? value : 0;
}

function getNestedString(record: DetailRecord, relationKey: string, key: string, fallback: string): string {
  const relation = record[relationKey];
  const value = Array.isArray(relation)
    ? (relation[0] as DetailRecord | undefined)?.[key]
    : typeof relation === "object" && relation !== null
      ? (relation as DetailRecord)[key]
      : null;
  return value ? String(value) : fallback;
}
