/** Keep a single selected invoice in step with the amount actually paid. */
export function synchronizeSingleInvoiceAllocation(
  allocations: Record<string, number>,
  paymentAmount: number,
  invoices: ReadonlyArray<{ id: string; remaining_amount: number }>,
): Record<string, number> {
  const allIds = Object.keys(allocations);
  const positiveIds = allIds.filter((id) => allocations[id] > 0);
  const selectedIds = positiveIds.length > 0 ? positiveIds : allIds;
  if (selectedIds.length !== 1) return allocations;
  const invoice = invoices.find((item) => item.id === selectedIds[0]);
  if (!invoice || !Number.isFinite(Number(invoice.remaining_amount))) return allocations;
  const paid = Number.isFinite(paymentAmount) ? Math.max(paymentAmount, 0) : 0;
  const allocated = Math.min(paid, Math.max(Number(invoice.remaining_amount), 0));
  return { [invoice.id]: Math.round((allocated + Number.EPSILON) * 100) / 100 };
}
