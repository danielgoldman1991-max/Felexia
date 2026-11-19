import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildEdiSimpl } from "../src/lib/accounting/edi-simpl";
import { declarationToSimplLines } from "../src/lib/accounting/fiscal-files";
import { buildDeclarationLines } from "../src/lib/tax/dgi-vat-mapping";
import { balancedSimplAmounts, buildSimplDeductionXml, officialAmount, officialSimplFiling, simplDeductionIssues, simplDeductionZip, simplPlainText, simplRowsFromPurchases, type SimplDeductionRow } from "../src/lib/tax/simpl-tva-xml";
import { deductionTable } from "../src/lib/tax/vat-deduction-report";
import { getLaunchDestination, isLaunchPathAvailable } from "../src/lib/launch-profile";
import {
  creditNotePosted,
  isFixedAssetAccount,
  casablancaIsoDate,
  resolveUnallocatedPayments,
  saleVat,
  selectPurchaseDeduction,
  simplPaymentModeId,
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
assert.ok(blocked.some((issue) => issue.message.includes("ICE")));
assert.equal(blocked.find((issue) => issue.code === "SUPPLIER_ICE")?.href, null);
assert.equal(officialAmount(4835), "4835");
assert.equal(officialAmount(645), "645");
assert.equal(officialAmount(20), "20");
assert.equal(officialAmount(4029.17), "4029.17");
assert.equal(officialAmount(3220.5), "3220.5");
assert.equal(officialAmount(3220.5), "3220.5");
assert.deepEqual(officialSimplFiling("2026-09-01", "monthly"), { annee: "2026", periode: "9", regime: "1" });
assert.deepEqual(officialSimplFiling("2026-06-01", "quarterly"), { annee: "2026", periode: "2", regime: "2" });

const fictionalRows: SimplDeductionRow[] = [
  { number: "F-100", description: "MATIERE FICTIVE", baseHt: 4029.17, vat: 805.83, ttc: 4835, supplierIf: "20000001", supplierName: "ATELIER FICTIF", supplierIce: "001234567000089", taxRate: 20, prorataPercent: 100, paymentMode: "cash", paymentDate: "2026-09-08", invoiceDate: "2026-09-08" },
  { number: "F-101", description: "FOURNITURE & EMBALLAGE", baseHt: 3220.5, vat: 644.1, ttc: 3864.6, supplierIf: "20000002", supplierName: "STE <DEMO>", supplierIce: "000000000000015", taxRate: 20, prorataPercent: 100, paymentMode: "virement", paymentDate: "2026-09-19", invoiceDate: "2026-09-18" },
];
const monthlyXml = buildSimplDeductionXml({ fiscalId: "10000001", periodStart: "2026-09-01", frequency: "monthly", regime: "encaissement", rows: fictionalRows });
const expectedMonthly = `<?xml version="1.0" encoding="UTF-8" ?><DeclarationReleveDeduction><identifiantFiscal>10000001</identifiantFiscal><annee>2026</annee><periode>9</periode><regime>1</regime><releveDeductions><rd><ord>1</ord><num>F-100</num><des>MATIERE FICTIVE</des><mht>4029.17</mht><tva>805.83</tva><ttc>4835</ttc><refF><if>20000001</if><nom>ATELIER FICTIF</nom><ice>001234567000089</ice></refF><tx>20</tx><mp><id>1</id></mp><dpai>2026-09-08</dpai><dfac>2026-09-08</dfac></rd><rd><ord>2</ord><num>F-101</num><des>FOURNITURE &amp; EMBALLAGE</des><mht>3220.5</mht><tva>644.1</tva><ttc>3864.6</ttc><refF><if>20000002</if><nom>STE &lt;DEMO&gt;</nom><ice>000000000000015</ice></refF><tx>20</tx><mp><id>4</id></mp><dpai>2026-09-19</dpai><dfac>2026-09-18</dfac></rd></releveDeductions></DeclarationReleveDeduction>`;
assert.equal(monthlyXml, expectedMonthly);
assert.equal(Buffer.from(monthlyXml, "utf8").equals(Buffer.from(expectedMonthly, "utf8")), true);

const quarterlyXml = buildSimplDeductionXml({
  fiscalId: "10000001",
  periodStart: "2026-04-01",
  frequency: "quarterly",
  regime: "debit",
  rows: [{ number: "T-1", description: "ACHAT FICTIF", baseHt: 1000, vat: 200, ttc: 1200, supplierIf: "30000001", supplierName: "FOURNISSEUR FICTIF", supplierIce: "001111111000011", taxRate: 20, prorataPercent: 100, paymentMode: "cash", paymentDate: "2026-05-02", invoiceDate: "2026-06-08" }],
});
assert.equal(quarterlyXml, `<?xml version="1.0" encoding="UTF-8" ?><DeclarationReleveDeduction><identifiantFiscal>10000001</identifiantFiscal><annee>2026</annee><periode>2</periode><regime>2</regime><releveDeductions><rd><ord>1</ord><num>T-1</num><des>ACHAT FICTIF</des><mht>1000</mht><tva>200</tva><ttc>1200</ttc><refF><if>30000001</if><nom>FOURNISSEUR FICTIF</nom><ice>001111111000011</ice></refF><tx>20</tx><mp><id>1</id></mp><dpai>2026-06-08</dpai><dfac>2026-06-08</dfac></rd></releveDeductions></DeclarationReleveDeduction>`);

const emptyXml = buildSimplDeductionXml({ fiscalId: "10000001", periodStart: "2026-01-01", frequency: "monthly", regime: "unspecified", rows: [] });
assert.equal(emptyXml, `<?xml version="1.0" encoding="UTF-8" ?><DeclarationReleveDeduction><identifiantFiscal>10000001</identifiantFiscal><annee>2026</annee><periode>1</periode><regime>1</regime><releveDeductions></releveDeductions></DeclarationReleveDeduction>`);
assert.equal(emptyXml.includes("\n") || emptyXml.endsWith("\n"), false);
assert.equal(monthlyXml.includes("<prorata>"), false);

const zip = simplDeductionZip(monthlyXml);
const name = "DeclarationReleveDeduction.xml";
assert.equal(zip.indexOf(name), 30);
const size = zip.readUInt32LE(18);
const payload = zip.subarray(30 + name.length, 30 + name.length + size);
assert.equal(payload[0], 0x3c);
assert.equal(payload.toString("utf8"), monthlyXml);
assert.equal(payload.includes(Buffer.from([0xef, 0xbb, 0xbf])), false);

assert.equal(simplPlainText("  MATIERE\r\nPREMIERE\tX\u0001 "), "MATIERE PREMIERE X");
assert.equal(casablancaIsoDate("2026-09-08"), "2026-09-08");
assert.equal(casablancaIsoDate("2026-09-07T23:30:00.000Z"), "2026-09-08");
assert.deepEqual(officialSimplFiling("2026-09-01", "monthly", "2026-09-30"), { annee: "2026", periode: "9", regime: "1" });
assert.deepEqual(officialSimplFiling("2026-04-01", "quarterly", "2026-06-30"), { annee: "2026", periode: "2", regime: "2" });
assert.equal(officialSimplFiling("2026-06-30", "monthly", "2026-07-30"), null);
assert.equal(officialSimplFiling("2026-04-01", "quarterly", "2026-04-30"), null);
assert.match(simplDeductionIssues({
  fiscalId: "10000001",
  regime: "encaissement",
  periodStart: "2026-06-30",
  periodEnd: "2026-07-30",
  frequency: "monthly",
  line190: 0,
  rows: [],
})[0]?.message ?? "", /mois civil/);
assert.equal(buildSimplDeductionXml({ fiscalId: "10000001", periodStart: "2026-06-30", periodEnd: "2026-07-30", frequency: "monthly", regime: "encaissement", rows: [] }), "");

const robustRow = (overrides: Partial<SimplDeductionRow>): SimplDeductionRow => ({
  number: "F-200",
  description: "ACHAT",
  baseHt: 100,
  vat: 20,
  ttc: 120,
  supplierId: "sup-1",
  supplierIf: "20000001",
  supplierName: "ATELIER FICTIF",
  supplierIce: "001234567000089",
  taxRate: 20,
  prorataPercent: 100,
  paymentMode: "cash",
  paymentDate: "2026-09-08",
  invoiceDate: "2026-09-08",
  ...overrides,
});
const noisyXml = buildSimplDeductionXml({
  fiscalId: "10000001",
  periodStart: "2026-09-01",
  periodEnd: "2026-09-30",
  frequency: "monthly",
  regime: "encaissement",
  rows: [robustRow({
    description: "  ACHAT\r\nTEST\tX\u0001 ",
    supplierName: "  SOCIETE\n<DEMO> & CIE  ",
    baseHt: 10.005,
    vat: 2.004,
    ttc: 99,
    paymentDate: "2026-09-07T23:30:00.000Z",
    invoiceDate: "2026-09-07T23:30:00.000Z",
    paymentMode: "inconnu",
  })],
});
const noisyAmounts = balancedSimplAmounts(10.005, 2.004);
assert.equal(Number((noisyAmounts.mht + noisyAmounts.tva).toFixed(2)), noisyAmounts.ttc);
const expectedNoisy = `<?xml version="1.0" encoding="UTF-8" ?><DeclarationReleveDeduction><identifiantFiscal>10000001</identifiantFiscal><annee>2026</annee><periode>9</periode><regime>1</regime><releveDeductions><rd><ord>1</ord><num>F-200</num><des>ACHAT TEST X</des><mht>${officialAmount(noisyAmounts.mht)}</mht><tva>${officialAmount(noisyAmounts.tva)}</tva><ttc>${officialAmount(noisyAmounts.ttc)}</ttc><refF><if>20000001</if><nom>SOCIETE &lt;DEMO&gt; &amp; CIE</nom><ice>001234567000089</ice></refF><tx>20</tx><mp><id>7</id></mp><dpai>2026-09-08</dpai><dfac>2026-09-08</dfac></rd></releveDeductions></DeclarationReleveDeduction>`;
assert.equal(noisyXml, expectedNoisy);
assert.equal(noisyXml.includes("\n"), false);

const blankLabel = buildSimplDeductionXml({
  fiscalId: "10000001",
  periodStart: "2026-09-01",
  frequency: "monthly",
  regime: "encaissement",
  rows: [robustRow({ description: " \n\t " })],
});
assert.match(blankLabel, /<des>ACHAT<\/des>/);

const cashXml = buildSimplDeductionXml({
  fiscalId: "10000001",
  periodStart: "2026-09-01",
  frequency: "monthly",
  regime: "encaissement",
  rows: [robustRow({ paymentMode: "espèces" })],
});
assert.match(cashXml, /<mp><id>1<\/id><\/mp>/);

const multi = simplRowsFromPurchases([{
  id: "multi",
  documentType: "INVOICE",
  referenceNumber: "F-300",
  issueDate: "2026-09-03",
  supplierId: "sup-1",
  supplierName: "ATELIER FICTIF",
  supplierIf: "20000001",
  supplierIce: "001234567000089",
  description: "MULTI",
  currencySource: "MAD",
  paymentMode: "cash",
  paymentReference: null,
  paymentDate: "2026-09-03",
  taxBreakdown: [
    { taxRate: 20, baseHtMad: 1000, vatOnInvoiceMad: 200, deductibleVatMad: 200 },
    { taxRate: 10, baseHtMad: 500, vatOnInvoiceMad: 50, deductibleVatMad: 50 },
  ],
  totalTtcMad: 1750,
  paidAmountMad: 1750,
  importFlag: false,
  immobilizationFlag: false,
  accountingStatus: "posted",
}]);
assert.equal(multi.length, 2);
const multiXml = buildSimplDeductionXml({ fiscalId: "10000001", periodStart: "2026-09-01", frequency: "monthly", regime: "encaissement", rows: multi });
assert.equal(multiXml, `<?xml version="1.0" encoding="UTF-8" ?><DeclarationReleveDeduction><identifiantFiscal>10000001</identifiantFiscal><annee>2026</annee><periode>9</periode><regime>1</regime><releveDeductions><rd><ord>1</ord><num>F-300</num><des>MULTI</des><mht>1000</mht><tva>200</tva><ttc>1200</ttc><refF><if>20000001</if><nom>ATELIER FICTIF</nom><ice>001234567000089</ice></refF><tx>20</tx><mp><id>1</id></mp><dpai>2026-09-03</dpai><dfac>2026-09-03</dfac></rd><rd><ord>2</ord><num>F-300</num><des>MULTI</des><mht>500</mht><tva>50</tva><ttc>550</ttc><refF><if>20000001</if><nom>ATELIER FICTIF</nom><ice>001234567000089</ice></refF><tx>10</tx><mp><id>1</id></mp><dpai>2026-09-03</dpai><dfac>2026-09-03</dfac></rd></releveDeductions></DeclarationReleveDeduction>`);

const creditXml = buildSimplDeductionXml({
  fiscalId: "10000001",
  periodStart: "2026-09-01",
  frequency: "monthly",
  regime: "encaissement",
  rows: [robustRow({ number: "AV-1", description: "AVOIR", baseHt: -150.004, vat: -30.004, ttc: -1, taxRate: 20 })],
});
assert.match(creditXml, /<mht>-150<\/mht><tva>-30<\/tva><ttc>-180<\/ttc>/);
assert.equal(creditXml.includes("\n"), false);

const invalidIdentity = simplDeductionIssues({
  fiscalId: "IF12",
  regime: "encaissement",
  periodStart: "2026-09-01",
  periodEnd: "2026-09-30",
  frequency: "monthly",
  line190: 20,
  rows: [robustRow({ supplierIf: "AB", supplierIce: "12345", taxRate: Number.NaN }), robustRow({ number: "F-201", supplierIce: "", taxRate: 15 })],
});
assert.ok(invalidIdentity.some((issue) => issue.code === "COMPANY_IF" && issue.href === "/parametres/entreprise"));
assert.ok(invalidIdentity.some((issue) => issue.code === "SUPPLIER_IF" && issue.href === "/tiers/sup-1" && issue.message.includes("1 facture")));
assert.ok(invalidIdentity.some((issue) => issue.code === "SUPPLIER_ICE" && issue.message.includes("étranger") && issue.message.includes("2 facture")));
assert.ok(invalidIdentity.some((issue) => issue.message.includes("taux de TVA absent")));
assert.ok(invalidIdentity.some((issue) => issue.message.includes("hors 7, 10, 14 et 20")));

const allocatedOnly = resolveUnallocatedPayments([
  { id: "inv", supplierId: "s1", allocations: [{ date: "2026-09-20", amount: 600, mode: "cheque" }], paidAmount: 600, status: "partially_paid", paymentStatus: "partial" },
], [{ id: "pay", supplierId: "s1", date: "2026-09-21", amount: 600, mode: "virement", reference: "VIR" }]);
assert.equal(allocatedOnly[0]?.unallocated, false);
assert.equal(allocatedOnly[0]?.payments.length, 1);
assert.equal(allocatedOnly[0]?.payments[0]?.amount, 600);

const datedRemainder = resolveUnallocatedPayments([
  { id: "inv", supplierId: "s1", allocations: [], paidAmount: 1200, status: "paid", paymentStatus: "paid" },
], [{ id: "pay", supplierId: "s1", date: "2026-09-12", amount: 1200, mode: "cash", reference: "ESP" }]);
assert.equal(datedRemainder[0]?.unallocated, false);
assert.equal(datedRemainder[0]?.payments[0]?.date, "2026-09-12");
assert.equal(selectPurchaseDeduction(purchase({
  id: "inv",
  number: "FF-UNALLOC",
  invoiceDate: "2026-08-02",
  totalTtc: 1200,
  lines: [{ taxRate: 20, baseHt: 1000, vat: 200, ttc: 1200 }],
  payments: datedRemainder[0]?.payments ?? [],
}), september, "encaissement").deductibleVat, 200);

const ambiguous = resolveUnallocatedPayments([
  { id: "inv", supplierId: "s1", allocations: [], paidAmount: 1200, status: "paid", paymentStatus: "paid" },
], [
  { id: "a", supplierId: "s1", date: "2026-09-01", amount: 600, mode: "cash", reference: null },
  { id: "b", supplierId: "s1", date: "2026-09-02", amount: 600, mode: "cash", reference: null },
]);
assert.equal(ambiguous[0]?.unallocated, true);
assert.equal(ambiguous[0]?.payments.length, 0);
const secondUse = resolveUnallocatedPayments([
  { id: "one", supplierId: "s1", allocations: [], paidAmount: 100, status: "paid", paymentStatus: "paid" },
  { id: "two", supplierId: "s1", allocations: [], paidAmount: 100, status: "paid", paymentStatus: "paid" },
], [{ id: "only", supplierId: "s1", date: "2026-09-04", amount: 100, mode: "cash", reference: null }]);
assert.equal(secondUse[0]?.payments.length, 1);
assert.equal(secondUse[1]?.unallocated, true);
assert.equal(secondUse[1]?.payments.length, 0);

assert.equal(simplPaymentModeId("cash"), "1");
assert.equal(simplPaymentModeId("check"), "2");
assert.equal(simplPaymentModeId("direct_debit"), "3");
assert.equal(simplPaymentModeId("transfer"), "4");
assert.equal(simplPaymentModeId("bill_of_exchange"), "5");
assert.equal(simplPaymentModeId("compensation"), "6");
assert.equal(simplPaymentModeId("other"), "7");
assert.equal(simplPaymentModeId("bank_card"), "7");

const declarationId = "41b90309-8ca7-459f-a115-a847f9694053";
assert.equal(isLaunchPathAvailable("/comptabilite/tva/declarations/new"), true);
assert.equal(getLaunchDestination(`/comptabilite/tva/declarations/${declarationId}/releve-simpl`), null);
assert.equal(isLaunchPathAvailable("/comptabilite/tva/controle"), true);
assert.equal(isLaunchPathAvailable("/comptabilite/tva/periodicite"), true);
assert.equal(getLaunchDestination("/vente/devis"), "/parametres/modules");
assert.equal(getLaunchDestination("/comptabilite/tva/edi-simpl/fichier"), "/parametres/modules");
assert.equal(readFileSync("src/lib/tax/vat-declaration-actions.ts", "utf8").includes("requireProWorkspace"), false);
assert.equal(readFileSync("src/app/comptabilite/tva/declarations/[id]/releve-simpl/route.ts", "utf8").includes("hasFullErpAccess"), false);
assert.equal(readFileSync("src/app/comptabilite/tva/edi-simpl/fichier/route.ts", "utf8").includes("hasFullErpAccess"), true);
const migration = readFileSync("supabase/migrations/155_essentiel_vat_filing.sql", "utf8");
assert.match(migration, /drop policy if exists pro_read_guard_110 on public\.vat_declarations/);
assert.doesNotMatch(migration, /sales_quotes/);
assert.match(migration, /revoke all on function public\.get_organization_vat_filing\(uuid\) from public, anon/);
assert.match(migration, /revoke all on public\.vat_declarations from anon/);
const essentialZip = simplDeductionZip(monthlyXml);
assert.equal(essentialZip.subarray(30 + name.length, 30 + name.length + size).toString("utf8"), expectedMonthly);

console.log("TVA : déduction par règlement, avoirs, immobilisations, SIMPL et XML contrôlés.");
