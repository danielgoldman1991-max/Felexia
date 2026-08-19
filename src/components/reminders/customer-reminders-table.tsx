import Link from "next/link";
import { Eye, Printer } from "lucide-react";
import { EmptyState } from "@/components/erp/empty-state";
import { MoneyDisplay } from "@/components/erp/money-display";
import { Button } from "@/components/ui/button";
import { Table, Td, Th } from "@/components/ui/table";
import { ReminderStatusBadge } from "@/components/reminders/reminder-status-badge";
import { formatDate } from "@/lib/format";
import { REMINDER_CHANNEL_LABELS, type CustomerReminderRecord } from "@/lib/reminder-types";

export function CustomerRemindersTable({ rows }: { rows: CustomerReminderRecord[] }) {
  if (rows.length === 0) return <EmptyState title="Aucune relance" description="Les relances clients creees apparaitront ici." />;

  return (
    <Table>
      <thead>
        <tr><Th>Numero</Th><Th>Client</Th><Th>Date</Th><Th>Niveau</Th><Th>Statut</Th><Th>Montant du</Th><Th>En retard</Th><Th>Canal</Th><Th>Actions</Th></tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.id}>
            <Td><Link className="font-medium text-indigo-700 hover:underline" href={`/facturation/relances/${row.id}`}>{row.reminder_number}</Link></Td>
            <Td>{row.customer_name ?? "-"}</Td>
            <Td>{formatDate(row.reminder_date)}</Td>
            <Td>Niveau {row.reminder_level}</Td>
            <Td><ReminderStatusBadge status={row.status} /></Td>
            <Td><MoneyDisplay value={row.total_due_amount} /></Td>
            <Td><MoneyDisplay value={row.total_overdue_amount} /></Td>
            <Td>{row.channel ? REMINDER_CHANNEL_LABELS[row.channel] : "-"}</Td>
            <Td>
              <div className="flex gap-1">
                <Button type="button" variant="ghost" className="h-9 w-9 px-0" title="Voir" asChild><Link href={`/facturation/relances/${row.id}`}><Eye className="h-4 w-4" /></Link></Button>
                <Button type="button" variant="ghost" className="h-9 w-9 px-0" title="Imprimer" asChild><Link href={`/facturation/relances/${row.id}/print`} target="_blank"><Printer className="h-4 w-4" /></Link></Button>
              </div>
            </Td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}
