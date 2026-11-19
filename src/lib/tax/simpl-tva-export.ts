import { roundMad } from "@/lib/tax/dgi-vat-mapping";
import { getDgiVatExportData } from "@/lib/tax/dgi-vat-query";
import {
  buildSimplDeductionXml,
  simplDeductionIssues,
  simplRowsFromPurchases,
  type SimplDeductionIssue,
  type SimplFilingFrequency,
} from "@/lib/tax/simpl-tva-xml";
import type { VatRegimeMode } from "@/lib/tax/vat-period-rules";
import { createClient } from "@/lib/supabase/server";

export function simplFilingFrequency(company: string | null | undefined, declaration: string | null | undefined): SimplFilingFrequency {
  if (company === "quarterly" || company === "monthly") return company;
  if (declaration === "quarterly" || declaration === "annual_control") return "quarterly";
  return "monthly";
}

export async function prepareSimplDeductionExport(input: {
  organizationId: string;
  userId: string;
  periodStart: string;
  periodEnd: string;
  declarationFrequency: string | null;
  regime: VatRegimeMode;
  priorCredit: number;
}) {
  const supabase = await createClient();
  const settings = await supabase
    .from("organization_fiscal_settings")
    .select("vat_frequency")
    .eq("organization_id", input.organizationId)
    .maybeSingle();
  const frequency = simplFilingFrequency(settings.data?.vat_frequency, input.declarationFrequency);
  const data = await getDgiVatExportData({
    organizationId: input.organizationId,
    periodStart: input.periodStart,
    periodEnd: input.periodEnd,
    frequency,
    generatedBy: input.userId,
    priorCreditMad: input.priorCredit,
    regime: input.regime,
  });
  const line190 = roundMad(data.declarationLines.find((line) => line.code === "190")?.amountMad ?? 0);
  const rows = simplRowsFromPurchases(data.purchaseDocuments);
  const issues = simplDeductionIssues({
    fiscalId: data.organization.ifNumber,
    regime: input.regime,
    periodStart: data.period.startDate,
    periodEnd: data.period.endDate,
    frequency,
    line190,
    rows,
  });
  const warnings: SimplDeductionIssue[] = (data.unallocatedSupplierPayments ?? []).map((payment) => ({
    code: "UNALLOCATED_SUPPLIER_PAYMENT",
    message: payment.deducted
      ? `${payment.invoiceNumber || "Facture"} : un paiement indiqué n'est pas imputé. Seuls les règlements déjà datés sont déduits, sans double comptage.`
      : `${payment.invoiceNumber || "Facture"} : paiement de ${payment.paidAmount.toFixed(2)} MAD sans imputation et sans date exploitable. La facture n'est pas reprise dans le relevé.`,
    href: `/achats/factures/${payment.invoiceId}`,
  }));
  const xml = issues.length === 0
    ? buildSimplDeductionXml({
      fiscalId: data.organization.ifNumber ?? "",
      periodStart: data.period.startDate,
      periodEnd: data.period.endDate,
      frequency,
      regime: input.regime,
      rows,
    })
    : null;
  return { issues, warnings, xml, frequency, periodStart: data.period.startDate };
}
