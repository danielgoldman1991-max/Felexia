"use client";

import { useState, useTransition, type Dispatch, type FormEvent, type SetStateAction } from "react";
import Link from "next/link";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { analyzeSupplierInvoiceScan, discardSupplierInvoiceScan, saveScannedSupplierInvoice, type OcrAnalysis } from "@/lib/purchases/supplier-invoice-ocr-actions";
import { OCR_NOT_CONFIGURED_MESSAGE, SCAN_BUCKET, SCAN_MAX_BYTES, inspectScanFile, uncertain, validateNewSupplier, type OcrSupplierInvoice } from "@/lib/purchases/supplier-invoice-ocr";
import { createSupplierForOcr } from "@/lib/third-party-actions";
import { createClient } from "@/lib/supabase/client";

type SupplierOption = { id: string; name: string; ice: string | null };

export function SupplierInvoiceScanImporter({
  configured,
  organizationId,
  suppliers,
  preview,
}: {
  configured: boolean;
  organizationId: string;
  suppliers: SupplierOption[];
  preview?: { analysis: OcrAnalysis; fileUrl: string };
}) {
  const [file, setFile] = useState<File | null>(null);
  const [fileUrl, setFileUrl] = useState(preview?.fileUrl ?? "");
  const [analysis, setAnalysis] = useState<OcrAnalysis | null>(preview?.analysis ?? null);
  const [knownSuppliers, setKnownSuppliers] = useState(suppliers);
  const [linkedSupplierId, setLinkedSupplierId] = useState(preview?.analysis?.match?.status === "matched" ? preview.analysis.match.id : "");
  const [message, setMessage] = useState(configured ? "" : OCR_NOT_CONFIGURED_MESSAGE);
  const [pending, startTransition] = useTransition();

  function onFile(next: File | null) {
    setFile(next);
    setAnalysis(null);
    if (fileUrl.startsWith("blob:")) URL.revokeObjectURL(fileUrl);
    if (!next) { setFileUrl(""); return; }
    setFileUrl(URL.createObjectURL(next));
  }

  function analyze() {
    if (!configured) { setMessage(OCR_NOT_CONFIGURED_MESSAGE); return; }
    if (!file) { setMessage("Sélectionnez un fichier."); return; }
    const localError = inspectScanFile({ name: file.name, type: file.type, size: file.size });
    if (localError) { setMessage(localError); return; }
    startTransition(async () => {
      setMessage("");
      const extension = file.name.split(".").pop()?.toLowerCase() || "pdf";
      const path = `organizations/${organizationId}/pending/${crypto.randomUUID()}.${extension}`;
      const supabase = createClient();
      const uploaded = await supabase.storage.from(SCAN_BUCKET).upload(path, file, { contentType: file.type, upsert: false });
      if (uploaded.error) {
        setMessage("Le document n’a pas pu être déposé. Aucune facture n’a été créée.");
        return;
      }
      const result = await analyzeSupplierInvoiceScan(path);
      setAnalysis(result);
      setMessage(result.error ?? "");
    });
  }

  return (
    <div className="space-y-6">
      <section className="space-y-3 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--card)] p-4">
        <p className="text-sm text-[var(--muted)]">PDF, JPG ou PNG, photo de téléphone comprise, 10 Mo maximum. Si le fournisseur est inconnu, vous le créez avant la facture. Annuler n’enregistre rien.</p>
        <input aria-label="Document de facture" type="file" accept="application/pdf,image/jpeg,image/png,.pdf,.jpg,.jpeg,.png" className="block text-sm" onChange={(event) => onFile(event.target.files?.[0] ?? null)} />
        <p className="text-xs text-[var(--muted)]">Taille maximale : {SCAN_MAX_BYTES / (1024 * 1024)} Mo. Les photos HEIC doivent être enregistrées en JPG.</p>
        <Button type="button" onClick={analyze} disabled={pending}>{pending ? "Analyse en cours…" : "Analyser le document"}</Button>
        {message ? <p className="text-sm text-red-700" role="alert">{message}</p> : null}
      </section>
      {analysis?.invoice && analysis.match?.status === "new" && !linkedSupplierId ? (
        <SupplierQuickCreate
          invoice={analysis.invoice}
          onCancel={() => {
            const path = analysis.path;
            setAnalysis(null);
            if (path) void discardSupplierInvoiceScan(path).catch(() => undefined);
          }}
          onCreated={(supplier) => {
            setKnownSuppliers((current) => current.some((item) => item.id === supplier.id) ? current : [...current, supplier]);
            setLinkedSupplierId(supplier.id);
          }}
        />
      ) : null}
      {analysis?.invoice && fileUrl && (analysis.match?.status !== "new" || linkedSupplierId) ? (
        <SupplierInvoiceScanReview analysis={analysis} fileUrl={fileUrl} suppliers={knownSuppliers} supplierId={linkedSupplierId} />
      ) : null}
    </div>
  );
}

export function SupplierQuickCreate({
  invoice,
  onCreated,
  onCancel,
}: {
  invoice: OcrSupplierInvoice;
  onCreated: (supplier: SupplierOption) => void;
  onCancel: () => void;
}) {
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const local = validateNewSupplier({ name: String(form.get("name") ?? ""), ice: String(form.get("ice") ?? ""), email: String(form.get("email") ?? "") });
    if (local) { setError(local); return; }
    startTransition(async () => {
      const result = await createSupplierForOcr(form);
      if (!result.success) { setError(result.error); return; }
      onCreated({ id: result.id, name: result.name, ice: String(form.get("ice") ?? "") || null });
    });
  }
  return (
    <form onSubmit={submit} className="space-y-3 rounded-[var(--radius-lg)] border border-amber-300 bg-amber-50 p-4">
      <p className="text-base font-semibold text-amber-950" role="alert">Fournisseur introuvable : {invoice.supplierName || "nom non lu"}</p>
      <p className="text-sm text-amber-950">Créez ce fournisseur avant la facture. Seul le nom est obligatoire. Annuler ne crée ni le fournisseur ni la facture.</p>
      {error ? <p className="text-sm text-red-700" role="alert">{error}</p> : null}
      <input type="hidden" name="type_supplier" value="on" />
      <label className="block text-sm">Type
        <input value="Fournisseur" readOnly className="mt-1 w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2" />
      </label>
      <label className="block text-sm">Nom
        <input name="name" required defaultValue={invoice.supplierName} className={`mt-1 w-full rounded-lg border px-3 py-2 ${uncertain(invoice.confidence.supplierName) ? "border-amber-500 bg-white" : "border-[var(--border)] bg-white"}`} />
      </label>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="block text-sm">ICE
          <input name="ice" defaultValue={invoice.ice} inputMode="numeric" className="mt-1 w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2" />
        </label>
        <label className="block text-sm">IF
          <input name="if_number" defaultValue={invoice.ifNumber} className="mt-1 w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2" />
        </label>
        <label className="block text-sm">RC
          <input name="rc" defaultValue={invoice.rc} className="mt-1 w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2" />
        </label>
      </div>
      <label className="block text-sm">Adresse
        <input name="address" defaultValue={invoice.address} className="mt-1 w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2" />
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm">Téléphone
          <input name="phone" defaultValue={invoice.phone} className="mt-1 w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2" />
        </label>
        <label className="block text-sm">E-mail
          <input name="email" type="email" defaultValue={invoice.email} className="mt-1 w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2" />
        </label>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={pending}>{pending ? "Création…" : "Créer le fournisseur"}</Button>
        <Button type="button" variant="secondary" onClick={onCancel}>Annuler</Button>
      </div>
    </form>
  );
}

export function SupplierInvoiceScanReview({
  analysis,
  fileUrl,
  suppliers,
  supplierId: initialSupplierId = "",
}: {
  analysis: OcrAnalysis;
  fileUrl: string;
  suppliers: SupplierOption[];
  supplierId?: string;
}) {
  const invoice = analysis.invoice;
  const [supplierId, setSupplierId] = useState(initialSupplierId || (analysis.match?.status === "matched" ? analysis.match.id : ""));
  const [lines, setLines] = useState(invoice?.lines ?? []);
  const [state, action, pending] = useActionState(saveScannedSupplierInvoice, {});
  if (!invoice) return null;
  const average = averageConfidence(invoice);
  return (
    <form action={action} className="grid gap-4 lg:grid-cols-2">
      <div className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--card)]">
        <p className="border-b border-[var(--border)] px-4 py-2 text-sm font-medium">Document</p>
        <iframe title="Aperçu de la facture fournisseur" src={fileUrl} className="h-[720px] w-full bg-white" />
      </div>
      <div className="space-y-3 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--card)] p-4">
        <p className="text-sm text-[var(--muted)]">Vérifiez les champs surlignés, puis enregistrez. La facture reste un brouillon : aucune écriture n’est passée.</p>
        {analysis.warnings.map((warning) => <p key={warning} className="text-sm text-amber-800" role="alert">{warning}</p>)}
        {state.error ? <p className="text-sm text-red-700" role="alert">{state.error}</p> : null}
        <input type="hidden" name="scan_path" value={analysis.path ?? ""} />
        <input type="hidden" name="lines" value={JSON.stringify(lines)} />
        <input type="hidden" name="confidence" value={String(average)} />
        <label className="block text-sm">Fournisseur
          <select name="supplier_id" value={supplierId} onChange={(event) => setSupplierId(event.target.value)} className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2">
            <option value="">Choisir un fournisseur</option>
            {suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}
          </select>
        </label>
        {initialSupplierId ? <p className="text-sm text-emerald-800">Fournisseur créé et sélectionné.</p> : null}
        {analysis.match?.status === "matched" && !initialSupplierId ? <p className="text-sm text-emerald-800">Fournisseur reconnu {analysis.match.via === "ice" ? "par l’ICE" : "par le nom"}.</p> : null}
        {analysis.match?.status === "ambiguous" ? <p className="text-sm text-amber-800">Plusieurs fournisseurs correspondent. Choisissez le bon.</p> : null}
        {!supplierId ? <p className="text-sm text-red-700">La facture ne peut pas être enregistrée sans fournisseur.</p> : null}
        <Field name="supplier_name" label="Nom lu sur la facture" defaultValue={invoice.supplierName} confidence={invoice.confidence.supplierName} />
        <div className="grid gap-3 sm:grid-cols-3">
          <Field name="ice" label="ICE" defaultValue={invoice.ice} confidence={invoice.confidence.ice} />
          <Field name="if_number" label="IF" defaultValue={invoice.ifNumber} confidence={invoice.confidence.ifNumber} />
          <Field name="rc" label="RC" defaultValue={invoice.rc} confidence={invoice.confidence.rc} />
        </div>
        <Field name="invoice_number" label="Numéro de facture" defaultValue={invoice.invoiceNumber} confidence={invoice.confidence.invoiceNumber} />
        <div className="grid gap-3 sm:grid-cols-2">
          <Field name="invoice_date" label="Date" type="date" defaultValue={invoice.invoiceDate} confidence={invoice.confidence.invoiceDate} />
          <Field name="due_date" label="Échéance" type="date" defaultValue={invoice.dueDate} confidence={invoice.confidence.dueDate} />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr><th className="px-2 py-1 text-left">Désignation</th><th className="px-2 py-1 text-left">Qté</th><th className="px-2 py-1 text-left">PU HT</th><th className="px-2 py-1 text-left">TVA %</th></tr></thead>
            <tbody>
              {lines.map((line, index) => (
                <tr key={`${line.description}-${index}`} className={uncertain(line.confidence) ? "bg-amber-50" : undefined}>
                  <td className="px-2 py-1"><input aria-label={`Désignation ${index + 1}`} className="w-full rounded border border-[var(--border)] px-2 py-1" value={line.description} onChange={(event) => updateLine(setLines, index, "description", event.target.value)} /></td>
                  <td className="px-2 py-1"><input aria-label={`Quantité ${index + 1}`} className="w-20 rounded border border-[var(--border)] px-2 py-1" value={line.quantity} onChange={(event) => updateLine(setLines, index, "quantity", Number(event.target.value))} /></td>
                  <td className="px-2 py-1"><input aria-label={`Prix unitaire ${index + 1}`} className="w-24 rounded border border-[var(--border)] px-2 py-1" value={line.unitPriceHt} onChange={(event) => updateLine(setLines, index, "unitPriceHt", Number(event.target.value))} /></td>
                  <td className="px-2 py-1"><input aria-label={`TVA ${index + 1}`} className="w-16 rounded border border-[var(--border)] px-2 py-1" value={line.vatRate} onChange={(event) => updateLine(setLines, index, "vatRate", Number(event.target.value))} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-sm">Total HT document : {money(invoice.totalHt)} · TVA : {money(invoice.totalVat)} · TTC : {money(invoice.totalTtc)} MAD</p>
        {invoice.vatByRate.length ? <p className="text-sm text-[var(--muted)]">TVA par taux : {invoice.vatByRate.map((item) => `${item.rate} % = ${item.amount.toFixed(2)}`).join(", ")}</p> : null}
        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={pending || !supplierId}>{pending ? "Enregistrement…" : "Enregistrer la facture"}</Button>
          <Button variant="secondary" asChild><Link href="/achats/factures">Annuler</Link></Button>
        </div>
      </div>
    </form>
  );
}

function Field({ name, label, defaultValue, confidence, type = "text" }: { name: string; label: string; defaultValue: string; confidence: number; type?: string }) {
  return (
    <label className="block text-sm">{label}
      <input name={name} type={type} defaultValue={defaultValue} className={`mt-1 w-full rounded-lg border px-3 py-2 ${uncertain(confidence) ? "border-amber-500 bg-amber-50" : "border-[var(--border)] bg-[var(--surface)]"}`} />
      {uncertain(confidence) ? <span className="text-xs text-amber-800">À vérifier</span> : null}
    </label>
  );
}

function money(value: number | null) {
  return value == null ? "—" : value.toFixed(2);
}

function averageConfidence(invoice: OcrSupplierInvoice) {
  const values = Object.values(invoice.confidence);
  if (!values.length) return 0;
  return Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 100) / 100;
}

function updateLine(setLines: Dispatch<SetStateAction<OcrSupplierInvoice["lines"]>>, index: number, key: "description" | "quantity" | "unitPriceHt" | "vatRate", value: string | number) {
  setLines((current) => current.map((line, lineIndex) => lineIndex === index ? { ...line, [key]: value, confidence: 1 } : line));
}
