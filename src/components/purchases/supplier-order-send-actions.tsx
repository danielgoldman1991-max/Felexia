"use client";

import { FileText, Mail, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/format";
import type { PurchaseDocumentRecord } from "@/lib/purchase-types";

function normalizePhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  let cleaned = phone.replace(/[\s\-\(\)\.]/g, "");
  if (cleaned.startsWith("+")) cleaned = cleaned.slice(1);
  if (cleaned.startsWith("00")) cleaned = cleaned.slice(2);
  if (cleaned.startsWith("0") && cleaned.length === 10) {
    cleaned = "212" + cleaned.slice(1);
  }
  if (/^\d{9,15}$/.test(cleaned)) return cleaned;
  return null;
}

function getOrigin(): string {
  if (typeof window !== "undefined") return window.location.origin;
  return "";
}

export function SupplierOrderSendActions({ document }: { document: Pick<PurchaseDocumentRecord, "id" | "document_number" | "document_date" | "expected_receipt_date" | "total_ttc" | "status" | "supplier_name" | "supplier_email" | "supplier_phone"> }) {
  const sendable = ["confirmed", "sent", "partially_received", "received"].includes(document.status);
  if (!sendable) return null;

  const origin = getOrigin();
  const printUrl = `${origin}/achats/commandes/${document.id}/print`;
  const formattedDate = formatDate(document.document_date);
  const formattedTotal = `${Number(document.total_ttc).toFixed(2)} MAD`;

  const subject = encodeURIComponent(`Commande fournisseur ${document.document_number}`);
  const body = encodeURIComponent(
    [
      "Bonjour,",
      "",
      `Veuillez trouver ci-dessous notre commande fournisseur ${document.document_number}.`,
      "",
      `Lien PDF : ${printUrl}`,
      `Date commande : ${formattedDate}`,
      document.expected_receipt_date ? `Date reception prevue : ${formatDate(document.expected_receipt_date)}` : null,
      `Montant TTC : ${formattedTotal}`,
      "",
      "Merci de nous confirmer la bonne reception de cette commande.",
      "",
      "Cordialement,",
    ].filter(Boolean).join("\n"),
  );

  const phone = normalizePhone(document.supplier_phone);
  const waText = encodeURIComponent(
    [
      "Bonjour,",
      "",
      `Veuillez trouver notre commande fournisseur ${document.document_number}.`,
      "",
      `Lien PDF : ${printUrl}`,
      `Date commande : ${formattedDate}`,
      document.expected_receipt_date ? `Reception prevue : ${formatDate(document.expected_receipt_date)}` : null,
      `Montant TTC : ${formattedTotal}`,
      "",
      "Merci de confirmer la bonne reception.",
    ].filter(Boolean).join("\n"),
  );

  const hasEmail = Boolean(document.supplier_email);
  const hasPhone = Boolean(phone);

  return (
    <div className="flex flex-wrap items-center gap-2">
      {hasEmail ? (
        <a href={`mailto:${document.supplier_email}?subject=${subject}&body=${body}`} target="_blank" rel="noopener noreferrer">
          <Button type="button" variant="secondary"><Mail className="h-4 w-4" /> Envoyer par email</Button>
        </a>
      ) : (
        <span title="Aucune adresse email fournisseur renseignee.">
          <Button type="button" variant="secondary" disabled><Mail className="h-4 w-4" /> Envoyer par email</Button>
        </span>
      )}
      {hasPhone ? (
        <a href={`https://wa.me/${phone}?text=${waText}`} target="_blank" rel="noopener noreferrer">
          <Button type="button" variant="secondary"><MessageCircle className="h-4 w-4" /> Envoyer par WhatsApp</Button>
        </a>
      ) : (
        <span title="Aucun numero telephone fournisseur renseigne.">
          <Button type="button" variant="secondary" disabled><MessageCircle className="h-4 w-4" /> Envoyer par WhatsApp</Button>
        </span>
      )}
      <a href={`/achats/commandes/${document.id}/print`} target="_blank" rel="noopener noreferrer">
        <Button type="button" variant="secondary"><FileText className="h-4 w-4" /> Telecharger PDF</Button>
      </a>
    </div>
  );
}