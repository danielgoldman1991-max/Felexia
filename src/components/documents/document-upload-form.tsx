"use client";

import { useActionState, useRef } from "react";
import { UploadCloud } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { DOCUMENT_SOURCE_MODULES, DOCUMENT_TYPES } from "@/lib/document-types";
import { uploadDocumentAction, type DocumentActionState } from "@/lib/document-actions";

const initialState: DocumentActionState = { success: true };

export function DocumentUploadForm() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [state, formAction, pending] = useActionState(uploadDocumentAction, initialState);

  return (
    <form action={formAction} className="space-y-5">
      <label className="flex min-h-52 cursor-pointer flex-col items-center justify-center rounded-[var(--radius-lg)] border border-dashed border-[var(--border)] bg-[var(--surface-soft)] px-6 py-8 text-center transition hover:border-[var(--primary)] hover:bg-white">
        <UploadCloud className="h-9 w-9 text-[var(--secondary)]" />
        <span className="mt-3 text-sm font-semibold text-[var(--foreground)]">Glissez vos fichiers ici</span>
        <span className="mt-1 text-sm text-[var(--muted)]">ou cliquez pour sélectionner un fichier</span>
        <input
          ref={fileInputRef}
          type="file"
          name="file"
          className="sr-only"
          accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.webp,.csv"
        />
      </label>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-1.5 text-sm md:col-span-2">
          <span className="font-medium text-[var(--muted)]">Titre du document</span>
          <Input name="title" placeholder="Ex. Contrat fournisseur, facture scannée..." />
        </label>
        <label className="space-y-1.5 text-sm">
          <span className="font-medium text-[var(--muted)]">Catégorie / type de document</span>
          <Select name="category" defaultValue="imported_document">
            {DOCUMENT_TYPES.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
          </Select>
        </label>
        <label className="space-y-1.5 text-sm">
          <span className="font-medium text-[var(--muted)]">Module lié</span>
          <Select name="source_module" defaultValue="documents">
            {DOCUMENT_SOURCE_MODULES.map((module) => <option key={module.value} value={module.value}>{module.label}</option>)}
          </Select>
        </label>
        <label className="space-y-1.5 text-sm">
          <span className="font-medium text-[var(--muted)]">Référence liée</span>
          <Input name="linked_reference" placeholder="Ex. FAC-2026-0001" />
        </label>
        <label className="space-y-1.5 text-sm">
          <span className="font-medium text-[var(--muted)]">Date du document</span>
          <Input type="date" name="document_date" />
        </label>
        <label className="space-y-1.5 text-sm md:col-span-2">
          <span className="font-medium text-[var(--muted)]">Description</span>
          <Textarea name="notes" rows={4} placeholder="Notes internes, contexte, instructions de classement..." />
        </label>
      </div>

      <Card className="border-blue-100 bg-blue-50">
        <CardContent className="text-sm text-blue-800">
          Les fichiers sont stockés dans le bucket privé organization-documents et accessibles via liens signés.
        </CardContent>
      </Card>

      {!state.success && state.error ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
      ) : null}

      <div className="flex justify-end">
        <Button type="submit" disabled={pending}>
          <UploadCloud className="h-4 w-4" />
          {pending ? "Import en cours..." : "Importer"}
        </Button>
      </div>
    </form>
  );
}
