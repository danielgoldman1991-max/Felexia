import { isCommonMoroccanVatRate, roundMad } from "@/lib/tax/dgi-vat-mapping";
import type { DgiVatExportData, DgiVatValidationIssue } from "@/lib/tax/dgi-vat-types";

function issue(issue: DgiVatValidationIssue): DgiVatValidationIssue {
  return issue;
}

function addIfMissing(
  issues: DgiVatValidationIssue[],
  condition: boolean,
  payload: DgiVatValidationIssue,
) {
  if (condition) issues.push(issue(payload));
}

export function validateDgiVatExport(data: DgiVatExportData): DgiVatValidationIssue[] {
  const issues: DgiVatValidationIssue[] = [];
  const start = new Date(data.period.startDate);
  const end = new Date(data.period.endDate);

  addIfMissing(issues, !data.organization.ifNumber, {
    code: "ORG_IF_MISSING",
    severity: "blocking",
    source: "organization",
    message: "L'identifiant fiscal de l'organisation est manquant.",
    correctionUrl: "/parametres/entreprise",
    correctionLabel: "Corriger l'entreprise",
    suggestedFix: "Complétez l'IF dans Paramètres > Entreprise avant génération.",
  });
  addIfMissing(issues, !data.organization.ice, {
    code: "ORG_ICE_MISSING",
    severity: "blocking",
    source: "organization",
    message: "L'ICE de l'organisation est manquant.",
    correctionUrl: "/parametres/entreprise",
    correctionLabel: "Corriger l'entreprise",
    suggestedFix: "Complétez l'ICE dans Paramètres > Entreprise avant génération.",
  });
  addIfMissing(issues, !Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || start > end, {
    code: "PERIOD_INVALID",
    severity: "blocking",
    source: "organization",
    message: "La période TVA est invalide.",
    correctionUrl: "/comptabilite/tva/exports",
    correctionLabel: "Changer la période",
    suggestedFix: "Vérifiez la date de début et la date de fin.",
  });
  addIfMissing(issues, data.salesDocuments.length === 0 && data.purchaseDocuments.length === 0, {
    code: "NO_DATA_FOR_PERIOD",
    severity: "blocking",
    source: "organization",
    message: "Aucune vente ni facture fournisseur éligible n'a été trouvée sur la période.",
    suggestedFix: "Vérifiez la période ou validez les pièces concernées.",
  });

  for (const document of data.salesDocuments) {
    const isCreditNote = document.documentType === "CREDIT_NOTE";
    const docSource: DgiVatValidationIssue["source"] = isCreditNote ? "customer_invoice" : "customer_invoice";

    addIfMissing(issues, !document.invoiceNumber, {
      code: "SALES_INVOICE_NUMBER_MISSING",
      severity: "blocking",
      source: docSource,
      sourceId: document.id,
      documentNumber: document.invoiceNumber,
      correctionUrl: `/facturation/factures/${document.id}`,
      correctionLabel: "Ouvrir la facture client",
      message: "Une facture client incluse n'a pas de numéro.",
      suggestedFix: "Renseignez ou régénérez le numéro de facture client.",
    });
    addIfMissing(issues, !document.issueDate, {
      code: "SALES_INVOICE_DATE_MISSING",
      severity: "blocking",
      source: docSource,
      sourceId: document.id,
      documentNumber: document.invoiceNumber,
      correctionUrl: `/facturation/factures/${document.id}`,
      correctionLabel: "Ouvrir la facture client",
      message: "Une facture client incluse n'a pas de date.",
      suggestedFix: "Renseignez la date de facture.",
    });
    addIfMissing(issues, isCreditNote && !document.originalInvoiceNumber, {
      code: "CREDIT_NOTE_ORIGIN_MISSING",
      severity: "warning",
      source: docSource,
      sourceId: document.id,
      documentNumber: document.invoiceNumber,
      correctionUrl: `/facturation/avoirs/${document.id}`,
      correctionLabel: "Ouvrir l'avoir client",
      message: "Un avoir client n'est pas rattaché à une facture d'origine.",
      suggestedFix: "Renseignez la facture d'origine si elle existe.",
    });
    addIfMissing(issues, !document.customerIce, {
      code: "CUSTOMER_ICE_MISSING",
      severity: "warning",
      source: "customer",
      sourceId: document.id,
      thirdPartyId: document.customerId,
      thirdPartyName: document.customerName,
      documentNumber: document.invoiceNumber,
      correctionUrl: document.customerId ? `/tiers/${document.customerId}/edit` : null,
      correctionLabel: "Corriger le client",
      message: "Le client n'a pas d'ICE renseigné.",
      suggestedFix: "Complétez la fiche tiers client.",
    });
    addIfMissing(issues, !document.customerIf, {
      code: "CUSTOMER_IF_MISSING",
      severity: "warning",
      source: "customer",
      sourceId: document.id,
      thirdPartyId: document.customerId,
      thirdPartyName: document.customerName,
      documentNumber: document.invoiceNumber,
      correctionUrl: document.customerId ? `/tiers/${document.customerId}/edit` : null,
      correctionLabel: "Corriger le client",
      message: "Le client n'a pas d'IF renseigné.",
      suggestedFix: "Complétez la fiche tiers client si l'information est disponible.",
    });
    addIfMissing(issues, document.accountingStatus === "not_posted", {
      code: "NOT_POSTED_TO_ACCOUNTING",
      severity: "warning",
      source: docSource,
      sourceId: document.id,
      documentNumber: document.invoiceNumber,
      correctionUrl: `/facturation/factures/${document.id}`,
      correctionLabel: "Ouvrir la facture client",
      message: "La facture client n'est pas comptabilisée.",
      suggestedFix: "Générez l'écriture comptable si la pièce est définitive.",
    });
    addIfMissing(issues, document.currencySource !== "MAD" && !document.exchangeRateToMad, {
      code: "FX_RATE_MISSING",
      severity: "blocking",
      source: docSource,
      sourceId: document.id,
      documentNumber: document.invoiceNumber,
      correctionUrl: `/facturation/factures/${document.id}`,
      correctionLabel: "Ouvrir la facture client",
      message: "Une facture client en devise étrangère n'a pas de taux de conversion MAD.",
      suggestedFix: "Renseignez un taux de conversion validé.",
    });

    const lineVatTotal = roundMad(document.taxBreakdown.reduce((sum, row) => sum + row.vatAmountMad, 0));
    for (const breakdown of document.taxBreakdown) {
      addIfMissing(issues, !Number.isFinite(breakdown.taxRate), {
        code: "TAX_RATE_MISSING",
        severity: "blocking",
        source: "tax_rate",
        sourceId: document.id,
        documentNumber: document.invoiceNumber,
        correctionUrl: `/facturation/factures/${document.id}`,
        correctionLabel: "Ouvrir la facture client",
        message: "Une ligne de facture client n'a pas de taux TVA exploitable.",
        suggestedFix: "Vérifiez les lignes et le paramétrage des taux TVA.",
      });
      addIfMissing(issues, Number.isFinite(breakdown.taxRate) && !isCommonMoroccanVatRate(breakdown.taxRate), {
        code: "UNUSUAL_TAX_RATE",
        severity: "warning",
        source: "tax_rate",
        sourceId: document.id,
        documentNumber: document.invoiceNumber,
        correctionUrl: `/articles/tva`,
        correctionLabel: "Vérifier les taux TVA",
        message: `Le taux TVA ${breakdown.taxRate}% est inhabituel pour le mapping préparatoire.`,
        suggestedFix: "Validez le taux avec votre conseiller fiscal.",
      });
    }
    addIfMissing(issues, Math.abs(lineVatTotal) > Math.abs(document.totalTtcMad) && document.totalTtcMad !== 0, {
      code: "VAT_TOTAL_MISMATCH",
      severity: "blocking",
      source: docSource,
      sourceId: document.id,
      documentNumber: document.invoiceNumber,
      correctionUrl: `/facturation/factures/${document.id}`,
      correctionLabel: "Ouvrir la facture client",
      message: "Le total TVA des lignes semble incohérent avec le total TTC.",
      suggestedFix: "Recalculez les lignes de facture.",
    });
  }

  for (const document of data.purchaseDocuments) {
    const deductibleVat = roundMad(document.taxBreakdown.reduce((sum, row) => sum + row.deductibleVatMad, 0));
    const invoiceVat = roundMad(document.taxBreakdown.reduce((sum, row) => sum + row.vatOnInvoiceMad, 0));

    addIfMissing(issues, !document.referenceNumber, {
      code: "PURCHASE_REFERENCE_MISSING",
      severity: "blocking",
      source: "supplier_invoice",
      sourceId: document.id,
      documentNumber: document.referenceNumber,
      correctionUrl: `/achats/factures/${document.id}`,
      correctionLabel: "Ouvrir la facture fournisseur",
      message: "Une facture fournisseur incluse n'a pas de référence.",
      suggestedFix: "Renseignez la référence fournisseur.",
    });
    addIfMissing(issues, !document.issueDate, {
      code: "PURCHASE_DATE_MISSING",
      severity: "blocking",
      source: "supplier_invoice",
      sourceId: document.id,
      documentNumber: document.referenceNumber,
      correctionUrl: `/achats/factures/${document.id}`,
      correctionLabel: "Ouvrir la facture fournisseur",
      message: "Une facture fournisseur incluse n'a pas de date.",
      suggestedFix: "Renseignez la date de facture fournisseur.",
    });
    addIfMissing(issues, !document.supplierName, {
      code: "SUPPLIER_MISSING",
      severity: "blocking",
      source: "supplier",
      sourceId: document.id,
      thirdPartyId: document.supplierId,
      thirdPartyName: document.supplierName,
      documentNumber: document.referenceNumber,
      correctionUrl: document.supplierId ? `/tiers/${document.supplierId}/edit` : `/achats/factures/${document.id}`,
      correctionLabel: document.supplierId ? "Corriger le fournisseur" : "Ouvrir la facture",
      message: "Une facture fournisseur n'a pas de fournisseur exploitable.",
      suggestedFix: "Rattachez la facture à un tiers fournisseur.",
    });
    addIfMissing(issues, deductibleVat > 0 && !document.supplierIf, {
      code: "SUPPLIER_IF_MISSING",
      severity: "blocking",
      source: "supplier",
      sourceId: document.id,
      thirdPartyId: document.supplierId,
      thirdPartyName: document.supplierName,
      documentNumber: document.referenceNumber,
      correctionUrl: document.supplierId ? `/tiers/${document.supplierId}/edit` : null,
      correctionLabel: "Corriger le fournisseur",
      message: "Un achat avec TVA déductible n'a pas d'IF fournisseur.",
      suggestedFix: "Complétez la fiche fournisseur avant déduction.",
    });
    addIfMissing(issues, deductibleVat > 0 && !document.supplierIce, {
      code: "SUPPLIER_ICE_MISSING",
      severity: "blocking",
      source: "supplier",
      sourceId: document.id,
      thirdPartyId: document.supplierId,
      thirdPartyName: document.supplierName,
      documentNumber: document.referenceNumber,
      correctionUrl: document.supplierId ? `/tiers/${document.supplierId}/edit` : null,
      correctionLabel: "Corriger le fournisseur",
      message: "Un achat avec TVA déductible n'a pas d'ICE fournisseur.",
      suggestedFix: "Complétez la fiche fournisseur avant déduction.",
    });
    addIfMissing(issues, invoiceVat > 0 && deductibleVat === 0, {
      code: "PAYMENT_MISSING_FOR_DEDUCTION",
      severity: "warning",
      source: "supplier_invoice",
      sourceId: document.id,
      documentNumber: document.referenceNumber,
      correctionUrl: `/achats/factures/${document.id}`,
      correctionLabel: "Ouvrir la facture fournisseur",
      message: "La facture fournisseur contient de la TVA mais aucun paiement exploitable n'a été trouvé.",
      suggestedFix: "Rattachez le paiement fournisseur pour calculer la TVA récupérable.",
    });
    addIfMissing(issues, deductibleVat > 0 && !document.paymentMode, {
      code: "PAYMENT_MODE_MISSING",
      severity: "blocking",
      source: "supplier_invoice",
      sourceId: document.id,
      documentNumber: document.referenceNumber,
      correctionUrl: `/achats/factures/${document.id}`,
      correctionLabel: "Ouvrir la facture fournisseur",
      message: "Un achat déduit n'a pas de mode de paiement.",
      suggestedFix: "Complétez le paiement fournisseur.",
    });
    addIfMissing(issues, deductibleVat > 0 && !document.paymentReference, {
      code: "PAYMENT_REFERENCE_MISSING",
      severity: "blocking",
      source: "supplier_invoice",
      sourceId: document.id,
      documentNumber: document.referenceNumber,
      correctionUrl: `/achats/factures/${document.id}`,
      correctionLabel: "Ouvrir la facture fournisseur",
      message: "Un achat déduit n'a pas de référence de paiement.",
      suggestedFix: "Ajoutez la référence de virement, chèque ou opération bancaire.",
    });
    addIfMissing(issues, deductibleVat > 0 && !document.paymentDate, {
      code: "PAYMENT_DATE_MISSING",
      severity: "blocking",
      source: "supplier_invoice",
      sourceId: document.id,
      documentNumber: document.referenceNumber,
      correctionUrl: `/achats/factures/${document.id}`,
      correctionLabel: "Ouvrir la facture fournisseur",
      message: "Un achat déduit n'a pas de date de paiement.",
      suggestedFix: "Renseignez la date de paiement.",
    });
    addIfMissing(issues, document.currencySource !== "MAD" && !document.exchangeRateToMad, {
      code: "FX_RATE_MISSING",
      severity: "blocking",
      source: "supplier_invoice",
      sourceId: document.id,
      documentNumber: document.referenceNumber,
      correctionUrl: `/achats/factures/${document.id}`,
      correctionLabel: "Ouvrir la facture fournisseur",
      message: "Une facture fournisseur en devise étrangère n'a pas de taux de conversion MAD.",
      suggestedFix: "Renseignez un taux de conversion validé.",
    });
    addIfMissing(issues, document.accountingStatus === "not_posted", {
      code: "NOT_POSTED_TO_ACCOUNTING",
      severity: "warning",
      source: "supplier_invoice",
      sourceId: document.id,
      documentNumber: document.referenceNumber,
      correctionUrl: `/achats/factures/${document.id}`,
      correctionLabel: "Ouvrir la facture fournisseur",
      message: "La facture fournisseur n'est pas comptabilisée.",
      suggestedFix: "Générez l'écriture comptable si la pièce est définitive.",
    });

    for (const breakdown of document.taxBreakdown) {
      addIfMissing(issues, !Number.isFinite(breakdown.taxRate), {
        code: "TAX_RATE_MISSING",
        severity: "blocking",
        source: "tax_rate",
        sourceId: document.id,
        documentNumber: document.referenceNumber,
        correctionUrl: `/achats/factures/${document.id}`,
        correctionLabel: "Ouvrir la facture fournisseur",
        message: "Une ligne de facture fournisseur n'a pas de taux TVA exploitable.",
        suggestedFix: "Vérifiez les lignes et le paramétrage des taux TVA.",
      });
      addIfMissing(issues, Number.isFinite(breakdown.taxRate) && !isCommonMoroccanVatRate(breakdown.taxRate), {
        code: "UNUSUAL_TAX_RATE",
        severity: "warning",
        source: "tax_rate",
        sourceId: document.id,
        documentNumber: document.referenceNumber,
        correctionUrl: `/articles/tva`,
        correctionLabel: "Vérifier les taux TVA",
        message: `Le taux TVA ${breakdown.taxRate}% est inhabituel pour le mapping préparatoire.`,
        suggestedFix: "Validez le taux avec votre conseiller fiscal.",
      });
    }
  }

  issues.push({
    code: "PREPARATORY_ONLY",
    severity: "warning",
    source: "organization",
    message: "Export préparatoire structuré Felexia, non homologué DGI.",
    suggestedFix: "Le dépôt officiel reste à effectuer selon les modalités DGI/SIMPL applicables.",
  });

  return issues;
}
