import { NextRequest, NextResponse } from "next/server";
import { getEinvoiceContext, EInvoiceError, uuid } from "@/lib/e-invoicing/access";
import { getEinvoiceArtifact } from "@/lib/e-invoicing/repository";
import { verifiedArtifactBytes } from "@/lib/e-invoicing/integrity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const privateHeaders = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };

export async function GET(request: NextRequest, { params }: { params: Promise<{ kind: string; sourceId: string }> }) {
  const c = await getEinvoiceContext();
  try {
    const { kind, sourceId } = await params;
    if (kind !== "factures" && kind !== "avoirs") throw new EInvoiceError("INVALID_SOURCE", "Pièce introuvable.", 404);
    const format = request.nextUrl.searchParams.get("format");
    if (format !== "pdf" && format !== "xml") throw new EInvoiceError("INVALID_FORMAT", "Format inconnu.");
    const version = request.nextUrl.searchParams.get("version");
    const { document, artifact } = await getEinvoiceArtifact(c.client, c.workspace.organization.id, kind === "factures" ? "invoice" : "credit_note", uuid(sourceId), format, version ? uuid(version) : undefined);
    const bytes = verifiedArtifactBytes(artifact);
    if (format === "pdf" && bytes.subarray(0, 5).toString() !== "%PDF-") throw new EInvoiceError("ARCHIVE_INTEGRITY_FAILED", "Archive invalide.", 409);
    const filename = `${document.source_number.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 90) || "document"}-${artifact.version_id}.${format}`;
    const disposition = format === "pdf" && request.nextUrl.searchParams.get("inline") === "1" ? "inline" : "attachment";
    return new NextResponse(new Uint8Array(bytes), { headers: { ...privateHeaders, "Content-Type": format === "pdf" ? "application/pdf" : "application/xml; charset=utf-8", "Content-Length": String(bytes.length), "Content-Disposition": `${disposition}; filename="${filename}"`, "ETag": `"${artifact.sha256}"` } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof EInvoiceError ? error.message : "Archive indisponible.", code: error instanceof EInvoiceError ? error.code : "ARCHIVE_UNAVAILABLE" }, { status: error instanceof EInvoiceError ? error.status : 503, headers: privateHeaders });
  }
}
