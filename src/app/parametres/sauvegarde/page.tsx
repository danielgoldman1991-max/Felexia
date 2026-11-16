import Link from "next/link";
import { requireActiveWorkspace } from "@/lib/auth";
import { isAdminRole } from "@/lib/auth/roles";
import { PageHeader } from "@/components/erp/page-header";
import { OrganizationBackupPanel } from "@/components/settings/organization-backup-panel";
import { ThirdPartyImportForm } from "@/components/tiers/third-party-import-form";
import { redirect } from "next/navigation";

export default async function OrganizationBackupPage() {
  const workspace = await requireActiveWorkspace();
  if (!isAdminRole(workspace.role)) redirect("/parametres");
  return (
    <div className="space-y-6">
      <PageHeader title="Sauvegarde et import" description="Réservé au propriétaire et à l’administrateur. Tout reste limité à l’entreprise ouverte." />
      <div className="grid gap-4 xl:grid-cols-2">
        <OrganizationBackupPanel organizationName={workspace.organization.name} />
        <section className="space-y-4 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--card)] p-4 sm:p-5" aria-labelledby="import-clients">
          <div>
            <h2 id="import-clients" className="text-base font-semibold">Import clients</h2>
            <p className="mt-1 text-sm leading-6 text-[var(--muted)]">Excel .xlsx, .xls ou CSV. Le modèle contient les colonnes en français, une ligne fictive et les consignes.</p>
          </div>
          <ThirdPartyImportForm />
        </section>
      </div>
      <Link href="/parametres" className="text-sm font-medium text-[var(--primary)] hover:underline">Retour aux paramètres</Link>
    </div>
  );
}
