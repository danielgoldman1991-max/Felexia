"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Archive, CheckCircle2, Eye, Pencil } from "lucide-react";
import { EmptyState } from "@/components/erp/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, Td, Th } from "@/components/ui/table";
import { archiveStockLocation, setDefaultStockLocation } from "@/lib/stock-location-actions";
import { STOCK_LOCATION_STATUS_LABELS, STOCK_LOCATION_TYPE_LABELS, type StockActionResult, type StockLocationRecord } from "@/lib/stock-types";

function actionWithId(action: (prev: StockActionResult, formData: FormData) => Promise<StockActionResult>, id: string) {
  return (prev: StockActionResult) => {
    const formData = new FormData();
    formData.set("id", id);
    return action(prev, formData);
  };
}

function InlineAction({ label, id, action, icon, variant = "ghost" }: { label: string; id: string; action: typeof archiveStockLocation; icon: React.ReactNode; variant?: "ghost" | "danger" }) {
  const [, formAction, pending] = useActionState(actionWithId(action, id), { success: true });
  return <form action={formAction}><Button type="submit" variant={variant} className="h-9 w-9 px-0" title={label} disabled={pending}>{icon}</Button></form>;
}

export function StockLocationsTable({ rows }: { rows: StockLocationRecord[] }) {
  if (rows.length === 0) return <EmptyState title="Aucun emplacement de stock cree." description="Creez votre premier depot, magasin ou site de stockage." />;
  return (
    <Table>
      <thead>
        <tr><Th>Code</Th><Th>Nom</Th><Th>Type</Th><Th>Ville</Th><Th>Responsable</Th><Th>Statut</Th><Th>Par defaut</Th><Th>Actions</Th></tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.id}>
            <Td>{row.code ?? "-"}</Td>
            <Td><Link className="font-medium text-indigo-700 hover:underline" href={`/stock/emplacements/${row.id}`}>{row.name}</Link></Td>
            <Td>{STOCK_LOCATION_TYPE_LABELS[row.location_type]}</Td>
            <Td>{row.city ?? "-"}</Td>
            <Td>{row.manager_name ?? "-"}</Td>
            <Td><Badge tone={row.status === "active" ? "success" : "neutral"}>{STOCK_LOCATION_STATUS_LABELS[row.status]}</Badge></Td>
            <Td>{row.is_default ? <Badge tone="info">Par defaut</Badge> : "-"}</Td>
            <Td>
              <div className="flex items-center gap-1">
                <Button type="button" variant="ghost" className="h-9 w-9 px-0" title="Voir" asChild><Link href={`/stock/emplacements/${row.id}`}><Eye className="h-4 w-4" /></Link></Button>
                <Button type="button" variant="ghost" className="h-9 w-9 px-0" title="Modifier" asChild><Link href={`/stock/emplacements/${row.id}/edit`}><Pencil className="h-4 w-4" /></Link></Button>
                {!row.is_default ? <InlineAction label="Definir par defaut" id={row.id} action={setDefaultStockLocation} icon={<CheckCircle2 className="h-4 w-4" />} /> : null}
                <InlineAction label="Archiver" id={row.id} action={archiveStockLocation} icon={<Archive className="h-4 w-4" />} variant="danger" />
              </div>
            </Td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}
