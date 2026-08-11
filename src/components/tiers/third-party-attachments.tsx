"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Archive, ExternalLink, FileText, Upload } from "lucide-react";
import { EmptyState } from "@/components/erp/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, Td, Th } from "@/components/ui/table";
import {
  archiveThirdPartyAttachment,
  uploadThirdPartyAttachment,
} from "@/lib/third-party-actions";
import type { ThirdPartyAttachment } from "@/lib/third-party-types";
import { formatDate } from "@/lib/format";

function formatFileSize(value: number | null | undefined) {
  const size = value ?? 0;
  if (size < 1024) return `${size} o`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} Ko`;
  return `${(size / (1024 * 1024)).toFixed(1)} Mo`;
}

function uploaderName(attachment: ThirdPartyAttachment) {
  return attachment.uploaded_by_name || attachment.uploaded_by_email || "Utilisateur inconnu";
}

export function ThirdPartyAttachments({
  thirdPartyId,
  attachments,
}: {
  thirdPartyId: string;
  attachments: ThirdPartyAttachment[];
}) {
  const [uploadState, uploadAction, uploadPending] = useActionState(uploadThirdPartyAttachment, { success: true });
  const [archiveState, archiveAction, archivePending] = useActionState(archiveThirdPartyAttachment, { success: true });

  return (
    <div className="space-y-4">
      <form
        action={uploadAction}
        className="grid gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] p-4 md:grid-cols-[1fr_auto]"
      >
        <input type="hidden" name="third_party_id" value={thirdPartyId} />
        <Input
          name="file"
          type="file"
          accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx"
          required
        />
        <Button disabled={uploadPending}>
          <Upload className="h-4 w-4" />
          Ajouter
        </Button>
        <p className="text-xs text-[var(--muted)] md:col-span-2">
          Formats acceptes: PDF, images JPG/PNG/WEBP et Word. Taille maximale: 10 Mo.
        </p>
        {!uploadState.success && uploadState.error ? (
          <p className="text-xs text-red-600 md:col-span-2">{uploadState.error}</p>
        ) : null}
      </form>

      {!archiveState.success && archiveState.error ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{archiveState.error}</p>
      ) : null}

      {attachments.length ? (
        <Table>
          <thead>
            <tr>
              <Th>Fichier</Th>
              <Th>Type</Th>
              <Th>Taille</Th>
              <Th>Ajoute par</Th>
              <Th>Date</Th>
              <Th>Actions</Th>
            </tr>
          </thead>
          <tbody>
            {attachments.map((attachment) => (
              <tr key={attachment.id}>
                <Td>
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-[var(--secondary)]" />
                    <span className="font-medium">{attachment.file_name}</span>
                  </div>
                </Td>
                <Td>{attachment.file_type?.toUpperCase() ?? "-"}</Td>
                <Td>{formatFileSize(attachment.file_size)}</Td>
                <Td>{uploaderName(attachment)}</Td>
                <Td>{formatDate(attachment.created_at)}</Td>
                <Td>
                  <div className="flex items-center gap-1">
                    {attachment.signed_url ? (
                      <Button
                          type="button"
                          variant="ghost"
                          className="h-9 w-9 border border-slate-200 px-0 text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                         asChild><Link href={attachment.signed_url} target="_blank" title="Ouvrir">
                          <ExternalLink className="h-4 w-4" />
                        </Link></Button>
                    ) : null}
                    <form action={archiveAction}>
                      <input type="hidden" name="id" value={attachment.id} />
                      <input type="hidden" name="third_party_id" value={thirdPartyId} />
                      <Button
                        type="submit"
                        variant="ghost"
                        title="Archiver"
                        disabled={archivePending}
                        className="h-9 w-9 border border-slate-200 px-0 text-slate-600 hover:bg-slate-100 hover:text-slate-900"
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
      ) : (
        <EmptyState
          title="Aucune piece jointe"
          description="Ajoutez des contrats, attestations, documents fiscaux, images ou fichiers Word."
        />
      )}
    </div>
  );
}
