import { notFound } from "next/navigation";
import { requireActiveWorkspace } from "@/lib/auth";
import { hasFullErpAccess } from "@/lib/launch-access";
import { createClient } from "@/lib/supabase/server";
import { isMissingSchema, SCHEMA_PENDING_MESSAGE } from "@/lib/optional-schema";
import { ModulePage } from "@/components/erp/module-page";
import { ModuleUpgradePage } from "@/components/erp/module-upgrade-page";
import { PageHeader } from "@/components/erp/page-header";
import { ReminderRuleForm } from "@/app/facturation/relances/regles/form";

export const dynamic = "force-dynamic";

export default async function EditReminderRulePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const workspace = await requireActiveWorkspace();
  if (!(await hasFullErpAccess(workspace.organization.id))) return <ModulePage><ModuleUpgradePage /></ModulePage>;
  const supabase = await createClient();
  const { data, error } = await supabase.from("customer_reminder_rules").select("id, name, days_after_due, level, channel, subject, message, active").eq("organization_id", workspace.organization.id).eq("id", id).maybeSingle();
  if (isMissingSchema(error)) return <ModulePage><PageHeader title="Règle de relance" description={SCHEMA_PENDING_MESSAGE} /></ModulePage>;
  if (!data) notFound();
  return (
    <ModulePage>
      <PageHeader title={(data.name as string | null) ?? "Règle de relance"} description="Une règle inactive n’est plus proposée." />
      <ReminderRuleForm initial={{
        id,
        name: (data.name as string | null) ?? "",
        days: Number(data.days_after_due ?? 0),
        level: Number(data.level ?? 1),
        channel: (data.channel as string | null) ?? "email",
        subject: (data.subject as string | null) ?? "",
        message: (data.message as string | null) ?? "",
        active: data.active !== false,
      }} />
    </ModulePage>
  );
}
