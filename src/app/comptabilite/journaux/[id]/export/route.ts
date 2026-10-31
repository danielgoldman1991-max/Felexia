import { getAccountingJournalDetail, listAccountingJournalExportRows } from "@/lib/accounting";
import type { AccountingJournalEntryFilters } from "@/lib/accounting-types";
import { requireActiveWorkspace } from "@/lib/auth";

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
  const [workspace, detail, rows] = await Promise.all([
    requireActiveWorkspace(),
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
      <td class="amount">${amount(entry.total_debit)}</td>
      <td class="amount">${amount(entry.total_credit)}</td>
    </tr>
  `).join("");

  const lineRows = rows.lines.map((line) => `
    <tr>
      <td>${cell(line.entry_number)}</td>
      <td>${cell(line.entry_date)}</td>
      <td>${cell(`${line.account_code} - ${line.account_label}`)}</td>
      <td>${cell(line.label ?? "")}</td>
      <td></td>
      <td class="amount">${amount(line.debit)}</td>
      <td class="amount">${amount(line.credit)}</td>
    </tr>
  `).join("");

  const html = `<!doctype html>
  <html lang="fr" xmlns:x="urn:schemas-microsoft-com:office:excel">
    <head>
      <meta charset="utf-8" />
      <title>Journal ${cell(detail.journal.code)} - ${cell(workspace.organization.name)}</title>
      <style>
        body { font-family: Calibri, Arial, sans-serif; color: #14213d; margin: 28px; font-size: 11pt; }
        h1 { font-size: 22pt; color: #14213d; margin: 8px 0 12px; }
        h2 { font-size: 14pt; color: #2454d8; margin: 28px 0 10px; }
        p { margin: 4px 0; }
        .company { font-size: 12pt; font-weight: bold; }
        .metadata { color: #52627a; font-size: 10pt; }
        table { border-collapse: collapse; width: 100%; }
        th { background: #14213d; color: #ffffff; font-weight: bold; text-align: left; padding: 10px 12px; border: 1px solid #14213d; }
        td { padding: 8px 12px; border: 1px solid #dce4ef; vertical-align: top; }
        tbody tr:nth-child(even) td { background: #f5f7fb; }
        .amount { text-align: right; white-space: nowrap; mso-number-format: "#,##0.00"; }
        .caption { margin-top: 24px; padding-top: 10px; border-top: 1px solid #dce4ef; color: #52627a; font-size: 9pt; }
      </style>
    </head>
    <body>
      <p class="company">${cell(workspace.organization.name)}</p>
      <h1>Journal ${cell(detail.journal.code)} - ${cell(detail.journal.name)}</h1>
      <p class="metadata">Période : ${cell(filters.date_from || "Depuis l’origine")} au ${cell(filters.date_to || "dernier mouvement")}</p>
      <p class="metadata">${rows.entries.length} écriture(s) · ${rows.lines.length} ligne(s) d’écriture</p>
      <h2>Écritures</h2>
      <table>
        <thead><tr><th>Date</th><th>N° d’écriture</th><th>Journal</th><th>Source</th><th>N° source</th><th>Libellé</th><th>Statut</th><th>Total débit</th><th>Total crédit</th></tr></thead>
        <tbody>${entriesRows}</tbody>
      </table>
      <h2>Lignes d’écriture</h2>
      <table>
        <thead><tr><th>N° d’écriture</th><th>Date</th><th>Compte</th><th>Libellé de la ligne</th><th>Tiers</th><th>Débit</th><th>Crédit</th></tr></thead>
        <tbody>${lineRows}</tbody>
      </table>
      <p class="caption">${cell(workspace.organization.name)} · Journal ${cell(detail.journal.code)} · Export Felexia Pro</p>
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
