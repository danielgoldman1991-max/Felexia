import { Mail, ShieldCheck, User } from "lucide-react";
import { PageHeader } from "@/components/erp/page-header";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { requireActiveWorkspace } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { initials } from "@/lib/utils";

function formatDate(value?: string | null) {
  if (!value) return "Non disponible";
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(new Date(value));
}

export default async function ProfilPage() {
  const workspace = await requireActiveWorkspace();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, email, created_at")
    .eq("id", workspace.userId)
    .maybeSingle();

  const displayName = profile?.full_name ?? workspace.profile?.full_name ?? "Utilisateur Felexia";
  const email = profile?.email ?? workspace.profile?.email ?? workspace.email ?? user?.email ?? "";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Mon profil"
        description="Consultez les informations de votre compte et votre rôle dans l’organisation active."
      />

      <Card className="overflow-hidden">
        <CardContent className="flex flex-col gap-6 p-6 md:flex-row md:items-center">
          <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-[28px] bg-gradient-to-br from-[#D6B56D] to-cyan-300 text-2xl font-semibold text-[#06070A] shadow-[var(--shadow-gold)]">
            {initials(displayName) || "FX"}
          </div>
          <div className="min-w-0 flex-1">
            <p className="section-title">Compte utilisateur</p>
            <h2 className="mt-2 truncate text-2xl font-semibold tracking-tight text-[var(--foreground)]">{displayName}</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">{email}</p>
          </div>
          <Badge tone="info">{workspace.role ?? "Membre"}</Badge>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <User className="h-5 w-5 text-[var(--primary)]" />
              <h2 className="font-semibold">Identité</h2>
            </div>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p className="text-[var(--muted)]">Nom complet</p>
            <p className="font-medium text-[var(--foreground)]">{displayName}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <Mail className="h-5 w-5 text-[#D6B56D]" />
              <h2 className="font-semibold">Email</h2>
            </div>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p className="text-[var(--muted)]">Adresse de connexion</p>
            <p className="break-all font-medium text-[var(--foreground)]">{email || "Non disponible"}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <ShieldCheck className="h-5 w-5 text-[var(--success)]" />
              <h2 className="font-semibold">Accès</h2>
            </div>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p className="text-[var(--muted)]">Organisation</p>
            <p className="font-medium text-[var(--foreground)]">{workspace.organization.name}</p>
            <p className="pt-2 text-xs text-[var(--muted)]">Profil créé le {formatDate(profile?.created_at ?? null)}</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
