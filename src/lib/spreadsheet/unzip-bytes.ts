import { gridFromSheetXml } from "@/lib/spreadsheet/xlsx-grid";

async function inflateRaw(data: Uint8Array) {
  const copy = new Uint8Array(data.byteLength);
  copy.set(data);
  const stream = new Blob([copy]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** ZIP stored or deflated, without Node zlib, so the browser can read an Excel file locally. */
export async function unzipBytes(bytes: Uint8Array) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const files = new Map<string, Uint8Array>();
  let offset = 0;
  const decoder = new TextDecoder();
  while (offset + 30 <= bytes.length) {
    const signature = view.getUint32(offset, true);
    if (signature === 0x02014b50 || signature === 0x06054b50) break;
    if (signature !== 0x04034b50) throw new Error("Le fichier ZIP est illisible.");
    const flags = view.getUint16(offset + 6, true);
    const method = view.getUint16(offset + 8, true);
    const compressedSize = view.getUint32(offset + 18, true);
    const nameLength = view.getUint16(offset + 26, true);
    const extraLength = view.getUint16(offset + 28, true);
    const name = decoder.decode(bytes.subarray(offset + 30, offset + 30 + nameLength));
    if (name.includes("..") || name.startsWith("/") || name.includes("\\")) throw new Error("Le fichier ZIP contient un chemin refusé.");
    if (flags & 0x8) throw new Error("Ce ZIP utilise un descripteur de données non pris en charge. Enregistrez le classeur à nouveau au format .xlsx.");
    const start = offset + 30 + nameLength + extraLength;
    const compressed = bytes.subarray(start, start + compressedSize);
    const data = method === 0 ? compressed : method === 8 ? await inflateRaw(compressed) : null;
    if (!data) throw new Error("La compression de ce ZIP n’est pas prise en charge.");
    if (name && !name.endsWith("/")) files.set(name, data);
    offset = start + compressedSize;
  }
  if (files.size === 0) throw new Error("Le fichier ZIP est vide ou illisible.");
  return files;
}

export async function readXlsxGrid(bytes: Uint8Array) {
  const files = await unzipBytes(bytes);
  const decoder = new TextDecoder();
  const shared = decoder.decode(files.get("xl/sharedStrings.xml") ?? new Uint8Array());
  const sheetName = [...files.keys()].find((name) => /^xl\/worksheets\/sheet1\.xml$/.test(name));
  if (!sheetName) throw new Error("La première feuille du classeur est introuvable.");
  return gridFromSheetXml(shared, decoder.decode(files.get(sheetName) ?? new Uint8Array()));
}
