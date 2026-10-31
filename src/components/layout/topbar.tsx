"use client";

import { CalendarDays, Menu } from "lucide-react";
import { GlobalSearch } from "@/components/layout/global-search";
import { HelpDropdown } from "@/components/layout/help-dropdown";
import { QuickCreateMenu } from "@/components/layout/quick-create-menu";
import { NotificationDropdown } from "@/components/notifications/notification-dropdown";
import { ThemeToggle } from "@/components/theme/theme-toggle";

export function Topbar({ onOpenMenu, fullAccess = false, readOnly = false, operator = false }: { onOpenMenu: () => void; fullAccess?: boolean; readOnly?: boolean; operator?: boolean }) {
  return (
    <header className="app-topbar sticky top-0 z-30 border-b border-[var(--border)] bg-[var(--card)]">
      <div className="mx-auto flex h-[72px] max-w-[1600px] items-center gap-3 px-4 sm:gap-4 sm:px-6 lg:px-8">
        <button type="button" onClick={onOpenMenu} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--card)] text-[var(--muted)] transition hover:bg-[var(--surface-soft)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)] lg:hidden" aria-label="Ouvrir le menu">
          <Menu className="h-[18px] w-[18px]" />
        </button>

        <GlobalSearch fullAccess={fullAccess} readOnly={readOnly} operator={operator} />
        <div className="app-toolbar-actions ml-auto flex shrink-0 items-center gap-2">
          {!readOnly ? <QuickCreateMenu fullAccess={fullAccess} operator={operator} /> : null}
          {fullAccess ? <button type="button" className="hidden h-10 items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 text-sm font-medium text-[var(--muted-strong)] transition hover:bg-[var(--surface-soft)] hover:text-[var(--foreground)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)] xl:flex" aria-label="Période active">
            <CalendarDays className="h-4 w-4 text-[var(--muted)]" />
            Ce mois
          </button> : null}
          <div className="hidden sm:flex">
            <NotificationDropdown />
          </div>
          <ThemeToggle />
          <div className="hidden sm:flex"><HelpDropdown fullAccess={fullAccess} operator={operator} /></div>
        </div>
      </div>
    </header>
  );
}
