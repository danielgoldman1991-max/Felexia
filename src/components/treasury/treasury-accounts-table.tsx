"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useActionState } from "react";
import { Archive, CheckCircle2, Eye, Pencil } from "lucide-react";
import { EmptyState } from "@/components/erp/empty-state";
import { MoneyDisplay } from "@/components/erp/money-display";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, Td, Th } from "@/components/ui/table";
import { archiveTreasuryAccount, setDefaultTreasuryAccount } from "@/lib/treasury-actions";
import { TREASURY_ACCOUNT_TYPE_LABELS, type TreasuryAccountRecord, type TreasuryActionResult } from "@/lib/treasury-types";

function actionWithId(action: (prev: TreasuryActionResult, formData: FormData) => Promise<TreasuryActionResult>, id: string) {
  return (prev: TreasuryActionResult) => {
    const formData = new FormData();
    formData.set("id", id);
    return action(prev, formData);
  };
}

function InlineAction({ label, id, action, icon, variant = "ghost" }: { label: string; id: string; action: typeof archiveTreasuryAccount; icon: ReactNode; variant?: "ghost" | "danger" }) {
  const [, formAction, pending] = useActionState(actionWithId(action, id), { success: true });
  return <form action={formAction}><Button type="submit" variant={variant} className="h-9 w-9 px-0" title={label} disabled={pending}>{icon}</Button></form>;
}

export function TreasuryAccountsTable({ rows }: { rows: TreasuryAccountRecord[] }) {
  if (rows.length === 0) return <EmptyState title="Aucun compte de tresorerie." description="Creez une banque, une caisse ou une passerelle de paiement." />;
  return (
    <Table>
      <thead><tr><Th>Code</Th><Th>Nom</Th><Th>Type</Th><Th>Banque</Th><Th>Devise</Th><Th>Solde actuel</Th><Th>Statut</Th><Th>Par defaut</Th><Th>Actions</Th></tr></thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.id}>
            <Td>{row.code ?? "-"}</Td>
            <Td><Link className="font-medium text-indigo-700 hover:underline" href={`/tresorerie/comptes/${row.id}`}>{row.name}</Link></Td>
            <Td>{TREASURY_ACCOUNT_TYPE_LABELS[row.account_type]}</Td>
            <Td>{row.bank_name ?? "-"}</Td>
            <Td>{row.currency}</Td>
            <Td><MoneyDisplay value={row.current_balance} /></Td>
            <Td><Badge tone={row.status === "active" ? "success" : "neutral"}>{row.status === "active" ? "Actif" : row.status === "inactive" ? "Inactif" : "Archive"}</Badge></Td>
            <Td>{row.is_default ? <Badge tone="info">Par defaut</Badge> : "-"}</Td>
            <Td>
              <div className="flex items-center gap-1">
                <Button type="button" variant="ghost" className="h-9 w-9 px-0" title="Voir" asChild><Link href={`/tresorerie/comptes/${row.id}`}><Eye className="h-4 w-4" /></Link></Button>
                <Button type="button" variant="ghost" className="h-9 w-9 px-0" title="Modifier" asChild><Link href={`/tresorerie/comptes/${row.id}/edit`}><Pencil className="h-4 w-4" /></Link></Button>
                {!row.is_default ? <InlineAction label="Definir par defaut" id={row.id} action={setDefaultTreasuryAccount} icon={<CheckCircle2 className="h-4 w-4" />} /> : null}
                <InlineAction label="Archiver" id={row.id} action={archiveTreasuryAccount} icon={<Archive className="h-4 w-4" />} variant="danger" />
              </div>
            </Td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}
