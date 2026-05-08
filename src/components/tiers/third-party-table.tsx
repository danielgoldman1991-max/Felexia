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

export function ThirdPartyTable({ rows }: { rows: ThirdPartyRecord[] }) {
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
            <Th>Types</Th>
            <Th>Code tiers</Th>
            <Th>Ville</Th>
            <Th>Telephone</Th>
            <Th>Email</Th>
            <Th>ICE</Th>
            <Th>Statut</Th>
            <Th>Creation</Th>
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
              <Td>
                <ThirdPartyBadges types={row.types} />
              </Td>
              <Td className="font-mono text-xs">{row.code ?? "-"}</Td>
              <Td>{row.city ?? "-"}</Td>
              <Td>{row.mobile ?? row.phone ?? "-"}</Td>
              <Td>{row.email ?? "-"}</Td>
              <Td className="font-mono text-xs">{row.ice ?? "-"}</Td>
              <Td>
                <StatusBadge status={row.status} />
              </Td>
              <Td>{formatDate(row.created_at)}</Td>
              <Td>
                <div className="flex items-center gap-1">
                  <Link href={`/tiers/${row.id}`} title="Consulter">
                    <Button variant="ghost" className="h-9 w-9 px-0">
                      <Eye className="h-4 w-4" />
                    </Button>
                  </Link>
                  <Link href={`/tiers/${row.id}/edit`} title="Modifier">
                    <Button variant="ghost" className="h-9 w-9 px-0">
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </Link>
                  <form action={archiveAction}>
                    <input type="hidden" name="id" value={row.id} />
                    <Button variant="ghost" className="h-9 w-9 px-0" title="Archiver">
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
