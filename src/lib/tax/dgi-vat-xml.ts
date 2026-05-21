import type { DgiVatExportData, DgiVatValidationIssue } from "@/lib/tax/dgi-vat-types";

function xml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function money(value: number) {
  return (Number(value) || 0).toFixed(2);
}

function issueTag(issue: DgiVatValidationIssue) {
  const tag = issue.severity === "blocking" ? "BlockingError" : issue.severity === "warning" ? "Warning" : "Info";
  return `    <${tag} code="${xml(issue.code)}" source="${xml(issue.source ?? "")}">
      <Message>${xml(issue.message)}</Message>
      <DocumentNumber>${xml(issue.documentNumber ?? "")}</DocumentNumber>
      <SuggestedFix>${xml(issue.suggestedFix ?? "")}</SuggestedFix>
    </${tag}>`;
}

export function generateDgiVatPreparatoryXml(data: DgiVatExportData): string {
  const declarationLines = data.declarationLines.map((line) => `    <Line code="${xml(line.code)}">
      <Label>${xml(line.label)}</Label>
      <AmountMAD>${money(line.amountMad)}</AmountMAD>
    </Line>`).join("\n");

  const salesDocuments = data.salesDocuments.map((document) => `    <SalesDocument type="${xml(document.documentType)}">
      <DocumentId>${xml(document.id)}</DocumentId>
      <InvoiceNumber>${xml(document.invoiceNumber)}</InvoiceNumber>
      <OriginalInvoiceNumber>${xml(document.originalInvoiceNumber ?? "")}</OriginalInvoiceNumber>
      <IssueDate>${xml(document.issueDate)}</IssueDate>
      <CustomerName>${xml(document.customerName ?? "")}</CustomerName>
      <CustomerIF>${xml(document.customerIf ?? "")}</CustomerIF>
      <CustomerICE>${xml(document.customerIce ?? "")}</CustomerICE>
      <Currency>${xml(document.currencySource)}</Currency>
      <AccountingStatus>${xml(document.accountingStatus ?? "")}</AccountingStatus>
      <TaxBreakdown>
${document.taxBreakdown.map((row) => `        <TaxLine rate="${money(row.taxRate)}">
          <BaseHtMAD>${money(row.baseHtMad)}</BaseHtMAD>
          <VatAmountMAD>${money(row.vatAmountMad)}</VatAmountMAD>
          <TotalTtcMAD>${money(row.totalTtcMad ?? 0)}</TotalTtcMAD>
        </TaxLine>`).join("\n")}
      </TaxBreakdown>
      <TotalTtcMAD>${money(document.totalTtcMad)}</TotalTtcMAD>
    </SalesDocument>`).join("\n");

  const purchaseDocuments = data.purchaseDocuments.map((document) => `    <PurchaseDocument type="${xml(document.documentType)}">
      <DocumentId>${xml(document.id)}</DocumentId>
      <ReferenceNumber>${xml(document.referenceNumber)}</ReferenceNumber>
      <OriginalReferenceNumber>${xml(document.originalReferenceNumber ?? "")}</OriginalReferenceNumber>
      <IssueDate>${xml(document.issueDate)}</IssueDate>
      <SupplierName>${xml(document.supplierName ?? "")}</SupplierName>
      <SupplierIF>${xml(document.supplierIf ?? "")}</SupplierIF>
      <SupplierICE>${xml(document.supplierIce ?? "")}</SupplierICE>
      <Description>${xml(document.description ?? "")}</Description>
      <Currency>${xml(document.currencySource)}</Currency>
      <PaymentMode>${xml(document.paymentMode ?? "")}</PaymentMode>
      <PaymentReference>${xml(document.paymentReference ?? "")}</PaymentReference>
      <PaymentDate>${xml(document.paymentDate ?? "")}</PaymentDate>
      <AccountingStatus>${xml(document.accountingStatus ?? "")}</AccountingStatus>
      <TaxBreakdown>
${document.taxBreakdown.map((row) => `        <TaxLine rate="${money(row.taxRate)}">
          <BaseHtMAD>${money(row.baseHtMad)}</BaseHtMAD>
          <VatOnInvoiceMAD>${money(row.vatOnInvoiceMad)}</VatOnInvoiceMAD>
          <DeductibleVatMAD>${money(row.deductibleVatMad)}</DeductibleVatMAD>
        </TaxLine>`).join("\n")}
      </TaxBreakdown>
      <TotalTtcMAD>${money(document.totalTtcMad)}</TotalTtcMAD>
      <PaidAmountMAD>${money(document.paidAmountMad)}</PaidAmountMAD>
      <ImportFlag>${document.importFlag ? "true" : "false"}</ImportFlag>
      <ImmobilizationFlag>${document.immobilizationFlag ? "true" : "false"}</ImmobilizationFlag>
    </PurchaseDocument>`).join("\n");

  const validationReport = data.validationIssues.map(issueTag).join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<FelexiaDgiVatExport
  xmlns="urn:felexia:dgi:tva:preparatory:v1"
  version="1.0"
  schemaStatus="preparatory"
  officialConformityClaim="false">

  <Header>
    <BatchId>${xml(data.batchId)}</BatchId>
    <GeneratedAt>${xml(data.generatedAt)}</GeneratedAt>
    <SchemaVersion>${xml(data.schemaVersion)}</SchemaVersion>
    <SourceSnapshotHash>${xml(data.sourceSnapshotHash)}</SourceSnapshotHash>
  </Header>

  <Declarant>
    <OrganizationName>${xml(data.organization.name)}</OrganizationName>
    <LegalName>${xml(data.organization.legalName ?? "")}</LegalName>
    <IF>${xml(data.organization.ifNumber ?? "")}</IF>
    <ICE>${xml(data.organization.ice ?? "")}</ICE>
    <Currency>${xml(data.organization.currency)}</Currency>
    <Address>${xml(data.organization.address ?? "")}</Address>
    <City>${xml(data.organization.city ?? "")}</City>
    <CountryCode>${xml(data.organization.countryCode)}</CountryCode>
  </Declarant>

  <Period>
    <StartDate>${xml(data.period.startDate)}</StartDate>
    <EndDate>${xml(data.period.endDate)}</EndDate>
    <Frequency>${xml(data.period.frequency)}</Frequency>
    <Regime>${xml(data.period.regime)}</Regime>
  </Period>

  <DeclarationLines>
${declarationLines}
  </DeclarationLines>

  <SalesDocuments>
${salesDocuments}
  </SalesDocuments>

  <PurchaseDocuments>
${purchaseDocuments}
  </PurchaseDocuments>

  <Summary>
    <PriorCreditMAD>${money(data.summary.priorCreditMad)}</PriorCreditMAD>
    <TotalTurnoverMAD>${money(data.summary.totalTurnoverMad)}</TotalTurnoverMAD>
    <TaxableTurnoverMAD>${money(data.summary.taxableTurnoverMad)}</TaxableTurnoverMAD>
    <CollectedVatMAD>${money(data.summary.collectedVatMad)}</CollectedVatMAD>
    <DeductibleVatMAD>${money(data.summary.deductibleVatMad)}</DeductibleVatMAD>
    <VatDueMAD>${money(data.summary.vatDueMad)}</VatDueMAD>
    <CreditCarryForwardMAD>${money(data.summary.creditCarryForwardMad)}</CreditCarryForwardMAD>
  </Summary>

  <ValidationReport>
${validationReport}
  </ValidationReport>

</FelexiaDgiVatExport>
`;
}
