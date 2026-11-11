import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { performance } from "node:perf_hooks";
import PDFDocument from "pdfkit";
import { parseInvoiceDocument, parseInvoiceText } from "../src/lib/purchases/invoice-parser";
import { tokensFromPdfItems } from "../src/lib/purchases/pdf-tokens";
import { inspectScanFile, lineTotals, matchSupplier, reviewOcrInvoice, validateNewSupplier, SCAN_MAX_BYTES } from "../src/lib/purchases/supplier-invoice-ocr";

const BUYER = "003456789000021";
const FONT = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf";

const sample = [
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
const parsed = parseInvoiceText(sample);
assert.equal(parsed.supplierName, "Atelier Démo SARL");
assert.equal(parsed.ice, "001234567000018");
assert.equal(parsed.invoiceNumber, "FF-DEMO-0001");
assert.equal(parsed.invoiceDate, "2026-03-12");
assert.equal(parsed.dueDate, "2026-04-11");
assert.deepEqual(lineTotals(parsed.lines), { ht: 200, vat: 40, ttc: 240 });
assert.equal(reviewOcrInvoice(parsed).warnings.length, 0);
assert.equal(reviewOcrInvoice(parseInvoiceText("Fournisseur: Atelier\nICE: 123\nCâble | 2 | 100,00 | 20\nTotal HT: 10,00\nTotal TTC: 10,00\nEUR")).warnings.some((item) => item.includes("15 chiffres")), true);
assert.equal(matchSupplier({ name: "Inconnu", ice: "001234567000018" }, [{ id: "a", name: "Atelier", ice: "001234567000018" }]).status, "matched");
assert.equal(validateNewSupplier({ name: "", ice: "", email: "" }), "Le nom du fournisseur est obligatoire.");
assert.equal(readFileSync("src/lib/purchases/read-invoice-file.ts", "utf8").includes("mistral.ai"), false);
assert.equal(existsSync("src/lib/purchases/supplier-invoice-ocr-provider.ts"), false);
assert.equal(inspectScanFile({ name: "photo.jpg", type: "image/jpeg", size: SCAN_MAX_BYTES + 1 }), "Le fichier dépasse 10 Mo.");

type Line = { description: string; quantity: number; unitPriceHt: number; vatRate: number };
type Fixture = {
  id: string;
  supplierName: string;
  ice: string;
  ifNumber: string;
  rc: string;
  patente: string;
  cnss: string;
  address: string;
  phone: string;
  email: string;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  dateLabel: string;
  dueLabel: string;
  lines: Line[];
  buyer?: boolean;
};

const fixtures: Fixture[] = [
  fixture("classique", { supplierName: "Atlas Négoce SARL", ice: "001111111000011", ifNumber: "11111111", rc: "554433", patente: "35678109", cnss: "1234567", invoiceNumber: "FAC-1001", invoiceDate: "2026-03-12", dueDate: "2026-04-11", dateLabel: "12/03/2026", dueLabel: "11/04/2026", lines: [{ description: "Câble cuivre", quantity: 2, unitPriceHt: 100, vatRate: 20 }] }),
  fixture("deux-taux", { supplierName: "Beta Fournitures SA", ice: "002222222000022", ifNumber: "22222222", rc: "778899", invoiceNumber: "FF-2026-14", invoiceDate: "2026-01-05", dueDate: "2026-02-04", dateLabel: "05/01/2026", dueLabel: "04/02/2026", lines: [{ description: "Papier A4", quantity: 10, unitPriceHt: 25, vatRate: 20 }, { description: "Cahier", quantity: 4, unitPriceHt: 15, vatRate: 10 }] }),
  fixture("sans-ice", { supplierName: "Gamma Services", ice: "", ifNumber: "33333333", rc: "101010", invoiceNumber: "GS-77", invoiceDate: "2026-06-01", dueDate: "2026-06-30", dateLabel: "01/06/2026", dueLabel: "30/06/2026", lines: [{ description: "Prestation conseil", quantity: 1, unitPriceHt: 1500, vatRate: 20 }] }),
  fixture("date-ecrite", { supplierName: "Delta Import SARL", ice: "004444444000044", ifNumber: "44444444", rc: "246810", invoiceNumber: "DI-12", invoiceDate: "2026-11-12", dueDate: "2026-12-12", dateLabel: "12 novembre 2026", dueLabel: "12 décembre 2026", lines: [{ description: "Roulement", quantity: 3, unitPriceHt: 80, vatRate: 20 }] }),
  fixture("grands-montants", { supplierName: "Epsilon Acier SA", ice: "005555555000055", ifNumber: "55555555", rc: "998877", invoiceNumber: "EA-900", invoiceDate: "2026-07-20", dueDate: "2026-08-19", dateLabel: "20/07/2026", dueLabel: "19/08/2026", lines: [{ description: "Tôle", quantity: 8, unitPriceHt: 154.32, vatRate: 14 }, { description: "Vis", quantity: 100, unitPriceHt: 1.5, vatRate: 7 }] }),
  fixture("trois-lignes", { supplierName: "Zeta Bureau SARL AU", ice: "006666666000066", ifNumber: "66666666", rc: "135790", invoiceNumber: "ZB-3", invoiceDate: "2026-02-02", dueDate: "2026-03-04", dateLabel: "02/02/2026", dueLabel: "04/03/2026", lines: [{ description: "Stylo", quantity: 20, unitPriceHt: 4.5, vatRate: 20 }, { description: "Classeur", quantity: 6, unitPriceHt: 18, vatRate: 20 }, { description: "Ramette", quantity: 5, unitPriceHt: 32, vatRate: 20 }] }),
  fixture("acheteur-a-droite", { supplierName: "Eta Logistique SARL", ice: "007777777000077", ifNumber: "77777777", rc: "864200", invoiceNumber: "EL-44", invoiceDate: "2026-09-09", dueDate: "2026-10-09", dateLabel: "09/09/2026", dueLabel: "09/10/2026", lines: [{ description: "Transport", quantity: 1, unitPriceHt: 900, vatRate: 14 }], buyer: true }),
];

void run();

async function run() {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs").catch(() => import("pdfjs-dist"));
  const scores: Record<string, { hit: number; total: number }> = {};
  const started = performance.now();
  for (const item of fixtures) {
    const pdfStarted = performance.now();
    const bytes = await renderPdf(item);
    const tokens = await tokensFromPdf(pdfjs, bytes);
    const actual = parseInvoiceDocument(tokens, { buyerIce: item.buyer ? BUYER : "" });
    const elapsed = performance.now() - pdfStarted;
    const row = compare(item, actual);
    for (const [field, ok] of Object.entries(row)) add(scores, field, ok);
    const missed = Object.entries(row).filter((entry) => !entry[1]).map((entry) => entry[0]);
    assert.equal(missed.length, 0, `${item.id} manquant: ${missed.join(", ")} / lu ${JSON.stringify({ name: actual.supplierName, ice: actual.ice, number: actual.invoiceNumber, ht: actual.totalHt, ttc: actual.totalTtc, lines: actual.lines })}`);
    console.log(`${item.id}: ${elapsed.toFixed(0)} ms, texte PDF`);
  }
  const imageDir = path.resolve("scripts/fixtures/ocr");
  mkdirSync(imageDir, { recursive: true });
  await writeImages(imageDir, fixtures[0]);
  const { createWorker } = await import("tesseract.js");
  const workerStarted = performance.now();
  const worker = await createWorker("fra+eng", 1, { langPath: path.resolve("public/ocr"), cachePath: path.resolve("public/ocr"), gzip: false });
  console.log(`démarrage OCR: ${(performance.now() - workerStarted).toFixed(0)} ms`);
  for (const name of ["scan-propre.png", "photo-tournee.png"]) {
    const imageStarted = performance.now();
    const recognized = await worker.recognize(path.join(imageDir, name));
    const tokens = (recognized.data.words ?? []).filter((word) => word.text.trim()).map((word) => ({ text: word.text, x: word.bbox.x0, y: word.bbox.y0, w: word.bbox.x1 - word.bbox.x0, h: word.bbox.y1 - word.bbox.y0 }));
    const actual = parseInvoiceDocument(tokens, { buyerIce: BUYER });
    const row = compare(fixtures[0], actual);
    for (const [field, ok] of Object.entries(row)) add(scores, `image:${field}`, ok);
    const missed = Object.entries(row).filter((entry) => !entry[1]).map((entry) => entry[0]);
    console.log(`${name}: ${(performance.now() - imageStarted).toFixed(0)} ms, manques: ${missed.join(", ") || "aucun"}`);
  }
  await worker.terminate();
  console.log(`lot numérique: ${(performance.now() - started).toFixed(0)} ms`);
  console.log("précision par champ:");
  for (const [field, score] of Object.entries(scores)) console.log(`  ${field}: ${score.hit}/${score.total} (${Math.round(100 * score.hit / score.total)} %)`);
  const assets = ["eng.traineddata", "fra.traineddata", "worker.min.js", "tesseract-core-simd-lstm.wasm", "tesseract-core-simd-lstm.wasm.js", "pdf.worker.min.mjs"];
  let bytes = 0;
  for (const asset of assets) bytes += statSync(path.join("public/ocr", asset)).size;
  console.log(`fichiers OCR locaux: ${(bytes / 1024 / 1024).toFixed(1)} Mo (hors bundle JS, servis par l’application)`);
  console.log("supplier invoice ocr: ok");
}

function fixture(id: string, value: Omit<Fixture, "id" | "address" | "phone" | "email" | "patente" | "cnss"> & Partial<Fixture>): Fixture {
  return { address: "1 rue Démo, Casablanca", phone: "0522000000", email: "contact@exemple.test", patente: "35678109", cnss: "1234567", ...value, id };
}

function compare(expected: Fixture, actual: ReturnType<typeof parseInvoiceDocument>) {
  const text = (field: "supplierName" | "ice" | "ifNumber" | "rc" | "patente" | "cnss" | "address" | "phone" | "email" | "invoiceNumber" | "invoiceDate" | "dueDate") => fold(actual[field]) === fold(expected[field]);
  const money = (field: "totalHt" | "totalVat" | "totalTtc", value: number) => actual[field] != null && Math.abs(actual[field] - value) <= 0.05;
  const totals = expected.lines.reduce((sum, line) => {
    const ht = round(line.quantity * line.unitPriceHt);
    const vat = round(ht * line.vatRate / 100);
    return { ht: round(sum.ht + ht), vat: round(sum.vat + vat), ttc: round(sum.ttc + ht + vat) };
  }, { ht: 0, vat: 0, ttc: 0 });
  const linesOk = expected.lines.length === actual.lines.length && expected.lines.every((line, index) => {
    const found = actual.lines[index];
    return Boolean(found) && fold(found.description).includes(fold(line.description).slice(0, 6)) && Math.abs(found.quantity - line.quantity) <= 0.01 && Math.abs(found.unitPriceHt - line.unitPriceHt) <= 0.05 && found.vatRate === line.vatRate;
  });
  return { fournisseur: text("supplierName"), ice: text("ice"), if: text("ifNumber"), rc: text("rc"), patente: text("patente"), cnss: text("cnss"), adresse: text("address"), telephone: text("phone"), email: text("email"), numero: text("invoiceNumber"), date: text("invoiceDate"), echeance: text("dueDate"), ht: money("totalHt", totals.ht), tva: money("totalVat", totals.vat), ttc: money("totalTtc", totals.ttc), lignes: linesOk };
}

function add(scores: Record<string, { hit: number; total: number }>, field: string, ok: boolean) {
  scores[field] ??= { hit: 0, total: 0 };
  scores[field].total += 1;
  if (ok) scores[field].hit += 1;
}

async function renderPdf(item: Fixture) {
  return new Promise<Buffer>((resolve) => {
    const doc = new PDFDocument({ size: "A4", margin: 40 });
    if (existsSync(FONT)) doc.font(FONT);
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    const text = (value: string, x: number, y: number) => doc.text(value, x, y, { lineBreak: false });
    text(item.supplierName, 40, 70);
    if (item.ice) text(`ICE : ${item.ice}`, 40, 90);
    text(`IF : ${item.ifNumber}`, 40, 108);
    text(`RC : ${item.rc}`, 40, 126);
    text(`Patente : ${item.patente}`, 40, 144);
    text(`CNSS : ${item.cnss}`, 40, 162);
    text(`Adresse : ${item.address}`, 40, 180);
    text(`Téléphone : ${item.phone}`, 40, 198);
    text(`Email : ${item.email}`, 40, 216);
    if (item.buyer) {
      text("Felexia Conseils", 340, 70);
      text(`ICE : ${BUYER}`, 340, 90);
      text("Client", 340, 108);
    }
    text(`Facture n° ${item.invoiceNumber}`, 40, 250);
    text(`Date : ${item.dateLabel}`, 40, 270);
    text(`Échéance : ${item.dueLabel}`, 40, 290);
    text("Désignation", 40, 330);
    text("Qté", 250, 330);
    text("PU HT", 310, 330);
    text("TVA", 400, 330);
    text("Montant", 470, 330);
    item.lines.forEach((line, index) => {
      const y = 354 + index * 20;
      text(line.description, 40, y);
      text(String(line.quantity), 250, y);
      text(fr(line.unitPriceHt), 310, y);
      text(String(line.vatRate), 400, y);
      text(fr(line.quantity * line.unitPriceHt), 470, y);
    });
    const totals = item.lines.reduce((sum, line) => {
      const ht = round(line.quantity * line.unitPriceHt);
      const vat = round(ht * line.vatRate / 100);
      sum.ht = round(sum.ht + ht);
      sum.byRate[line.vatRate] = round((sum.byRate[line.vatRate] ?? 0) + vat);
      return sum;
    }, { ht: 0, byRate: {} as Record<number, number> });
    let y = 354 + item.lines.length * 20 + 24;
    text(`Total HT : ${fr(totals.ht)}`, 310, y);
    for (const [rate, amount] of Object.entries(totals.byRate)) {
      y += 18;
      text(`TVA ${rate} % : ${fr(amount)}`, 310, y);
    }
    const vat = round(Object.values(totals.byRate).reduce((sum, amount) => sum + amount, 0));
    text(`Total TTC : ${fr(round(totals.ht + vat))} MAD`, 310, y + 18);
    doc.end();
  });
}

async function tokensFromPdf(pdfjs: typeof import("pdfjs-dist"), bytes: Buffer) {
  const params = { data: new Uint8Array(bytes), disableWorker: true, isEvalSupported: false, useSystemFonts: true };
  const document = await pdfjs.getDocument(params as never).promise;
  const tokens = [];
  let offset = 0;
  for (let index = 1; index <= document.numPages; index += 1) {
    const page = await document.getPage(index);
    const viewport = page.getViewport({ scale: 1 });
    const content = await page.getTextContent();
    tokens.push(...tokensFromPdfItems(content.items, viewport.height).map((token) => ({ ...token, y: token.y + offset })));
    offset += viewport.height + 40;
  }
  return tokens;
}

async function writeImages(directory: string, item: Fixture) {
  const clean = path.join(directory, "scan-propre.png");
  const turned = path.join(directory, "photo-tournee.png");
  if (existsSync(clean) && existsSync(turned)) return;
  const { spawnSync } = await import("node:child_process");
  const script = `
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import random
font = ImageFont.truetype(${JSON.stringify(FONT)}, 28)
small = ImageFont.truetype(${JSON.stringify(FONT)}, 24)
def paint(path, rotate, noise):
    image = Image.new("RGB", (1100, 1500), "white")
    draw = ImageDraw.Draw(image)
    lines = ${JSON.stringify(imageLines(item))}
    y = 80
    for line in lines:
        draw.text((70, y), line, fill="black", font=font if y < 500 else small)
        y += 42
    if rotate:
        image = image.rotate(rotate, expand=True, fillcolor="white")
    if noise:
        pixels = image.load()
        for n in range(8000):
            x = random.randrange(image.width); yy = random.randrange(image.height)
            pixels[x, yy] = (random.randint(80, 180),) * 3
        image = image.filter(ImageFilter.GaussianBlur(0.4))
    image.save(path)
paint(${JSON.stringify(clean)}, 0, False)
paint(${JSON.stringify(turned)}, 3, True)
`;
  const result = spawnSync("python3", ["-c", script], { stdio: "inherit" });
  if (result.status !== 0) throw new Error("Impossible de préparer les images fictives.");
  writeFileSync(path.join(directory, ".gitkeep"), "");
}

function imageLines(item: Fixture) {
  const totals = item.lines.reduce((sum, line) => {
    const ht = round(line.quantity * line.unitPriceHt);
    const vat = round(ht * line.vatRate / 100);
    sum.ht = round(sum.ht + ht);
    sum.byRate[line.vatRate] = round((sum.byRate[line.vatRate] ?? 0) + vat);
    return sum;
  }, { ht: 0, byRate: {} as Record<number, number> });
  const vat = round(Object.values(totals.byRate).reduce((sum, amount) => sum + amount, 0));
  return [item.supplierName, item.ice ? `ICE : ${item.ice}` : "", `IF : ${item.ifNumber}`, `RC : ${item.rc}`, `Patente : ${item.patente}`, `CNSS : ${item.cnss}`, `Adresse : ${item.address}`, `Telephone : ${item.phone}`, `Email : ${item.email}`, `Facture n° ${item.invoiceNumber}`, `Date : ${item.dateLabel}`, `Echeance : ${item.dueLabel}`, "Designation    Qte    PU HT    TVA    Montant", ...item.lines.map((line) => `${line.description}    ${line.quantity}    ${fr(line.unitPriceHt)}    ${line.vatRate}    ${fr(line.quantity * line.unitPriceHt)}`), `Total HT : ${fr(totals.ht)}`, ...Object.entries(totals.byRate).map(([rate, amount]) => `TVA ${rate} % : ${fr(amount)}`), `Total TTC : ${fr(round(totals.ht + vat))} MAD`].filter(Boolean);
}

function fr(value: number) {
  const [whole, decimal] = round(value).toFixed(2).split(".");
  return `${whole.replace(/\B(?=(\d{3})+(?!\d))/g, " ")},${decimal}`;
}
function round(value: number) { return Math.round((value + Number.EPSILON) * 100) / 100; }
function fold(value: string) { return value.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/[^a-z0-9]/g, ""); }
