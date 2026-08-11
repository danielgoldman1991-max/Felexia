import Link from "next/link";
import { notFound } from "next/navigation";
import { Pencil } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Table, Td, Th } from "@/components/ui/table";
import { ModulePage } from "@/components/erp/module-page";
import { PageHeader } from "@/components/erp/page-header";
import { formatDate, formatNumber } from "@/lib/format";
import { getStockLocationDetail, getStockLocationTypeLabel } from "@/lib/stock-locations";
import { STOCK_LOCATION_STATUS_LABELS, STOCK_MOVE_TYPE_LABELS, type StockMoveType } from "@/lib/stock-types";

export const dynamic = "force-dynamic";

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return <div><p className="text-xs font-medium uppercase text-[var(--muted)]">{label}</p><div className="mt-1 text-sm">{value || "-"}</div></div>;
}

export default async function StockLocationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { location, stockLevels, movements } = await getStockLocationDetail(id);
  if (!location) notFound();
  return (
    <ModulePage>
      <PageHeader
        title={location.name}
        description="Fiche emplacement de stock"
        actions={<Button variant="secondary" asChild><Link href={`/stock/emplacements/${location.id}/edit`}><Pencil className="h-4 w-4" /> Modifier</Link></Button>}
      />
      <Card>
        <CardContent className="flex flex-wrap items-center gap-3">
          <Badge tone="info">{getStockLocationTypeLabel(location.location_type)}</Badge>
          <Badge tone={location.status === "active" ? "success" : "neutral"}>{STOCK_LOCATION_STATUS_LABELS[location.status]}</Badge>
          {location.is_default ? <Badge tone="warning">Par defaut</Badge> : null}
        </CardContent>
      </Card>
      <Card className="mt-5">
        <CardHeader><h2 className="font-semibold">Informations</h2></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Info label="Code" value={location.code} />
          <Info label="Parent" value={location.parent_name} />
          <Info label="Ville" value={location.city} />
          <Info label="Pays" value={location.country} />
          <Info label="Adresse" value={location.address} />
          <Info label="Responsable" value={location.manager_name} />
          <Info label="Telephone" value={location.phone} />
          <Info label="Email" value={location.email} />
        </CardContent>
      </Card>
      {location.notes ? <Card className="mt-5"><CardHeader><h2 className="font-semibold">Notes</h2></CardHeader><CardContent className="text-sm">{location.notes}</CardContent></Card> : null}
      <Card className="mt-5">
        <CardHeader><h2 className="font-semibold">Articles presents dans cet emplacement</h2></CardHeader>
        <CardContent>
          <Table>
            <thead><tr><Th>Reference</Th><Th>Article</Th><Th>Stock emplacement</Th><Th>Stock minimum</Th><Th>Maj</Th></tr></thead>
            <tbody>
              {stockLevels.length === 0 ? <tr><td colSpan={5} className="px-4 py-8 text-center text-sm text-[var(--muted)]">Aucun stock sur cet emplacement.</td></tr> : stockLevels.map((level) => (
                <tr key={level.product_id}>
                  <Td>{level.sku ?? "-"}</Td>
                  <Td>{level.product_name ?? "-"}</Td>
                  <Td>{formatNumber(level.quantity)}</Td>
                  <Td>{formatNumber(level.min_stock)}</Td>
                  <Td>{formatDate(level.updated_at)}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </CardContent>
      </Card>
      <Card className="mt-5">
        <CardHeader><h2 className="font-semibold">Derniers mouvements</h2></CardHeader>
        <CardContent>
          <Table>
            <thead><tr><Th>Date</Th><Th>Article</Th><Th>Type</Th><Th>Direction</Th><Th>Quantite</Th><Th>Notes</Th></tr></thead>
            <tbody>
              {movements.length === 0 ? <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-[var(--muted)]">Aucun mouvement recent.</td></tr> : movements.map((movement) => (
                <tr key={movement.id}>
                  <Td>{formatDate(movement.movement_date)}</Td>
                  <Td>{movement.product_name ?? "-"}</Td>
                  <Td>{STOCK_MOVE_TYPE_LABELS[movement.move_type as StockMoveType] ?? movement.move_type}</Td>
                  <Td>{movement.direction === "in" ? "Entree" : "Sortie"}</Td>
                  <Td>{formatNumber(movement.quantity)}</Td>
                  <Td>{movement.notes ?? "-"}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </CardContent>
      </Card>
    </ModulePage>
  );
}
