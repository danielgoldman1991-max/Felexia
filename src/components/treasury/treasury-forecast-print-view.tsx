import type { OrganizationIdentity } from "@/lib/company-identity";
import { formatDate, formatMoney } from "@/lib/format";
import { documentIdentityContact, documentIdentityInfoLines } from "@/lib/print-format";
import type { TreasuryForecastItem, TreasuryForecastResult } from "@/lib/treasury/treasury-forecast";
import { PrintPage } from "@/components/print/PrintPage";
import { PrintHeader } from "@/components/print/PrintHeader";
import { PrintOrganizationIdentity } from "@/components/print/PrintOrganizationIdentity";
import { PrintDocumentTitle } from "@/components/print/PrintDocumentTitle";
import { PrintLineTable } from "@/components/print/PrintLineTable";
import { PrintTerms } from "@/components/print/PrintTerms";
import { PrintFooter } from "@/components/print/PrintFooter";

const scenarioLabels = { prudent: "Prudent", realistic: "Réaliste", optimistic: "Optimiste" };
const statusLabels: Record<string, string> = { validated: "Validée", sent: "Envoyée", partially_paid: "Partiellement payée", overdue: "En retard", paid: "Payée", draft: "Brouillon", cancelled: "Annulée", planned: "Planifiée", confirmed: "Confirmée", realized: "Réalisée", ignored: "Ignorée" };

function sourceLabel(item: TreasuryForecastItem) {
  if (item.sourceType === "customer_invoice") return "Facture client";
  if (item.sourceType === "supplier_invoice") return "Facture fournisseur";
  if (item.sourceType === "scheduled_payment") return "Paiement programmé";
  return "Prévision manuelle";
}

export function TreasuryForecastPrintView({ identity, forecast }: { identity: OrganizationIdentity; forecast: TreasuryForecastResult }) {
  const { hypothesis } = forecast;
  const companyContact = documentIdentityContact(identity);
  const items = [...forecast.inflows, ...forecast.outflows].sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const summary = [
    { label: "Solde de départ", value: formatMoney(forecast.openingBalance) },
    { label: "Encaissements attendus", value: formatMoney(forecast.totalExpectedInflows) },
    { label: "Décaissements attendus", value: formatMoney(forecast.totalExpectedOutflows) },
    { label: "Solde prévisionnel final", value: formatMoney(forecast.closingForecastBalance) },
    { label: "Point bas de trésorerie", value: formatMoney(forecast.lowestForecastBalance) },
    { label: "Jours à solde négatif", value: forecast.criticalDaysCount },
  ];

  return (
    <PrintPage orientation="landscape">
      <PrintHeader>
        <PrintOrganizationIdentity identity={identity} infoLines={documentIdentityInfoLines(identity)} contact={companyContact} />
        <PrintDocumentTitle title="Prévisions de trésorerie">
          <p><strong>Période :</strong> {formatDate(hypothesis.from)} au {formatDate(hypothesis.to)}</p>
          <p><strong>Scénario :</strong> {scenarioLabels[hypothesis.scenario]}</p>
          <p><strong>Périmètre :</strong> {hypothesis.accountName || `${hypothesis.activeAccountCount} compte(s) actif(s)`}</p>
          <p><strong>Édité le :</strong> {formatDate(new Date())}</p>
        </PrintDocumentTitle>
      </PrintHeader>

      <section className="print-report-summary" aria-label="Synthèse de trésorerie">
        {summary.map((item) => <div key={item.label}><p className="print-report-summary-label">{item.label}</p><p className="print-report-summary-value">{item.value}</p></div>)}
      </section>

      <h2 className="print-report-section-title">Calendrier des flux attendus</h2>
      <PrintLineTable variant="report" head={<><th>Date</th><th>Source / document</th><th>Tiers / libellé</th><th className="right">Entrée pondérée</th><th className="right">Sortie pondérée</th><th className="right">Prob. de base</th><th className="right">Solde du jour</th><th>Statut</th></>}>
        {items.map((item) => {
          const day = forecast.daily.find((point) => point.date === (item.dueDate < hypothesis.from ? hypothesis.from : item.dueDate));
          return <tr key={item.id}>
            <td>{formatDate(item.dueDate)}{item.hasFallbackDate ? <p className="muted">Échéance estimée</p> : null}</td>
            <td>{sourceLabel(item)}{item.documentNumber ? <p className="muted">{item.documentNumber}</p> : null}</td>
            <td>{item.thirdPartyName ? <p className="strong">{item.thirdPartyName}</p> : null}<p>{item.label}</p></td>
            <td className="num">{item.direction === "inflow" ? formatMoney(item.weightedAmount) : "—"}</td>
            <td className="num">{item.direction === "outflow" ? formatMoney(item.weightedAmount) : "—"}</td>
            <td className="num">{Math.round(item.probability)} %</td>
            <td className="num">{day ? formatMoney(day.closingBalance) : "—"}</td>
            <td>{statusLabels[item.status] ?? item.status}</td>
          </tr>;
        })}
        {items.length === 0 ? <tr><td colSpan={8} className="print-report-empty">Aucun flux attendu pour la période et les critères sélectionnés.</td></tr> : null}
      </PrintLineTable>

      <h2 className="print-report-section-title">Évolution quotidienne du solde</h2>
      <PrintLineTable variant="report" head={<><th>Date</th><th className="right">Solde d’ouverture</th><th className="right">Encaissements</th><th className="right">Décaissements</th><th className="right">Flux net</th><th className="right">Solde de clôture</th></>}>
        {forecast.daily.map((day) => <tr key={day.date}><td>{formatDate(day.date)}</td><td className="num">{formatMoney(day.openingBalance)}</td><td className="num">{formatMoney(day.inflows)}</td><td className="num">{formatMoney(day.outflows)}</td><td className="num">{formatMoney(day.netFlow)}</td><td className="num strong">{formatMoney(day.closingBalance)}</td></tr>)}
        {forecast.daily.length === 0 ? <tr><td colSpan={6} className="print-report-empty">Aucune journée dans la période sélectionnée.</td></tr> : null}
      </PrintLineTable>

      {forecast.alerts.length > 0 ? <PrintTerms title="Points d’attention">{forecast.alerts.map((alert) => `${alert.title} : ${alert.message}`).join("\n\n")}</PrintTerms> : null}
      <PrintTerms title="Hypothèses de prévision">
        {`${hypothesis.invoiceCount} facture(s) client, ${hypothesis.supplierInvoiceCount} facture(s) fournisseur, ${hypothesis.manualItemCount} prévision(s) manuelle(s). Les montants correspondent aux soldes restant à encaisser ou à payer.\n${hypothesis.scenario === "prudent" ? "Les probabilités d’encaissement sont réduites de 30 % ; les décaissements sont pris à 100 %." : hypothesis.scenario === "optimistic" ? "Encaissements pris à 100 % ; décaissements pondérés selon leur probabilité de base." : "Probabilités de base ; factures clients échues pondérées à 70 %."}\n${hypothesis.includeOverdue ? "Les échéances en retard sont incluses." : "Les échéances en retard sont exclues."} ${hypothesis.invoiceWithoutDueDateCount} facture(s) sans échéance estimée à 30 jours.\nLes prévisions constituent une aide au pilotage ; elles ne représentent pas des règlements réalisés.`}
      </PrintTerms>
      <PrintFooter footerText={identity.footerText} name={identity.name} contact={companyContact} />
    </PrintPage>
  );
}
