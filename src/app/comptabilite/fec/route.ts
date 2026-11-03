import { NextResponse } from "next/server";
import { buildFec } from "@/lib/accounting/fec";
import { requireActiveWorkspace } from "@/lib/auth";
import { hasFullErpAccess } from "@/lib/launch-access";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const workspace = await requireActiveWorkspace();
  if (!(await hasFullErpAccess(workspace.organization.id))) return new NextResponse("PRO requis", { status: 403 });
  const supabase = await createClient();
  const { data } = await supabase.from("accounting_entry_lines").select("account_code, account_label, debit, credit, label, entry_id").eq("organization_id", workspace.organization.id).limit(5000);
  const entryIds = [...new Set((data ?? []).map((line) => line.entry_id).filter(Boolean))] as string[];
  const { data: entries } = entryIds.length
    ? await supabase.from("accounting_entries").select("id, entry_number, entry_date").in("id", entryIds)
    : { data: [] };
  const byId = new Map((entries ?? []).map((entry) => [entry.id as string, entry]));
  const body = buildFec((data ?? []).map((line) => {
    const entry = byId.get(line.entry_id as string);
    const date = String(entry?.entry_date ?? "").slice(0, 10);
    return {
      journalCode: "OD",
      journalLabel: "Journal",
      entryNumber: String(entry?.entry_number ?? ""),
      entryDate: date || "2026-01-01",
      account: String(line.account_code ?? ""),
      accountLabel: String(line.account_label ?? ""),
      piece: String(entry?.entry_number ?? ""),
      pieceDate: date || "2026-01-01",
      label: String(line.label ?? ""),
      debit: Number(line.debit ?? 0),
      credit: Number(line.credit ?? 0),
    };
  }));
  return new NextResponse(body, { headers: { "Content-Type": "text/plain; charset=utf-8", "Content-Disposition": "attachment; filename=fec-preparatoire.txt" } });
}
