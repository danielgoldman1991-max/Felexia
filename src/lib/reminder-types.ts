export type CustomerReminderStatus = "draft" | "sent" | "cancelled";
export type CustomerReminderChannel = "email" | "phone" | "whatsapp" | "letter" | "in_person" | "other";

export type CustomerReminderRecord = {
  id: string;
  organization_id: string;
  reminder_number: string;
  customer_id: string;
  customer_name?: string | null;
  reminder_level: number;
  status: CustomerReminderStatus;
  channel: CustomerReminderChannel | null;
  reminder_date: string;
  due_date: string | null;
  total_due_amount: number;
  total_overdue_amount: number;
  subject: string | null;
  message: string | null;
  internal_notes: string | null;
  sent_at: string | null;
  cancelled_at: string | null;
  created_at: string;
  archived_at: string | null;
};

export type CustomerReminderInvoiceRecord = {
  id: string;
  reminder_id: string;
  invoice_id: string;
  invoice_number: string | null;
  invoice_date: string | null;
  due_date: string | null;
  total_ttc: number;
  paid_amount: number;
  remaining_amount: number;
  days_overdue: number | null;
};

export type CustomerReminderDetail = {
  reminder: CustomerReminderRecord | null;
  invoices: CustomerReminderInvoiceRecord[];
};

export type ReminderCustomerOption = {
  id: string;
  name: string;
  commercial_name?: string | null;
  total_remaining_amount: number;
  overdue_invoices_count: number;
};

export type OverdueInvoiceForReminder = {
  id: string;
  invoice_number: string;
  customer_id: string;
  invoice_date: string;
  due_date: string | null;
  total_ttc: number;
  paid_amount: number;
  remaining_amount: number;
  payment_status: string;
  status: string;
  days_overdue: number;
};

export type ReminderCounters = {
  overdueInvoices: number;
  overdueAmount: number;
  draft: number;
  sent: number;
};

export type ReminderActionResult = {
  success: boolean;
  error?: string;
  data?: unknown;
};

export const REMINDER_STATUS_LABELS: Record<string, string> = {
  draft: "Brouillon",
  sent: "Envoyee",
  cancelled: "Annulee",
};

export const REMINDER_CHANNEL_LABELS: Record<string, string> = {
  email: "Email",
  phone: "Telephone",
  whatsapp: "WhatsApp",
  letter: "Courrier",
  in_person: "En personne",
  other: "Autre",
};
