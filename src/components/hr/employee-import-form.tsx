"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Table, Td, Th } from "@/components/ui/table";
import { importEmployeesAction, previewEmployeeImportAction, type EmployeeImportState } from "@/lib/hr/employee-import-actions";

const initial: EmployeeImportState = { success: false, errors: [], rows: [] };

export function EmployeeImportForm() {
  const [preview, previewAction, previewPending] = useActionState(previewEmployeeImportAction, initial);
  const [imported, importAction, importPending] = useActionState(importEmployeesAction, initial);
  const ready = preview.success && preview.errors.length === 0 && preview.rows.length > 0;
  return (
    <div className="space-y-4">
      <form action={previewAction} className="erp-form space-y-3 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--card)] p-4">
        <p className="text-sm text-[var(--muted)]">Fichier point-virgule. En-têtes : Matricule, Prénom, Nom, Date d&apos;embauche, Salaire, CIN, CNSS, RIB, Email, Ville, Personnes à charge. Une ligne invalide bloque tout le fichier.</p>
        <Link className="text-sm font-medium text-[var(--primary)] hover:underline" href="/rh/employes/import/modele">Télécharger le modèle CSV</Link>
        <input name="file" type="file" accept=".csv,text/csv" required className="block text-sm" />
        <div className="erp-form-actions">
          <Button type="submit" variant="secondary" disabled={previewPending}>{previewPending ? "Lecture…" : "Prévisualiser"}</Button>
        </div>
        {preview.error ? <p className="text-sm text-red-700">{preview.error}</p> : null}
      </form>
      {preview.rows.length > 0 || preview.errors.length > 0 ? (
        <div className="space-y-3">
          {preview.errors.length > 0 ? <ul className="space-y-1 text-sm text-red-700">{preview.errors.map((error) => <li key={error}>{error}</li>)}</ul> : null}
          {preview.rows.length > 0 ? (
            <Table>
              <thead><tr><Th>Matricule</Th><Th>Salarié</Th><Th>Embauche</Th><Th>Salaire</Th><Th>CIN</Th><Th>CNSS</Th><Th>RIB</Th></tr></thead>
              <tbody>
                {preview.rows.map((row) => (
                  <tr key={row.employeeNumber}><Td>{row.employeeNumber}</Td><Td>{row.firstName} {row.lastName}</Td><Td>{row.hireDate}</Td><Td>{row.baseSalary.toFixed(2)}</Td><Td>{row.cin ?? "—"}</Td><Td>{row.cnss ?? "—"}</Td><Td>{row.rib ?? "—"}</Td></tr>
                ))}
              </tbody>
            </Table>
          ) : null}
          {ready ? (
            <form action={importAction}>
              <input type="hidden" name="csv" value={serialize(preview.rows)} />
              <Button type="submit" disabled={importPending}>{importPending ? "Import…" : `Importer ${preview.rows.length} salarié${preview.rows.length > 1 ? "s" : ""}`}</Button>
              {imported.error ? <p className="mt-2 text-sm text-red-700">{imported.error}</p> : null}
              {imported.success ? <p className="mt-2 text-sm text-emerald-700">{imported.imported} salarié{(imported.imported ?? 0) > 1 ? "s" : ""} importé{(imported.imported ?? 0) > 1 ? "s" : ""}.</p> : null}
            </form>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function serialize(rows: EmployeeImportState["rows"]) {
  const header = "Matricule;Prénom;Nom;Date d'embauche;Salaire;CIN;CNSS;RIB;Email;Ville;Personnes à charge";
  const body = rows.map((row) => [row.employeeNumber, row.firstName, row.lastName, row.hireDate, row.baseSalary.toFixed(2), row.cin ?? "", row.cnss ?? "", row.rib ?? "", row.email ?? "", row.city ?? "", String(row.dependents)].join(";"));
  return [header, ...body].join("\n");
}
