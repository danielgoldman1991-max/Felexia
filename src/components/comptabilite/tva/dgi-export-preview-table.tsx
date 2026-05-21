import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Table, Td, Th } from "@/components/ui/table";
import { formatMoney } from "@/lib/format";
import type { DgiVatExportData } from "@/lib/tax/dgi-vat-types";

export function DgiExportPreviewTable({ data }: { data: DgiVatExportData }) {
  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader>
          <h2 className="font-semibold text-[var(--foreground)]">Lignes déclaratives préparatoires</h2>
          <p className="text-sm text-[var(--muted)]">Codification préparatoire inspirée des lignes déclaratives TVA. À valider selon les spécifications DGI applicables.</p>
        </CardHeader>
        <CardContent>
          <Table>
            <thead><tr><Th>Code</Th><Th>Libellé</Th><Th>Montant MAD</Th></tr></thead>
            <tbody>
              {data.declarationLines.map((line) => (
                <tr key={line.code}>
                  <Td><span className="font-mono text-xs">{line.code}</span></Td>
                  <Td>{line.label}</Td>
                  <Td className="text-right font-medium">{formatMoney(line.amountMad)}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="font-semibold text-[var(--foreground)]">TVA collectée</h2>
          <p className="text-sm text-[var(--muted)]">Factures clients et avoirs inclus sur la période.</p>
        </CardHeader>
        <CardContent>
          <Table>
            <thead><tr><Th>Pièce</Th><Th>Date</Th><Th>Client</Th><Th>ICE</Th><Th>Base HT</Th><Th>TVA</Th><Th>Statut</Th></tr></thead>
            <tbody>
              {data.salesDocuments.length === 0 ? (
                <tr><td colSpan={7} className="border-t border-[var(--border)] px-4 py-3.5 text-center text-[var(--muted)]">Aucune pièce client incluse.</td></tr>
              ) : data.salesDocuments.flatMap((document) => document.taxBreakdown.map((taxLine, index) => (
                <tr key={`${document.id}-${index}`}>
                  <Td>{document.invoiceNumber}</Td>
                  <Td>{document.issueDate || "-"}</Td>
                  <Td>{document.customerName ?? "-"}</Td>
                  <Td>{document.customerIce ?? "-"}</Td>
                  <Td className="text-right">{formatMoney(taxLine.baseHtMad)}</Td>
                  <Td className="text-right">{formatMoney(taxLine.vatAmountMad)} <span className="text-xs text-[var(--muted)]">({taxLine.taxRate}%)</span></Td>
                  <Td><Badge tone={document.accountingStatus === "posted" ? "success" : "warning"}>{document.accountingStatus === "posted" ? "Comptabilisée" : "Non comptabilisée"}</Badge></Td>
                </tr>
              )))}
            </tbody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="font-semibold text-[var(--foreground)]">TVA déductible</h2>
          <p className="text-sm text-[var(--muted)]">Factures fournisseurs avec prorata de paiement si disponible.</p>
        </CardHeader>
        <CardContent>
          <Table>
            <thead><tr><Th>Référence</Th><Th>Date</Th><Th>Fournisseur</Th><Th>ICE</Th><Th>Base HT</Th><Th>TVA déductible</Th><Th>Paiement</Th></tr></thead>
            <tbody>
              {data.purchaseDocuments.length === 0 ? (
                <tr><td colSpan={7} className="border-t border-[var(--border)] px-4 py-3.5 text-center text-[var(--muted)]">Aucune facture fournisseur incluse.</td></tr>
              ) : data.purchaseDocuments.flatMap((document) => document.taxBreakdown.map((taxLine, index) => (
                <tr key={`${document.id}-${index}`}>
                  <Td>{document.referenceNumber}</Td>
                  <Td>{document.issueDate || "-"}</Td>
                  <Td>{document.supplierName ?? "-"}</Td>
                  <Td>{document.supplierIce ?? "-"}</Td>
                  <Td className="text-right">{formatMoney(taxLine.baseHtMad)}</Td>
                  <Td className="text-right">{formatMoney(taxLine.deductibleVatMad)} <span className="text-xs text-[var(--muted)]">({taxLine.taxRate}%)</span></Td>
                  <Td>{document.paymentDate ? `${document.paymentMode ?? "Paiement"} - ${document.paymentDate}` : "À contrôler"}</Td>
                </tr>
              )))}
            </tbody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
