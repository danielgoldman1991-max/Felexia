import type { SupabaseClient } from "@supabase/supabase-js";

export type AgendaItem = {
  id: string;
  date: string;
  kind: "client" | "fournisseur" | "contrat" | "conge";
  title: string;
  detail: string;
  href: string;
  overdue: boolean;
};

const OPEN_CUSTOMER = ["validated", "sent", "partially_paid", "overdue"];
const OPEN_SUPPLIER = ["validated", "partially_paid"];

export async function listAgendaItems(supabase: SupabaseClient, organizationId: string, includeHr: boolean): Promise<AgendaItem[]> {
  const today = new Date().toISOString().slice(0, 10);
  const horizon = new Date(Date.now() + 45 * 86400000).toISOString().slice(0, 10);
  const [customers, suppliers] = await Promise.all([
    supabase.from("customer_invoices").select("id, invoice_number, due_date, remaining_amount, status").eq("organization_id", organizationId).is("archived_at", null).in("status", OPEN_CUSTOMER).gt("remaining_amount", 0).not("due_date", "is", null).order("due_date").limit(80),
    supabase.from("supplier_invoices").select("id, invoice_number, due_date, remaining_amount, status").eq("organization_id", organizationId).is("archived_at", null).in("status", OPEN_SUPPLIER).gt("remaining_amount", 0).not("due_date", "is", null).order("due_date").limit(80),
  ]);
  const items: AgendaItem[] = [];
  for (const row of customers.data ?? []) {
    items.push({
      id: `c-${row.id}`,
      date: String(row.due_date),
      kind: "client",
      title: `Facture client ${row.invoice_number}`,
      detail: `${Number(row.remaining_amount).toFixed(2)} MAD restants`,
      href: `/facturation/factures/${row.id}`,
      overdue: String(row.due_date) < today,
    });
  }
  for (const row of suppliers.data ?? []) {
    items.push({
      id: `s-${row.id}`,
      date: String(row.due_date),
      kind: "fournisseur",
      title: `Facture fournisseur ${row.invoice_number}`,
      detail: `${Number(row.remaining_amount).toFixed(2)} MAD restants`,
      href: `/achats/factures/${row.id}`,
      overdue: String(row.due_date) < today,
    });
  }
  if (includeHr) {
    const [contracts, leaves] = await Promise.all([
      supabase.from("hr_contracts").select("id, contract_number, end_date").eq("organization_id", organizationId).eq("status", "active").not("end_date", "is", null).lte("end_date", horizon).order("end_date").limit(40),
      supabase.from("hr_leave_requests").select("id, start_date, end_date, days_count, status").eq("organization_id", organizationId).in("status", ["pending", "approved"]).gte("end_date", today).order("start_date").limit(40),
    ]);
    for (const row of contracts.data ?? []) {
      items.push({ id: `k-${row.id}`, date: String(row.end_date), kind: "contrat", title: `Fin de contrat ${row.contract_number}`, detail: "Contrat actif arrivant à échéance", href: `/rh/contrats/${row.id}`, overdue: String(row.end_date) < today });
    }
    for (const row of leaves.data ?? []) {
      items.push({ id: `l-${row.id}`, date: String(row.start_date), kind: "conge", title: row.status === "pending" ? "Congé à valider" : "Congé accepté", detail: `${row.days_count} jour(s)`, href: `/rh/conges/${row.id}`, overdue: false });
    }
  }
  return items.sort((a, b) => a.date.localeCompare(b.date));
}
