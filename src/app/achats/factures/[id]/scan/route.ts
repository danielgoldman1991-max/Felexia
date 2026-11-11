import { getSupplierInvoiceScan } from "@/lib/purchases/supplier-invoice-ocr-actions";
import { SCAN_BUCKET } from "@/lib/purchases/supplier-invoice-ocr";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const scan = await getSupplierInvoiceScan(id);
  if (!scan) return new Response("Pièce jointe introuvable.", { status: 404 });
  const supabase = await createClient();
  const downloaded = await supabase.storage.from(SCAN_BUCKET).download(scan.path);
  if (downloaded.error || !downloaded.data) return new Response("Pièce jointe introuvable.", { status: 404 });
  const bytes = Buffer.from(await downloaded.data.arrayBuffer());
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": scan.mimeType,
      "Content-Disposition": `attachment; filename="${scan.fileName.replace(/"/g, "")}"`,
      "Cache-Control": "private, no-store",
      "X-Robots-Tag": "noindex",
    },
  });
}
