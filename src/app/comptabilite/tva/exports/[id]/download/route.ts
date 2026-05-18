import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireActiveWorkspace } from "@/lib/auth";
import { TAX_EXPORTS_BUCKET } from "@/lib/tva";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const workspace = await requireActiveWorkspace();
  const supabase = await createClient();

  const { data: batch, error } = await supabase
    .from("tax_export_batches")
    .select("id, file_path, file_name, status")
    .eq("organization_id", workspace.organization.id)
    .eq("id", id)
    .maybeSingle();

  if (error || !batch?.file_path) {
    return NextResponse.json({ error: "Impossible de générer le lien de téléchargement." }, { status: 404 });
  }

  const { data, error: signedError } = await supabase.storage
    .from(TAX_EXPORTS_BUCKET)
    .createSignedUrl(batch.file_path as string, 60 * 5, {
      download: (batch.file_name as string | null) ?? "export-tva-dgi-preparatoire.csv",
    });

  if (signedError || !data?.signedUrl) {
    return NextResponse.json({ error: "Impossible de générer le lien de téléchargement." }, { status: 500 });
  }

  if (batch.status !== "downloaded" && batch.status !== "archived") {
    await supabase
      .from("tax_export_batches")
      .update({ status: "downloaded" })
      .eq("organization_id", workspace.organization.id)
      .eq("id", id);
  }

  return NextResponse.redirect(data.signedUrl);
}
