import { NextResponse } from "next/server";
import { buildFec } from "@/lib/accounting/fec";
import { loadAccountingLines, loadEntryHeaders } from "@/lib/accounting/entry-lines";
import { requireActiveWorkspace } from "@/lib/auth";
import { hasFullErpAccess } from "@/lib/launch-access";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const workspace = await requireActiveWorkspace();
  if (!(await hasFullErpAccess(workspace.organization.id))) return new NextResponse("PRO requis", { status: 403 });
  const supabase = await createClient();
  const loaded = await loadAccountingLines(supabase, workspace.organization.id);
  if (loaded.error) return new NextResponse("Export indisponible tant que les écritures ne sont pas lisibles.\n", { status: 200, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  const entryIds = [...new Set(loaded.rows.map((line) => line.entryId).filter((id): id is string => Boolean(id)))];
  const headers = await loadEntryHeaders(supabase, workspace.organization.id, entryIds);
  const body = buildFec(loaded.rows.map((line) => {
    const entry = line.entryId ? headers.headers.get(line.entryId) : undefined;
    const date = entry?.date || "2026-01-01";
    return {
      journalCode: entry?.journalCode || "OD",
      journalLabel: entry?.journalLabel || "Journal",
      entryNumber: entry?.number || "",
      entryDate: date,
      account: line.accountCode,
      accountLabel: line.accountLabel,
      piece: entry?.number || "",
      pieceDate: date,
      label: line.label,
      debit: line.debit,
      credit: line.credit,
    };
  }));
  const note = loaded.truncated ? "Export tronqué à 20000 lignes.\n" : "";
  return new NextResponse(note + body, { headers: { "Content-Type": "text/plain; charset=utf-8", "Content-Disposition": "attachment; filename=fec-preparatoire.txt" } });
}
