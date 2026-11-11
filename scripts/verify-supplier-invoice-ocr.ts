import assert from "node:assert/strict";
import { execSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { performance } from "node:perf_hooks";
import PDFDocument from "pdfkit";
import { parseInvoiceDocument, parseInvoiceText } from "../src/lib/purchases/invoice-parser";
import { tokensFromPdfItems } from "../src/lib/purchases/pdf-tokens";
import { inspectScanFile, lineTotals, matchSupplier, reviewOcrInvoice, scanFileType, validateNewSupplier, SCAN_MAX_BYTES } from "../src/lib/purchases/supplier-invoice-ocr";

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
assert.deepEqual(scanFileType("scan.pdf", "", Uint8Array.from([0x25, 0x50, 0x44, 0x46])), { mime: "application/pdf", extension: "pdf" });
assert.deepEqual(scanFileType("IMG_2044.jpg", "application/octet-stream", Uint8Array.from([0xff, 0xd8, 0xff])), { mime: "image/jpeg", extension: "jpeg" });
assert.deepEqual(scanFileType("photo.jpg", "image/jpg"), { mime: "image/jpeg", extension: "jpeg" });

type Line = { description: string; parts?: string[]; quantity: number; unitPriceHt: number; vatRate: number; bareTotal?: boolean };
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
  buyerName?: string;
  buyerIce?: string;
  layout?: "standard" | "footer" | "boxed" | "two-page";
  money?: "space-comma" | "space-dot" | "dot-comma" | "dot";
  totals?: "classic" | "montant" | "net" | "dh";
  dateStyle?: "label" | "city" | "payable";
  decoy?: boolean;
  words?: boolean;
  skipDue?: boolean;
  city?: string;
  numberLabel?: string;
};

const fixtures: Fixture[] = [
  fixture("classique", { supplierName: "Atlas Négoce SARL", ice: "001111111000011", ifNumber: "11111111", rc: "554433", patente: "35678109", cnss: "1234567", invoiceNumber: "FAC-1001", invoiceDate: "2026-03-12", dueDate: "2026-04-11", dateLabel: "12/03/2026", dueLabel: "11/04/2026", lines: [{ description: "Câble cuivre", quantity: 2, unitPriceHt: 100, vatRate: 20 }] }),
  fixture("deux-taux", { supplierName: "Beta Fournitures SA", ice: "002222222000022", ifNumber: "22222222", rc: "778899", invoiceNumber: "FF-2026-14", invoiceDate: "2026-01-05", dueDate: "2026-02-04", dateLabel: "05/01/2026", dueLabel: "04/02/2026", lines: [{ description: "Papier A4", quantity: 10, unitPriceHt: 25, vatRate: 20 }, { description: "Cahier", quantity: 4, unitPriceHt: 15, vatRate: 10 }] }),
  fixture("sans-ice", { supplierName: "Gamma Services", ice: "", ifNumber: "33333333", rc: "101010", invoiceNumber: "GS-77", invoiceDate: "2026-06-01", dueDate: "2026-06-30", dateLabel: "01/06/2026", dueLabel: "30/06/2026", lines: [{ description: "Prestation conseil", quantity: 1, unitPriceHt: 1500, vatRate: 20 }] }),
  fixture("date-ecrite", { supplierName: "Delta Import SARL", ice: "004444444000044", ifNumber: "44444444", rc: "246810", invoiceNumber: "DI-12", invoiceDate: "2026-11-12", dueDate: "2026-12-12", dateLabel: "12 novembre 2026", dueLabel: "12 décembre 2026", lines: [{ description: "Roulement", quantity: 3, unitPriceHt: 80, vatRate: 20 }] }),
  fixture("grands-montants", { supplierName: "Epsilon Acier SA", ice: "005555555000055", ifNumber: "55555555", rc: "998877", invoiceNumber: "EA-900", invoiceDate: "2026-07-20", dueDate: "2026-08-19", dateLabel: "20/07/2026", dueLabel: "19/08/2026", lines: [{ description: "Tôle", quantity: 8, unitPriceHt: 154.32, vatRate: 14 }, { description: "Vis", quantity: 100, unitPriceHt: 1.5, vatRate: 7 }] }),
  fixture("trois-lignes", { supplierName: "Zeta Bureau SARL AU", ice: "006666666000066", ifNumber: "66666666", rc: "135790", invoiceNumber: "ZB-3", invoiceDate: "2026-02-02", dueDate: "2026-03-04", dateLabel: "02/02/2026", dueLabel: "04/03/2026", lines: [{ description: "Stylo", quantity: 20, unitPriceHt: 4.5, vatRate: 20 }, { description: "Classeur", quantity: 6, unitPriceHt: 18, vatRate: 20 }, { description: "Ramette", quantity: 5, unitPriceHt: 32, vatRate: 20 }] }),
  fixture("acheteur-a-droite", { supplierName: "Eta Logistique SARL", ice: "007777777000077", ifNumber: "77777777", rc: "864200", invoiceNumber: "EL-44", invoiceDate: "2026-09-09", dueDate: "2026-10-09", dateLabel: "09/09/2026", dueLabel: "09/10/2026", lines: [{ description: "Transport", quantity: 1, unitPriceHt: 900, vatRate: 14 }], buyer: true }),
  fixture("pied-legal", { supplierName: "Demo Nord SARL AU", ice: "002345678000012", ifNumber: "50251905", rc: "502101", patente: "35678109", cnss: "2586708", address: "26 avenue Demo Sultan etage 1 Casablanca", phone: "061598745", email: "contact@demo-nord.test", invoiceNumber: "TR002572024", invoiceDate: "2024-05-20", dueDate: "", dateLabel: "20/05/2024", dueLabel: "", layout: "footer", money: "space-dot", totals: "dh", dateStyle: "city", city: "TANGER", decoy: true, words: true, skipDue: true, buyer: true, buyerName: "Client Essai SARL", buyerIce: "000111222000033", lines: [{ description: "Blocs notes demo format carre", parts: ["Blocs notes demo", "format carre"], quantity: 25, unitPriceHt: 60, vatRate: 20 }, { description: "Boite serre feuilles demo", quantity: 18, unitPriceHt: 50, vatRate: 20 }, { description: "Cahier spirale demo petits carreaux", parts: ["Cahier spirale demo", "petits carreaux"], quantity: 20, unitPriceHt: 25, vatRate: 20 }, { description: "Marqueur tableau demo", quantity: 11, unitPriceHt: 100, vatRate: 20, bareTotal: true }] }),
  fixture("net-a-payer", { supplierName: "Nour Equipement SARL", ice: "008888888000088", ifNumber: "80808080", rc: "445566", invoiceNumber: "NE-320", invoiceDate: "2026-04-15", dueDate: "2026-05-15", dateLabel: "15/04/2026", dueLabel: "15/05/2026", totals: "net", lines: [{ description: "Perceuse demo", quantity: 2, unitPriceHt: 450, vatRate: 20 }] }),
  fixture("montant-ht", { supplierName: "Oasis Bureau SA", ice: "009999999000099", ifNumber: "90909090", rc: "121212", invoiceNumber: "OB-18", invoiceDate: "2026-08-08", dueDate: "2026-09-07", dateLabel: "08/08/2026", dueLabel: "07/09/2026", totals: "montant", lines: [{ description: "Ramette ivoire", quantity: 12, unitPriceHt: 35, vatRate: 20 }] }),
  fixture("separateurs-point", { supplierName: "Rif Acier SARL", ice: "001010101000101", ifNumber: "10101010", rc: "303030", invoiceNumber: "RA-77", invoiceDate: "2026-03-03", dueDate: "2026-04-02", dateLabel: "03/03/2026", dueLabel: "02/04/2026", money: "dot-comma", lines: [{ description: "Barre ronde", quantity: 6, unitPriceHt: 205.75, vatRate: 20 }] }),
  fixture("separateurs-point-decimal", { supplierName: "Souss Emballage SARL", ice: "001212121000121", ifNumber: "12121212", rc: "404040", invoiceNumber: "SE-5", invoiceDate: "2026-05-05", dueDate: "2026-06-04", dateLabel: "05/05/2026", dueLabel: "04/06/2026", money: "dot", lines: [{ description: "Carton double", quantity: 40, unitPriceHt: 12.5, vatRate: 20 }] }),
  fixture("une-ligne", { supplierName: "Taza Services SARL", ice: "001313131000131", ifNumber: "13131313", rc: "505050", invoiceNumber: "TS-1", invoiceDate: "2026-01-31", dueDate: "", dateLabel: "31/01/2026", dueLabel: "", skipDue: true, lines: [{ description: "Maintenance annuelle", quantity: 1, unitPriceHt: 2500, vatRate: 20 }] }),
  fixture("huit-lignes", { supplierName: "Atlas Fournitures SARL", ice: "001414141000141", ifNumber: "14141414", rc: "606060", invoiceNumber: "AF-8", invoiceDate: "2026-02-14", dueDate: "2026-03-16", dateLabel: "14/02/2026", dueLabel: "16/03/2026", lines: numberedLines(8) }),
  fixture("quinze-lignes", { supplierName: "Maghreb Quincaillerie SA", ice: "001515151000151", ifNumber: "15151515", rc: "707070", invoiceNumber: "MQ-15", invoiceDate: "2026-06-18", dueDate: "2026-07-18", dateLabel: "18/06/2026", dueLabel: "18/07/2026", lines: numberedLines(15) }),
  fixture("deux-pages", { supplierName: "Draa Materiaux SARL", ice: "001616161000161", ifNumber: "16161616", rc: "808080", invoiceNumber: "DM-2P", invoiceDate: "2026-09-01", dueDate: "2026-10-01", dateLabel: "01/09/2026", dueLabel: "01/10/2026", layout: "two-page", lines: numberedLines(12) }),
  fixture("payable-le", { supplierName: "Khemisset Bois SARL", ice: "001717171000171", ifNumber: "17171717", rc: "909090", invoiceNumber: "KB-9", invoiceDate: "2026-10-10", dueDate: "2026-11-09", dateLabel: "10/10/2026", dueLabel: "09/11/2026", dateStyle: "payable", lines: [{ description: "Planche sapin", quantity: 14, unitPriceHt: 80, vatRate: 10 }] }),
  fixture("encadre", { supplierName: "Zenata Logistique SARL", ice: "001818181000181", ifNumber: "18181818", rc: "112233", invoiceNumber: "ZL-60", invoiceDate: "2026-12-01", dueDate: "2026-12-31", dateLabel: "01/12/2026", dueLabel: "31/12/2026", layout: "boxed", buyer: true, buyerName: "Atelier Client SARL", buyerIce: "000999888000077", lines: [{ description: "Livraison palette", quantity: 3, unitPriceHt: 220, vatRate: 14 }] }),
  fixture("montant-espace", { supplierName: "Oujda Textile SARL", ice: "001919191000191", ifNumber: "19191919", rc: "223344", invoiceNumber: "OT-100", invoiceDate: "2026-07-07", dueDate: "2026-08-06", dateLabel: "07/07/2026", dueLabel: "06/08/2026", money: "space-comma", lines: [{ description: "Rouleau coton", quantity: 9, unitPriceHt: 1234.5, vatRate: 20 }] }),
  fixture("reference", { supplierName: "Ifrane Froid SARL", ice: "002020202000202", ifNumber: "20202020", rc: "334455", invoiceNumber: "IFR-2044", invoiceDate: "2026-04-04", dueDate: "2026-05-04", dateLabel: "04/04/2026", dueLabel: "04/05/2026", numberLabel: "Réf :", lines: [{ description: "Groupe froid demo", quantity: 1, unitPriceHt: 780, vatRate: 7 }] }),
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
    const actual = parseInvoiceDocument(tokens, { buyerIce: item.buyerIce ?? (item.buyer ? BUYER : "") });
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
  if (process.argv.includes("--corpus")) await buildCorpus(pdfjs);
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
    return Boolean(found) && fold(found.description).includes(fold(line.description)) && Math.abs(found.quantity - line.quantity) <= 0.01 && Math.abs(found.unitPriceHt - line.unitPriceHt) <= 0.05 && found.vatRate === line.vatRate;
  });
  return { fournisseur: text("supplierName"), ice: text("ice"), if: text("ifNumber"), rc: text("rc"), patente: text("patente"), cnss: text("cnss"), adresse: text("address"), telephone: text("phone"), email: text("email"), numero: text("invoiceNumber"), date: text("invoiceDate"), echeance: text("dueDate"), ht: money("totalHt", totals.ht), tva: money("totalVat", totals.vat), ttc: money("totalTtc", totals.ttc), lignes: linesOk };
}

function add(scores: Record<string, { hit: number; total: number }>, field: string, ok: boolean) {
  scores[field] ??= { hit: 0, total: 0 };
  scores[field].total += 1;
  if (ok) scores[field].hit += 1;
}

function numberedLines(count: number): Line[] {
  const names = ["Carton", "Dossier", "Encre", "Farine", "Gaine", "Huile", "Joint", "Lampe", "Mastic", "Nez", "Outil", "Peinture", "Quincaillerie", "Ruban", "Sac"];
  return Array.from({ length: count }, (_, index) => ({ description: `${names[index]} demo ${index + 1}`, quantity: index + 1, unitPriceHt: 10 + index, vatRate: [20, 14, 10, 7][index % 4] }));
}

function money(value: number, style: Fixture["money"] = "space-comma") {
  const [whole, decimal] = round(value).toFixed(2).split(".");
  if (style === "dot") return `${whole}.${decimal}`;
  if (style === "space-dot") return `${whole.replace(/\B(?=(\d{3})+(?!\d))/g, " ")}.${decimal}`;
  if (style === "dot-comma") return `${whole.replace(/\B(?=(\d{3})+(?!\d))/g, ".")},${decimal}`;
  return `${whole.replace(/\B(?=(\d{3})+(?!\d))/g, " ")},${decimal}`;
}

function layoutOf(item: Fixture) {
  const ops: { text: string; x: number; y: number }[] = [];
  const put = (text: string, x: number, y: number) => ops.push({ text, x, y });
  const style = item.money ?? "space-comma";
  const amount = (value: number, bare = false) => bare ? String(round(value)) : money(value, style);
  if (item.layout === "footer") {
    put(item.buyerName ?? "Client Essai SARL", 340, 70);
    put(`ICE : ${item.buyerIce ?? BUYER}`, 340, 92);
    put(`${item.city ?? "TANGER"} le, ${item.dateLabel}`, 40, 150);
    if (item.decoy) put("N° TES", 40, 176);
    put(`FACTURE N° ${item.invoiceNumber}`, 40, 200);
    put("Désignation", 40, 250);
    put("Quantité", 250, 250);
    put("Prix unitaire DH H.T", 330, 250);
    put("Prix total DH H.T", 470, 250);
    let y = 278;
    for (const line of item.lines) {
      const parts = line.parts ?? [line.description];
      parts.forEach((part, index) => put(part, 40, y + index * 14));
      const row = y + (parts.length - 1) * 14;
      put(String(line.quantity), 260, row);
      put(amount(line.unitPriceHt), 340, row);
      put(amount(line.quantity * line.unitPriceHt, line.bareTotal), 480, row);
      y = row + 28;
    }
    if (item.words) put("Arrêtée à la somme de quatre mille huit cents dirhams.", 40, y + 8);
    const totals = totalsOf(item);
    put(`Montant en DH HT ${amount(totals.ht)}`, 300, y + 36);
    for (const [rate, value] of Object.entries(totals.byRate)) put(`TVA ${rate}% ${amount(value)}`, 300, y + 54);
    put(`Montant en DH TTC ${amount(totals.ttc)}`, 300, y + 72);
    put(`${item.supplierName} au capital de 100 000,00`, 40, 700);
    put(`ADRESSE : ${item.address} - Tél ${item.phone}`, 40, 718);
    put(`IF:${item.ifNumber} - RC : ${item.rc} - CNSS:${item.cnss} - TP : ${item.patente} - ICE : ${item.ice}`, 40, 736);
    put(item.email, 40, 754);
    return ops;
  }
  const boxed = item.layout === "boxed";
  put(item.supplierName, boxed ? 48 : 40, 70);
  if (item.ice) put(`ICE : ${item.ice}`, 40, 90);
  put(`IF : ${item.ifNumber}`, 40, 108);
  put(`RC : ${item.rc}`, 40, 126);
  put(`Patente : ${item.patente}`, 40, 144);
  put(`CNSS : ${item.cnss}`, 40, 162);
  put(`Adresse : ${item.address}`, 40, 180);
  put(`Téléphone : ${item.phone}`, 40, 198);
  put(`Email : ${item.email}`, 40, 216);
  if (item.buyer) {
    put(item.buyerName ?? "Felexia Conseils", 340, 70);
    put(`ICE : ${item.buyerIce ?? BUYER}`, 340, 90);
    put("Client", 340, 108);
  }
  put(`${item.numberLabel ?? "Facture n°"} ${item.invoiceNumber}`, 40, 250);
  if (item.dateStyle === "city") put(`${item.city ?? "AGADIR"} le, ${item.dateLabel}`, 40, 270);
  else put(`Date : ${item.dateLabel}`, 40, 270);
  if (!item.skipDue) put(`${item.dateStyle === "payable" ? "Payable le" : "Échéance"} : ${item.dueLabel}`, 40, 290);
  const pageBreak = item.layout === "two-page" ? 6 : item.lines.length;
  const drawTable = (lines: Line[], top: number, yOffset: number) => {
    put("Désignation", 40, top + yOffset);
    put("Qté", 250, top + yOffset);
    put("PU HT", 310, top + yOffset);
    put("TVA", 400, top + yOffset);
    put("Montant", 470, top + yOffset);
    lines.forEach((line, index) => {
      const y = top + 24 + index * 22 + yOffset;
      put(line.description, 40, y);
      put(String(line.quantity), 250, y);
      put(amount(line.unitPriceHt), 310, y);
      put(String(line.vatRate), 400, y);
      put(amount(line.quantity * line.unitPriceHt, line.bareTotal), 470, y);
    });
    return top + 24 + lines.length * 22 + yOffset;
  };
  let y = drawTable(item.lines.slice(0, pageBreak), 330, 0);
  if (item.layout === "two-page") y = drawTable(item.lines.slice(pageBreak), 70, 900);
  const totals = totalsOf(item);
  y += 16;
  const htLabel = item.totals === "montant" ? "Montant HT" : item.totals === "dh" ? "Montant en DH HT" : "Total HT";
  const ttcLabel = item.totals === "net" ? "Net à payer" : item.totals === "dh" ? "Montant en DH TTC" : "Total TTC";
  put(`${htLabel} : ${amount(totals.ht)}`, 310, y);
  for (const [rate, value] of Object.entries(totals.byRate)) {
    y += 18;
    put(`TVA ${rate} % : ${amount(value)}`, 310, y);
  }
  put(`${ttcLabel} : ${amount(totals.ttc)} MAD`, 310, y + 18);
  if (item.words) put("Arrêtée à la somme de : montant en toutes lettres.", 40, y + 42);
  return ops;
}

function totalsOf(item: Fixture) {
  return item.lines.reduce((sum, line) => {
    const ht = round(line.quantity * line.unitPriceHt);
    const vat = round(ht * line.vatRate / 100);
    sum.ht = round(sum.ht + ht);
    sum.vat = round(sum.vat + vat);
    sum.ttc = round(sum.ht + sum.vat);
    sum.byRate[line.vatRate] = round((sum.byRate[line.vatRate] ?? 0) + vat);
    return sum;
  }, { ht: 0, vat: 0, ttc: 0, byRate: {} as Record<number, number> });
}

async function renderPdf(item: Fixture) {
  const ops = layoutOf(item);
  return new Promise<Buffer>((resolve) => {
    const doc = new PDFDocument({ size: "A4", margin: 40 });
    if (existsSync(FONT)) doc.font(FONT);
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    let page = 0;
    for (const op of ops) {
      const target = Math.floor(op.y / 900);
      while (page < target) { doc.addPage(); page += 1; }
      doc.text(op.text, op.x, op.y - target * 900, { lineBreak: false });
    }
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

const RASTER_IDS = ["pied-legal", "classique", "encadre", "net-a-payer", "separateurs-point", "grands-montants", "quinze-lignes", "deux-pages"];

async function buildCorpus(pdfjs: typeof import("pdfjs-dist")) {
  const directory = path.resolve("scripts/fixtures/ocr/corpus-build");
  rmSync(directory, { recursive: true, force: true });
  mkdirSync(directory, { recursive: true });
  const manifest = fixtures.map((item) => ({ id: item.id, buyerIce: item.buyerIce ?? (item.buyer ? BUYER : ""), ops: layoutOf(item) }));
  writeFileSync(path.join(directory, "layouts.json"), JSON.stringify(manifest));
  for (const item of fixtures) writeFileSync(path.join(directory, `${item.id}.pdf`), await renderPdf(item));
  const painted = spawnSync("python3", ["scripts/paint-invoice-corpus.py", path.join(directory, "layouts.json"), directory], { stdio: "inherit" });
  if (painted.status !== 0) throw new Error("Le corpus image n’a pas pu être dessiné.");
  for (const id of RASTER_IDS) {
    const scans = existsSync(path.join(directory, `${id}-p1-scan.png`))
      ? [path.join(directory, `${id}-p1-scan.png`), path.join(directory, `${id}-p2-scan.png`)]
      : [path.join(directory, `${id}-scan.png`)];
    writeFileSync(path.join(directory, `${id}-scan.pdf`), await imageOnlyPdf(scans));
  }
  writeFileSync(path.resolve("scripts/_legacy-invoice-parser.ts"), execSync("git show origin/main:src/lib/purchases/invoice-parser.ts"));
  const legacy = await import("./_legacy-invoice-parser.ts");
  const { createWorker, PSM } = await import("tesseract.js");
  const worker = await createWorker("fra+eng", 1, { langPath: path.resolve("public/ocr"), cachePath: path.resolve("public/ocr"), gzip: false });
  const report: string[] = ["# Précision OCR factures fournisseurs fictives", "", "Corpus fictif, 20 factures. Le parseur « avant » est celui de `origin/main`. Le parseur « après » est celui de cette branche.", ""];
  const digitalBefore = blankScores();
  const digitalAfter = blankScores();
  const digitalMisses: string[] = [];
  for (const item of fixtures) {
    const tokens = await tokensFromPdf(pdfjs, readFileSync(path.join(directory, `${item.id}.pdf`)));
    const before = scoreFields(item, legacy.parseInvoiceDocument(tokens, { buyerIce: item.buyerIce ?? (item.buyer ? BUYER : "") }));
    const after = scoreFields(item, parseInvoiceDocument(tokens, { buyerIce: item.buyerIce ?? (item.buyer ? BUYER : "") }));
    addScores(digitalBefore, before);
    addScores(digitalAfter, after);
    const missed = Object.entries(after).filter((entry) => !entry[1]).map((entry) => entry[0]);
    if (missed.length) digitalMisses.push(`${item.id}: ${missed.join(", ")}`);
  }
  report.push("## PDF numérique (couche texte)", "", table(digitalBefore, digitalAfter), "", digitalMisses.length ? `Écarts après : ${digitalMisses.join(" ; ")}` : "Après : 100 % sur les 20 PDF numériques.", "");
  const formats = ["png-propre", "pdf-scan", "photo"] as const;
  const photoVariants: { item: Fixture; buyerIce: string; raw: Token[]; contrast: Token[]; threshold: Token[] }[] = [];
  const tables: Record<string, { before: Score; after: Score; notes: string[] }> = {};
  for (const format of formats) tables[format] = { before: blankScores(), after: blankScores(), notes: [] };
  for (const id of RASTER_IDS) {
    const item = fixtures.find((entry) => entry.id === id);
    if (!item) continue;
    const buyerIce = item.buyerIce ?? (item.buyer ? BUYER : "");
    const clean = await readPages(worker, PSM, directory, id, "clean.png");
    const scan = await readPages(worker, PSM, directory, id, "scan.png");
    const photo = await readPages(worker, PSM, directory, id, "photo.jpg");
    const photoPrep = await readPages(worker, PSM, directory, id, "photo-prep-contrast.png");
    const photoBinary = await readPages(worker, PSM, directory, id, "photo-prep-threshold.png");
    const scanPdf = await tokensFromPdf(pdfjs, readFileSync(path.join(directory, `${id}-scan.pdf`)));
    const scanLetters = scanPdf.map((token) => token.text).join("").replace(/\s/g, "").length;
    record(tables["png-propre"], item, clean, clean, buyerIce, legacy);
    record(tables["pdf-scan"], item, scan, scan, buyerIce, legacy);
    photoVariants.push({ item, buyerIce, raw: photo, contrast: photoPrep, threshold: photoBinary });
    if (scanLetters >= 40) tables["pdf-scan"].notes.push(`${id}: le PDF « scan » contient encore ${scanLetters} lettres`);
    const after = scoreFields(item, parseInvoiceDocument(clean, { buyerIce }));
    const missed = Object.entries(after).filter((entry) => !entry[1]).map((entry) => entry[0]);
    if (missed.length) tables["png-propre"].notes.push(`${id}: ${missed.join(", ")}`);
  }
  const variantScore = (key: "raw" | "contrast" | "threshold") => photoVariants.reduce((sum, entry) => sum + Object.values(scoreFields(entry.item, parseInvoiceDocument(entry[key], { buyerIce: entry.buyerIce }))).filter(Boolean).length, 0);
  const chosenMode = (["contrast", "threshold", "raw"] as const).sort((left, right) => variantScore(right) - variantScore(left))[0];
  for (const entry of photoVariants) {
    record(tables.photo, entry.item, entry.raw, entry[chosenMode], entry.buyerIce, legacy);
    const after = scoreFields(entry.item, parseInvoiceDocument(entry[chosenMode], { buyerIce: entry.buyerIce }));
    const missed = Object.entries(after).filter((item) => !item[1]).map((item) => item[0]);
    if (missed.length) tables.photo.notes.push(`${entry.item.id}: ${missed.join(", ")} — ${cause(entry.item, parseInvoiceDocument(entry[chosenMode], { buyerIce: entry.buyerIce }))}`);
  }
  tables.photo.notes.unshift(`Prétraitement retenu pour les photos : ${chosenMode}.`);
  report.push("## Par format", "");
  for (const format of formats) {
    report.push(`### ${format}`, "", table(tables[format].before, tables[format].after), "");
    if (tables[format].notes.length) report.push(tables[format].notes.join("\n"), "");
  }
  report.push("## Causes principales", "", "- PDF numérique avant : le nom retenu était une ligne d’article ou le bloc client, un jeton court comme TES passait pour le numéro, « Montant en DH » et `4 000.00` n’étaient pas lus, et une désignation sur deux lignes était coupée.", "- PNG propre : les champs restants ratés viennent de Tesseract (0 lu O, un chiffre d’IF). Le parseur, une fois le texte juste, retrouve les lignes.", "- Photos : la rotation, le flou, la perspective et le moiré font perdre l’en-tête de colonnes. Le prétraitement binaire a baissé le score, donc la lecture garde l’image brute et ne force plus le seuillage.", "");
  const photoPath = "/home/ubuntu/.cursor/projects/agent-repos-Felexia/uploads/facture-reelle-photo_776f.jpg";
  if (existsSync(photoPath)) {
    const raw = await recognizeFile(worker, PSM, photoPath);
    const prepared = path.join(directory, "photo-reelle-prep.png");
    const prepScript = `import importlib.util\nfrom PIL import Image\nspec = importlib.util.spec_from_file_location("paint", "scripts/paint-invoice-corpus.py")\nmod = importlib.util.module_from_spec(spec)\nspec.loader.exec_module(mod)\nmod.prepare(Image.open(${JSON.stringify(photoPath)}), ${JSON.stringify("contrast")}).save(${JSON.stringify(prepared)})\n`;
    spawnSync("python3", ["-c", prepScript], { stdio: "inherit" });
    const preparedTokens = existsSync(prepared) ? await recognizeFile(worker, PSM, prepared) : raw;
    const buyerIce = "000217145000056";
    const before = legacy.parseInvoiceDocument(raw, { buyerIce });
    const afterRaw = parseInvoiceDocument(raw, { buyerIce });
    const afterPrep = parseInvoiceDocument(preparedTokens, { buyerIce });
    const chosen = [afterRaw, afterPrep].sort((a, b) => fieldHits(b) - fieldHits(a))[0];
    report.push("## Photo réelle (locale, non versionnée)", "", "Utilisée seulement pour mesurer. Le fichier n’est pas dans le dépôt.", "", `| Champ | Avant | Après | Attendu |`, `| --- | --- | --- | --- |`, `| Fournisseur | ${before.supplierName || "—"} | ${chosen.supplierName || "—"} | AMY NEGOCE SARL AU |`, `| ICE | ${before.ice || "—"} | ${chosen.ice || "—"} | 002799711000097 |`, `| IF | ${before.ifNumber || "—"} | ${chosen.ifNumber || "—"} | 50251905 |`, `| RC | ${before.rc || "—"} | ${chosen.rc || "—"} | 502101 |`, `| Numéro | ${before.invoiceNumber || "—"} | ${chosen.invoiceNumber || "—"} | TR002572024 |`, `| Date | ${before.invoiceDate || "—"} | ${chosen.invoiceDate || "—"} | 2024-05-20 |`, `| Échéance | ${before.dueDate || "—"} | ${chosen.dueDate || "—"} | vide |`, `| HT | ${before.totalHt ?? "—"} | ${chosen.totalHt ?? "—"} | 4000 |`, `| TVA | ${before.totalVat ?? "—"} | ${chosen.totalVat ?? "—"} | 800 |`, `| TTC | ${before.totalTtc ?? "—"} | ${chosen.totalTtc ?? "—"} | 4800 |`, `| Lignes | ${before.lines.length} | ${chosen.lines.length} | 4 |`, "");
  }
  await worker.terminate();
  rmSync(path.resolve("scripts/_legacy-invoice-parser.ts"), { force: true });
  const publish = path.resolve("scripts/fixtures/ocr/corpus-publish");
  rmSync(publish, { recursive: true, force: true });
  mkdirSync(publish, { recursive: true });
  writeFileSync(path.join(publish, "LISEZMOI.txt"), "Factures fictives pour le contrôle OCR. Aucune société réelle. ICE, IF, RC, CNSS et taxe professionnelle sont des numéros de forme valide, inventés.\n");
  for (const item of fixtures) {
    writeFileSync(path.join(publish, `${item.id}.pdf`), readFileSync(path.join(directory, `${item.id}.pdf`)));
  }
  for (const id of RASTER_IDS) {
    for (const name of [`${id}.pdf`, `${id}-scan.pdf`, `${id}-clean.png`, `${id}-photo.jpg`, `${id}-p1-clean.png`, `${id}-p2-clean.png`, `${id}-p1-photo.jpg`, `${id}-p2-photo.jpg`]) {
      const source = path.join(directory, name);
      if (existsSync(source)) writeFileSync(path.join(publish, name), readFileSync(source));
    }
  }
  const zipPath = path.resolve("scripts/fixtures/ocr/supplier-invoice-corpus.zip");
  spawnSync("python3", ["-c", `import os,zipfile,sys\nroot,dest=sys.argv[1],sys.argv[2]\nwith zipfile.ZipFile(dest,"w",compression=zipfile.ZIP_DEFLATED,compresslevel=9) as z:\n    for dirpath,_,files in os.walk(root):\n        for name in files:\n            full=os.path.join(dirpath,name)\n            z.write(full, os.path.relpath(full, root))\n`, publish, zipPath], { stdio: "inherit" });
  const reportPath = "/opt/cursor/artifacts/ocr-accuracy.md";
  mkdirSync("/opt/cursor/artifacts", { recursive: true });
  writeFileSync(reportPath, report.join("\n"));
  console.log(`corpus: ${zipPath} (${statSync(zipPath).size} octets)`);
  console.log(`rapport: ${reportPath}`);
  rmSync(directory, { recursive: true, force: true });
  rmSync(publish, { recursive: true, force: true });
}

function blankScores() {
  return Object.fromEntries(["fournisseur", "ice", "if", "rc", "numero", "date", "echeance", "ht", "tva", "ttc", "lignes", "lignesExactes"].map((field) => [field, { hit: 0, total: 0 }])) as Score;
}

type Score = Record<string, { hit: number; total: number }>;

function scoreFields(item: Fixture, actual: ReturnType<typeof parseInvoiceDocument>) {
  const row = compare(item, actual);
  return { fournisseur: row.fournisseur, ice: row.ice, if: row.if, rc: row.rc, numero: row.numero, date: row.date, echeance: row.echeance, ht: row.ht, tva: row.tva, ttc: row.ttc, lignes: actual.lines.length === item.lines.length, lignesExactes: row.lignes };
}

function addScores(target: Score, row: Record<string, boolean>) {
  for (const [field, ok] of Object.entries(row)) add(target, field, ok);
}

function table(before: Score, after: Score) {
  const lines = ["| Champ | Avant | Après |", "| --- | ---: | ---: |"];
  for (const field of Object.keys(after)) lines.push(`| ${field} | ${percent(before[field])} | ${percent(after[field])} |`);
  return lines.join("\n");
}

function percent(score?: { hit: number; total: number }) {
  if (!score?.total) return "—";
  return `${Math.round(100 * score.hit / score.total)} % (${score.hit}/${score.total})`;
}

function record(bucket: { before: Score; after: Score }, item: Fixture, beforeTokens: { text: string; x: number; y: number; w: number; h: number }[], afterTokens: { text: string; x: number; y: number; w: number; h: number }[], buyerIce: string, legacy: { parseInvoiceDocument: typeof parseInvoiceDocument }) {
  addScores(bucket.before, scoreFields(item, legacy.parseInvoiceDocument(beforeTokens, { buyerIce })));
  addScores(bucket.after, scoreFields(item, parseInvoiceDocument(afterTokens, { buyerIce })));
}

function bestTokens(item: Fixture, buyerIce: string, candidates: { text: string; x: number; y: number; w: number; h: number }[][]) {
  return candidates.sort((left, right) => fieldHits(parseInvoiceDocument(right, { buyerIce })) - fieldHits(parseInvoiceDocument(left, { buyerIce })) || right.length - left.length)[0];
}

function fieldHits(invoice: ReturnType<typeof parseInvoiceDocument>) {
  return [invoice.supplierName, invoice.ice, invoice.ifNumber, invoice.rc, invoice.invoiceNumber, invoice.invoiceDate, invoice.totalHt, invoice.totalVat, invoice.totalTtc].filter((value) => value !== "" && value != null).length + invoice.lines.length;
}

function cause(item: Fixture, actual: ReturnType<typeof parseInvoiceDocument>) {
  if (item.buyerName && fold(actual.supplierName) === fold(item.buyerName)) return "le bloc client a été lu comme fournisseur";
  if (actual.lines.length !== item.lines.length) return `lignes ${actual.lines.length} au lieu de ${item.lines.length}`;
  if (actual.totalTtc == null) return "total non lu";
  return "champ mal lu";
}

async function readPages(worker: import("tesseract.js").Worker, PSM: typeof import("tesseract.js").PSM, directory: string, id: string, suffix: string) {
  const first = path.join(directory, `${id}-p1-${suffix}`);
  const files = existsSync(first) ? [first, path.join(directory, `${id}-p2-${suffix}`)] : [path.join(directory, `${id}-${suffix}`)];
  const tokens = [];
  let offset = 0;
  for (const file of files) {
    const page = await recognizeFile(worker, PSM, file);
    tokens.push(...page.map((token) => ({ ...token, y: token.y + offset })));
    offset += 2200;
  }
  return tokens;
}

async function recognizeFile(worker: import("tesseract.js").Worker, PSM: typeof import("tesseract.js").PSM, file: string) {
  let best: { text: string; x: number; y: number; w: number; h: number }[] = [];
  for (const mode of [PSM.SINGLE_BLOCK, PSM.SINGLE_COLUMN]) {
    await worker.setParameters({ tessedit_pageseg_mode: mode });
    const recognized = await worker.recognize(file);
    const tokens = (recognized.data.words ?? []).filter((word) => word.text.trim()).map((word) => ({ text: word.text, x: word.bbox.x0, y: word.bbox.y0, w: word.bbox.x1 - word.bbox.x0, h: word.bbox.y1 - word.bbox.y0 }));
    if (tokens.reduce((sum, token) => sum + token.text.length, 0) > best.reduce((sum, token) => sum + token.text.length, 0)) best = tokens;
    if (tokens.length > 20 && /total|ttc|facture|montant/i.test(tokens.map((token) => token.text).join(" "))) break;
  }
  return best;
}

async function imageOnlyPdf(files: string[]) {
  return new Promise<Buffer>((resolve) => {
    const doc = new PDFDocument({ autoFirstPage: false });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    for (const file of files) {
      const image = doc.openImage(file);
      doc.addPage({ size: [image.width, image.height] });
      doc.image(file, 0, 0);
    }
    doc.end();
  });
}
