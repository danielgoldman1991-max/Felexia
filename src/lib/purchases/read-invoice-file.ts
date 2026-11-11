import { parseInvoiceDocument } from "@/lib/purchases/invoice-parser";
import { tokensFromPdfItems } from "@/lib/purchases/pdf-tokens";
import { SCAN_MAX_PAGES } from "@/lib/purchases/supplier-invoice-ocr";
import type { OcrSupplierInvoice } from "@/lib/purchases/supplier-invoice-ocr";
import type { TextToken } from "@/lib/purchases/invoice-parser";

type Progress = (ratio: number, label: string) => void;

let workerPromise: Promise<import("tesseract.js").Worker> | null = null;
let reportProgress: Progress = () => undefined;

export async function readInvoiceFile(file: File, options?: { buyerIce?: string; onProgress?: Progress }): Promise<OcrSupplierInvoice> {
  const onProgress = options?.onProgress ?? (() => undefined);
  const bytes = new Uint8Array(await file.arrayBuffer());
  const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
  if (isPdf) return readPdf(bytes, options?.buyerIce, onProgress);
  onProgress(0.05, "Préparation de l’image…");
  const image = await bitmapCanvas(file);
  const tokens = await recognize(preprocess(image), onProgress);
  onProgress(1, "Analyse en cours…");
  return parseInvoiceDocument(tokens, { buyerIce: options?.buyerIce });
}

async function readPdf(data: Uint8Array, buyerIce: string | undefined, onProgress: Progress): Promise<OcrSupplierInvoice> {
  onProgress(0.05, "Lecture du PDF…");
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = "/ocr/pdf.worker.min.mjs";
  const pdf = await pdfjs.getDocument({ data, isEvalSupported: false }).promise;
  if (pdf.numPages > SCAN_MAX_PAGES) throw new Error(`Le PDF dépasse ${SCAN_MAX_PAGES} pages. Découpez-le avant l’analyse.`);
  const tokens: TextToken[] = [];
  let offset = 0;
  for (let index = 1; index <= pdf.numPages; index += 1) {
    const page = await pdf.getPage(index);
    const viewport = page.getViewport({ scale: 1 });
    const content = await page.getTextContent();
    const textTokens = tokensFromPdfItems(content.items, viewport.height).map((token) => ({ ...token, y: token.y + offset }));
    const letters = textTokens.map((token) => token.text).join("").replace(/\s/g, "");
    if (letters.length >= 40) tokens.push(...textTokens);
    else {
      onProgress(0.1, "Analyse en cours…");
      const scaled = page.getViewport({ scale: 2 });
      const canvas = document.createElement("canvas");
      canvas.width = Math.ceil(scaled.width);
      canvas.height = Math.ceil(scaled.height);
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Le document n’a pas pu être lu.");
      await page.render({ canvasContext: context, viewport: scaled }).promise;
      const recognized = await recognize(preprocess(canvas), onProgress);
      tokens.push(...recognized.map((token) => ({ ...token, y: token.y + offset })));
    }
    offset += viewport.height + 48;
    onProgress(index / pdf.numPages, letters.length >= 40 ? "Lecture du PDF…" : "Analyse en cours…");
  }
  return parseInvoiceDocument(tokens, { buyerIce });
}

async function recognize(canvas: HTMLCanvasElement, onProgress: Progress): Promise<TextToken[]> {
  reportProgress = onProgress;
  const { PSM } = await import("tesseract.js");
  const worker = await ocrWorker();
  onProgress(0.2, "Analyse en cours…");
  let best: TextToken[] = [];
  for (const mode of [PSM.SINGLE_BLOCK, PSM.SINGLE_COLUMN]) {
    await worker.setParameters({ tessedit_pageseg_mode: mode });
    const result = await worker.recognize(canvas);
    const tokens = wordsToTokens(result.data.words ?? []);
    if (tokenScore(tokens) > tokenScore(best)) best = tokens;
    if (tokens.length > 20 && /total|ttc|facture|montant/i.test(tokens.map((token) => token.text).join(" "))) break;
  }
  return best;
}

function wordsToTokens(words: { text: string; bbox: { x0: number; y0: number; x1: number; y1: number } }[]): TextToken[] {
  return words.filter((word) => word.text.trim()).map((word) => ({
    text: word.text,
    x: word.bbox.x0,
    y: word.bbox.y0,
    w: Math.max(1, word.bbox.x1 - word.bbox.x0),
    h: Math.max(1, word.bbox.y1 - word.bbox.y0),
  }));
}

function tokenScore(tokens: TextToken[]) {
  return tokens.reduce((sum, token) => sum + token.text.length + (/\d/.test(token.text) ? 2 : 0), 0);
}

function ocrWorker() {
  workerPromise ??= import("tesseract.js").then(({ createWorker }) => createWorker("fra+eng", 1, {
    workerPath: "/ocr/worker.min.js",
    corePath: "/ocr/tesseract-core-simd-lstm.wasm.js",
    langPath: "/ocr",
    gzip: false,
    workerBlobURL: false,
    logger: (message) => {
      if (message.status === "recognizing text") reportProgress(0.2 + message.progress * 0.75, "Analyse en cours…");
    },
  }));
  return workerPromise;
}

async function bitmapCanvas(file: File) {
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0);
  return canvas;
}

function preprocess(source: HTMLCanvasElement) {
  const oriented = orient(source);
  const scale = oriented.width < 1800 ? 2200 / oriented.width : 1;
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(oriented.width * scale);
  canvas.height = Math.round(oriented.height * scale);
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return source;
  context.drawImage(oriented, 0, 0, canvas.width, canvas.height);
  const image = context.getImageData(0, 0, canvas.width, canvas.height);
  const pixels = image.data;
  let min = 255;
  let max = 0;
  for (let index = 0; index < pixels.length; index += 4) {
    const gray = pixels[index] * 0.299 + pixels[index + 1] * 0.587 + pixels[index + 2] * 0.114;
    pixels[index] = pixels[index + 1] = pixels[index + 2] = gray;
    min = Math.min(min, gray);
    max = Math.max(max, gray);
  }
  const span = Math.max(1, max - min);
  for (let index = 0; index < pixels.length; index += 4) {
    const stretched = ((pixels[index] - min) / span) * 255;
    const contrasted = Math.min(255, Math.max(0, (stretched - 128) * 1.15 + 128));
    pixels[index] = pixels[index + 1] = pixels[index + 2] = contrasted;
  }
  context.putImageData(image, 0, 0);
  return deskew(canvas);
}

function orient(source: HTMLCanvasElement) {
  const turns = [0, 90, 180, 270];
  let best = 0;
  let bestScore = -1;
  for (const turn of turns) {
    const score = projectionScore(source, turn);
    if (score > bestScore) { bestScore = score; best = turn; }
  }
  if (best === 0) return source;
  const canvas = document.createElement("canvas");
  canvas.width = best === 90 || best === 270 ? source.height : source.width;
  canvas.height = best === 90 || best === 270 ? source.width : source.height;
  const context = canvas.getContext("2d");
  if (!context) return source;
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.translate(canvas.width / 2, canvas.height / 2);
  context.rotate(best * Math.PI / 180);
  context.drawImage(source, -source.width / 2, -source.height / 2);
  return canvas;
}

function deskew(source: HTMLCanvasElement) {
  const sampleWidth = 360;
  const sampleHeight = Math.max(1, Math.round(source.height * (sampleWidth / source.width)));
  const sample = document.createElement("canvas");
  sample.width = sampleWidth;
  sample.height = sampleHeight;
  const sampleContext = sample.getContext("2d", { willReadFrequently: true });
  if (!sampleContext) return source;
  sampleContext.drawImage(source, 0, 0, sampleWidth, sampleHeight);
  let bestAngle = 0;
  let bestScore = -1;
  for (let angle = -5; angle <= 5; angle += 1) {
    const score = projectionScore(sample, angle);
    if (score > bestScore) { bestScore = score; bestAngle = angle; }
  }
  const straight = projectionScore(sample, 0);
  if (bestAngle === 0 || bestScore < straight * 1.2) return source;
  const radians = bestAngle * Math.PI / 180;
  const canvas = document.createElement("canvas");
  canvas.width = source.width;
  canvas.height = source.height;
  const context = canvas.getContext("2d");
  if (!context) return source;
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.translate(canvas.width / 2, canvas.height / 2);
  context.rotate(radians);
  context.drawImage(source, -source.width / 2, -source.height / 2);
  return canvas;
}

function projectionScore(source: HTMLCanvasElement, angle: number) {
  const canvas = document.createElement("canvas");
  canvas.width = source.width;
  canvas.height = source.height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return 0;
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.translate(canvas.width / 2, canvas.height / 2);
  context.rotate(angle * Math.PI / 180);
  context.drawImage(source, -source.width / 2, -source.height / 2);
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
  const rows = new Array<number>(canvas.height).fill(0);
  for (let y = 0; y < canvas.height; y += 1) {
    for (let x = 0; x < canvas.width; x += 1) {
      rows[y] += 255 - pixels[(y * canvas.width + x) * 4];
    }
  }
  const mean = rows.reduce((sum, value) => sum + value, 0) / rows.length;
  return rows.reduce((sum, value) => sum + (value - mean) ** 2, 0);
}
