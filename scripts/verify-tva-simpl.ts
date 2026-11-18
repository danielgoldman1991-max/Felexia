import assert from "node:assert/strict";
import { buildEdiSimpl } from "../src/lib/accounting/edi-simpl";
import { declarationToSimplLines } from "../src/lib/accounting/fiscal-files";
import { buildDeclarationLines } from "../src/lib/tax/dgi-vat-mapping";
import { buildSimplDeductionXml, simplDeductionIssues, simplDeductionZip, simplRowsFromPurchases } from "../src/lib/tax/simpl-tva-xml";
import { deductionTable } from "../src/lib/tax/vat-deduction-report";
import {
  creditNotePosted,
  isFixedAssetAccount,
  saleVat,
  selectPurchaseDeduction,
  type PurchaseCandidate,
  type SaleCandidate,
} from "../src/lib/tax/vat-period-rules";
import type { DgiVatPurchaseDocument } from "../src/lib/tax/dgi-vat-types";

const september = { start: "2026-09-01", end: "2026-09-30" };
const october = { start: "2026-10-01", end: "2026-10-31" };

function purchase(overrides: Partial<PurchaseCandidate> & Pick<PurchaseCandidate, "id" | "number" | "invoiceDate" | "totalTtc" | "lines">): PurchaseCandidate {
  return {
    documentType: "INVOICE",
    supplierName: "Atlas Fournitures",
    supplierIf: "12345678",
    supplierIce: "001234567000089",
    description: "Achat",
    payments: [],
    accountCodes: ["6111"],
    markedFixedAsset: false,
    ...overrides,
  };
}

const paidNextMonth = purchase({
  id: "next",
  number: "FF-0926-0008",
  invoiceDate: "2026-09-02",
  totalTtc: 1200,
  lines: [{ taxRate: 20, baseHt: 1000, vat: 200, ttc: 1200 }],
  payments: [{ date: "2026-10-15", amount: 1200, mode: "virement", reference: "VIR-10" }],
});
assert.equal(selectPurchaseDeduction(paidNextMonth, september, "encaissement").included, false);
assert.equal(selectPurchaseDeduction(paidNextMonth, september, "unspecified").included, false);
assert.equal(selectPurchaseDeduction(paidNextMonth, october, "encaissement").deductibleVat, 200);
assert.equal(selectPurchaseDeduction(paidNextMonth, september, "debit").deductibleVat, 200);
assert.equal(selectPurchaseDeduction(paidNextMonth, october, "debit").included, false);

const partial = purchase({
  id: "partial",
  number: "FF-0926-0002",
  invoiceDate: "2026-09-04",
  totalTtc: 1200,
  lines: [{ taxRate: 20, baseHt: 1000, vat: 200, ttc: 1200 }],
  payments: [{ date: "2026-09-20", amount: 600, mode: "cheque", reference: "CHQ-1" }],
});
const partialDeduction = selectPurchaseDeduction(partial, september, "encaissement");
assert.equal(partialDeduction.deductibleVat, 100);
assert.equal(partialDeduction.baseHt, 500);
assert.equal(partialDeduction.paymentDate, "2026-09-20");

const supplierCredit = purchase({
  id: "avoir-frs",
  documentType: "CREDIT_NOTE",
  number: "AVF-0926-0001",
  invoiceDate: "2026-09-18",
  totalTtc: 180,
  lines: [{ taxRate: 20, baseHt: 150, vat: 30, ttc: 180 }],
  accountCodes: ["6111"],
});
assert.equal(selectPurchaseDeduction(supplierCredit, september, "encaissement").deductibleVat, -30);
assert.equal(creditNotePosted(["supplier_credit_note"], "supplier"), true);
assert.equal(creditNotePosted(["credit_note"], "supplier"), false);

const asset = purchase({
  id: "immo",
  number: "FF-0926-0003",
  invoiceDate: "2026-09-08",
  description: "Matériel",
  totalTtc: 480,
  lines: [{ taxRate: 20, baseHt: 400, vat: 80, ttc: 480 }],
  payments: [{ date: "2026-09-08", amount: 480, mode: "virement", reference: "VIR-9" }],
  accountCodes: ["2230", "3455"],
});
assert.equal(selectPurchaseDeduction(asset, september, "unspecified").fixedAsset, true);
assert.equal(isFixedAssetAccount("2838"), false);
assert.equal(isFixedAssetAccount("4417"), false);

const customerInvoice: SaleCandidate = {
  id: "fac",
  documentType: "INVOICE",
  issueDate: "2026-09-05",
  lines: [{ taxRate: 20, baseHt: 1000, vat: 200, ttc: 1200 }],
  postedSourceTypes: ["customer_invoice"],
};
const customerCredit: SaleCandidate = {
  id: "avc",
  documentType: "CREDIT_NOTE",
  issueDate: "2026-09-12",
  lines: [{ taxRate: 20, baseHt: 100, vat: 20, ttc: 120 }],
  postedSourceTypes: ["customer_credit_note"],
};
assert.equal(saleVat(customerInvoice) + saleVat(customerCredit), 180);
assert.equal(creditNotePosted(customerCredit.postedSourceTypes, "customer"), true);
assert.equal(creditNotePosted([], "customer"), false);

const septemberPurchases = [partial, supplierCredit, asset, paidNextMonth]
  .map((item) => selectPurchaseDeduction(item, september, "unspecified"))
  .filter((item) => item.included);
const assets = septemberPurchases.filter((item) => item.fixedAsset).reduce((sum, item) => sum + item.deductibleVat, 0);
const charges = septemberPurchases.filter((item) => !item.fixedAsset).reduce((sum, item) => sum + item.deductibleVat, 0);
const declaration = buildDeclarationLines({
  salesBreakdowns: [
    { taxRate: 20, baseHtMad: 1000, vatAmountMad: 200 },
    { taxRate: 20, baseHtMad: -100, vatAmountMad: -20 },
  ],
  collectedVatMad: 180,
  deductibleVatMad: assets + charges,
  assetDeductibleVatMad: assets,
  chargeDeductibleVatMad: charges,
  vatDueMad: 180 - (assets + charges),
  creditCarryForwardMad: 0,
});
assert.equal(declaration.find((line) => line.code === "140")?.amountMad, 80);
assert.equal(declaration.find((line) => line.code === "145")?.amountMad, 70);
assert.equal(declaration.find((line) => line.code === "190")?.amountMad, 150);
assert.equal(declaration.find((line) => line.code === "130")?.amountMad, 180);

const statement = deductionTable(septemberPurchases.map((item, index) => ({
  supplier: "Atlas Fournitures",
  ifNumber: "12345678",
  ice: "001234567000089",
  invoiceNumber: ["FF-0926-0002", "AVF-0926-0001", "FF-0926-0003"][index] ?? "",
  invoiceDate: "2026-09-01",
  amountHt: item.baseHt,
  vatAmount: item.deductibleVat,
  payments: [{ date: item.paymentDate, mode: item.paymentMode }],
  nature: item.fixedAsset ? "Immobilisation" as const : "Charge" as const,
})));
assert.equal(statement.at(-1)?.[6], "150,00");
assert.equal(statement.filter((row) => row[0] !== "TOTAL").length - 1, 3);

const simpl = buildEdiSimpl("001234567000012", "202609", declarationToSimplLines(declaration));
assert.equal(simpl.split("\n").find((line) => line.startsWith("TOTAL")), "TOTAL;;180.00");
assert.doesNotMatch(simpl, /TOTAL;;400/);

function asDocument(item: PurchaseCandidate, period: { start: string; end: string }): DgiVatPurchaseDocument | null {
  const deduction = selectPurchaseDeduction(item, period, "encaissement");
  if (!deduction.included) return null;
  return {
    id: item.id,
    documentType: item.documentType,
    referenceNumber: item.number,
    issueDate: item.invoiceDate,
    supplierId: null,
    supplierName: item.supplierName,
    supplierIf: item.supplierIf,
    supplierIce: item.supplierIce,
    description: item.description,
    currencySource: "MAD",
    paymentMode: deduction.paymentMode,
    paymentReference: deduction.paymentReference,
    paymentDate: deduction.paymentDate,
    taxBreakdown: deduction.lines.map((line) => ({
      taxRate: line.taxRate,
      baseHtMad: line.baseHt,
      vatOnInvoiceMad: line.vatOnInvoice,
      deductibleVatMad: line.deductibleVat,
    })),
    totalTtcMad: item.documentType === "CREDIT_NOTE" ? -item.totalTtc : item.totalTtc,
    paidAmountMad: deduction.paidInPeriod,
    importFlag: false,
    immobilizationFlag: deduction.fixedAsset,
    accountingStatus: "posted",
  };
}

const xmlDocuments = [partial, supplierCredit, asset].map((item) => asDocument(item, september)).filter((item): item is DgiVatPurchaseDocument => Boolean(item));
assert.equal(xmlDocuments.some((item) => item.id === "next"), false);
const rows = simplRowsFromPurchases(xmlDocuments);
const line190 = 150;
assert.equal(Number(rows.reduce((sum, row) => sum + row.vat, 0).toFixed(2)), line190);
assert.deepEqual(simplDeductionIssues({
  fiscalId: "12345678",
  regime: "encaissement",
  periodStart: september.start,
  periodEnd: september.end,
  line190,
  rows,
}), []);
const blocked = simplDeductionIssues({
  fiscalId: "12345678",
  regime: "encaissement",
  periodStart: september.start,
  periodEnd: september.end,
  line190,
  rows: rows.map((row) => row.number === "FF-0926-0002" ? { ...row, supplierIce: null } : row),
});
assert.ok(blocked.some((issue) => issue.includes("ICE")));
const xml = buildSimplDeductionXml({
  fiscalId: "12345678",
  periodStart: september.start,
  frequency: "monthly",
  regime: "encaissement",
  rows,
});
assert.doesNotMatch(xml, /<\?xml/);
assert.match(xml, /<DeclarationReleveDeduction>/);
assert.match(xml, /<annee>2026<\/annee>/);
assert.match(xml, /<periode>9<\/periode>/);
assert.match(xml, /<regime>1<\/regime>/);
assert.match(xml, /<prorata>50.00<\/prorata>/);
assert.match(xml, /<id>2<\/id>/);
assert.match(xml, /<dpai>2026-09-20<\/dpai>/);
assert.match(xml, /<dfac>2026-09-04<\/dfac>/);
const zip = simplDeductionZip(xml);
const name = "DeclarationReleveDeduction.xml";
const nameAt = zip.indexOf(name);
assert.equal(nameAt, 30);
const size = zip.readUInt32LE(18);
const payload = zip.subarray(30 + name.length, 30 + name.length + size);
assert.equal(payload[0], 0xef);
assert.equal(payload[1], 0xbb);
assert.equal(payload[2], 0xbf);
assert.equal(payload.subarray(3).toString("utf8"), xml);
assert.equal(zip.includes(Buffer.from("<?xml")), false);

console.log("TVA : déduction par règlement, avoirs, immobilisations, SIMPL et XML contrôlés.");
