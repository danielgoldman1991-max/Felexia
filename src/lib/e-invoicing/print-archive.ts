import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { EInvoiceError, sourceRoute } from "./access";

/** Legacy invoices remain live until electronic issuance. Issued copies always use the frozen PDF. */
export async function redirectIssuedEinvoicePrint(organizationId: string, kind: "invoice" | "credit_note", sourceId: string) {
  const client = await createClient();
  const { data, error } = await client.from("einvoice_documents").select("id,issued_at,current_version_id").eq("organization_id", organizationId).eq("source_kind", kind).eq("source_id", sourceId).maybeSingle();
  if (error && ["42P01", "PGRST205"].includes(error.code)) return; // Additive module has not been installed yet.
  if (error) throw new EInvoiceError("ARCHIVE_UNAVAILABLE", "L’archive émise n’a pas pu être vérifiée.", 503);
  if (data?.issued_at) {
    if (!data.current_version_id) throw new EInvoiceError("ARCHIVE_UNAVAILABLE", "L’archive émise est indisponible.", 503);
    redirect(`${sourceRoute(kind, sourceId)}/download?format=pdf&inline=1&version=${data.current_version_id}`);
  }
}
