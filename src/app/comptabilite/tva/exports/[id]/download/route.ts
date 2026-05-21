import { NextResponse } from "next/server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireActiveWorkspace } from "@/lib/auth";

const TAX_EXPORTS_BUCKET = "tax-exports";

type DownloadFile = "xml" | "csv" | "xlsx" | "manifest" | "validation";

const PATH_BY_FILE: Record<DownloadFile, string> = {
  xml: "xml_path",
  csv: "csv_path",
  xlsx: "xlsx_path",
  manifest: "manifest_path",
  validation: "validation_report_path",
};

const DEFAULT_FILE: DownloadFile = "xml";

function requestedFile(request: Request): DownloadFile {
  const value = new URL(request.url).searchParams.get("file");
  return value && value in PATH_BY_FILE ? value as DownloadFile : DEFAULT_FILE;
}

async function auditDownload(batchId: string, file: DownloadFile) {
  try {
    const workspace = await requireActiveWorkspace();
    const supabase = await createClient();
    await supabase.from("audit_logs").insert({
      organization_id: workspace.organization.id,
      actor_id: workspace.userId,
      table_name: "tax_export_batches",
      record_id: batchId,
      action: "dgi_vat_export_downloaded",
      changes: { file },
    });
  } catch {
    // Best effort only.
  }
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const file = requestedFile(request);
  const workspace = await requireActiveWorkspace();
  const supabase = await createClient();

  const { data: batch, error } = await supabase
    .from("tax_export_batches")
    .select("id, file_bucket, xml_path, csv_path, xlsx_path, manifest_path, validation_report_path, download_count")
    .eq("organization_id", workspace.organization.id)
    .eq("id", id)
    .maybeSingle();

  if (error || !batch) {
    return NextResponse.json({ error: "Export TVA introuvable pour l'organisation active." }, { status: 404 });
  }

  const path = batch[PATH_BY_FILE[file] as keyof typeof batch] as string | null;
  if (!path) {
    return NextResponse.json({ error: "Le fichier demandé n'est pas disponible pour cet export." }, { status: 404 });
  }

  const fileName = path.split("/").pop() ?? `export-tva-dgi-preparatoire.${file}`;
  const { data, error: signedError } = await supabase.storage
    .from((batch.file_bucket as string | null) ?? TAX_EXPORTS_BUCKET)
    .createSignedUrl(path, 60 * 5, { download: fileName });

  if (signedError || !data?.signedUrl) {
    return NextResponse.json({ error: "Impossible de générer le lien sécurisé de téléchargement." }, { status: 500 });
  }

  await supabase
    .from("tax_export_batches")
    .update({
      status: "downloaded",
      download_count: Number(batch.download_count ?? 0) + 1,
      downloaded_at: new Date().toISOString(),
    })
    .eq("organization_id", workspace.organization.id)
    .eq("id", id);

  await auditDownload(id, file);

  redirect(data.signedUrl);
}
