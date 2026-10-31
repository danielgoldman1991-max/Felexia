"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Archive, Eye, Pencil } from "lucide-react";
import { archiveThirdParty } from "@/lib/third-party-actions";
import type { ThirdPartyRecord } from "@/lib/third-party-types";
import { formatDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Table, Td, Th } from "@/components/ui/table";
import { StatusBadge } from "@/components/erp/status-badge";
import { ThirdPartyBadges } from "@/components/tiers/third-party-badges";

export function ThirdPartyTable({ rows, fullAccess = false }: { rows: ThirdPartyRecord[]; fullAccess?: boolean }) {
  const [archiveState, archiveAction] = useActionState(archiveThirdParty, { success: true });

  return (
    <>
      {!archiveState.success && archiveState.error ? (
        <p className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{archiveState.error}</p>
      ) : null}
      <Table>
        <thead>
          <tr>
            <Th>Nom</Th>
            {fullAccess ? <Th>Types</Th> : null}
            {fullAccess ? <Th>Code tiers</Th> : null}
            <Th>Ville</Th>
            <Th>Telephone</Th>
            <Th>Email</Th>
            <Th>ICE</Th>
            <Th>Statut</Th>
            {fullAccess ? <Th>Creation</Th> : null}
            <Th>Actions</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <Td>
                <Link href={`/tiers/${row.id}`} className="font-medium hover:text-[var(--primary)]">
                  {row.name}
                </Link>
                {row.commercial_name ? (
                  <p className="text-xs text-[var(--muted)]">{row.commercial_name}</p>
                ) : null}
              </Td>
              {fullAccess ? <Td>
                <ThirdPartyBadges types={row.types} />
              </Td> : null}
              {fullAccess ? <Td className="font-mono text-xs">{row.code ?? "-"}</Td> : null}
              <Td>{row.city ?? "-"}</Td>
              <Td>{row.mobile ?? row.phone ?? "-"}</Td>
              <Td>{row.email ?? "-"}</Td>
              <Td className="font-mono text-xs">{row.ice ?? "-"}</Td>
              <Td>
                <StatusBadge status={row.status} />
              </Td>
              {fullAccess ? <Td>{formatDate(row.created_at)}</Td> : null}
              <Td>
                <div className="flex items-center gap-1">
                  <Button
                      variant="ghost"
                      className="h-9 w-9 border border-slate-200 px-0 text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                      aria-label={`Consulter ${row.name}`}
                     asChild><Link href={`/tiers/${row.id}`} title="Consulter">
                      <Eye className="h-4 w-4" />
                    </Link></Button>
                  <Button
                      variant="ghost"
                      className="h-9 w-9 border border-slate-200 px-0 text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                      aria-label={`Modifier ${row.name}`}
                     asChild><Link href={`/tiers/${row.id}/edit`} title="Modifier">
                      <Pencil className="h-4 w-4" />
                    </Link></Button>
                  <form action={archiveAction}>
                    <input type="hidden" name="id" value={row.id} />
                    <Button
                      variant="ghost"
                      className="h-9 w-9 border border-slate-200 px-0 text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                      title="Archiver"
                      aria-label={`Archiver ${row.name}`}
                    >
                      <Archive className="h-4 w-4" />
                    </Button>
                  </form>
                </div>
              </Td>
            </tr>
          ))}
        </tbody>
      </Table>
    </>
  );
}
