"use client";

import { useActionState, useState, type FormEvent } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Table, Td, Th } from "@/components/ui/table";
import { readXlsxGrid } from "@/lib/spreadsheet/unzip-bytes";
import { confirmThirdPartyImportAction, previewThirdPartyImportAction, type ThirdPartyImportState } from "@/lib/tiers/third-party-import-actions";
import { THIRD_PARTY_IMPORT_HEADERS, THIRD_PARTY_IMPORT_INSTRUCTIONS } from "@/lib/tiers/third-party-import";

const initial: ThirdPartyImportState = { success: false, errors: [], rows: [], readyRows: [] };

export function ThirdPartyImportForm({ demo }: { demo?: ThirdPartyImportState } = {}) {
  const [preview, previewAction, previewPending] = useActionState(previewThirdPartyImportAction, demo ?? initial);
  const [imported, importAction, importPending] = useActionState(confirmThirdPartyImportAction, initial);
  const [reading, setReading] = useState(false);
  const [readError, setReadError] = useState<string>();
  const readyRows = preview.readyRows ?? [];
  const ready = readyRows.length > 0 && !imported.success;
  const busy = reading || previewPending;

  async function previewFile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const file = new FormData(event.currentTarget).get("file");
    if (!(file instanceof File) || file.size <= 0) {
      setReadError("Choisissez un fichier CSV ou Excel.");
      return;
    }
    setReading(true);
    setReadError(undefined);
    try {
      const data = new FormData();
      const name = file.name.toLowerCase();
      if (name.endsWith(".xlsx")) {
        const grid = await readXlsxGrid(new Uint8Array(await file.arrayBuffer()));
        data.set("csv", grid.map((row) => row.map(escapeCell).join(";")).join("\n"));
      } else if (name.endsWith(".xls")) {
        data.set("file", file);
      } else {
        data.set("csv", await file.text());
      }
      previewAction(data);
    } catch (error) {
      setReadError(error instanceof Error ? error.message : "Le classeur n’a pas pu être lu.");
    } finally {
      setReading(false);
    }
  }

  return (
    <div className="space-y-4">
      <form onSubmit={previewFile} className="erp-form space-y-3 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--card)] p-4">
        <p className="text-sm text-[var(--muted)]">CSV (point-virgule), Excel .xlsx ou .xls. {THIRD_PARTY_IMPORT_INSTRUCTIONS}</p>
        <p className="text-sm text-[var(--muted)]">Colonnes : {THIRD_PARTY_IMPORT_HEADERS.join(", ")}.</p>
        <div className="flex flex-wrap gap-4">
          <Link className="text-sm font-medium text-[var(--primary)] hover:underline" href="/tiers/import/modele">Télécharger le modèle CSV</Link>
          <Link className="text-sm font-medium text-[var(--primary)] hover:underline" href="/tiers/import/modele.xlsx">Télécharger le modèle Excel</Link>
        </div>
        <input name="file" type="file" accept=".csv,text/csv,.xlsx,.xls" required className="block text-sm" />
        <div className="erp-form-actions">
          <Button type="submit" variant="secondary" disabled={busy}>{busy ? "Lecture du classeur…" : "Prévisualiser"}</Button>
        </div>
        {busy ? <p className="text-sm text-[var(--muted)]" role="status">Lecture du classeur…</p> : null}
        {readError || preview.error ? <p className="text-sm text-red-700">{readError || preview.error}</p> : null}
      </form>
      {imported.success ? <p className="rounded-[var(--radius-md)] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{imported.imported} contact{(imported.imported ?? 0) > 1 ? "s" : ""} ajouté{(imported.imported ?? 0) > 1 ? "s" : ""} à votre entreprise.{imported.skipped ? ` ${imported.skipped} ligne${imported.skipped > 1 ? "s" : ""} ignorée${imported.skipped > 1 ? "s" : ""}.` : ""} Aucun e-mail n’a été envoyé.</p> : null}
      {preview.rows.length > 0 || preview.errors.length > 0 ? (
        <div className="space-y-3">
          {preview.errors.length > 0 ? <ul className="space-y-1 text-sm text-red-700">{preview.errors.map((error) => <li key={error}>{error}</li>)}</ul> : null}
          {readyRows.length > 0 ? <p className="text-sm text-[var(--muted)]">{readyRows.length} ligne{readyRows.length > 1 ? "s" : ""} valide{readyRows.length > 1 ? "s" : ""}. Les lignes signalées ne seront pas enregistrées.</p> : null}
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
              <input type="hidden" name="csv" value={serialize(readyRows)} />
              <Button type="submit" disabled={importPending}>{importPending ? "Enregistrement…" : `Importer ${readyRows.length} ligne${readyRows.length > 1 ? "s" : ""} valide${readyRows.length > 1 ? "s" : ""}`}</Button>
              {imported.error ? <p className="mt-2 text-sm text-red-700">{imported.error}</p> : null}
            </form>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function serialize(rows: ThirdPartyImportState["rows"]) {
  const body = rows.map((row) => [row.name, row.type === "customer" ? "Client" : "Fournisseur", row.ice, row.ifNumber, row.rc, row.email, row.phone, row.city, row.address].map(escapeCell).join(";"));
  return [THIRD_PARTY_IMPORT_HEADERS.join(";"), ...body].join("\n");
}

function escapeCell(value: string) {
  return /[;"\n]/.test(value) ? `"${value.replace(/"/g, "\"\"")}"` : value;
}
