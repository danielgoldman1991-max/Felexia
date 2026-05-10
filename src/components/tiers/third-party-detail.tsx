"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Archive, CheckCircle2, Pencil } from "lucide-react";
import { EmptyState } from "@/components/erp/empty-state";
import { MoneyDisplay } from "@/components/erp/money-display";
import { PageHeader } from "@/components/erp/page-header";
import { StatusBadge } from "@/components/erp/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Table, Td, Th } from "@/components/ui/table";
import {
  archiveThirdParty,
  convertProspectToCustomer,
  createThirdPartyAddress,
  createThirdPartyContact,
  deleteThirdPartyAddress,
  deleteThirdPartyContact,
} from "@/lib/third-party-actions";
import { getPaymentTermLabel, getPaymentMethodLabel } from "@/lib/payment-terms";
import type {
  ThirdPartyActivityItem,
  ThirdPartyAddress,
  ThirdPartyAttachment,
  ThirdPartyContact,
  ThirdPartyRecord,
} from "@/lib/third-party-types";
import { formatDate } from "@/lib/format";
import { ThirdPartyBadges } from "@/components/tiers/third-party-badges";
import { ThirdPartyAttachments } from "@/components/tiers/third-party-attachments";

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase text-[var(--muted)]">{label}</p>
      <div className="mt-1 text-sm">{value || "-"}</div>
    </div>
  );
}

const ACTIVITY_LABELS: Record<string, string> = {
  create: "Creation du tiers",
  update: "Modification du tiers",
  archive: "Archivage du tiers",
  convert_prospect_to_customer: "Conversion prospect en client",
  CONVERT_PROSPECT_TO_CUSTOMER: "Conversion prospect en client",
  create_contact: "Contact ajoute",
  update_contact: "Contact modifie",
  delete_contact: "Contact archive",
  create_address: "Adresse ajoutee",
  update_address: "Adresse modifiee",
  delete_address: "Adresse archivee",
  upload_attachment: "Piece jointe ajoutee",
  archive_attachment: "Piece jointe archivee",
};

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("fr-MA", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function activityLabel(action: string) {
  return ACTIVITY_LABELS[action] ?? action;
}

function activityUser(activity: ThirdPartyActivityItem) {
  return activity.user_name || activity.user_email || "Utilisateur inconnu";
}

export function ThirdPartyDetail({
  thirdParty,
  contacts,
  addresses,
  attachments,
  activity,
}: {
  thirdParty: ThirdPartyRecord;
  contacts: ThirdPartyContact[];
  addresses: ThirdPartyAddress[];
  attachments: ThirdPartyAttachment[];
  activity: ThirdPartyActivityItem[];
}) {
  const isProspect = thirdParty.types?.includes("prospect");
  const isCustomer = thirdParty.types?.includes("customer");
  const isSupplier = thirdParty.types?.includes("supplier");

  const [convertState, convertAction, convertPending] = useActionState(convertProspectToCustomer, { success: true });
  const [archiveState, archiveAction] = useActionState(archiveThirdParty, { success: true });
  const [createContactState, createContactAction] = useActionState(createThirdPartyContact, { success: true });
  const [deleteContactState, deleteContactAction] = useActionState(deleteThirdPartyContact, { success: true });
  const [createAddressState, createAddressAction] = useActionState(createThirdPartyAddress, { success: true });
  const [deleteAddressState, deleteAddressAction] = useActionState(deleteThirdPartyAddress, { success: true });

  return (
    <div className="space-y-6">
      <PageHeader
        title={thirdParty.name}
        description={thirdParty.code ?? "Code tiers non genere"}
        actions={
          <>
            {isProspect && !isCustomer ? (
              <form action={convertAction}>
                <input type="hidden" name="id" value={thirdParty.id} />
                <Button disabled={convertPending}>
                  <CheckCircle2 className="h-4 w-4" />
                  Convertir en client
                </Button>
                {!convertState.success && convertState.error ? (
                  <p className="mt-1 text-xs text-red-600">{convertState.error}</p>
                ) : null}
              </form>
            ) : null}
            <Link href={`/tiers/${thirdParty.id}/edit`}>
              <Button variant="secondary"><Pencil className="h-4 w-4" /> Modifier</Button>
            </Link>
            <form action={archiveAction}>
              <input type="hidden" name="id" value={thirdParty.id} />
              <Button variant="danger"><Archive className="h-4 w-4" /> Archiver</Button>
              {!archiveState.success && archiveState.error ? (
                <p className="mt-1 text-xs text-red-600">{archiveState.error}</p>
              ) : null}
            </form>
          </>
        }
      />

      <Card>
        <CardContent className="flex flex-wrap items-center gap-3">
          <ThirdPartyBadges types={thirdParty.types} />
          <StatusBadge status={thirdParty.status} />
          <span className="text-sm text-[var(--muted)]">Cree le {formatDate(thirdParty.created_at)}</span>
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader><h2 className="font-semibold">Informations generales</h2></CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <Info label="Nom commercial" value={thirdParty.commercial_name} />
            <Info label="Code tiers" value={thirdParty.code} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader><h2 className="font-semibold">Coordonnees</h2></CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <Info label="Adresse" value={thirdParty.address} />
            <Info label="Ville" value={`${thirdParty.postal_code ?? ""} ${thirdParty.city ?? ""}`} />
            <Info label="Telephone" value={thirdParty.phone} />
            <Info label="Portable" value={thirdParty.mobile} />
            <Info label="Email" value={thirdParty.email} />
            <Info label="Web" value={thirdParty.website} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><h2 className="font-semibold">Identifiants professionnels</h2></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <Info label="R.C." value={thirdParty.rc} />
          <Info label="Patente" value={thirdParty.patente} />
          <Info label="I.F." value={thirdParty.if_number} />
          <Info label="C.N.S.S." value={thirdParty.cnss} />
          <Info label="ICE" value={thirdParty.ice} />
          <Info label="TVA" value={thirdParty.vat_subject ? thirdParty.vat_number ?? "Assujetti" : "Non assujetti"} />
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-2">
        {isCustomer || isProspect ? (
          <Card>
            <CardHeader><h2 className="font-semibold">Conditions commerciales</h2></CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <Info label="Conditions de paiement" value={getPaymentTermLabel(thirdParty.payment_terms) || `${thirdParty.payment_terms_days ?? 0} jours`} />
              <Info label="Modalites de paiement" value={getPaymentMethodLabel(thirdParty.payment_method)} />
              {thirdParty.custom_payment_terms ? <Info label="Detail condition" value={thirdParty.custom_payment_terms} /> : null}
              {thirdParty.custom_payment_method ? <Info label="Detail modalite" value={thirdParty.custom_payment_method} /> : null}
              <Info label="Limite credit" value={<MoneyDisplay value={thirdParty.credit_limit} />} />
              <Info label="CA cumule" value={<MoneyDisplay value={thirdParty.cumulative_revenue} />} />
              <Info label="Encours actuel" value={<MoneyDisplay value={thirdParty.current_outstanding} />} />
              <Info label="Categorie" value={thirdParty.customer_category} />
              <Info label="Risque" value={thirdParty.risk_level} />
            </CardContent>
          </Card>
        ) : null}
        {isSupplier ? (
          <Card>
            <CardHeader><h2 className="font-semibold">Informations achats</h2></CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <Info label="Categories fournies" value={thirdParty.supplier_product_categories} />
              <Info label="Conditions achat" value={thirdParty.supplier_payment_terms} />
              <Info label="Delai livraison" value={thirdParty.supplier_delivery_delay_days ? `${thirdParty.supplier_delivery_delay_days} jours` : null} />
              <Info label="Evaluation" value={thirdParty.supplier_rating ? `${thirdParty.supplier_rating}/5` : null} />
              <Info label="Contact achat" value={thirdParty.supplier_main_contact} />
              <Info label="Paiement fournisseur" value={thirdParty.supplier_payment_method} />
            </CardContent>
          </Card>
        ) : null}
      </div>

      <Card>
        <CardHeader><h2 className="font-semibold">Contacts associes</h2></CardHeader>
        <CardContent className="space-y-4">
          {contacts.length ? (
            <Table>
              <thead><tr><Th>Nom</Th><Th>Fonction</Th><Th>Telephone</Th><Th>Email</Th><Th>Principal</Th><Th>Actions</Th></tr></thead>
              <tbody>
                {contacts.map((contact) => (
                  <tr key={contact.id}>
                    <Td>{contact.full_name}</Td>
                    <Td>{contact.job_title ?? "-"}</Td>
                    <Td>{contact.mobile ?? contact.phone ?? "-"}</Td>
                    <Td>{contact.email ?? "-"}</Td>
                    <Td>{contact.is_primary ? "Oui" : "Non"}</Td>
                    <Td>
                      <form action={deleteContactAction}>
                        <input type="hidden" name="id" value={contact.id} />
                        <input type="hidden" name="third_party_id" value={thirdParty.id} />
                        <Button variant="ghost">Archiver</Button>
                      </form>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          ) : <EmptyState title="Aucun contact" description="Ajoutez les interlocuteurs de ce tiers." />}
          {!deleteContactState.success && deleteContactState.error ? (
            <p className="text-xs text-red-600">{deleteContactState.error}</p>
          ) : null}
          <form action={createContactAction} className="grid gap-3 rounded-lg border border-[var(--border)] p-4 md:grid-cols-4">
            <input type="hidden" name="third_party_id" value={thirdParty.id} />
            <Input name="full_name" placeholder="Nom complet" required />
            <Input name="job_title" placeholder="Fonction" />
            <Input name="mobile" placeholder="Portable" />
            <Input name="email" type="email" placeholder="Email" />
            <label className="flex items-center gap-2 text-sm"><input name="is_primary" type="checkbox" /> Contact principal</label>
            <Input name="phone" placeholder="Telephone" />
            <Input name="notes" placeholder="Notes" />
            <Button>Ajouter contact</Button>
            {!createContactState.success && createContactState.error ? (
              <p className="col-span-full text-xs text-red-600">{createContactState.error}</p>
            ) : null}
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><h2 className="font-semibold">Adresses secondaires</h2></CardHeader>
        <CardContent className="space-y-4">
          {addresses.length ? (
            <Table>
              <thead><tr><Th>Libelle</Th><Th>Type</Th><Th>Adresse</Th><Th>Ville</Th><Th>Defaut</Th><Th>Actions</Th></tr></thead>
              <tbody>
                {addresses.map((address) => (
                  <tr key={address.id}>
                    <Td>{address.label}</Td>
                    <Td>{address.type}</Td>
                    <Td>{address.address}</Td>
                    <Td>{address.city ?? "-"}</Td>
                    <Td>{address.is_default ? "Oui" : "Non"}</Td>
                    <Td>
                      <form action={deleteAddressAction}>
                        <input type="hidden" name="id" value={address.id} />
                        <input type="hidden" name="third_party_id" value={thirdParty.id} />
                        <Button variant="ghost">Archiver</Button>
                      </form>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          ) : <EmptyState title="Aucune adresse secondaire" description="Ajoutez les adresses de facturation ou livraison." />}
          {!deleteAddressState.success && deleteAddressState.error ? (
            <p className="text-xs text-red-600">{deleteAddressState.error}</p>
          ) : null}
          <form action={createAddressAction} className="grid gap-3 rounded-lg border border-[var(--border)] p-4 md:grid-cols-4">
            <input type="hidden" name="third_party_id" value={thirdParty.id} />
            <Input name="label" placeholder="Libelle" required />
            <Select name="type" defaultValue="billing"><option value="billing">Facturation</option><option value="delivery">Livraison</option><option value="other">Autre</option></Select>
            <Input name="address" placeholder="Adresse" required />
            <Input name="city" placeholder="Ville" />
            <Input name="postal_code" placeholder="Code postal" />
            <Input name="country" defaultValue="MA" placeholder="Pays" />
            <label className="flex items-center gap-2 text-sm"><input name="is_default" type="checkbox" /> Adresse par defaut</label>
            <Button>Ajouter adresse</Button>
            {!createAddressState.success && createAddressState.error ? (
              <p className="col-span-full text-xs text-red-600">{createAddressState.error}</p>
            ) : null}
          </form>
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader><h2 className="font-semibold">Notes internes</h2></CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap text-sm leading-6 text-[var(--muted)]">{thirdParty.notes || "Aucune note interne."}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><h2 className="font-semibold">Pieces jointes</h2></CardHeader>
          <CardContent>
            <ThirdPartyAttachments thirdPartyId={thirdParty.id} attachments={attachments} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><h2 className="font-semibold">Activite recente</h2></CardHeader>
        <CardContent>
          {activity.length ? (
            <div className="space-y-3">
              {activity.map((item) => (
                <div key={item.id} className="rounded-lg border border-[var(--border)] bg-white p-3">
                  <p className="text-sm font-medium text-[var(--foreground)]">
                    {activityLabel(item.action)} par {activityUser(item)}
                  </p>
                  <p className="mt-1 text-xs text-[var(--muted)]">{formatDateTime(item.created_at)}</p>
                  {item.description ? (
                    <p className="mt-2 text-sm text-[var(--muted)]">{item.description}</p>
                  ) : null}
                </div>
              ))}
            </div>
          ) : (
            <EmptyState title="Aucune activite recente" description="Les prochaines modifications du tiers apparaitront ici." />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
