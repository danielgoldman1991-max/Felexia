import { requireActiveWorkspace } from "@/lib/auth";
import { isAdminRole } from "@/lib/auth/roles";
import { hasFullErpAccess } from "@/lib/launch-access";
import { toCsv, zipStore } from "@/lib/export/archive";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const TABLES = [
  ["tiers.csv", "third_parties"],
  ["factures-clients.csv", "customer_invoices"],
  ["lignes-factures-clients.csv", "customer_invoice_lines"],
  ["factures-fournisseurs.csv", "supplier_invoices"],
  ["lignes-factures-fournisseurs.csv", "supplier_invoice_lines"],
  ["reglements-clients.csv", "customer_payments"],
  ["reglements-fournisseurs.csv", "supplier_payments"],
  ["articles.csv", "products"],
  ["ecritures.csv", "accounting_entries"],
  ["lignes-ecritures.csv", "accounting_entry_lines"],
] as const;

async function readTable(supabase: Awaited<ReturnType<typeof createClient>>, table: string, organizationId: string) {
  const rows: Record<string, unknown>[] = [];
  for (let from = 0; from < 50000; from += 1000) {
    const { data, error } = await supabase.from(table).select("*").eq("organization_id", organizationId).order("id").range(from, from + 999);
    if (error) throw new Error(error.message);
    const batch = (data ?? []) as Record<string, unknown>[];
    rows.push(...batch);
    if (batch.length < 1000) break;
  }
  return rows;
}

export async function GET() {
  const workspace = await requireActiveWorkspace();
  if (!isAdminRole(workspace.role)) {
    return new Response("Réservé au propriétaire ou à l’administrateur de l’entreprise.", { status: 403 });
  }
  const organizationId = workspace.organization.id;
  const supabase = await createClient();
  const includeHr = await hasFullErpAccess(organizationId);
  try {
    const files: { name: string; data: Buffer }[] = await Promise.all(TABLES.map(async ([name, table]) => ({ name, data: toCsv(await readTable(supabase, table, organizationId)) })));
    if (includeHr) files.push({ name: "salaries.csv", data: toCsv(await readTable(supabase, "hr_employees", organizationId)) });
    const note = [
      "Export Felexia de l’entreprise ouverte dans votre session.",
      "Chaque fichier ne contient que les lignes de cette entreprise.",
      includeHr ? "Les salariés sont inclus car l’entreprise est en offre PRO." : "Les salariés ne sont pas inclus : ils sont réservés à l’offre PRO.",
      "Lecture seule : cet export ne modifie aucune donnée.",
    ].join("\r\n");
    files.unshift({ name: "lire-moi.txt", data: Buffer.from(note, "utf8") });
    const zip = zipStore(files);
    return new Response(new Uint8Array(zip), {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": "attachment; filename=\"felexia-entreprise.zip\"",
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return new Response("L’export de l’entreprise a échoué. Réessayez dans un instant.", { status: 500 });
  }
}
