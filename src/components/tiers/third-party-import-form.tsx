"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Table, Td, Th } from "@/components/ui/table";
import { confirmThirdPartyImportAction, previewThirdPartyImportAction, type ThirdPartyImportState } from "@/lib/tiers/third-party-import-actions";
import { THIRD_PARTY_IMPORT_HEADERS } from "@/lib/tiers/third-party-import";

const initial: ThirdPartyImportState = { success: false, errors: [], rows: [] };

export function ThirdPartyImportForm() {
  const [preview, previewAction, previewPending] = useActionState(previewThirdPartyImportAction, initial);
  const [imported, importAction, importPending] = useActionState(confirmThirdPartyImportAction, initial);
  const ready = preview.success && preview.errors.length === 0 && preview.rows.length > 0 && !imported.success;
  return (
    <div className="space-y-4">
      <form action={previewAction} className="erp-form space-y-3 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--card)] p-4">
        <p className="text-sm text-[var(--muted)]">Fichier CSV, séparateur point-virgule, ouvert par Excel. Colonnes : {THIRD_PARTY_IMPORT_HEADERS.join(", ")}. Rien n’est enregistré tant que vous n’avez pas confirmé un aperçu sans erreur.</p>
        <Link className="text-sm font-medium text-[var(--primary)] hover:underline" href="/tiers/import/modele">Télécharger le modèle CSV</Link>
        <input name="file" type="file" accept=".csv,text/csv,.xlsx,.xls" required className="block text-sm" />
        <div className="erp-form-actions">
          <Button type="submit" variant="secondary" disabled={previewPending}>{previewPending ? "Lecture…" : "Prévisualiser"}</Button>
        </div>
        {preview.error ? <p className="text-sm text-red-700">{preview.error}</p> : null}
      </form>
      {imported.success ? <p className="rounded-[var(--radius-md)] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{imported.imported} contact{(imported.imported ?? 0) > 1 ? "s" : ""} ajouté{(imported.imported ?? 0) > 1 ? "s" : ""} à votre entreprise. Aucun e-mail n’a été envoyé.</p> : null}
      {preview.rows.length > 0 || preview.errors.length > 0 ? (
        <div className="space-y-3">
          {preview.errors.length > 0 ? <ul className="space-y-1 text-sm text-red-700">{preview.errors.map((error) => <li key={error}>{error}</li>)}</ul> : <p className="text-sm text-[var(--muted)]">{preview.rows.length} ligne{preview.rows.length > 1 ? "s" : ""} prête{preview.rows.length > 1 ? "s" : ""}. Confirmez pour les ajouter uniquement à votre entreprise.</p>}
          {preview.rows.length > 0 ? (
            <Table>
              <thead><tr><Th>Ligne</Th><Th>Nom</Th><Th>Type</Th><Th>ICE</Th><Th>E-mail</Th><Th>Ville</Th></tr></thead>
              <tbody>
                {preview.rows.map((row) => (
                  <tr key={row.line}><Td>{row.line}</Td><Td>{row.name}</Td><Td>{row.type === "customer" ? "Client" : "Fournisseur"}</Td><Td>{row.ice || "—"}</Td><Td>{row.email || "—"}</Td><Td>{row.city || "—"}</Td></tr>
                ))}
              </tbody>
            </Table>
          ) : null}
          {ready ? (
            <form action={importAction}>
              <input type="hidden" name="csv" value={serialize(preview.rows)} />
              <Button type="submit" disabled={importPending}>{importPending ? "Enregistrement…" : `Confirmer l’import de ${preview.rows.length} contact${preview.rows.length > 1 ? "s" : ""}`}</Button>
              {imported.error ? <p className="mt-2 text-sm text-red-700">{imported.error}</p> : null}
            </form>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function serialize(rows: ThirdPartyImportState["rows"]) {
  const body = rows.map((row) => [row.name, row.type === "customer" ? "Client" : "Fournisseur", row.ice, row.email, row.phone, row.city, row.address].map(escapeCell).join(";"));
  return [THIRD_PARTY_IMPORT_HEADERS.join(";"), ...body].join("\n");
}

function escapeCell(value: string) {
  return /[;"\n]/.test(value) ? `"${value.replace(/"/g, "\"\"")}"` : value;
}
