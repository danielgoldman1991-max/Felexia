"use client";

import { useState } from "react";
import { Key, LogOut, History } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";

export function SecuritySettings({
  userEmail,
  userName,
  auditLogs,
}: {
  userEmail: string;
  userName: string;
  auditLogs: Record<string, unknown>[];
}) {
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  async function handlePasswordChange(formData: FormData) {
    setPasswordError(null);
    setPasswordSuccess(false);

    const newPwd = String(formData.get("new_password") ?? "");
    const confirmPwd = String(formData.get("confirm_password") ?? "");

    if (newPwd.length < 8) {
      setPasswordError("Le mot de passe doit faire au moins 8 caractères.");
      return;
    }

    if (newPwd !== confirmPwd) {
      setPasswordError("La confirmation du mot de passe ne correspond pas.");
      return;
    }

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({ password: newPwd });
      if (error) throw error;
      setPasswordSuccess(true);
      const form = document.getElementById("change-password-form") as HTMLFormElement | null;
      form?.reset();
    } catch (err) {
      setPasswordError((err as Error).message);
    }
  }

  const actionLabels: Record<string, string> = {
    update_company_settings: "Modification des informations entreprise",
    update_document_settings: "Modification des paramètres documents",
    create_role: "Création d'un rôle",
    delete_role: "Suppression d'un rôle",
    update_role_permissions: "Modification des permissions d'un rôle",
    invite_user: "Invitation d'un utilisateur",
    disable_user: "Désactivation d'un utilisateur",
    remove_user: "Suppression d'un utilisateur",
    change_subscription: "Changement d'abonnement",
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <Key className="h-5 w-5 text-blue-600" />
            <h2 className="font-semibold">Mot de passe</h2>
          </div>
        </CardHeader>
        <CardContent>
          <form id="change-password-form" action={handlePasswordChange} className="space-y-4 max-w-md">
            <Input name="new_password" type="password" placeholder="Nouveau mot de passe (min. 8 caractères)" autoComplete="new-password" required />
            <Input name="confirm_password" type="password" placeholder="Confirmer le nouveau mot de passe" autoComplete="new-password" required />
            {passwordError && (
              <p className="text-sm text-red-600">{passwordError}</p>
            )}
            {passwordSuccess && (
              <p className="text-sm text-green-600">Mot de passe modifié avec succès.</p>
            )}
            <Button type="submit">Changer le mot de passe</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <LogOut className="h-5 w-5 text-blue-600" />
            <h2 className="font-semibold">Session</h2>
          </div>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>Connecté en tant que: <span className="font-medium">{userName || userEmail}</span></p>
          <p>Email: <span className="font-medium">{userEmail}</span></p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <History className="h-5 w-5 text-blue-600" />
            <h2 className="font-semibold">Journal d&apos;activité</h2>
          </div>
        </CardHeader>
        <CardContent>
          {auditLogs.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">Aucune activité récente.</p>
          ) : (
            <div className="space-y-2">
              {auditLogs.map((log) => (
                <div key={String(log.id)} className="flex items-center justify-between rounded-lg border border-[var(--border)] px-3 py-2 text-sm">
                  <span>{actionLabels[String(log.action)] || String(log.action)}</span>
                  <span className="text-xs text-[var(--muted)]">
                    {new Date(String(log.created_at)).toLocaleDateString("fr-FR", {
                      day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
                    })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
