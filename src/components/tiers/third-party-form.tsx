"use client";

import Link from "next/link";
import { useActionState, useMemo, useState } from "react";
import type { ThirdPartyActionResult } from "@/lib/third-party-actions";
import type { ThirdPartyKind, ThirdPartyRecord } from "@/lib/third-party-types";
import { PROSPECT_SOURCES, PROSPECT_STATUSES, normalizeTypes } from "@/lib/third-party-types";
import { PAYMENT_TERMS_OPTIONS, PAYMENT_METHOD_OPTIONS } from "@/lib/payment-options";
import { COUNTRY_OPTIONS, getCitiesForCountry, getDefaultCountry } from "@/lib/location-options";
import {
  SUPPLIER_CATEGORY_OPTIONS,
  SUPPLIER_PURCHASE_TERMS_OPTIONS,
  SUPPLIER_RATING_OPTIONS,
  SUPPLIER_PAYMENT_METHOD_OPTIONS,
} from "@/lib/supplier-options";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { DateField } from "@/components/ui/date-field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

type Props = {
  mode: "create" | "edit";
  thirdParty?: ThirdPartyRecord;
  action: (state: ThirdPartyActionResult, formData: FormData) => Promise<ThirdPartyActionResult>;
  initialType?: ThirdPartyKind;
};

const initialState: ThirdPartyActionResult = { success: true };

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="space-y-1.5 text-sm">
      <span className="font-medium text-[var(--muted)]">{label}</span>
      {children}
    </label>
  );
}

export function ThirdPartyForm({ mode, thirdParty, action, initialType }: Props) {
  const [state, formAction, pending] = useActionState(action, initialState);
  const initialTypes = useMemo<ThirdPartyKind[]>(() => {
    const fromRecord = normalizeTypes(thirdParty?.types);
    if (fromRecord.length) return fromRecord;
    if (initialType) return [initialType];
    return ["prospect"];
  }, [thirdParty, initialType]);
  const [types, setTypes] = useState<ThirdPartyKind[]>(initialTypes);
  const [country, setCountry] = useState(thirdParty?.country ?? getDefaultCountry());
  const [selectedCategories, setSelectedCategories] = useState<string[]>(() => {
    const raw = thirdParty?.supplier_product_categories ?? "";
    if (!raw) return [];
    return raw.split(",").map((s) => s.trim()).filter(Boolean);
  });
  const cities = useMemo(() => getCitiesForCountry(country), [country]);

  const toggle = (type: ThirdPartyKind) => {
    setTypes((current) =>
      current.includes(type)
        ? current.filter((item) => item !== type)
        : [...current, type],
    );
  };

  function toggleCategory(value: string) {
    setSelectedCategories((current) =>
      current.includes(value)
        ? current.filter((v) => v !== value)
        : [...current, value],
    );
  }

  const hasProspect = types.includes("prospect");
  const hasCustomer = types.includes("customer");
  const hasSupplier = types.includes("supplier");

  return (
    <form action={formAction} className="space-y-5">
      {thirdParty ? <input type="hidden" name="id" value={thirdParty.id} /> : null}
      <input type="hidden" name="supplier_product_categories" value={selectedCategories.join(",")} />
      <Card>
        <CardHeader>
          <h2 className="font-semibold">En-tete / Type de tiers</h2>
        </CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-3">
          <Field label="Nom du tiers *">
            <Input name="name" defaultValue={thirdParty?.name ?? ""} required />
          </Field>
          <Field label="Nom commercial / marque">
            <Input name="commercial_name" defaultValue={thirdParty?.commercial_name ?? ""} />
          </Field>
          <div className="space-y-2 lg:col-span-2">
            <p className="text-sm font-medium text-[var(--muted)]">Categories</p>
            <div className="flex flex-wrap gap-3">
              {(["prospect", "customer", "supplier"] as ThirdPartyKind[]).map((type) => (
                <label key={type} className="flex items-center gap-2 rounded-md border border-[var(--border)] bg-white px-3 py-2 text-sm">
                  <input
                    type="checkbox"
                    name={`type_${type}`}
                    checked={types.includes(type)}
                    onChange={() => toggle(type)}
                  />
                  {type === "prospect" ? "Prospect" : type === "customer" ? "Client" : "Fournisseur"}
                </label>
              ))}
            </div>
          </div>
          <Field label="Code tiers">
            <Input name="code" value={thirdParty?.code ?? "Genere automatiquement"} disabled readOnly />
          </Field>
          <Field label="Statut">
            <Select name="status" defaultValue={thirdParty?.status ?? "active"}>
              <option value="active">Actif</option>
              <option value="inactive">Inactif</option>
              <option value="blocked">Bloque</option>
              <option value="archived">Archive</option>
            </Select>
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="font-semibold">Coordonnees</h2>
        </CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-4">
          <Field label="Adresse">
            <Textarea name="address" defaultValue={thirdParty?.address ?? ""} className="lg:col-span-4" />
          </Field>
          <Field label="Code postal">
            <Input name="postal_code" defaultValue={thirdParty?.postal_code ?? ""} />
          </Field>
          <Field label="Pays">
            <Select
              name="country"
              value={country}
              onChange={(e) => setCountry(e.target.value)}
            >
              {COUNTRY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </Select>
          </Field>
          <Field label="Ville">
            <Select
              name="city"
              defaultValue={thirdParty?.city ?? ""}
              key={country}
            >
              <option value="">Selectionner une ville...</option>
              {cities.map((city) => (
                <option key={city} value={city}>{city}</option>
              ))}
            </Select>
          </Field>
          <Field label="Telephone">
            <Input name="phone" defaultValue={thirdParty?.phone ?? ""} />
          </Field>
          <Field label="Tel portable">
            <Input name="mobile" defaultValue={thirdParty?.mobile ?? ""} />
          </Field>
          <Field label="Email">
            <Input name="email" type="email" defaultValue={thirdParty?.email ?? ""} />
          </Field>
          <Field label="Web">
            <Input name="website" defaultValue={thirdParty?.website ?? ""} />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="font-semibold">Identifiants professionnels Maroc</h2>
        </CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-2">
          <Field label="Id. prof. 1 (R.C.)">
            <Input name="rc" defaultValue={thirdParty?.rc ?? ""} />
          </Field>
          <Field label="Id. prof. 2 (Patente)">
            <Input name="patente" defaultValue={thirdParty?.patente ?? ""} />
          </Field>
          <Field label="Id. prof. 3 (I.F.)">
            <Input name="if_number" defaultValue={thirdParty?.if_number ?? ""} />
          </Field>
          <Field label="Id. prof. 4 (C.N.S.S.)">
            <Input name="cnss" defaultValue={thirdParty?.cnss ?? ""} />
          </Field>
          <Field label="Identifiant Commun d'Entreprise (ICE)">
            <Input name="ice" defaultValue={thirdParty?.ice ?? ""} maxLength={15} />
          </Field>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="flex items-center gap-2 self-end rounded-md border border-[var(--border)] bg-white px-3 py-2 text-sm">
              <input name="vat_subject" type="checkbox" defaultChecked={thirdParty?.vat_subject ?? false} />
              Assujetti a la TVA
            </label>
            <Field label="Numero de TVA">
              <Input name="vat_number" defaultValue={thirdParty?.vat_number ?? ""} />
            </Field>
          </div>
        </CardContent>
      </Card>

      {hasProspect ? (
        <Card>
          <CardHeader><h2 className="font-semibold">Prospection</h2></CardHeader>
          <CardContent className="grid gap-4 lg:grid-cols-4">
            <Field label="Source du prospect">
              <Select name="prospect_source" defaultValue={thirdParty?.prospect_source ?? ""}>
                <option value="">Selectionner une source</option>
                {PROSPECT_SOURCES.map((source) => (
                  <option key={source} value={source}>{source}</option>
                ))}
              </Select>
            </Field>
            <Field label="Statut du prospect">
              <Select name="prospect_status" defaultValue={thirdParty?.prospect_status ?? "nouveau"}>
                {PROSPECT_STATUSES.map((status) => <option key={status}>{status}</option>)}
              </Select>
            </Field>
            <Field label="Valeur potentielle"><Input name="potential_value" type="number" min="0" step="0.01" defaultValue={thirdParty?.potential_value ?? 0} /></Field>
            <Field label="Prochain rappel"><DateField name="next_follow_up_date" defaultValue={thirdParty?.next_follow_up_date ?? ""} /></Field>
            <Field label="Niveau d'interet"><Input name="interest_level" defaultValue={thirdParty?.interest_level ?? ""} /></Field>
            <Field label="Commercial responsable"><Input name="sales_owner" defaultValue={thirdParty?.sales_owner ?? ""} /></Field>
            <Field label="Notes de prospection"><Textarea name="prospect_notes" defaultValue={thirdParty?.prospect_notes ?? ""} /></Field>
          </CardContent>
        </Card>
      ) : null}

      {hasCustomer || hasProspect ? (
        <Card>
          <CardHeader><h2 className="font-semibold">Conditions commerciales</h2></CardHeader>
          <CardContent className="grid gap-4 lg:grid-cols-4">
            <Field label="Conditions de paiement">
              <Select name="payment_terms" defaultValue={thirdParty?.payment_terms ?? ""}>
                <option value="">-- Selectionner --</option>
                {PAYMENT_TERMS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </Select>
            </Field>
            <Field label="Modalites de paiement">
              <Select name="payment_method" defaultValue={thirdParty?.payment_method ?? ""}>
                <option value="">-- Selectionner --</option>
                {PAYMENT_METHOD_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </Select>
            </Field>
            <Field label="Delai de paiement (jours)">
              <Input name="payment_terms_days" type="number" min="0" defaultValue={thirdParty?.payment_terms_days ?? 30} />
            </Field>
            <Field label="Detail condition personnalisee">
              <Input name="custom_payment_terms" defaultValue={thirdParty?.custom_payment_terms ?? ""} placeholder="Si paiement personnalise" />
            </Field>
            <Field label="Detail modalite personnalisee">
              <Input name="custom_payment_method" defaultValue={thirdParty?.custom_payment_method ?? ""} placeholder="Si autre modalite" />
            </Field>
            <Field label="Limite de credit"><Input name="credit_limit" type="number" min="0" step="0.01" defaultValue={thirdParty?.credit_limit ?? 0} /></Field>
            <Field label="CA cumule"><Input name="cumulative_revenue" type="number" min="0" step="0.01" defaultValue={thirdParty?.cumulative_revenue ?? 0} /></Field>
            <Field label="Encours actuel"><Input name="current_outstanding" type="number" min="0" step="0.01" defaultValue={thirdParty?.current_outstanding ?? 0} /></Field>
            <Field label="Remise commerciale par defaut"><Input name="default_discount_rate" type="number" min="0" step="0.01" defaultValue={thirdParty?.default_discount_rate ?? 0} /></Field>
            <Field label="Categorie client"><Input name="customer_category" defaultValue={thirdParty?.customer_category ?? ""} /></Field>
            <Field label="Niveau de risque"><Input name="risk_level" defaultValue={thirdParty?.risk_level ?? ""} /></Field>
          </CardContent>
        </Card>
      ) : null}

      {hasSupplier ? (
        <Card>
          <CardHeader><h2 className="font-semibold">Informations fournisseur</h2></CardHeader>
          <CardContent className="grid gap-4 lg:grid-cols-3">
            <div className="space-y-1.5 text-sm lg:col-span-3">
              <span className="font-medium text-[var(--muted)]">Categories produits/services</span>
              <div className="mt-1.5 flex flex-wrap gap-2">
                {SUPPLIER_CATEGORY_OPTIONS.map((opt) => (
                  <label
                    key={opt.value}
                    className={`flex cursor-pointer items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs transition-colors ${
                      selectedCategories.includes(opt.value)
                        ? "border-indigo-300 bg-indigo-50 text-indigo-700"
                        : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                    }`}
                  >
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={selectedCategories.includes(opt.value)}
                      onChange={() => toggleCategory(opt.value)}
                    />
                    {opt.label}
                  </label>
                ))}
              </div>
            </div>
            <Field label="Conditions d'achat">
              <Select name="supplier_payment_terms" defaultValue={thirdParty?.supplier_payment_terms ?? ""}>
                <option value="">-- Selectionner --</option>
                {SUPPLIER_PURCHASE_TERMS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </Select>
            </Field>
            <Field label="Delai moyen livraison (jours)">
              <Input name="supplier_delivery_delay_days" type="number" min="0" step="1" defaultValue={thirdParty?.supplier_delivery_delay_days ?? ""} placeholder="Ex : 3" />
            </Field>
            <Field label="Evaluation fournisseur">
              <Select name="supplier_rating" defaultValue={thirdParty?.supplier_rating != null ? String(thirdParty.supplier_rating) : ""}>
                {SUPPLIER_RATING_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </Select>
            </Field>
            <Field label="Contact achat principal">
              <Input name="supplier_main_contact" defaultValue={thirdParty?.supplier_main_contact ?? ""} placeholder="Nom du contact achat principal" />
            </Field>
            <Field label="Mode de paiement fournisseur">
              <Select name="supplier_payment_method" defaultValue={thirdParty?.supplier_payment_method ?? ""}>
                <option value="">-- Selectionner --</option>
                {SUPPLIER_PAYMENT_METHOD_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </Select>
            </Field>
            <Field label="Notes achat">
              <Textarea name="supplier_notes" defaultValue={thirdParty?.supplier_notes ?? ""} placeholder="Notes internes liees aux achats, conditions particulieres, historique fournisseur..." />
            </Field>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader><h2 className="font-semibold">Plus</h2></CardHeader>
        <CardContent>
          <Field label="Notes internes">
            <Textarea name="notes" defaultValue={thirdParty?.notes ?? ""} />
          </Field>
          <div className="mt-4 rounded-lg border border-dashed border-[var(--border)] bg-[var(--surface-soft)] p-4 text-sm text-[var(--muted)]">
            Contacts, adresses secondaires et pieces jointes sont geres depuis la fiche tiers apres creation.
          </div>
        </CardContent>
      </Card>

      {!state.success && state.error ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{state.error}</p>
      ) : null}

      <div className="sticky bottom-0 flex items-center justify-end gap-3 border-t border-[var(--border)] bg-[var(--background)] py-4">
        <Link href={thirdParty ? `/tiers/${thirdParty.id}` : "/tiers"}>
          <Button type="button" variant="secondary">Annuler</Button>
        </Link>
        <Button disabled={pending}>{mode === "create" ? "Creer tiers" : "Enregistrer"}</Button>
      </div>
    </form>
  );
}
