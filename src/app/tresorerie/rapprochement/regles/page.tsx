import Link from "next/link";
import { requireActiveWorkspace } from "@/lib/auth";
import { hasFullErpAccess } from "@/lib/launch-access";
import { createClient } from "@/lib/supabase/server";
import { isMissingSchema, SCHEMA_PENDING_MESSAGE } from "@/lib/optional-schema";
import { ModulePage } from "@/components/erp/module-page";
import { ModuleUpgradePage } from "@/components/erp/module-upgrade-page";
import { PageHeader } from "@/components/erp/page-header";
import { EmptyState } from "@/components/erp/empty-state";
import { BankMatchRuleForm } from "@/components/treasury/bank-match-rule-form";
import { Button } from "@/components/ui/button";
import { Table, Td, Th } from "@/components/ui/table";
import { deleteBankMatchRule } from "@/lib/treasury/reconciliation-actions";

export const dynamic = "force-dynamic";

const categories: Record<string, string> = {
  customer: "Encaissement client",
  supplier: "Paiement fournisseur",
  fee: "Frais",
  commission: "Commission",
  vat_fee: "TVA sur frais",
  agio: "Agios",
  ignore: "Ignorer",
};

export default async function BankMatchRulesPage() {
  const workspace = await requireActiveWorkspace();
  if (!(await hasFullErpAccess(workspace.organization.id))) return <ModulePage><ModuleUpgradePage /></ModulePage>;
  const supabase = await createClient();
  const { data, error } = await supabase.from("bank_match_rules").select("id, label_contains, direction, category, auto_apply, active").eq("organization_id", workspace.organization.id).order("label_contains");
  if (isMissingSchema(error)) return <ModulePage><PageHeader title="Règles de rapprochement" description={SCHEMA_PENDING_MESSAGE} /></ModulePage>;
  return (
    <ModulePage>
      <PageHeader title="Règles de rapprochement" description="Si le libellé contient un texte, Felexia propose la catégorie. L'application automatique reste un choix explicite." actions={<Button variant="secondary" asChild><Link href="/tresorerie/rapprochement">Retour</Link></Button>} />
      <BankMatchRuleForm />
      {(data ?? []).length === 0 ? <EmptyState title="Aucune règle" description="Ajoutez par exemple « commission » vers les frais bancaires." /> : (
        <Table>
          <thead><tr><Th>Libellé</Th><Th>Sens</Th><Th>Catégorie</Th><Th>Auto</Th><Th></Th></tr></thead>
          <tbody>
            {(data ?? []).map((rule) => (
              <tr key={rule.id as string}>
                <Td>{rule.label_contains as string}</Td>
                <Td>{(rule.direction as string | null) === "in" ? "Crédit" : (rule.direction as string | null) === "out" ? "Débit" : "Les deux"}</Td>
                <Td>{categories[rule.category as string] ?? rule.category}</Td>
                <Td>{rule.auto_apply ? "Oui" : "Non"}</Td>
                <Td><form action={deleteBankMatchRule}><input type="hidden" name="id" value={rule.id as string} /><Button type="submit" variant="ghost">Supprimer</Button></form></Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </ModulePage>
  );
}
