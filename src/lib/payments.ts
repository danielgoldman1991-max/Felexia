import { requireActiveWorkspace } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { InvoiceCustomerOption } from "@/lib/invoice-types";
import type {
  CustomerOutstandingBalance,
  CustomerOpenItems,
  CustomerPaymentAllocationRecord,
  CustomerPaymentDetail,
  CustomerPaymentRecord,
  OpenInvoiceForAllocation,
  OpenInvoiceForPayment,
  PaymentCounters,
  PaymentListFilters,
} from "@/lib/payment-types";

const PAYMENT_SELECT = `
  id, organization_id, payment_number, third_party_id, customer_id, payment_date, value_date,
  amount, allocated_amount, available_amount, currency, payment_method,
  reference, bank_name, check_number, transfer_reference, due_date,
  status, payment_type, source_type, source_invoice_id, notes, internal_notes,
  confirmed_at, cancelled_at, created_by, created_at, updated_at, archived_at,
  customer:third_party_id(name),
  source_invoice:source_invoice_id(invoice_number)
`;

const ALLOCATION_SELECT = `
  id, organization_id, payment_id, invoice_id, third_party_id, customer_id, allocation_date,
  amount, notes, created_by, created_at, cancelled_at,
  invoice:invoice_id(invoice_number, total_ttc)
`;

function objectValue(value: unknown) {
  if (!value || Array.isArray(value) || typeof value !== "object") return null;
  return value as Record<string, unknown>;
}

async function activeOrganizationId() {
  const workspace = await requireActiveWorkspace();
  return workspace.organization.id;
}

function mapPayment(raw: unknown): CustomerPaymentRecord {
  const row = raw as Record<string, unknown>;
  const customer = objectValue(row.customer);
  const sourceInvoice = objectValue(row.source_invoice);
  return {
    id: row.id as string,
    organization_id: row.organization_id as string,
    payment_number: row.payment_number as string,
    third_party_id: row.third_party_id as string,
    customer_name: customer?.name as string | null,
    payment_date: row.payment_date as string,
    value_date: row.value_date as string | null,
    amount: Number(row.amount ?? 0),
    allocated_amount: Number(row.allocated_amount ?? 0),
    available_amount: Number(row.available_amount ?? 0),
    currency: row.currency as string,
    payment_method: row.payment_method as string,
    reference: row.reference as string | null,
    bank_name: row.bank_name as string | null,
    check_number: row.check_number as string | null,
    transfer_reference: row.transfer_reference as string | null,
    due_date: row.due_date as string | null,
    status: row.status as CustomerPaymentRecord["status"],
    payment_type: row.payment_type as CustomerPaymentRecord["payment_type"],
    source_type: row.source_type as string | null,
    source_invoice_id: row.source_invoice_id as string | null,
    source_invoice_number: sourceInvoice?.invoice_number as string | null,
    notes: row.notes as string | null,
    internal_notes: row.internal_notes as string | null,
    confirmed_at: row.confirmed_at as string | null,
    cancelled_at: row.cancelled_at as string | null,
    created_by: row.created_by as string | null,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
    archived_at: row.archived_at as string | null,
  };
}

function mapAllocation(raw: unknown): CustomerPaymentAllocationRecord {
  const row = raw as Record<string, unknown>;
  const invoice = objectValue(row.invoice);
  return {
    id: row.id as string,
    organization_id: row.organization_id as string,
    payment_id: row.payment_id as string,
    invoice_id: row.invoice_id as string,
    third_party_id: row.third_party_id as string,
    allocation_date: row.allocation_date as string,
    amount: Number(row.amount ?? 0),
    notes: row.notes as string | null,
    created_by: row.created_by as string | null,
    created_at: row.created_at as string,
    cancelled_at: row.cancelled_at as string | null,
    invoice_number: invoice?.invoice_number as string | null,
    invoice_total_ttc: invoice?.total_ttc === undefined ? null : Number(invoice.total_ttc),
  };
}

export async function listPaymentCustomers(): Promise<InvoiceCustomerOption[]> {
  const organizationId = await activeOrganizationId();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("third_parties")
    .select("id, name, commercial_name, ice, email, phone, city, types, primary_type")
    .eq("organization_id", organizationId)
    .contains("types", ["customer"])
    .eq("status", "active")
    .is("archived_at", null)
    .order("name");
  if (error) throw new Error(error.message);
  return (data ?? []) as InvoiceCustomerOption[];
}

export async function listCustomerPayments(filters: PaymentListFilters = {}) {
  const organizationId = await activeOrganizationId();
  const supabase = await createClient();
  const page = filters.page ?? 1;
  const pageSize = filters.pageSize ?? 25;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  let query = supabase
    .from("customer_payments")
    .select(PAYMENT_SELECT, { count: "exact" })
    .eq("organization_id", organizationId)
    .is("archived_at", null)
    .order("payment_date", { ascending: false })
    .order("created_at", { ascending: false })
    .range(from, to);
  if (filters.customerId) query = query.eq("third_party_id", filters.customerId);
  if (filters.status && filters.status !== "all") query = query.eq("status", filters.status);
  if (filters.paymentMethod && filters.paymentMethod !== "all") query = query.eq("payment_method", filters.paymentMethod);
  if (filters.availableOnly) query = query.gt("available_amount", 0).neq("status", "cancelled");
  if (filters.query?.trim()) query = query.ilike("payment_number", `%${filters.query.trim()}%`);
  const { data, error, count } = await query;
  if (error) throw new Error(error.message);
  return { rows: (data ?? []).map(mapPayment), total: count ?? 0, page, pageSize };
}

export async function getCustomerPaymentDetail(id: string): Promise<CustomerPaymentDetail> {
  const organizationId = await activeOrganizationId();
  const supabase = await createClient();
  const [paymentResult, allocationsResult] = await Promise.all([
    supabase.from("customer_payments").select(PAYMENT_SELECT).eq("organization_id", organizationId).eq("id", id).maybeSingle(),
    supabase.from("customer_payment_allocations").select(ALLOCATION_SELECT).eq("organization_id", organizationId).eq("payment_id", id).is("cancelled_at", null).order("created_at"),
  ]);
  if (paymentResult.error) throw new Error(paymentResult.error.message);
  if (allocationsResult.error) throw new Error(allocationsResult.error.message);
  return {
    payment: paymentResult.data ? mapPayment(paymentResult.data) : null,
    allocations: (allocationsResult.data ?? []).map(mapAllocation),
  };
}

export async function listOpenInvoicesByCustomer(customerId: string): Promise<OpenInvoiceForAllocation[]> {
  if (!customerId) return [];
  const organizationId = await activeOrganizationId();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("customer_invoices")
    .select("id, invoice_number, customer_id, invoice_date, due_date, total_ttc, paid_amount, remaining_amount, payment_status, status, customer:customer_id(name)")
    .eq("organization_id", organizationId)
    .eq("customer_id", customerId)
    .is("archived_at", null)
    .gt("remaining_amount", 0)
    .in("status", ["validated", "sent", "partially_paid", "overdue"])
    .in("payment_status", ["unpaid", "partial"])
    .order("due_date", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => {
    const customer = objectValue((row as Record<string, unknown>).customer);
    return {
      id: row.id as string,
      invoice_number: row.invoice_number as string,
      customer_id: row.customer_id as string,
      customer_name: customer?.name as string | null,
      invoice_date: row.invoice_date as string,
      due_date: row.due_date as string | null,
      total_ttc: Number(row.total_ttc ?? 0),
      paid_amount: Number(row.paid_amount ?? 0),
      remaining_amount: Number(row.remaining_amount ?? 0),
      payment_status: row.payment_status as string,
      status: row.status as string,
    };
  });
}

export async function getCustomerOpenItems(thirdPartyId: string): Promise<CustomerOpenItems> {
  if (!thirdPartyId) {
    return {
      customer: null,
      invoices: [],
      credits: [],
      summary: {
        total_open_invoices: 0,
        overdue_amount: 0,
        total_remaining_amount: 0,
        invoices_count: 0,
      },
    };
  }

  const organizationId = await activeOrganizationId();
  const supabase = await createClient();
  const [{ data: customer, error: customerError }, invoices] = await Promise.all([
    supabase
      .from("third_parties")
      .select("id, name, commercial_name")
      .eq("organization_id", organizationId)
      .eq("id", thirdPartyId)
      .is("archived_at", null)
      .maybeSingle(),
    listOpenInvoicesByCustomer(thirdPartyId),
  ]);
  if (customerError) throw new Error(customerError.message);

  const today = new Date().toISOString().split("T")[0];
  const invoiceRows: OpenInvoiceForPayment[] = invoices.map((invoice) => ({
    ...invoice,
    is_overdue: Boolean(invoice.due_date && invoice.due_date < today),
  }));
  const totalRemaining = invoiceRows.reduce((sum, invoice) => sum + invoice.remaining_amount, 0);
  const overdueAmount = invoiceRows.filter((invoice) => invoice.is_overdue).reduce((sum, invoice) => sum + invoice.remaining_amount, 0);

  return {
    customer: customer
      ? {
          id: customer.id as string,
          name: customer.name as string,
          commercial_name: customer.commercial_name as string | null,
        }
      : null,
    invoices: invoiceRows,
    credits: [],
    summary: {
      total_open_invoices: totalRemaining,
      overdue_amount: overdueAmount,
      total_remaining_amount: totalRemaining,
      invoices_count: invoiceRows.length,
    },
  };
}

export async function listUnallocatedPayments(customerId?: string) {
  return listCustomerPayments({ customerId, availableOnly: true, pageSize: 50 });
}

export async function listAllocatableInvoices(customerId: string) {
  return listOpenInvoicesByCustomer(customerId);
}

export async function getPaymentAllocationPreparation(paymentId: string) {
  const detail = await getCustomerPaymentDetail(paymentId);
  const invoices = detail.payment ? await listOpenInvoicesByCustomer(detail.payment.third_party_id) : [];
  return { ...detail, invoices };
}

export async function getCustomerAllocationWorkspace(customerId: string) {
  const [payments, invoices] = await Promise.all([
    listUnallocatedPayments(customerId),
    listOpenInvoicesByCustomer(customerId),
  ]);
  return { payments: payments.rows, invoices };
}

export async function getCustomerOutstandingBalance(customerId: string): Promise<CustomerOutstandingBalance> {
  const [invoices, payments] = await Promise.all([listOpenInvoicesByCustomer(customerId), listUnallocatedPayments(customerId)]);
  return {
    customer_id: customerId,
    invoices_count: invoices.length,
    total_due: invoices.reduce((sum, invoice) => sum + invoice.remaining_amount, 0),
    available_payments: payments.rows.reduce((sum, payment) => sum + payment.available_amount, 0),
  };
}

export async function getPaymentCounters(): Promise<PaymentCounters> {
  const organizationId = await activeOrganizationId();
  const supabase = await createClient();
  const [payments, invoices] = await Promise.all([
    supabase.from("customer_payments").select("amount, available_amount, status").eq("organization_id", organizationId).is("archived_at", null),
    supabase.from("customer_invoices").select("remaining_amount, payment_status, status").eq("organization_id", organizationId).is("archived_at", null),
  ]);
  if (payments.error) throw new Error(payments.error.message);
  if (invoices.error) throw new Error(invoices.error.message);
  const paymentRows = payments.data ?? [];
  const invoiceRows = invoices.data ?? [];
  return {
    receivedTotal: paymentRows.filter((row) => row.status !== "cancelled").reduce((sum, row) => sum + Number(row.amount ?? 0), 0),
    unallocatedCount: paymentRows.filter((row) => Number(row.available_amount ?? 0) > 0 && row.status !== "cancelled").length,
    availableTotal: paymentRows.filter((row) => row.status !== "cancelled").reduce((sum, row) => sum + Number(row.available_amount ?? 0), 0),
    unpaidInvoices: invoiceRows.filter((row) => row.payment_status === "unpaid" && !["draft", "cancelled"].includes(row.status as string)).length,
    partiallyPaidInvoices: invoiceRows.filter((row) => row.payment_status === "partial").length,
    remainingToCollect: invoiceRows.filter((row) => row.status !== "cancelled").reduce((sum, row) => sum + Number(row.remaining_amount ?? 0), 0),
  };
}
