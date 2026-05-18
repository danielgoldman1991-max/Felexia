import { csvCell, getVatExportPreview, recordVatExportBatch } from "@/lib/tva";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const preview = await getVatExportPreview({
    from: searchParams.get("from") ?? undefined,
    to: searchParams.get("to") ?? undefined,
    type: searchParams.get("type") ?? undefined,
    regime: searchParams.get("regime") ?? undefined,
    source: searchParams.get("source") ?? undefined,
    status: searchParams.get("status") ?? undefined,
    q: searchParams.get("q") ?? undefined,
  });

  const headers = [
    "Organisation",
    "Période début",
    "Période fin",
    "Type pièce",
    "Numéro pièce",
    "Date pièce",
    "Tiers",
    "ICE tiers",
    "Base HT",
    "Taux TVA",
    "Montant TVA",
    "Total TTC",
    "Statut pièce",
    "Statut comptable",
    "Source",
    "Observation",
  ];

  const rows = preview.rows.map((row) => [
    preview.organization.name,
    preview.filters.from ?? "",
    preview.filters.to ?? "",
    row.documentType,
    row.documentNumber,
    row.documentDate,
    row.thirdPartyName,
    row.thirdPartyIce,
    row.baseHt.toFixed(2),
    row.taxRate === null ? "" : row.taxRate.toFixed(2),
    row.vatAmount.toFixed(2),
    row.totalTtc.toFixed(2),
    row.documentStatus,
    row.accountingStatus,
    row.sourceLabel,
    row.observation,
  ]);

  const csv = [
    headers.map(csvCell).join(","),
    ...rows.map((row) => row.map(csvCell).join(",")),
  ].join("\n");

  const today = new Date().toISOString().slice(0, 10);
  const fileName = `export-tva-felexia-${today}.csv`;
  await recordVatExportBatch(preview, "csv", fileName);

  return new Response(`\uFEFF${csv}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${fileName}"`,
    },
  });
}
