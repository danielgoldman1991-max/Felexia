import { notFound } from "next/navigation";
import { requireActiveWorkspace } from "@/lib/auth";
import { getAccountingJournalDetail, listAccountingJournalEntries } from "@/lib/accounting";
import { formatDate, formatMoney } from "@/lib/format";
import { ACCOUNTING_SOURCE_LABELS } from "@/components/accounting/accounting-source-badge";
import { ENTRY_STATUS_LABELS } from "@/lib/accounting-types";
import type { AccountingJournalEntryFilters } from "@/lib/accounting-types";
import { getOrganizationDocumentIdentity } from "@/lib/company-identity";
import { documentIdentityContact, documentIdentityInfoLines } from "@/lib/print-format";
import { PrintActions } from "@/components/sales/print-actions";
import { PrintPage } from "@/components/print/PrintPage";
import { PrintHeader } from "@/components/print/PrintHeader";
import { PrintOrganizationIdentity } from "@/components/print/PrintOrganizationIdentity";
import { PrintDocumentTitle } from "@/components/print/PrintDocumentTitle";
import { PrintLineTable } from "@/components/print/PrintLineTable";
import { PrintFooter } from "@/components/print/PrintFooter";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function value(params: Record<string, string | string[] | undefined>, key: string) {
  const raw = params[key];
  return Array.isArray(raw) ? raw[0] : raw;
}

function filtersFromParams(params: Record<string, string | string[] | undefined>): AccountingJournalEntryFilters {
  return {
    date_from: value(params, "date_from"),
    date_to: value(params, "date_to"),
    status: value(params, "status"),
    source_type: value(params, "source_type"),
    account_id: value(params, "account_id"),
    third_party_id: value(params, "third_party_id"),
    q: value(params, "q"),
    pageSize: 10000,
  };
}

export default async function AccountingJournalPrintPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: SearchParams }) {
  const { id } = await params;
  const filters = filtersFromParams(await searchParams);
  const [workspace, detail, list] = await Promise.all([
    requireActiveWorkspace(),
    getAccountingJournalDetail(id),
    listAccountingJournalEntries(id, filters),
  ]);
  if (!detail.journal) notFound();
  const identity = await getOrganizationDocumentIdentity(workspace.organization.id);
  const companyContact = documentIdentityContact(identity);
  const backSearch = new URLSearchParams();
  for (const [key, filter] of Object.entries(filters)) {
    if (key !== "pageSize" && typeof filter === "string" && filter) backSearch.set(key, filter);
  }
  const backHref = `/comptabilite/journaux/${id}${backSearch.size ? `?${backSearch.toString()}` : ""}`;
  const filterDescriptions = [
    filters.status ? `Statut : ${ENTRY_STATUS_LABELS[filters.status] ?? filters.status}` : null,
    filters.source_type ? `Source : ${ACCOUNTING_SOURCE_LABELS[filters.source_type] ?? filters.source_type}` : null,
    filters.account_id ? "Compte sélectionné" : null,
    filters.third_party_id ? "Tiers sélectionné" : null,
    filters.q ? `Recherche : ${filters.q}` : null,
  ].filter(Boolean);

  return (
    <div className="print-preview">
      <PrintActions backHref={backHref} backLabel="Retour au journal" />
      <PrintPage orientation="landscape">
        <PrintHeader>
          <PrintOrganizationIdentity identity={identity} infoLines={documentIdentityInfoLines(identity)} contact={companyContact} />
          <PrintDocumentTitle title="Journal comptable" documentNumber={detail.journal.code}>
            <p><strong>Journal :</strong> {detail.journal.name}</p>
            <p><strong>Période :</strong> {filters.date_from ? formatDate(filters.date_from) : "Depuis l’origine"} au {filters.date_to ? formatDate(filters.date_to) : "dernier mouvement"}</p>
            <p><strong>Édité le :</strong> {formatDate(new Date())}</p>
          </PrintDocumentTitle>
        </PrintHeader>
        {filterDescriptions.length > 0 ? <p className="print-report-note">Filtres appliqués : {filterDescriptions.join(" · ")}</p> : null}
        <section className="print-report-summary" aria-label="Synthèse du journal">
          <div><p className="print-report-summary-label">Écritures</p><p className="print-report-summary-value">{list.stats.entries_count}</p></div>
          <div><p className="print-report-summary-label">Total débit</p><p className="print-report-summary-value">{formatMoney(list.stats.total_debit)}</p></div>
          <div><p className="print-report-summary-label">Total crédit</p><p className="print-report-summary-value">{formatMoney(list.stats.total_credit)}</p></div>
        </section>
        <PrintLineTable variant="report" head={<><th>Date</th><th>N° d’écriture</th><th>Source</th><th>Libellé</th><th className="right">Débit</th><th className="right">Crédit</th><th>Statut</th></>}>
          {list.entries.map((entry) => (
            <tr key={entry.id}>
              <td>{formatDate(entry.entry_date)}</td>
              <td className="strong print-reference">{entry.entry_number}</td>
              <td>{ACCOUNTING_SOURCE_LABELS[entry.source_document_type ?? "manual"] ?? entry.source_document_type ?? "Manuel"}{entry.source_number ? <p className="muted">{entry.source_number}</p> : null}</td>
              <td>{entry.label}</td>
              <td className="num">{formatMoney(entry.total_debit)}</td>
              <td className="num">{formatMoney(entry.total_credit)}</td>
              <td>{ENTRY_STATUS_LABELS[entry.status] ?? entry.status}</td>
            </tr>
          ))}
          {list.entries.length === 0 ? <tr><td colSpan={7} className="print-report-empty">Aucune écriture pour les critères sélectionnés.</td></tr> : null}
        </PrintLineTable>
        <section className="print-signature print-signature-duo" aria-label="Validation du journal"><div className="print-signature-box">Visa du responsable</div><div className="print-signature-box">Cachet de l’entreprise</div></section>
        <PrintFooter footerText={identity.footerText} name={identity.name} contact={companyContact} />
      </PrintPage>
    </div>
  );
}
