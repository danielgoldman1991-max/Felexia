import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { getProductGuide } from "@/lib/content/product-guides";
import type { GuideFile } from "@/lib/guides/download-http";

export async function readGuidePdf(slug: string): Promise<GuideFile | null> {
  const guide = getProductGuide(slug);
  if (!guide || !/^[\w.-]+$/.test(guide.filename)) return null;
  const root = path.resolve(process.cwd(), "private", "guides");
  const file = path.resolve(root, guide.filename);
  if (file !== path.join(root, guide.filename)) return null;
  try {
    const bytes = await readFile(file);
    if (bytes.subarray(0, 5).toString() !== "%PDF-") return null;
    return { bytes, filename: guide.filename };
  } catch {
    return null;
  }
}
