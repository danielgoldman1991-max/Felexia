import Link from "next/link";
import { requireActiveWorkspace } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/erp/page-header";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getPlanDefinition } from "@/lib/subscriptions/plans";
import {
  Building2, Users, Shield, CreditCard, FileText, UserCog, ChevronRight,
} from "lucide-react";

export default async function ParametresPage() {
  const workspace = await requireActiveWorkspace();
  const supabase = await createClient();

  const [{ count: memberCount }, { data: company }] = await Promise.all([
    supabase
      .from("organization_members")
      .select("*", { count: "exact", head: true })
      .eq("organization_id", workspace.organization.id)
      .eq("status", "active"),
    supabase
      .from("company_settings")
      .select("legal_name, ice, city")
      .eq("organization_id", workspace.organization.id)
      .maybeSingle(),
  ]);

  const planName = getPlanDefinition(workspace.subscription?.planCode ?? workspace.subscription?.planSlug).name;

  const statusBadge = workspace.subscription?.status === "active"
    ? { label: "Actif", tone: "success" as const }
    : workspace.subscription?.status === "past_due"
    ? { label: "Paiement en retard", tone: "danger" as const }
    : { label: workspace.subscription?.status ?? "Aucun", tone: "neutral" as const };

  return (
    <div className="space-y-6">
      <PageHeader title="Paramètres" description="Gérez votre organisation, vos utilisateurs et votre abonnement." />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                <Building2 className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-medium text-[var(--muted)]">Entreprise</p>
                <p className="font-semibold">{company?.legal_name || workspace.organization.name}</p>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-1 text-sm text-[var(--muted)]">
              {company?.ice && <p>ICE: {company.ice}</p>}
              {company?.city && <p>{company.city}</p>}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-green-50 text-green-600">
                <Users className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-medium text-[var(--muted)]">Utilisateurs</p>
                <p className="font-semibold">{memberCount ?? 0} actif{(memberCount ?? 0) > 1 ? "s" : ""}</p>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-[var(--muted)]">
              Votre rôle: <span className="font-medium text-[var(--foreground)] capitalize">{workspace.role}</span>
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-50 text-purple-600">
                <CreditCard className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-medium text-[var(--muted)]">Abonnement</p>
                <p className="font-semibold">{planName}</p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex items-center gap-2">
            <Badge tone={statusBadge.tone}>{statusBadge.label}</Badge>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-2">
        <h2 className="text-sm font-semibold text-[var(--muted)]">Accès rapides</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <QuickLink href="/parametres/entreprise" icon={Building2} label="Modifier l'entreprise" />
          <QuickLink href="/parametres/utilisateurs" icon={Users} label="Inviter un utilisateur" />
          <QuickLink href="/parametres/roles" icon={Shield} label="Gérer les rôles" />
          <QuickLink href="/parametres/abonnement" icon={CreditCard} label="Gérer l'abonnement" />
          <QuickLink href="/parametres/documents" icon={FileText} label="Configurer les documents" />
          <QuickLink href="/parametres/preferences" icon={UserCog} label="Préférences" />
        </div>
      </div>
    </div>
  );
}

function QuickLink({ href, icon: Icon, label }: { href: string; icon: typeof Building2; label: string }) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm font-medium text-[var(--foreground)] transition hover:border-[var(--primary)]/30 hover:shadow-sm"
    >
      <span className="flex items-center gap-3">
        <Icon className="h-4 w-4 text-[var(--primary)]" />
        {label}
      </span>
      <ChevronRight className="h-4 w-4 text-[var(--muted)]" />
    </Link>
  );
}
