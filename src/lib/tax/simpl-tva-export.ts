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
import { readOrganizationVatFiling } from "@/lib/tax/vat-filing";

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
  const filing = await readOrganizationVatFiling(input.organizationId);
  const frequency = simplFilingFrequency(filing.frequency, input.declarationFrequency);
  const regime: VatRegimeMode = input.regime === "unspecified" && filing.regime !== "unspecified" ? filing.regime : input.regime;
  const data = await getDgiVatExportData({
    organizationId: input.organizationId,
    periodStart: input.periodStart,
    periodEnd: input.periodEnd,
    frequency,
    generatedBy: input.userId,
    priorCreditMad: input.priorCredit,
    regime,
  });
  const line190 = roundMad(data.declarationLines.find((line) => line.code === "190")?.amountMad ?? 0);
  const rows = simplRowsFromPurchases(data.purchaseDocuments);
  const issues = simplDeductionIssues({
    fiscalId: data.organization.ifNumber,
    regime,
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
      regime,
      rows,
    })
    : null;
  return { issues, warnings, xml, frequency, periodStart: data.period.startDate };
}
