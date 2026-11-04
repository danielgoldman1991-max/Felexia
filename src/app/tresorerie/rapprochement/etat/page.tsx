import { PrintActions } from "@/components/sales/print-actions";
import { PrintPage } from "@/components/print/PrintPage";
import { requireActiveWorkspace } from "@/lib/auth";
import { hasFullErpAccess } from "@/lib/launch-access";
import { ModuleUpgradePage } from "@/components/erp/module-upgrade-page";
import { formatMoney } from "@/lib/format";
import { loadExpertReconciliation } from "@/lib/treasury/reconciliation-view";

export const dynamic = "force-dynamic";

export default async function ReconciliationStatementPage({ searchParams }: { searchParams: Promise<{ accountId?: string }> }) {
  const workspace = await requireActiveWorkspace();
  if (!(await hasFullErpAccess(workspace.organization.id))) return <ModuleUpgradePage />;
  const params = await searchParams;
  const view = await loadExpertReconciliation(params.accountId);
  return (
    <div className="print-preview">
      <PrintActions backHref={`/tresorerie/rapprochement?accountId=${view.accountId}`} backLabel="Retour au rapprochement" />
      <PrintPage orientation="landscape">
        <h1>État de rapprochement</h1>
        <p>{view.accountName}</p>
        <p>Solde du relevé : {view.balances.statement === null ? "non indiqué" : formatMoney(view.balances.statement)} · Solde comptable : {view.balances.book === null ? "—" : formatMoney(view.balances.book)} · Écart : {view.balances.gap === null ? "—" : formatMoney(view.balances.gap)}</p>
        <table>
          <thead><tr><th>Date</th><th>Libellé</th><th>Sens</th><th>Montant</th><th>Groupe</th><th>Proposition</th></tr></thead>
          <tbody>
            {view.lines.map((line) => (
              <tr key={line.lineId}>
                <td>{line.date}</td>
                <td>{line.label}</td>
                <td>{line.direction === "in" ? "Crédit" : "Débit"}</td>
                <td>{formatMoney(line.amount)}</td>
                <td>{line.band}</td>
                <td>{line.summary || line.reason}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p>Document de gestion. Il ne remplace pas un état bancaire certifié.</p>
      </PrintPage>
    </div>
  );
}
