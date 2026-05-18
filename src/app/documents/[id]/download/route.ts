import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireActiveWorkspace } from "@/lib/auth";

const DOCUMENTS_BUCKET = "organization-documents";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const workspace = await requireActiveWorkspace();
  const supabase = await createClient();

  const { data: document, error } = await supabase
    .from("documents")
    .select("id, file_path, title, original_name")
    .eq("organization_id", workspace.organization.id)
    .eq("id", id)
    .maybeSingle();

  if (error || !document?.file_path) {
    return NextResponse.json({ error: "Impossible de générer le lien de téléchargement." }, { status: 404 });
  }

  const { data, error: signedError } = await supabase.storage
    .from(DOCUMENTS_BUCKET)
    .createSignedUrl(document.file_path as string, 60 * 5, {
      download: (document.original_name as string | null) ?? (document.title as string | null) ?? "document",
    });

  if (signedError || !data?.signedUrl) {
    return NextResponse.json({ error: "Impossible de générer le lien de téléchargement." }, { status: 500 });
  }

  return NextResponse.redirect(data.signedUrl);
}
