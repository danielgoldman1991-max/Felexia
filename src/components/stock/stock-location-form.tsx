"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { STOCK_LOCATION_STATUS_LABELS, STOCK_LOCATION_TYPE_LABELS, type StockActionResult, type StockLocationRecord } from "@/lib/stock-types";

type Props = {
  location?: StockLocationRecord | null;
  locations: StockLocationRecord[];
  action: (state: StockActionResult, formData: FormData) => Promise<StockActionResult>;
};

const initialState: StockActionResult = { success: true };

export function StockLocationForm({ location, locations, action }: Props) {
  const [state, formAction, pending] = useActionState(action, initialState);
  const availableParents = locations.filter((item) => item.id !== location?.id);

  return (
    <form action={formAction} className="space-y-5">
      {location ? <input type="hidden" name="id" value={location.id} /> : null}
      <Card>
        <CardHeader><h2 className="font-semibold">Informations emplacement</h2></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <label className="space-y-2 text-sm">
            <span className="font-medium">Nom de l&apos;emplacement *</span>
            <Input name="name" defaultValue={location?.name ?? ""} required />
          </label>
          <label className="space-y-2 text-sm">
            <span className="font-medium">Code</span>
            <Input name="code" defaultValue={location?.code ?? ""} placeholder="DEPOT-PRINCIPAL" />
          </label>
          <label className="space-y-2 text-sm">
            <span className="font-medium">Type d&apos;emplacement</span>
            <Select name="location_type" defaultValue={location?.location_type ?? "depot"}>
              {Object.entries(STOCK_LOCATION_TYPE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </Select>
          </label>
          <label className="space-y-2 text-sm">
            <span className="font-medium">Emplacement parent</span>
            <Select name="parent_id" defaultValue={location?.parent_id ?? ""}>
              <option value="">Aucun</option>
              {availableParents.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </Select>
          </label>
          <label className="space-y-2 text-sm">
            <span className="font-medium">Statut</span>
            <Select name="status" defaultValue={location?.status ?? "active"}>
              {Object.entries(STOCK_LOCATION_STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </Select>
          </label>
          <label className="flex items-center gap-2 pt-7 text-sm">
            <input type="checkbox" name="is_default" defaultChecked={Boolean(location?.is_default)} />
            <span className="font-medium">Emplacement par defaut</span>
          </label>
          <label className="space-y-2 text-sm md:col-span-2">
            <span className="font-medium">Adresse</span>
            <Input name="address" defaultValue={location?.address ?? ""} />
          </label>
          <label className="space-y-2 text-sm">
            <span className="font-medium">Ville</span>
            <Input name="city" defaultValue={location?.city ?? ""} />
          </label>
          <label className="space-y-2 text-sm">
            <span className="font-medium">Pays</span>
            <Input name="country" defaultValue={location?.country ?? "MA"} />
          </label>
          <label className="space-y-2 text-sm">
            <span className="font-medium">Responsable</span>
            <Input name="manager_name" defaultValue={location?.manager_name ?? ""} />
          </label>
          <label className="space-y-2 text-sm">
            <span className="font-medium">Telephone</span>
            <Input name="phone" defaultValue={location?.phone ?? ""} />
          </label>
          <label className="space-y-2 text-sm">
            <span className="font-medium">Email</span>
            <Input name="email" type="email" defaultValue={location?.email ?? ""} />
          </label>
          <label className="space-y-2 text-sm md:col-span-2">
            <span className="font-medium">Notes</span>
            <Textarea name="notes" defaultValue={location?.notes ?? ""} />
          </label>
        </CardContent>
      </Card>

      {!state.success && state.error ? <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p> : null}

      <div className="flex justify-end gap-3">
        <Link href="/stock/emplacements"><Button type="button" variant="secondary">Annuler</Button></Link>
        <Button disabled={pending}>{location ? "Enregistrer" : "Creer emplacement"}</Button>
      </div>
    </form>
  );
}
