import { THIRD_PARTY_IMPORT_TEMPLATE } from "@/lib/tiers/third-party-import";

export function GET() {
  return new Response(`\uFEFF${THIRD_PARTY_IMPORT_TEMPLATE}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": "attachment; filename=\"modele-tiers.csv\"",
    },
  });
}
