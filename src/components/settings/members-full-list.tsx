"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { UserX, UserCheck, Plus, Link as LinkIcon, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type Member = {
  id: string;
  userId: string;
  status: string;
  fullName: string | null;
  email: string | null;
  role: string | null;
};

type Invitation = {
  id: string;
  email: string;
  fullName: string | null;
  status: string;
  token: string;
  role: string | null;
  createdAt: string;
  expiresAt: string;
};

export function MembersFullList({
  members,
  invitations,
  roles,
  isOwner,
  organizationId,
  limit,
}: {
  members: Member[];
  invitations: Invitation[];
  roles: { id: string; name: string }[];
  isOwner: boolean;
  organizationId: string;
  limit: { allowed: boolean; current: number; max: number };
}) {
  const router = useRouter();
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState(roles[0]?.id ?? "");
  const [inviteFullName, setInviteFullName] = useState("");
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteSuccess, setInviteSuccess] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [changingRole, setChangingRole] = useState<string | null>(null);

  const activeMembers = members.filter((m) => m.status === "active");
  const disabledMembers = members.filter((m) => m.status === "disabled");
  const pendingInvites = invitations.filter((i) => i.status === "pending");

  const filtered = activeMembers.filter(
    (m) =>
      (m.fullName?.toLowerCase().includes(search.toLowerCase()) ?? false) ||
      (m.email?.toLowerCase().includes(search.toLowerCase()) ?? false),
  );

  async function handleInvite() {
    if (!inviteEmail.trim()) { setInviteError("Email requis."); return; }
    if (!limit.allowed) { setInviteError(`Limite atteinte (${limit.current}/${limit.max}). Passez à une formule supérieure.`); return; }

    setInviteError(null);
    setInviteSuccess(null);

    try {
      const res = await fetch("/api/invitations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: inviteEmail.trim(),
          roleId: inviteRole || null,
          organizationId,
          fullName: inviteFullName.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setInviteSuccess(`Invitation envoyée à ${inviteEmail}`);
      setInviteEmail("");
      setInviteFullName("");
      if (data.inviteLink) {
        setInviteSuccess(`Lien d'invitation: ${data.inviteLink}`);
      }
      router.refresh();
    } catch (err) {
      setInviteError((err as Error).message);
    }
  }

  async function handleToggleStatus(memberId: string, currentStatus: string) {
    try {
      await fetch(`/api/organization-members/${memberId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: currentStatus === "active" ? "disabled" : "active" }),
      });
      router.refresh();
    } catch { /* ignore */ }
  }

  async function handleRemove(memberId: string) {
    if (!confirm("Supprimer définitivement cet utilisateur de l'organisation ?")) return;
    try {
      await fetch(`/api/organization-members/${memberId}`, { method: "DELETE" });
      router.refresh();
    } catch { /* ignore */ }
  }

  async function handleRevoke(invId: string) {
    try {
      await fetch(`/api/invitations/${invId}`, { method: "DELETE" });
      router.refresh();
    } catch { /* ignore */ }
  }

  async function handleRoleChange(memberId: string, newRoleId: string) {
    setChangingRole(memberId);
    try {
      await fetch(`/api/organization-members/${memberId}/role`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roleId: newRoleId }),
      });
      router.refresh();
    } catch { /* ignore */ }
    setChangingRole(null);
  }

  const inviteLink = (token: string) =>
    `${window.location.origin}/invitation?token=${token}`;

  return (
    <div className="space-y-6">
      {isOwner && (
        <div className="flex items-center gap-2">
          <Button onClick={() => setShowInvite(!showInvite)} disabled={!limit.allowed}>
            <Plus className="mr-1 h-4 w-4" /> Inviter un utilisateur
          </Button>
          {!limit.allowed && (
            <p className="text-xs text-amber-600">
              Limite atteinte ({limit.current}/{limit.max})
            </p>
          )}
        </div>
      )}

      {showInvite && (
        <Card>
          <CardContent className="space-y-3 p-4">
            <h3 className="font-semibold">Nouvelle invitation</h3>
            <div className="grid gap-3 sm:grid-cols-3">
              <Input
                placeholder="Email du collaborateur"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                type="email"
              />
              <Input
                placeholder="Nom complet (optionnel)"
                value={inviteFullName}
                onChange={(e) => setInviteFullName(e.target.value)}
              />
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value)}
                className="h-10 rounded-[var(--radius-md)] border border-[var(--border)] bg-white px-3 text-sm outline-none focus:border-[var(--primary)]"
              >
                {roles.map((r) => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
            </div>
            {inviteError && <p className="text-sm text-red-600">{inviteError}</p>}
            {inviteSuccess && <p className="text-sm text-green-600">{inviteSuccess}</p>}
            <div className="flex gap-2">
              <Button onClick={handleInvite}>Envoyer l&apos;invitation</Button>
              <Button variant="secondary" onClick={() => setShowInvite(false)}>Annuler</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted)]" />
        <Input
          placeholder="Rechercher un utilisateur..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <Card>
        <CardHeader>
          <h2 className="font-semibold">Membres actifs ({activeMembers.length})</h2>
        </CardHeader>
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <div className="p-5 text-sm text-[var(--muted)]">Aucun utilisateur trouvé.</div>
          ) : (
            <div className="divide-y divide-[var(--border)]">
              {filtered.map((member) => (
                <div key={member.id} className="flex items-center justify-between px-5 py-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-sm font-semibold text-slate-700">
                      {member.fullName?.charAt(0)?.toUpperCase() || "?"}
                    </div>
                    <div>
                      <p className="text-sm font-medium">{member.fullName || "Utilisateur"}</p>
                      <p className="text-xs text-[var(--muted)]">{member.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {isOwner && (
                      <select
                        value={roles.find((r) => r.name === member.role)?.id ?? ""}
                        onChange={(e) => handleRoleChange(member.id, e.target.value)}
                        disabled={changingRole === member.id}
                        className="h-8 rounded-md border border-[var(--border)] bg-white px-2 text-xs outline-none"
                      >
                        {roles.map((r) => (
                          <option key={r.id} value={r.id}>{r.name}</option>
                        ))}
                      </select>
                    )}
                    <Badge tone="success">Actif</Badge>
                    {isOwner && member.role !== "owner" && (
                      <div className="flex gap-1">
                        <button
                          type="button"
                          className="rounded-lg p-1.5 text-amber-500 hover:bg-amber-50"
                          onClick={() => handleToggleStatus(member.id, "active")}
                          title="Désactiver"
                        >
                          <UserX className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          className="rounded-lg p-1.5 text-red-500 hover:bg-red-50"
                          onClick={() => handleRemove(member.id)}
                          title="Supprimer"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {disabledMembers.length > 0 && (
        <Card>
          <CardHeader>
            <h2 className="font-semibold">Utilisateurs désactivés ({disabledMembers.length})</h2>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-[var(--border)]">
              {disabledMembers.map((member) => (
                <div key={member.id} className="flex items-center justify-between px-5 py-3">
                  <div>
                    <p className="text-sm font-medium">{member.fullName || "Utilisateur"}</p>
                    <p className="text-xs text-[var(--muted)]">{member.email}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge tone="neutral">Désactivé</Badge>
                    {isOwner && (
                      <button
                        type="button"
                        className="rounded-lg p-1.5 text-green-500 hover:bg-green-50"
                        onClick={() => handleToggleStatus(member.id, "disabled")}
                        title="Réactiver"
                      >
                        <UserCheck className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {pendingInvites.length > 0 && (
        <Card>
          <CardHeader>
            <h2 className="font-semibold">Invitations en attente ({pendingInvites.length})</h2>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-[var(--border)]">
              {pendingInvites.map((inv) => (
                <div key={inv.id} className="flex items-center justify-between px-5 py-3">
                  <div>
                    <p className="text-sm font-medium">{inv.fullName || inv.email}</p>
                    <p className="text-xs text-[var(--muted)]">Rôle: {inv.role || "—"}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800"
                      onClick={() => {
                        navigator.clipboard.writeText(inviteLink(inv.token));
                      }}
                    >
                      <LinkIcon className="h-3 w-3" /> Copier le lien
                    </button>
                    {isOwner && (
                      <button
                        type="button"
                        className="rounded-lg p-1.5 text-red-500 hover:bg-red-50"
                        onClick={() => handleRevoke(inv.id)}
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
