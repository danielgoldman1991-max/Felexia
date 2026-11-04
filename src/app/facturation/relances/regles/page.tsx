import Link from "next/link";
import { requireActiveWorkspace } from "@/lib/auth";
import { hasFullErpAccess } from "@/lib/launch-access";
import { createClient } from "@/lib/supabase/server";
import { isMissingSchema, SCHEMA_PENDING_MESSAGE } from "@/lib/optional-schema";
import { ModulePage } from "@/components/erp/module-page";
import { ModuleUpgradePage } from "@/components/erp/module-upgrade-page";
import { PageHeader } from "@/components/erp/page-header";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/erp/empty-state";
import { Table, Td, Th } from "@/components/ui/table";
import { deleteReminderRuleAction } from "@/lib/sales/commercial-terms-actions";

export const dynamic = "force-dynamic";

export default async function ReminderRulesPage() {
  const workspace = await requireActiveWorkspace();
  if (!(await hasFullErpAccess(workspace.organization.id))) return <ModulePage><ModuleUpgradePage /></ModulePage>;
  const supabase = await createClient();
  const { data, error } = await supabase.from("customer_reminder_rules").select("id, name, days_after_due, level, channel, active").eq("organization_id", workspace.organization.id).order("days_after_due");
  if (isMissingSchema(error)) return <ModulePage><PageHeader title="Règles de relance" description={SCHEMA_PENDING_MESSAGE} /></ModulePage>;
  return (
    <ModulePage>
      <PageHeader title="Règles de relance" description="La règle active dont le délai est atteint préremplit la prochaine relance. Aucun envoi automatique n’est fait." actions={<Button asChild><Link href="/facturation/relances/regles/new">Nouvelle règle</Link></Button>} />
      {(data ?? []).length === 0 ? <EmptyState title="Aucune règle de relance" description="Définissez un délai après l’échéance, un niveau et un message." /> : (
        <Table>
          <thead><tr><Th>Règle</Th><Th>Délai</Th><Th>Niveau</Th><Th>Canal</Th><Th>État</Th><Th></Th></tr></thead>
          <tbody>
            {(data ?? []).map((row) => (
              <tr key={row.id as string}>
                <Td><Link className="font-medium text-[var(--primary)]" href={`/facturation/relances/regles/${row.id}`}>{(row.name as string | null) ?? "Règle"}</Link></Td>
                <Td>{row.days_after_due as number} j</Td>
                <Td>{row.level as number}</Td>
                <Td>{row.channel as string}</Td>
                <Td>{row.active === false ? "Inactive" : "Active"}</Td>
                <Td><form action={deleteReminderRuleAction}><input type="hidden" name="id" value={row.id as string} /><Button type="submit" variant="ghost">Supprimer</Button></form></Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </ModulePage>
  );
}
