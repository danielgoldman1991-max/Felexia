"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Ban,
  Clock,
  Copy,
  RotateCw,
  Search,
  Shield,
  Trash2,
  UserCheck,
  UserMinus,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getRoleLabel, ADMIN_ROLES } from "@/lib/auth/roles";
import { getAppUrl } from "@/lib/app-url";

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
  currentUserId,
  limit,
}: {
  members: Member[];
  invitations: Invitation[];
  roles: { id: string; name: string }[];
  isOwner: boolean;
  organizationId: string;
  currentUserId: string;
  limit: { allowed: boolean; current: number; max: number };
}) {
  const router = useRouter();
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState(roles.find((r) => r.name === "viewer")?.id ?? roles[0]?.id ?? "");
  const [inviteFullName, setInviteFullName] = useState("");
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteSuccess, setInviteSuccess] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [changingRole, setChangingRole] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<{ type: string; memberId: string; label: string } | null>(null);

  const activeMembers = members.filter((m) => m.status === "active");
  const disabledMembers = members.filter((m) => m.status === "disabled");
  const pendingInvites = invitations.filter((i) => i.status === "pending");
  const adminCount = activeMembers.filter((m) => m.role && ADMIN_ROLES.includes(m.role as typeof ADMIN_ROLES[number])).length;

  const filtered = activeMembers.filter((m) => {
    const matchesSearch =
      !search ||
      (m.fullName?.toLowerCase().includes(search.toLowerCase()) ?? false) ||
      (m.email?.toLowerCase().includes(search.toLowerCase()) ?? false);
    const matchesRole = roleFilter === "all" || m.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  const inviteLink = (token: string) =>
    `${getAppUrl(window.location.origin)}/invitation?token=${token}`;

  async function handleInvite() {
    if (!inviteEmail.trim()) { setInviteError("Email requis."); return; }
    if (!inviteEmail.includes("@")) { setInviteError("Format d'email invalide."); return; }
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

      if (data.inviteLink) {
        await navigator.clipboard.writeText(data.inviteLink);
        setInviteSuccess(`Invitation créée. Lien copié dans le presse-papier.`);
      } else {
        setInviteSuccess(`Invitation envoyée à ${inviteEmail}`);
      }
      setInviteEmail("");
      setInviteFullName("");
      router.refresh();
    } catch (err) {
      setInviteError((err as Error).message);
    }
  }

  async function handleToggleStatus(memberId: string, currentStatus: string) {
    setConfirmAction(null);
    const newStatus = currentStatus === "active" ? "disabled" : "active";
    try {
      const res = await fetch(`/api/organization-members/${memberId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      const data = await res.json();
      if (!res.ok && data.error) {
        alert(data.error);
      }
      router.refresh();
    } catch { /* ignore */ }
  }

  async function handleRemove(memberId: string) {
    setConfirmAction(null);
    try {
      const res = await fetch(`/api/organization-members/${memberId}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok && data.error) {
        alert(data.error);
      }
      router.refresh();
    } catch { /* ignore */ }
  }

  async function handleRevoke(invId: string) {
    try {
      await fetch(`/api/invitations/${invId}`, { method: "DELETE" });
      router.refresh();
    } catch { /* ignore */ }
  }

  async function handleResend(invId: string) {
    try {
      const res = await fetch(`/api/invitations/${invId}`, { method: "PATCH" });
      const data = await res.json();
      if (!res.ok && data.error) {
        alert(data.error);
        return;
      }
      if (data.token) {
        await navigator.clipboard.writeText(inviteLink(data.token));
        alert("Invitation renvoyée. Nouveau lien copié dans le presse-papier.");
      }
      router.refresh();
    } catch { /* ignore */ }
  }

  async function handleRoleChange(memberId: string, newRoleId: string) {
    setChangingRole(memberId);
    try {
      const res = await fetch(`/api/organization-members/${memberId}/role`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roleId: newRoleId }),
      });
      const data = await res.json();
      if (!res.ok && data.error) {
        alert(data.error);
      }
      router.refresh();
    } catch { /* ignore */ }
    setChangingRole(null);
  }

  function openConfirm(type: string, memberId: string, label: string) {
    setConfirmAction({ type, memberId, label });
  }

  return (
    <div className="space-y-6">
      {/* Stats row */}
      <div className="grid gap-3 sm:grid-cols-4">
        <StatCard icon={<Users className="h-4 w-4" />} label="Membres actifs" value={activeMembers.length} />
        <StatCard icon={<Shield className="h-4 w-4" />} label="Administrateurs" value={adminCount} />
        <StatCard icon={<Clock className="h-4 w-4" />} label="Invitations en attente" value={pendingInvites.length} />
        <StatCard icon={<Ban className="h-4 w-4" />} label="Désactivés" value={disabledMembers.length} />
      </div>

      {/* Actions bar */}
      <div className="flex flex-wrap items-center gap-3">
        {isOwner && (
          <Button onClick={() => setShowInvite(!showInvite)} disabled={!limit.allowed}>
            <UserPlus className="mr-1.5 h-4 w-4" /> Inviter un utilisateur
          </Button>
        )}
        {!limit.allowed && isOwner && (
          <p className="text-xs font-medium text-amber-600">
            Limite atteinte ({limit.current}/{limit.max})
          </p>
        )}
      </div>

      {/* Invite form */}
      {showInvite && (
        <Card className="border-blue-200 bg-blue-50/40">
          <CardContent className="space-y-3 p-4">
            <h3 className="flex items-center gap-2 font-semibold">
              <UserPlus className="h-4 w-4" /> Inviter un utilisateur
            </h3>
            <p className="text-sm text-[var(--muted)]">
              Envoyez une invitation à rejoindre votre organisation Felexia.
            </p>
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
                  <option key={r.id} value={r.id}>{getRoleLabel(r.name)}</option>
                ))}
              </select>
            </div>
            {inviteError && <p className="text-sm text-red-600">{inviteError}</p>}
            {inviteSuccess && <p className="text-sm text-green-600">{inviteSuccess}</p>}
            <div className="flex gap-2">
              <Button onClick={handleInvite}>Envoyer l&apos;invitation</Button>
              <Button variant="secondary" onClick={() => { setShowInvite(false); setInviteError(null); setInviteSuccess(null); }}>Annuler</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Search + filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted)]" />
          <Input
            placeholder="Rechercher un utilisateur..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="h-10 rounded-[var(--radius-md)] border border-[var(--border)] bg-white px-3 text-sm outline-none"
        >
          <option value="all">Tous les rôles</option>
          {roles.map((r) => (
            <option key={r.id} value={r.name}>{getRoleLabel(r.name)}</option>
          ))}
        </select>
      </div>

      {/* Active members */}
      <Card>
        <CardHeader>
          <h2 className="font-semibold">Membres actifs ({filtered.length}{filtered.length !== activeMembers.length ? ` / ${activeMembers.length}` : ""})</h2>
        </CardHeader>
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <div className="p-5 text-sm text-[var(--muted)]">Aucun utilisateur trouvé.</div>
          ) : (
            <div className="divide-y divide-[var(--border)]">
              {filtered.map((member) => {
                const isSelf = member.userId === currentUserId;
                const isAdmin = member.role && ADMIN_ROLES.includes(member.role as typeof ADMIN_ROLES[number]);
                return (
                  <div key={member.id} className="flex items-center justify-between px-5 py-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-sm font-semibold text-slate-700">
                        {(member.fullName || member.email || "?")[0].toUpperCase()}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium">{member.fullName || "Utilisateur"}</p>
                          {isSelf && <Badge tone="info">Vous</Badge>}
                        </div>
                        <p className="text-xs text-[var(--muted)]">{member.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {isOwner && !isSelf ? (
                        <select
                          value={roles.find((r) => r.name === member.role)?.id ?? ""}
                          onChange={(e) => handleRoleChange(member.id, e.target.value)}
                          disabled={changingRole === member.id}
                          className="h-8 rounded-md border border-[var(--border)] bg-white px-2 text-xs outline-none"
                        >
                          {roles.map((r) => (
                            <option key={r.id} value={r.id}>{getRoleLabel(r.name)}</option>
                          ))}
                        </select>
                      ) : (
                        <Badge tone={isAdmin ? "warning" : "neutral"}>
                          {getRoleLabel(member.role)}
                        </Badge>
                      )}
                      <Badge tone="success">Actif</Badge>
                      {isOwner && !isSelf && (
                        <div className="flex gap-1">
                          <button
                            type="button"
                            className="rounded-lg p-1.5 text-amber-500 hover:bg-amber-50"
                            onClick={() => openConfirm("disable", member.id, member.fullName || member.email || "cet utilisateur")}
                            title="Désactiver"
                          >
                            <UserMinus className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            className="rounded-lg p-1.5 text-red-500 hover:bg-red-50"
                            onClick={() => openConfirm("remove", member.id, member.fullName || member.email || "cet utilisateur")}
                            title="Retirer de l'organisation"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      )}
                      {isOwner && isSelf && (
                        <div className="flex items-center gap-1 text-xs text-[var(--muted)]">
                          <Shield className="h-3.5 w-3.5" />
                          <span>Admin</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Disabled members */}
      {disabledMembers.length > 0 && (
        <Card>
          <CardHeader>
            <h2 className="font-semibold">Utilisateurs désactivés ({disabledMembers.length})</h2>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-[var(--border)]">
              {disabledMembers.map((member) => (
                <div key={member.id} className="flex items-center justify-between px-5 py-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-200 text-sm font-semibold text-slate-500">
                      {(member.fullName || member.email || "?")[0].toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-[var(--muted)]">{member.fullName || "Utilisateur"}</p>
                      <p className="text-xs text-[var(--muted)]">{member.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge tone="neutral">Désactivé</Badge>
                    {isOwner && (
                      <Button variant="secondary" onClick={() => handleToggleStatus(member.id, "disabled")}>
                        <UserCheck className="mr-1 h-4 w-4" /> Réactiver
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Pending invitations */}
      {pendingInvites.length > 0 && (
        <Card>
          <CardHeader>
            <h2 className="font-semibold">Invitations en attente ({pendingInvites.length})</h2>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-[var(--border)]">
              {pendingInvites.map((inv) => {
                const isExpired = new Date(inv.expiresAt) < new Date();
                return (
                  <div key={inv.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-100 text-sm font-semibold text-blue-700">
                        {(inv.fullName || inv.email)[0].toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-medium">{inv.fullName || inv.email}</p>
                        <div className="flex items-center gap-2 text-xs text-[var(--muted)]">
                          <span>Rôle: {getRoleLabel(inv.role)}</span>
                          <span>·</span>
                          <span>Expire: {new Date(inv.expiresAt).toLocaleDateString("fr-FR")}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {isExpired && <Badge tone="warning">Expirée</Badge>}
                      {!isExpired && (
                        <>
                          <button
                            type="button"
                            className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-blue-600 hover:bg-blue-50"
                            onClick={() => {
                              navigator.clipboard.writeText(inviteLink(inv.token));
                            }}
                          >
                            <Copy className="h-3.5 w-3.5" /> Copier
                          </button>
                          {isOwner && (
                            <>
                              <button
                                type="button"
                                className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-amber-600 hover:bg-amber-50"
                                onClick={() => handleResend(inv.id)}
                              >
                                <RotateCw className="h-3.5 w-3.5" /> Renvoyer
                              </button>
                              <button
                                type="button"
                                className="rounded-lg p-1.5 text-red-500 hover:bg-red-50"
                                onClick={() => handleRevoke(inv.id)}
                                title="Révoquer"
                              >
                                <X className="h-4 w-4" />
                              </button>
                            </>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Confirmation modal */}
      {confirmAction && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40" onClick={() => setConfirmAction(null)}>
          <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold">
              {confirmAction.type === "remove" ? "Retirer cet utilisateur ?" : "Désactiver cet utilisateur ?"}
            </h3>
            <p className="mt-2 text-sm text-[var(--muted)]">
              {confirmAction.type === "remove"
                ? `${confirmAction.label} perdra l'accès à l'organisation. Ses actions passées resteront dans l'historique.`
                : `${confirmAction.label} ne pourra plus accéder à l'organisation jusqu'à réactivation.`}
            </p>
            <div className="mt-5 flex justify-end gap-3">
              <Button variant="secondary" onClick={() => setConfirmAction(null)}>Annuler</Button>
              <Button
                variant={confirmAction.type === "remove" ? "danger" : "primary"}
                onClick={() => {
                  if (confirmAction.type === "remove") handleRemove(confirmAction.memberId);
                  else handleToggleStatus(confirmAction.memberId, "active");
                }}
              >
                {confirmAction.type === "remove" ? "Retirer l'accès" : "Désactiver"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] p-4">
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-[var(--muted)]">
        {icon}
        {label}
      </div>
      <p className="mt-2 text-2xl font-bold">{value}</p>
    </div>
  );
}
