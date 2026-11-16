import { unzip } from "@/lib/export/archive";

export type SpreadsheetTable = { rows: string[][]; error?: undefined } | { rows: []; error: string };

function decodeXml(value: string) {
  return decodeXmlEntities(value);
}

/** Numeric and named XML/HTML entities, including openpyxl-style &#233; and &eacute;. */
export function decodeXmlEntities(value: string) {
  const named: Record<string, string> = {
    amp: "&", lt: "<", gt: ">", quot: "\"", apos: "'", nbsp: " ",
    eacute: "é", egrave: "è", ecirc: "ê", euml: "ë",
    agrave: "à", aacute: "á", acirc: "â", auml: "ä",
    icirc: "î", iuml: "ï", iacute: "í",
    ocirc: "ô", ouml: "ö", oacute: "ó",
    ugrave: "ù", ucirc: "û", uuml: "ü", uacute: "ú",
    ccedil: "ç", yacute: "ý",
    Eacute: "É", Egrave: "È", Ecirc: "Ê", Agrave: "À", Acirc: "Â", Ccedil: "Ç",
  };
  const code = (point: number) => {
    if (!Number.isInteger(point) || point <= 0 || point > 0x10ffff) return "";
    return String.fromCodePoint(point);
  };
  return value
    .replace(/&#x([0-9a-f]{1,6});/gi, (_, hex: string) => code(Number.parseInt(hex, 16)))
    .replace(/&#([0-9]{1,7});/g, (_, dec: string) => code(Number.parseInt(dec, 10)))
    .replace(/&([a-zA-Z]+);/g, (token, name: string) => named[name] ?? named[name.toLowerCase()] ?? token);
}

function columnIndex(cell: string) {
  const letters = cell.replace(/\d/g, "");
  let index = 0;
  for (const char of letters) index = index * 26 + (char.charCodeAt(0) - 64);
  return Math.max(0, index - 1);
}

function readXlsx(buffer: Buffer): string[][] {
  const files = unzip(buffer);
  const sharedRaw = files.get("xl/sharedStrings.xml")?.toString("utf8") ?? "";
  const shared = [...sharedRaw.matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g)].map((match) => (
    [...match[1].matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)].map((text) => decodeXml(text[1])).join("")
  ));
  const sheet = [...files.entries()].find(([name]) => /^xl\/worksheets\/sheet1\.xml$/.test(name))?.[1]?.toString("utf8");
  if (!sheet) throw new Error("La première feuille du classeur est introuvable.");
  const rows: string[][] = [];
  for (const row of sheet.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)) {
    const cells: string[] = [];
    for (const cell of row[1].matchAll(/<c\b([^>]*)>([\s\S]*?)<\/c>|<c\b([^>]*)\/>/g)) {
      const attrs = cell[1] || cell[3] || "";
      const ref = attrs.match(/\br="([A-Z]+)\d+"/)?.[1] ?? "";
      const index = ref ? columnIndex(ref) : cells.length;
      const type = attrs.match(/\bt="([^"]+)"/)?.[1] ?? "";
      let value = "";
      if (type === "inlineStr") value = decodeXml(cell[2]?.match(/<t\b[^>]*>([\s\S]*?)<\/t>/)?.[1] ?? "");
      else if (type === "s") value = shared[Number(cell[2]?.match(/<v>([\s\S]*?)<\/v>/)?.[1] ?? -1)] ?? "";
      else value = cell[2]?.match(/<v>([\s\S]*?)<\/v>/)?.[1] ?? "";
      cells[index] = decodeXml(value).trim();
    }
    rows.push(cells.map((item) => item ?? ""));
  }
  return rows.filter((row) => row.some((cell) => cell !== ""));
}

function readCfbStream(buffer: Buffer, wanted: string) {
  if (buffer.length < 512 || buffer.readUInt32LE(0) !== 0xE011CFD0) return null;
  const sectorSize = 1 << buffer.readUInt16LE(0x1E);
  const directorySector = buffer.readUInt32LE(0x30);
  const readSector = (sector: number) => buffer.subarray((sector + 1) * sectorSize, (sector + 2) * sectorSize);
  const fat: number[] = [];
  for (let index = 0; index < 109; index += 1) {
    const sector = buffer.readUInt32LE(0x4C + index * 4);
    if (sector >= 0xfffffffe) break;
    const data = readSector(sector);
    for (let cursor = 0; cursor + 4 <= data.length; cursor += 4) fat.push(data.readUInt32LE(cursor));
  }
  const directory = readSector(directorySector);
  for (let offset = 0; offset + 128 <= directory.length; offset += 128) {
    const nameLength = directory.readUInt16LE(offset + 64);
    if (nameLength < 4) continue;
    const name = directory.subarray(offset, offset + nameLength - 2).toString("utf16le");
    if (name !== wanted) continue;
    const start = directory.readUInt32LE(offset + 116);
    const size = directory.readUInt32LE(offset + 120);
    const chunks: Buffer[] = [];
    let sector = start;
    let guard = 0;
    while (sector < 0xfffffffe && guard < 10000) {
      chunks.push(readSector(sector));
      sector = fat[sector] ?? 0xfffffffe;
      guard += 1;
    }
    return Buffer.concat(chunks).subarray(0, size);
  }
  return null;
}

function readBiff(buffer: Buffer) {
  const strings: string[] = [];
  const cells = new Map<string, string>();
  let offset = 0;
  let maxRow = 0;
  let maxColumn = 0;
  const text = (data: Buffer, start: number) => {
    const length = data.readUInt16LE(start);
    const flags = data[start + 2] ?? 0;
    const wide = flags & 1;
    const bytes = data.subarray(start + 3, start + 3 + length * (wide ? 2 : 1));
    return wide ? bytes.toString("utf16le") : bytes.toString("latin1");
  };
  while (offset + 4 <= buffer.length) {
    const code = buffer.readUInt16LE(offset);
    const length = buffer.readUInt16LE(offset + 2);
    const data = buffer.subarray(offset + 4, offset + 4 + length);
    offset += 4 + length;
    if (code === 0x00fc && data.length >= 8) {
      const count = data.readUInt32LE(4);
      let cursor = 8;
      for (let index = 0; index < count && cursor + 3 <= data.length; index += 1) {
        const value = text(data, cursor);
        strings.push(value);
        const flags = data[cursor + 2] ?? 0;
        cursor += 3 + value.length * ((flags & 1) ? 2 : 1);
      }
    } else if (code === 0x00fd && data.length >= 10) {
      const row = data.readUInt16LE(0);
      const column = data.readUInt16LE(2);
      cells.set(`${row}:${column}`, strings[data.readUInt32LE(6)] ?? "");
      maxRow = Math.max(maxRow, row);
      maxColumn = Math.max(maxColumn, column);
    } else if (code === 0x0203 && data.length >= 14) {
      const row = data.readUInt16LE(0);
      const column = data.readUInt16LE(2);
      cells.set(`${row}:${column}`, String(data.readDoubleLE(6)));
      maxRow = Math.max(maxRow, row);
      maxColumn = Math.max(maxColumn, column);
    }
  }
  const rows: string[][] = [];
  for (let row = 0; row <= maxRow; row += 1) {
    const line: string[] = [];
    for (let column = 0; column <= maxColumn; column += 1) line.push(cells.get(`${row}:${column}`) ?? "");
    if (line.some(Boolean)) rows.push(line);
  }
  if (rows.length === 0) throw new Error("La feuille .xls ne contient aucune cellule lisible. Enregistrez-la en .xlsx.");
  return rows;
}

export function readSpreadsheet(bytes: Buffer, filename: string): SpreadsheetTable {
  try {
    if (bytes.length >= 2 && bytes[0] === 0x50 && bytes[1] === 0x4b) return { rows: readXlsx(bytes) };
    if (bytes.length >= 8 && bytes.readUInt32LE(0) === 0xE011CFD0) {
      const workbook = readCfbStream(bytes, "Workbook") ?? readCfbStream(bytes, "Book");
      if (!workbook) return { rows: [], error: "Ce fichier .xls ne contient pas de feuille lisible. Enregistrez-le en .xlsx." };
      return { rows: readBiff(workbook) };
    }
    const text = bytes.toString("utf8");
    if (filename.toLowerCase().endsWith(".xls") && text.includes("<Workbook")) {
      return { rows: [], error: "Ce classeur XML n’est pas pris en charge. Enregistrez-le en .xlsx ou en CSV." };
    }
    return { rows: [], error: "Format de classeur non reconnu. Utilisez .xlsx, .xls ou CSV." };
  } catch (error) {
    return { rows: [], error: error instanceof Error ? error.message : "Le classeur n’a pas pu être lu." };
  }
}
