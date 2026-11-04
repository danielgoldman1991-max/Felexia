import { NextResponse } from "next/server";
import { requireActiveWorkspace } from "@/lib/auth";
import { csvResponse } from "@/lib/listing";
import { writeXlsx } from "@/lib/spreadsheet/minimal-xlsx";
import { loadVatDeductionInvoices } from "@/lib/tax/vat-deduction-query";
import { deductionPeriod, deductionTable } from "@/lib/tax/vat-deduction-report";

function isRedirect(error: unknown) {
  const digest = error && typeof error === "object" ? (error as { digest?: string }).digest : undefined;
  return typeof digest === "string" && digest.startsWith("NEXT_REDIRECT");
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const period = deductionPeriod(url.searchParams.get("from"), url.searchParams.get("to"));
  if (!period.ok) return new NextResponse(period.error, { status: 400 });
  try {
    const workspace = await requireActiveWorkspace({ modules: ["tva", "comptabilite"], level: "read" });
    const invoices = await loadVatDeductionInvoices(workspace.organization.id, period.from, period.to);
    const table = deductionTable(invoices);
    const name = `releve-deductions-${period.from}-${period.to}`;
    if (url.searchParams.get("format") === "xlsx") {
      return new NextResponse(new Uint8Array(writeXlsx(table)), {
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="${name}.xlsx"`,
          "Cache-Control": "private, no-store",
        },
      });
    }
    return csvResponse(name, table[0] ?? [], table.slice(1));
  } catch (error) {
    if (isRedirect(error)) throw error;
    return new NextResponse(error instanceof Error ? error.message : "Export indisponible", { status: 403 });
  }
}
