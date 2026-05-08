import { Bell, LogOut, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { logoutAction } from "@/lib/auth-actions";
import { initials } from "@/lib/utils";
import type { ActiveWorkspace } from "@/lib/auth";

export function Topbar({ workspace }: { workspace: ActiveWorkspace }) {
  const displayName =
    workspace.profile?.full_name ?? workspace.email ?? workspace.organization.name;

  return (
    <header className="sticky top-0 z-10 border-b border-[var(--border)] bg-[rgb(255_255_255_/_86%)] backdrop-blur-xl">
      <div className="flex h-16 items-center justify-between gap-4 px-6">
        <div className="relative w-full max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--primary)]" />
          <Input className="border-[#d8deeb] bg-[#f9fbff] pl-9" placeholder="Rechercher un client, article, facture..." />
        </div>
        <div className="flex items-center gap-3">
          <button className="flex h-10 w-10 items-center justify-center rounded-[var(--radius-md)] border border-[var(--border)] bg-white text-[var(--muted)] shadow-[var(--shadow-sm)] transition hover:border-[#c9d1e4] hover:bg-[var(--surface-soft)] hover:text-[var(--secondary)]" aria-label="Notifications">
            <Bell className="h-4 w-4" />
          </button>
          <div className="hidden text-right sm:block">
            <p className="text-sm font-semibold text-[var(--foreground)]">{workspace.organization.name}</p>
            <p className="text-xs text-[var(--muted)]">{displayName}</p>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-[var(--radius-md)] bg-[linear-gradient(135deg,var(--primary),var(--accent))] text-sm font-semibold text-white shadow-[0_10px_24px_rgb(124_79_242_/_22%)]">
            {initials(displayName)}
          </div>
          <form action={logoutAction}>
            <button
              className="flex h-10 w-10 items-center justify-center rounded-[var(--radius-md)] border border-[var(--border)] bg-white text-[var(--muted)] shadow-[var(--shadow-sm)] transition hover:border-[#c9d1e4] hover:bg-[var(--surface-soft)] hover:text-[var(--danger)]"
              aria-label="Deconnexion"
              title="Deconnexion"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
