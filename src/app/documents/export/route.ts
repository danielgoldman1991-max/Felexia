import { listUnifiedDocuments } from "@/lib/documents";

function csvCell(value: unknown) {
  const text = value === null || value === undefined ? "" : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const result = await listUnifiedDocuments({
    query: searchParams.get("q") ?? undefined,
    documentType: searchParams.get("type") ?? undefined,
    sourceModule: searchParams.get("module") ?? undefined,
    status: searchParams.get("status") ?? undefined,
    dateFrom: searchParams.get("dateFrom") ?? undefined,
    dateTo: searchParams.get("dateTo") ?? undefined,
  });

  const headers = [
    "Source",
    "Type document",
    "Numéro",
    "Titre",
    "Tiers",
    "Statut",
    "Date",
    "Total TTC",
    "Nom fichier",
    "Lien",
    "Créé le",
  ];

  const rows = result.rows.map((document) => [
    document.source_label,
    document.document_type_label,
    document.document_number,
    document.title,
    document.third_party_name,
    document.status,
    document.issue_date,
    document.total_ttc,
    document.file_name,
    document.print_url,
    document.created_at,
  ]);

  const csv = [
    headers.map(csvCell).join(","),
    ...rows.map((row) => row.map(csvCell).join(",")),
  ].join("\n");

  return new Response(`\uFEFF${csv}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="documents-felexia.csv"',
    },
  });
}
