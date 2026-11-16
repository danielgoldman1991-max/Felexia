import { inflateRawSync } from "node:zlib";

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

export function csvCell(value: unknown) {
  if (value == null) return "";
  const text = value instanceof Date ? value.toISOString() : typeof value === "object" ? JSON.stringify(value) : String(value);
  if (/[;"\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

export function toCsv(rows: Record<string, unknown>[]) {
  const keys = [...new Set(rows.flatMap((row) => Object.keys(row)))];
  const lines = [keys.join(";"), ...rows.map((row) => keys.map((key) => csvCell(row[key])).join(";"))];
  return Buffer.from(`\uFEFF${lines.join("\r\n")}`, "utf8");
}

export function zipStore(files: { name: string; data: Buffer }[]) {
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;
  for (const file of files) {
    const name = Buffer.from(file.name, "utf8");
    const crc = crc32(file.data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0, 8);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(file.data.length, 18);
    local.writeUInt32LE(file.data.length, 22);
    local.writeUInt16LE(name.length, 26);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(file.data.length, 20);
    central.writeUInt32LE(file.data.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt32LE(offset, 42);
    locals.push(local, name, file.data);
    centrals.push(central, name);
    offset += local.length + name.length + file.data.length;
  }
  const directory = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(directory.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, directory, end]);
}

/** Reads ZIP entries stored or deflated. Names containing ".." are refused. */
export function unzip(buffer: Buffer) {
  const files = new Map<string, Buffer>();
  let offset = 0;
  while (offset + 30 <= buffer.length) {
    const signature = buffer.readUInt32LE(offset);
    if (signature === 0x02014b50 || signature === 0x06054b50) break;
    if (signature !== 0x04034b50) throw new Error("Le fichier ZIP est illisible.");
    const flags = buffer.readUInt16LE(offset + 6);
    const method = buffer.readUInt16LE(offset + 8);
    const compressedSize = buffer.readUInt32LE(offset + 18);
    const nameLength = buffer.readUInt16LE(offset + 26);
    const extraLength = buffer.readUInt16LE(offset + 28);
    const name = buffer.subarray(offset + 30, offset + 30 + nameLength).toString("utf8");
    if (name.includes("..") || name.startsWith("/") || name.includes("\\")) throw new Error("Le fichier ZIP contient un chemin refusé.");
    const start = offset + 30 + nameLength + extraLength;
    let size = compressedSize;
    let descriptor = 0;
    if (flags & 0x8 && size === 0) {
      let marker = -1;
      for (let scan = start; scan + 16 <= buffer.length; scan += 1) {
        if (buffer.readUInt32LE(scan) !== 0x08074b50) continue;
        if (buffer.readUInt32LE(scan + 8) === scan - start) {
          marker = scan;
          break;
        }
      }
      if (marker < 0) throw new Error("Ce ZIP utilise un descripteur de données illisible. Enregistrez le classeur à nouveau au format .xlsx.");
      size = marker - start;
      descriptor = 16;
    } else if (flags & 0x8 && start + size + 4 <= buffer.length && buffer.readUInt32LE(start + size) === 0x08074b50) {
      descriptor = 16;
    }
    const compressed = buffer.subarray(start, start + size);
    const data = method === 0 ? Buffer.from(compressed) : method === 8 ? inflateRawSync(compressed) : null;
    if (!data) throw new Error("La compression de ce ZIP n’est pas prise en charge.");
    if (name && !name.endsWith("/")) files.set(name, data);
    offset = start + size + descriptor;
  }
  if (files.size === 0) throw new Error("Le fichier ZIP est vide ou illisible.");
  return files;
}
