import Link from "next/link";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/erp/page-header";
import { MoneyDisplay } from "@/components/erp/money-display";
import { StatusBadge } from "@/components/erp/status-badge";
import { Table, Td, Th } from "@/components/ui/table";
import { HrPreparatoryNotice } from "@/components/hr/hr-notice";

type Row = Record<string, string | number | boolean | null>;

export function HrSectionPage({
  title,
  description,
  rows,
  columns,
  newHref,
  notice = false,
}: {
  title: string;
  description: string;
  rows: Row[];
  columns: Array<{ key: string; label: string; money?: boolean; status?: boolean }>;
  newHref?: string;
  notice?: boolean;
}) {
  return (
    <div className="space-y-6">
      <PageHeader
        title={title}
        description={description}
        actions={newHref ? (
          <Link href={newHref} className="inline-flex h-10 items-center rounded-[var(--radius-md)] bg-gradient-to-r from-[#D6B56D] to-[#B8924F] px-4 text-sm font-medium text-[#08090d]">
            <Plus className="mr-2 h-4 w-4" />
            Nouveau
          </Link>
        ) : null}
      />
      {notice ? <HrPreparatoryNotice /> : null}
      <div className="premium-card p-5">
        {rows.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-8 text-center">
            <p className="text-lg font-medium">Aucune donnée RH pour le moment.</p>
            <p className="mt-2 text-sm text-[var(--muted)]">Le module est prêt à recevoir vos informations.</p>
          </div>
        ) : (
          <Table>
            <thead>
              <tr>{columns.map((column) => <Th key={column.key}>{column.label}</Th>)}</tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={String(row.id)}>
                  {columns.map((column) => (
                    <Td key={column.key}>
                      {column.money ? (
                        <MoneyDisplay value={Number(row[column.key] ?? 0)} />
                      ) : column.status ? (
                        <StatusBadge status={String(row[column.key] ?? "draft")} />
                      ) : (
                        String(row[column.key] ?? "-")
                      )}
                    </Td>
                  ))}
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </div>
    </div>
  );
}
