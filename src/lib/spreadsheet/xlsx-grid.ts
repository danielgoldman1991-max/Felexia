import { decodeXmlEntities } from "@/lib/spreadsheet/xml-entities";

/** Linear scan of a worksheet. Excel writes empty styled cells as `<c .../>`; a reluctant regex treats that `>` as an open tag and then reads the rest of the row. */

function columnIndex(cell: string) {
  const letters = cell.replace(/\d/g, "");
  let index = 0;
  for (const char of letters) index = index * 26 + (char.charCodeAt(0) - 64);
  return Math.max(0, index - 1);
}

function isNameChar(char: string | undefined) {
  return Boolean(char && /[A-Za-z0-9_:]/.test(char));
}

function findTag(xml: string, name: string, from: number) {
  const needle = `<${name}`;
  let cursor = from;
  while (cursor < xml.length) {
    const start = xml.indexOf(needle, cursor);
    if (start < 0) return -1;
    if (!isNameChar(xml[start + needle.length])) return start;
    cursor = start + needle.length;
  }
  return -1;
}

function tagEnd(xml: string, start: number) {
  const end = xml.indexOf(">", start);
  return end < 0 ? -1 : end;
}

function readText(block: string) {
  let cursor = 0;
  let text = "";
  while (cursor < block.length) {
    const start = findTag(block, "t", cursor);
    if (start < 0) break;
    const open = tagEnd(block, start);
    if (open < 0) break;
    if (block[open - 1] === "/") {
      cursor = open + 1;
      continue;
    }
    const close = block.indexOf("</t>", open);
    if (close < 0) break;
    text += decodeXmlEntities(block.slice(open + 1, close));
    cursor = close + 4;
  }
  return text;
}

export function readSharedStrings(xml: string) {
  const shared: string[] = [];
  let cursor = 0;
  while (cursor < xml.length) {
    const start = findTag(xml, "si", cursor);
    if (start < 0) break;
    const open = tagEnd(xml, start);
    if (open < 0) break;
    const close = xml.indexOf("</si>", open);
    if (close < 0) break;
    shared.push(readText(xml.slice(start, close)));
    cursor = close + 5;
  }
  return shared;
}

function attribute(tag: string, name: string) {
  const match = tag.match(new RegExp(`\\b${name}="([^"]*)"`));
  return match?.[1] ?? "";
}

function readCells(rowXml: string, shared: string[]) {
  const cells: string[] = [];
  let cursor = 0;
  while (cursor < rowXml.length) {
    const start = findTag(rowXml, "c", cursor);
    if (start < 0) break;
    const open = tagEnd(rowXml, start);
    if (open < 0) break;
    const opening = rowXml.slice(start, open + 1);
    const selfClosing = opening.endsWith("/>");
    let inner = "";
    if (selfClosing) cursor = open + 1;
    else {
      const close = rowXml.indexOf("</c>", open);
      if (close < 0) break;
      inner = rowXml.slice(open + 1, close);
      cursor = close + 4;
    }
    const ref = attribute(opening, "r");
    const index = ref ? columnIndex(ref) : cells.length;
    const type = attribute(opening, "t");
    let value = "";
    if (!selfClosing) {
      if (type === "inlineStr") value = readText(inner);
      else {
        const valueStart = findTag(inner, "v", 0);
        const valueOpen = valueStart < 0 ? -1 : tagEnd(inner, valueStart);
        const valueClose = valueOpen < 0 ? -1 : inner.indexOf("</v>", valueOpen);
        value = valueClose < 0 ? "" : inner.slice(valueOpen + 1, valueClose);
        if (type === "s") value = shared[Number(value)] ?? "";
      }
    }
    cells[index] = decodeXmlEntities(value).trim();
  }
  return cells.map((item) => item ?? "");
}

export function readWorksheet(sheetXml: string, shared: string[]) {
  const rows: string[][] = [];
  let cursor = 0;
  while (cursor < sheetXml.length) {
    const start = findTag(sheetXml, "row", cursor);
    if (start < 0) break;
    const open = tagEnd(sheetXml, start);
    if (open < 0) break;
    if (sheetXml[open - 1] === "/") {
      cursor = open + 1;
      continue;
    }
    const close = sheetXml.indexOf("</row>", open);
    if (close < 0) break;
    const cells = readCells(sheetXml.slice(open + 1, close), shared);
    if (cells.some((cell) => cell !== "")) rows.push(cells);
    cursor = close + 6;
  }
  return rows;
}

export function gridFromSheetXml(sharedXml: string, sheetXml: string) {
  return readWorksheet(sheetXml, readSharedStrings(sharedXml));
}
