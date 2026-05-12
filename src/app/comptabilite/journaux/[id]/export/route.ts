import { getAccountingJournalDetail, listAccountingJournalExportRows } from "@/lib/accounting";
import type { AccountingJournalEntryFilters } from "@/lib/accounting-types";

function filtersFromUrl(url: string): AccountingJournalEntryFilters {
  const search = new URL(url).searchParams;
  return {
    date_from: search.get("date_from") ?? undefined,
    date_to: search.get("date_to") ?? undefined,
    status: search.get("status") ?? undefined,
    source_type: search.get("source_type") ?? undefined,
    account_id: search.get("account_id") ?? undefined,
    third_party_id: search.get("third_party_id") ?? undefined,
    q: search.get("q") ?? undefined,
    pageSize: 10000,
  };
}

function cell(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function amount(value: number) {
  return Number(value ?? 0).toFixed(2);
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const filters = filtersFromUrl(request.url);
  const [detail, rows] = await Promise.all([
    getAccountingJournalDetail(id),
    listAccountingJournalExportRows(id, filters),
  ]);
  if (!detail.journal) return new Response("Journal introuvable", { status: 404 });

  const entriesRows = rows.entries.map((entry) => `
    <tr>
      <td>${cell(entry.entry_date)}</td>
      <td>${cell(entry.entry_number)}</td>
      <td>${cell(detail.journal?.code)}</td>
      <td>${cell(entry.source_document_type ?? "manual")}</td>
      <td>${cell(entry.source_number ?? "")}</td>
      <td>${cell(entry.label)}</td>
      <td>${cell(entry.status)}</td>
      <td>${amount(entry.total_debit)}</td>
      <td>${amount(entry.total_credit)}</td>
    </tr>
  `).join("");

  const lineRows = rows.lines.map((line) => `
    <tr>
      <td>${cell(line.entry_number)}</td>
      <td>${cell(line.entry_date)}</td>
      <td>${cell(`${line.account_code} - ${line.account_label}`)}</td>
      <td>${cell(line.label ?? "")}</td>
      <td></td>
      <td>${amount(line.debit)}</td>
      <td>${amount(line.credit)}</td>
    </tr>
  `).join("");

  const html = `<!doctype html>
  <html>
    <head><meta charset="utf-8" /></head>
    <body>
      <h1>Journal ${cell(detail.journal.code)} - ${cell(detail.journal.name)}</h1>
      <h2>Ecritures</h2>
      <table border="1">
        <thead><tr><th>Date</th><th>N ecriture</th><th>Journal</th><th>Source</th><th>N source</th><th>Libelle</th><th>Statut</th><th>Total debit</th><th>Total credit</th></tr></thead>
        <tbody>${entriesRows}</tbody>
      </table>
      <h2>Lignes d'ecriture</h2>
      <table border="1">
        <thead><tr><th>N ecriture</th><th>Date</th><th>Compte</th><th>Libelle ligne</th><th>Tiers</th><th>Debit</th><th>Credit</th></tr></thead>
        <tbody>${lineRows}</tbody>
      </table>
    </body>
  </html>`;

  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const fileName = `journal-${detail.journal.code}-${now.getFullYear()}-${month}.xls`;
  return new Response(html, {
    headers: {
      "Content-Type": "application/vnd.ms-excel; charset=utf-8",
      "Content-Disposition": `attachment; filename="${fileName}"`,
    },
  });
}
