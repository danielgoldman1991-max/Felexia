import { NextResponse } from "next/server";
import { fecAuxiliaryColumns, loadEntryThirdParties } from "@/lib/accounting/fec-parties";
import { buildFec } from "@/lib/accounting/fec";
import { loadAccountingAuxiliaries, loadAccountingLines, loadEntryHeaders } from "@/lib/accounting/entry-lines";
import { requireActiveWorkspace } from "@/lib/auth";
import { hasFullErpAccess } from "@/lib/launch-access";
import { createClient } from "@/lib/supabase/server";

function isRedirect(error: unknown) {
  const digest = error && typeof error === "object" ? (error as { digest?: string }).digest : undefined;
  return typeof digest === "string" && digest.startsWith("NEXT_REDIRECT");
}

export async function GET() {
  let workspace;
  try {
    workspace = await requireActiveWorkspace({ module: "comptabilite", level: "read" });
  } catch (error) {
    if (isRedirect(error)) throw error;
    return new NextResponse(error instanceof Error ? error.message : "Accès refusé", { status: 403 });
  }
  if (!(await hasFullErpAccess(workspace.organization.id))) return new NextResponse("PRO requis", { status: 403 });
  const supabase = await createClient();
  const loaded = await loadAccountingLines(supabase, workspace.organization.id);
  if (loaded.error) return new NextResponse("Export indisponible tant que les écritures ne sont pas lisibles.\n", { status: 200, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  const entryIds = [...new Set(loaded.rows.map((line) => line.entryId).filter((id): id is string => Boolean(id)))];
  const headers = await loadEntryHeaders(supabase, workspace.organization.id, entryIds);
  const auxiliaries = await loadAccountingAuxiliaries(supabase, workspace.organization.id, loaded.rows.map((line) => line.auxiliaryId ?? ""));
  const parties = await loadEntryThirdParties(supabase, workspace.organization.id, headers.headers);
  const body = buildFec(loaded.rows.map((line) => {
    const entry = line.entryId ? headers.headers.get(line.entryId) : undefined;
    const auxiliary = line.auxiliaryId ? auxiliaries.get(line.auxiliaryId) : undefined;
    const party = line.entryId ? parties.get(line.entryId) ?? null : null;
    const columns = fecAuxiliaryColumns(line.accountCode, auxiliary, party);
    const date = entry?.date || "2026-01-01";
    return {
      journalCode: entry?.journalCode || "OD",
      journalLabel: entry?.journalLabel || "Journal",
      entryNumber: entry?.number || "",
      entryDate: date,
      account: line.accountCode,
      accountLabel: line.accountLabel,
      auxiliaryNumber: columns.number,
      auxiliaryLabel: columns.label,
      piece: entry?.number || "",
      pieceDate: date,
      label: line.label,
      debit: line.debit,
      credit: line.credit,
      letter: line.letter || "",
      letterDate: line.letterDate || "",
    };
  }));
  const note = loaded.truncated ? "Export tronqué à 20000 lignes.\n" : "";
  return new NextResponse(note + body, { headers: { "Content-Type": "text/plain; charset=utf-8", "Content-Disposition": "attachment; filename=fec-preparatoire.txt" } });
}
