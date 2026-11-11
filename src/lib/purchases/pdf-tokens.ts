import type { TextToken } from "@/lib/purchases/invoice-parser";

export function tokensFromPdfItems(items: unknown[], pageHeight: number): TextToken[] {
  const tokens: TextToken[] = [];
  for (const item of items) {
    if (!item || typeof item !== "object" || !("str" in item)) continue;
    const row = item as { str?: string; transform?: number[]; width?: number; height?: number };
    const text = row.str?.trim() ?? "";
    if (!text || !row.transform) continue;
    const height = row.height || Math.hypot(row.transform[2] ?? 0, row.transform[3] ?? 0) || 10;
    tokens.push({ text, x: row.transform[4] ?? 0, y: pageHeight - (row.transform[5] ?? 0), w: row.width || text.length * 4, h: height });
  }
  return tokens;
}
