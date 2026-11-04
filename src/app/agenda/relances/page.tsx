import { AgendaBoard } from "@/components/agenda/agenda-board";

export const dynamic = "force-dynamic";

export default function AgendaRemindersPage() {
  return <AgendaBoard filter="overdue" />;
}
