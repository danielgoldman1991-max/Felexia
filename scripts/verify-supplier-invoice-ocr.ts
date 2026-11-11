import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { deflateSync } from "zlib";
import PDFDocument from "pdfkit";
import {
  SCAN_MAX_BYTES,
  assertPendingScanPath,
  inspectScanFile,
  lineTotals,
  matchSupplier,
  normalizeOcrPayload,
  parseInvoiceText,
  pdfPageCount,
  reviewOcrInvoice,
  validateNewSupplier,
} from "../src/lib/purchases/supplier-invoice-ocr";
import { invoiceFromMistralResponse, mistralDocumentBody } from "../src/lib/purchases/supplier-invoice-ocr-provider";

const SAMPLE = [
  "Fournisseur: Atelier Démo SARL",
  "ICE: 001234567000018",
  "IF: 12345678",
  "RC: 98765",
  "Facture: FF-DEMO-0001",
  "Date: 12/03/2026",
  "Échéance: 11/04/2026",
  "Câble démo | 2 | 100,00 | 20",
  "Total HT: 200,00",
  "TVA 20%: 40,00",
  "Total TTC: 240,00",
  "Adresse: 1 rue Démo, Casablanca",
  "Téléphone: 0522000000",
  "Email: contact@exemple.test",
  "MAD",
].join("\n");

const parsed = parseInvoiceText(SAMPLE);
assert.equal(parsed.supplierName, "Atelier Démo SARL");
assert.equal(parsed.ice, "001234567000018");
assert.equal(parsed.ifNumber, "12345678");
assert.equal(parsed.rc, "98765");
assert.equal(parsed.invoiceNumber, "FF-DEMO-0001");
assert.equal(parsed.address, "1 rue Démo, Casablanca");
assert.equal(parsed.phone, "0522000000");
assert.equal(parsed.email, "contact@exemple.test");
assert.equal(parsed.invoiceDate, "2026-03-12");
assert.equal(parsed.dueDate, "2026-04-11");
assert.equal(parsed.lines[0]?.vatRate, 20);
assert.deepEqual(lineTotals(parsed.lines), { ht: 200, vat: 40, ttc: 240 });
assert.equal(reviewOcrInvoice(parsed).warnings.length, 0);

const broken = parseInvoiceText("Fournisseur: Atelier Démo SARL\nICE: 123\nFacture: FF-DEMO-0002\nCâble démo | 2 | 100,00 | 20\nTotal HT: 10,00\nTotal TTC: 10,00\nEUR");
const warnings = reviewOcrInvoice(broken).warnings;
assert.equal(warnings.some((item) => item.includes("15 chiffres")), true);
assert.equal(warnings.some((item) => item.includes("somme des lignes")), true);
assert.equal(warnings.some((item) => item.includes("pas en MAD")), true);

const parties = [{ id: "a", name: "Atelier Démo SARL", ice: "001234567000018" }, { id: "b", name: "Autre", ice: null }];
assert.equal(matchSupplier({ name: "Inconnu", ice: "001234567000018" }, parties).status, "matched");
assert.equal(matchSupplier({ name: "Atelier Démo SARL", ice: "" }, parties).status, "matched");
assert.equal(matchSupplier({ name: "Nouveau fournisseur", ice: "" }, parties).status, "new");
assert.equal(validateNewSupplier({ name: "", ice: "", email: "" }), "Le nom du fournisseur est obligatoire.");
assert.equal(validateNewSupplier({ name: "Atelier Démo", ice: "123", email: "" })?.includes("15 chiffres"), true);
assert.equal(validateNewSupplier({ name: "Atelier Démo", ice: "001234567000018", email: "contact@exemple.test" }), null);

const fromModel = invoiceFromMistralResponse({ document_annotation: JSON.stringify({ supplierName: "Atelier Démo SARL", ice: "001234567000018", ifNumber: "", rc: "", invoiceNumber: "FF-DEMO-0001", invoiceDate: "2026-03-12", dueDate: "", currency: "MAD", totalHt: 200, totalVat: 40, totalTtc: 240, vatByRate: [{ rate: 20, amount: 40 }], lines: [{ description: "Câble démo", quantity: 2, unitPriceHt: 100, vatRate: 20 }] }) });
assert.equal(fromModel.confidence.invoiceNumber, 0.9);
assert.equal(invoiceFromMistralResponse({ pages: [{ markdown: SAMPLE }] }).ice, "001234567000018");
const body = mistralDocumentBody("application/pdf", Buffer.from("%PDF").toString("base64"));
assert.equal(JSON.stringify(body).includes("MISTRAL_API_KEY"), false);
assert.throws(() => assertPendingScanPath("organizations/autre/pending/a.pdf", "mon-org"), /entreprise/);
assert.equal(inspectScanFile({ name: "photo.jpg", type: "image/jpeg", size: SCAN_MAX_BYTES + 1 }), "Le fichier dépasse 10 Mo.");
assert.equal(normalizeOcrPayload(fromModel).totalTtc, 240);

const source = readFileSync("src/lib/purchases/supplier-invoice-ocr-actions.ts", "utf8");
assert.equal(source.includes("p_organization_id: current.organization.id"), true);
assert.equal(source.includes("save_supplier_invoice_atomic"), true);
assert.equal(source.includes("validateSupplierInvoice"), false);
assert.equal(source.includes("La facture ne peut pas être enregistrée sans fournisseur."), true);
assert.equal(/from\("third_parties"\)\.insert/.test(source), false);
assert.equal(readFileSync("src/lib/third-party-actions.ts", "utf8").includes("createSupplierForOcr"), true);
assert.equal(readFileSync("src/lib/third-party-actions.ts", "utf8").includes("blockDuplicates"), true);
assert.equal(readFileSync("src/app/achats/factures/importer/page.tsx", "utf8").includes("module: \"achats\""), true);
assert.equal(/sk-|MISTRAL_API_KEY\s*=\s*['"][^'"]+/.test(readFileSync("src/lib/purchases/supplier-invoice-ocr-provider.ts", "utf8")), false);

void buildSamples().then(() => console.log("supplier invoice ocr: ok"));

async function buildSamples() {
  const pdf = await new Promise<Buffer>((resolve) => {
    const doc = new PDFDocument({ size: "A4" });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.fontSize(14).text(SAMPLE.replace(/\|/g, "  "));
    doc.end();
  });
  assert.equal(pdf.subarray(0, 4).toString("ascii"), "%PDF");
  assert.equal(pdfPageCount(pdf) >= 1, true);
  assert.equal(inspectScanFile({ name: "facture-demo.pdf", type: "application/pdf", size: pdf.length, bytes: pdf }), null);
  const png = invoicePng(["ATELIER DEMO", "ICE 001234567000018", "FF-DEMO-0001", "200.00 MAD"]);
  assert.equal(png.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
  assert.equal(inspectScanFile({ name: "facture-demo.png", type: "image/png", size: png.length, bytes: png }), null);
}

const GLYPHS: Record<string, string[]> = {
  " ": ["00000", "00000", "00000", "00000", "00000", "00000", "00000"],
  A: ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
  D: ["11110", "10001", "10001", "10001", "10001", "10001", "11110"],
  E: ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
  F: ["11111", "10000", "10000", "11110", "10000", "10000", "10000"],
  I: ["11111", "00100", "00100", "00100", "00100", "00100", "11111"],
  L: ["10000", "10000", "10000", "10000", "10000", "10000", "11111"],
  M: ["10001", "11011", "10101", "10001", "10001", "10001", "10001"],
  O: ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
  R: ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
  T: ["11111", "00100", "00100", "00100", "00100", "00100", "00100"],
  "0": ["01110", "10001", "10011", "10101", "11001", "10001", "01110"],
  "1": ["00100", "01100", "00100", "00100", "00100", "00100", "01110"],
  "2": ["01110", "10001", "00001", "00010", "00100", "01000", "11111"],
  "3": ["11110", "00001", "00001", "01110", "00001", "00001", "11110"],
  "4": ["00010", "00110", "01010", "10010", "11111", "00010", "00010"],
  "5": ["11111", "10000", "10000", "11110", "00001", "00001", "11110"],
  "6": ["01110", "10000", "10000", "11110", "10001", "10001", "01110"],
  "7": ["11111", "00001", "00010", "00100", "01000", "01000", "01000"],
  "8": ["01110", "10001", "10001", "01110", "10001", "10001", "01110"],
  "9": ["01110", "10001", "10001", "01111", "00001", "00001", "01110"],
  "-": ["00000", "00000", "00000", "11111", "00000", "00000", "00000"],
  ".": ["00000", "00000", "00000", "00000", "00000", "01100", "01100"],
};

function invoicePng(lines: string[]) {
  const width = 280;
  const height = 120;
  const raw = Buffer.alloc((width * 3 + 1) * height, 255);
  lines.forEach((line, row) => drawText(raw, width, 8, 16 + row * 22, line));
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  return Buffer.concat([signature, chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}

function drawText(raw: Buffer, width: number, x: number, y: number, text: string) {
  let cursor = x;
  for (const char of text.toUpperCase()) {
    const glyph = GLYPHS[char] ?? GLYPHS[" "];
    glyph.forEach((bits, row) => {
      for (let column = 0; column < bits.length; column += 1) {
        if (bits[column] !== "1") continue;
        const pixel = (y + row) * (width * 3 + 1) + 1 + (cursor + column) * 3;
        raw[pixel] = 20; raw[pixel + 1] = 33; raw[pixel + 2] = 61;
      }
    });
    cursor += 6;
  }
}

function chunk(type: string, data: Buffer) {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(data.length, 0);
  head.write(type, 4, "ascii");
  const crc = crc32(Buffer.concat([Buffer.from(type), data]));
  const tail = Buffer.alloc(4);
  tail.writeUInt32BE(crc, 0);
  return Buffer.concat([head, data, tail]);
}

const CRC_TABLE = new Uint32Array(256);
for (let index = 0; index < 256; index += 1) {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) value = (value & 1) ? (0xedb88320 ^ (value >>> 1)) : (value >>> 1);
  CRC_TABLE[index] = value >>> 0;
}
function crc32(data: Buffer) {
  let crc = 0xffffffff;
  for (const byte of data) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}
