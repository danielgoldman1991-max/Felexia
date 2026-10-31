import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { calculateExactLine } from "../../../src/lib/e-invoicing/calculations";
import { decimalScaled, decimalText, divideRounded } from "../../../src/lib/e-invoicing/decimal";
import { validateEInvoiceSnapshot } from "../../../src/lib/e-invoicing/validation";
import { prepareEInvoice, canonicalSnapshotJson } from "../../../src/lib/e-invoicing/ubl";
import { canonicalizeXml, validateUblXml, xmlRuntimeDiagnostics } from "../../../src/lib/e-invoicing/xml-runtime";
import { createEInvoiceConnector } from "../../../src/lib/e-invoicing/connector";
import type { EInvoiceSnapshotInput, EInvoicePreparationOptions } from "../../../src/lib/e-invoicing/types";

let checks = 0;
const check = (value: unknown, label: string) => { assert.ok(value, label); checks++; };
const input: EInvoiceSnapshotInput = {
  organizationId: "10000000-0000-4000-8000-000000000001", sourceId: "20000000-0000-4000-8000-000000000001", sourceType: "customer_invoice", number: "FAC-2610-00001", issueDate: "2026-10-31", dueDate: "2026-11-30", currency: "MAD",
  seller: { name: "Entreprise fictive & Associés", address: "1 rue de la Recette", city: "Casablanca", countryCode: "MA", ice: "001234567890123", ifNumber: "12345678", rc: "12345" },
  buyer: { name: "عميل تجريبي", address: "عنوان الاختبار", countryCode: "MA", ice: "009876543210987" },
  lines: [{ id: "line-1", description: "Service français & عربي <test>", quantity: "2.000", unitPriceHt: "100.00", discountRate: "10.00", taxRate: "20.00", sourceAmounts: { subtotalHt: "180.00", discountAmount: "20.00", taxAmount: "36.00", totalTtc: "216.00" } }],
  sourceTotals: { subtotalHt: "180.00", discountTotal: "20.00", taxTotal: "36.00", totalTtc: "216.00" },
  notes: "Note publique", paymentTerms: "30 jours",
};
const options: EInvoicePreparationOptions = { buyerType: "business", lineMetadata: { "line-1": { unitCode: "C62", taxCategory: "S" } } };
const clone = <T,>(value: T): T => structuredClone(value);
async function main() {
  const originalFetch = globalThis.fetch;
  let networkAttempts = 0;
  globalThis.fetch = async () => { networkAttempts++; throw new Error("DOMAIN_NETWORK_FORBIDDEN"); };
  try {
  check(decimalText(decimalScaled("1.005", 2), 2) === "1.01", "Positive decimal tie is exact");
  check(decimalText(decimalScaled("-1.005", 2), 2) === "-1.01", "Negative decimal tie matches PostgreSQL");
  check(divideRounded(BigInt("5"), BigInt("2")) === BigInt("3") && divideRounded(-BigInt("5"), BigInt("2")) === -BigInt("3"), "Exact signed rounded division");
  for (const value of [1.23, "1e2", "1,23", "NaN", "Infinity", " 1.00", "01.00"]) { assert.throws(() => decimalScaled(value, 2)); checks++; }
  check(calculateExactLine({ ...input.lines[0], quantity: "1.500", unitPriceHt: "0.03", discountRate: "0.00" }).totalTtc === "0.06", "Fractional small amount rounds gross before VAT");
  check(calculateExactLine({ ...input.lines[0], quantity: "3", unitPriceHt: "9.99", discountRate: "12.50" }).totalTtc === "31.46", "Discount is rounded once before VAT");
  const validated = validateEInvoiceSnapshot(input, options);
  check(validated.valid && validated.snapshot?.totals.payableAmount === "216.00" && validated.snapshot.totals.allowanceTotalAmount === "0.00", "Net customer totals never subtract discount twice");
  const badTotal = clone(input); badTotal.sourceTotals.totalTtc = "215.99";
  check(!validateEInvoiceSnapshot(badTotal, options).valid, "Source total mismatch blocks preparation");
  const badLine = clone(input); badLine.lines[0].sourceAmounts!.taxAmount = "35.99";
  check(!validateEInvoiceSnapshot(badLine, options).valid, "Source line mismatch blocks preparation");
  const zero = clone(input); zero.lines[0] = { ...zero.lines[0], taxRate: "0", sourceAmounts: undefined }; zero.sourceTotals = { subtotalHt: "180", discountTotal: "20", taxTotal: "0", totalTtc: "180" };
  check(!validateEInvoiceSnapshot(zero, { buyerType: "business" }).valid, "Zero VAT never invents an exemption");
  check(validateEInvoiceSnapshot(zero, { buyerType: "business", lineMetadata: { "line-1": { taxCategory: "E", exemptionReason: "Motif explicite de recette" } } }).valid, "Explicit zero-rate category and reason are supported");
  check(!validateEInvoiceSnapshot({ ...input, direction: "inbound" }, options).valid, "Supplier invoices cannot be reissued by this module");
  const noIce = clone(input); noIce.buyer.ice = null;
  check(!validateEInvoiceSnapshot(noIce, options).valid && validateEInvoiceSnapshot(noIce, { ...options, buyerType: "consumer" }).valid, "Buyer ICE depends on explicit professional/B2C profile");
  check(!validateEInvoiceSnapshot({ ...input, issueDate: "2026-02-30" }, options).valid, "Invalid calendar dates are rejected");
  check(!validateEInvoiceSnapshot({ ...input, notes: "Interdit\u0000" }, options).valid, "Invalid XML control characters in notes are rejected before serialization");
  check(!validateEInvoiceSnapshot({ ...input, notes: "Interdit\ud800" }, options).valid, "Unpaired UTF16 surrogates cannot be silently replaced during UTF8 conversion");
  check(!validateEInvoiceSnapshot(input, { ...options, requireSellerRc: true, lineMetadata: { "line-1": { taxCategory: "E" } } }).valid, "Tax category cannot contradict a positive VAT rate");
  const rcMissing = clone(input); rcMissing.seller.rc = null;
  check(!validateEInvoiceSnapshot(rcMissing, { ...options, requireSellerRc: true }).valid, "Configured seller RC requirement is enforced");
  const artifact = await prepareEInvoice(input, options);
  check(artifact.validation.valid, "Real fifteen-schema UBL invoice validation passes");
  check(artifact.xml.includes("عميل تجريبي") && artifact.xml.includes("&lt;test&gt;"), "French and Arabic survive UTF8 with XML escaping");
  check(artifact.xml.includes('PrepaidAmount currencyID="MAD">0.00') && artifact.xml.includes('PayableAmount currencyID="MAD">216.00'), "Payments cannot change immutable fiscal payable values");
  const credit = await prepareEInvoice({ ...input, sourceType: "customer_credit_note", number: "AV-2610-00001", originalInvoiceReference: input.number, reason: "Correction de recette" }, options);
  check(credit.validation.valid && credit.xml.includes("CreditedQuantity") && credit.xml.includes("BillingReference"), "Real UBL CreditNote schema and original invoice reference pass");
  const exempt = await prepareEInvoice(zero, { buyerType: "business", lineMetadata: { "line-1": { unitCode: "C62", taxCategory: "E", exemptionReason: "Motif explicite de recette" } } });
  check(exempt.validation.valid && exempt.xml.includes("TaxExemptionReason"), "Explicit exemption passes the real UBL schema");
  const mixed = clone(input);
  mixed.lines.push({ id: "line-2", description: "Second taux", quantity: "1", unitPriceHt: "50", discountRate: "0", taxRate: "10" });
  mixed.sourceTotals = { subtotalHt: "230", discountTotal: "20", taxTotal: "41", totalTtc: "271" };
  const mixedArtifact = await prepareEInvoice(mixed, options);
  check(mixedArtifact.validation.valid && mixedArtifact.snapshot.taxSubtotals.length === 2 && mixedArtifact.snapshot.totals.totalTtc === "271.00", "Different VAT rates have exact independent bases and taxes");
  const long = clone(input);
  long.lines = Array.from({ length: 500 }, (_, i) => ({ ...input.lines[0], id: "line-" + i }));
  long.sourceTotals = { subtotalHt: "90000.00", discountTotal: "10000.00", taxTotal: "18000.00", totalTtc: "108000.00" };
  check((await prepareEInvoice(long, { buyerType: "business" })).validation.valid, "Five hundred lines pass real XSD and exact aggregation within resource bounds");
  long.lines.push({ ...input.lines[0], id: "line-501" });
  check(!validateEInvoiceSnapshot(long, options).valid, "Five hundred and one lines are refused");
  check((await prepareEInvoice(input, options)).canonicalSha256 === artifact.canonicalSha256, "Repeated preparation is deterministic");
  check(canonicalSnapshotJson({ b: "2", a: "1" }) === canonicalSnapshotJson({ a: "1", b: "2" }), "Snapshot hash has stable key ordering");
  check(!artifact.signed && !artifact.officialConformityClaim, "Generic artifact claims neither signature nor official conformity");
  check(!(await validateUblXml(artifact.xml.replace(/<cbc:ID>FAC-2610-00001<\/cbc:ID>/, ""), "customer_invoice")).valid, "Well-formed XML missing mandatory ID fails real XSD");
  check(!(await validateUblXml('<!DOCTYPE Invoice [<!ENTITY x SYSTEM "file:///private">]><Invoice>&x;</Invoice>', "customer_invoice")).valid, "DTD and local-file XXE are rejected");
  check(!(await validateUblXml('<!DOCTYPE Invoice SYSTEM "https://attacker.invalid/dtd"><Invoice/>', "customer_invoice")).valid, "Network external DTD is rejected");
  check(!(await validateUblXml("x".repeat(2000001), "customer_invoice")).valid, "XML size bound is enforced");
  check(await canonicalizeXml('<a z="2" b="1"><b/></a>') === await canonicalizeXml('<a b="1" z="2"><b></b></a>'), "Real C14N normalizes attributes and empty elements");
  check(await canonicalizeXml('<a><!-- comment -->عربي</a>') === await canonicalizeXml('<a>عربي</a>'), "Configured C14N excludes comments and preserves Arabic");
  const disabled = createEInvoiceConnector();
  await assert.rejects(() => disabled.submit(artifact, { idempotencyKey: "qa" }), /CONNECTOR_DISABLED/); checks++;
  await assert.rejects(() => createEInvoiceConnector("official").submit(artifact, { idempotencyKey: "qa" }), /DGI_OFFICIAL/); checks++;
  await assert.rejects(() => disabled.sign(), /SIGNATURE_PROVIDER_NOT_CONFIGURED/); checks++;
  const simulation = createEInvoiceConnector("simulation");
  const receipt = await simulation.submit(artifact, { idempotencyKey: "qa" });
  check(receipt.simulation && receipt.authority === "FELEXIA_INTERNAL_SIMULATION" && receipt.acknowledgement.startsWith("SIMULATED"), "Internal simulation never masquerades as DGI acceptance");
  check((await simulation.submit(artifact, { idempotencyKey: "qa" })).reference === receipt.reference, "Simulation submission is idempotent");
  await assert.rejects(() => simulation.submit(credit, { idempotencyKey: "qa" }), /IDEMPOTENCY_DOCUMENT_MISMATCH/); checks++;
  check((await simulation.submit(credit, { idempotencyKey: "reject", outcome: "rejected" })).status === "rejected", "Simulation rejection is explicit");
  check((await simulation.submit(credit, { idempotencyKey: "unknown", outcome: "unknown" })).status === "unknown", "An unknown simulated outcome does not invent acceptance");
  await assert.rejects(() => simulation.submit(artifact, { idempotencyKey: "retry", outcome: "temporary_failure" }), /SIMULATION_TEMPORARY_FAILURE/); checks++;
  check((await simulation.submit(artifact, { idempotencyKey: "retry", outcome: "temporary_failure" })).status === "accepted", "Retry after a simulated transient failure is deterministic");
  await assert.rejects(() => simulation.submit(artifact, { idempotencyKey: "timeout", outcome: "timeout" }), /SIMULATION_TIMEOUT/); checks++;
  check(createEInvoiceConnector("simulation").reconcile(receipt).reference === receipt.reference, "Restart can reconcile a persisted simulated receipt without network");
  const runtime = await xmlRuntimeDiagnostics();
  check(runtime.schemaCount === 15 && runtime.externalResourceAttempts === 0 && runtime.networkRequests === 0, "Closed schema loader uses all local dependencies with zero network");
  check(networkAttempts === 0, "Network-disabled execution includes library initialization, XSD imports and all connector methods");
  const report = { success: true, checks, runtime, observedNetworkAttempts: networkAttempts, scope: "Real decimal/UBL/XSD/C14N domain; synthetic business fixtures and connector outcomes; no database, credentials, DGI or network" };
  writeFileSync(new URL("domain-tests.json", import.meta.url), JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify(report));
  } finally { globalThis.fetch = originalFetch; }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
