"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { saveBankMatchRule } from "@/lib/treasury/reconciliation-actions";

export function BankMatchRuleForm() {
  const [state, action, pending] = useActionState(saveBankMatchRule, { success: true });
  return (
    <form className="erp-form" action={action}>
      <Card>
        <CardHeader><h2 className="font-semibold">Nouvelle règle</h2></CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm">Le libellé contient<Input name="label_contains" required minLength={2} className="mt-1" placeholder="commission" /></label>
          <label className="text-sm">Sens
            <Select name="direction" defaultValue="" className="mt-1">
              <option value="">Les deux</option>
              <option value="in">Crédit</option>
              <option value="out">Débit</option>
            </Select>
          </label>
          <label className="text-sm">Catégorie
            <Select name="category" defaultValue="commission" className="mt-1">
              <option value="commission">Commission</option>
              <option value="fee">Frais bancaires</option>
              <option value="vat_fee">TVA sur frais</option>
              <option value="agio">Agios</option>
              <option value="customer">Encaissement client</option>
              <option value="supplier">Paiement fournisseur</option>
              <option value="ignore">Ignorer</option>
            </Select>
          </label>
          <label className="text-sm">Compte CGNC (optionnel)<Input name="account_code" className="mt-1" placeholder="6147" /></label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="auto_apply" /> Appliquer sans validation quand le score est élevé</label>
          {!state.success && state.error ? <p className="text-sm text-red-700 sm:col-span-2">{state.error}</p> : null}
          <div className="erp-form-actions"><Button type="submit" disabled={pending}>{pending ? "Enregistrement…" : "Enregistrer"}</Button></div>
        </CardContent>
      </Card>
    </form>
  );
}
