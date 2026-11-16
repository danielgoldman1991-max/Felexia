import { writeXlsx } from "@/lib/spreadsheet/minimal-xlsx";
import { THIRD_PARTY_IMPORT_HEADERS, THIRD_PARTY_IMPORT_TEMPLATE } from "@/lib/tiers/third-party-import";

export function GET() {
  const rows = THIRD_PARTY_IMPORT_TEMPLATE.split(/\r?\n/).filter((line) => !line.startsWith("#")).map((line) => line.split(";"));
  if (rows[0]?.join(";") !== THIRD_PARTY_IMPORT_HEADERS.join(";")) rows.unshift([...THIRD_PARTY_IMPORT_HEADERS]);
  const body = writeXlsx(rows);
  return new Response(new Uint8Array(body), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": "attachment; filename=\"modele-clients.xlsx\"",
      "Cache-Control": "no-store",
    },
  });
}
