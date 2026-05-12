"use client";

import { useRouter } from "next/navigation";
import { Mail, Shield, UserX } from "lucide-react";

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
  status: string;
  role: string | null;
  createdAt: string;
  expiresAt: string;
};

export function MembersList({
  members,
  invitations,
  isAdmin,
}: {
  members: Member[];
  invitations: Invitation[];
  isAdmin: boolean;
}) {
  const router = useRouter();

  async function handleRemove(memberId: string) {
    try {
      await fetch(`/api/organization-members/${memberId}`, { method: "DELETE" });
      router.refresh();
    } catch {
      // ignore
    }
  }

  async function handleRevoke(invitationId: string) {
    try {
      await fetch(`/api/invitations/${invitationId}`, { method: "DELETE" });
      router.refresh();
    } catch {
      // ignore
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="mb-3 font-semibold">Membres actifs ({members.filter((m) => m.status === "active").length})</h3>
        <div className="space-y-2">
          {members
            .filter((m) => m.status === "active")
            .map((member) => (
              <div
                key={member.id}
                className="flex items-center justify-between rounded-xl border border-[var(--border)] bg-[var(--card)] px-4 py-3"
              >
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
                  <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                    <Shield className="h-3 w-3" />
                    {member.role || "—"}
                  </span>
                  {isAdmin && member.role !== "admin" && (
                    <button type="button" className="rounded-lg p-1.5 text-red-500 hover:bg-red-50" onClick={() => handleRemove(member.id)}>
                      <UserX className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
        </div>
      </div>

      {invitations.length > 0 && (
        <div>
          <h3 className="mb-3 font-semibold">
            Invitations en attente ({invitations.filter((i) => i.status === "pending").length})
          </h3>
          <div className="space-y-2">
            {invitations
              .filter((i) => i.status === "pending")
              .map((inv) => (
                <div
                  key={inv.id}
                  className="flex items-center justify-between rounded-xl border border-[var(--border)] bg-[var(--card)] px-4 py-3"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-50 text-blue-600">
                      <Mail className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">{inv.email}</p>
                      <p className="text-xs text-[var(--muted)]">
                        Role: {inv.role || "—"} · Expire le{" "}
                        {new Date(inv.expiresAt).toLocaleDateString("fr-FR")}
                      </p>
                    </div>
                  </div>
                  {isAdmin && (
                    <button type="button" className="rounded-lg p-1.5 text-red-500 hover:bg-red-50" onClick={() => handleRevoke(inv.id)}>
                      <UserX className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
