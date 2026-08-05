"use client";

import { CalendarDays, CircleHelp, Menu } from "lucide-react";
import { GlobalSearch } from "@/components/layout/global-search";
import { QuickCreateMenu } from "@/components/layout/quick-create-menu";
import { NotificationDropdown } from "@/components/notifications/notification-dropdown";
import { ThemeToggle } from "@/components/theme/theme-toggle";

export function Topbar({ onOpenMenu }: { onOpenMenu: () => void }) {
  return (
    <header className="sticky top-0 z-30 border-b border-[var(--border-subtle)] bg-[color-mix(in_srgb,var(--background)_85%,transparent)] backdrop-blur-xl">
      <div className="flex h-18 items-center gap-3 px-4 sm:px-6 lg:px-8">
        <button type="button" onClick={onOpenMenu} className="flex h-10 w-10 items-center justify-center rounded-2xl border border-[var(--border)] bg-[var(--card)] text-[var(--muted)] shadow-[var(--shadow-sm)] lg:hidden" aria-label="Ouvrir le menu">
          <Menu className="h-5 w-5" />
        </button>

        <GlobalSearch />
        <QuickCreateMenu />
        <button type="button" className="hidden h-11 items-center gap-2 rounded-2xl border border-[var(--border)] bg-[var(--card)] px-3 text-sm font-medium text-[var(--muted)] shadow-[var(--shadow-sm)] transition hover:bg-[var(--surface-soft)] hover:text-[var(--foreground)] xl:flex" aria-label="Période active">
          <CalendarDays className="h-4 w-4 text-[var(--primary)]" />
          Ce mois
        </button>
        <div className="hidden sm:flex">
          <NotificationDropdown />
        </div>
        <ThemeToggle />
        <button type="button" className="hidden h-11 w-11 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--card)] text-[var(--muted)] shadow-[var(--shadow-sm)] transition hover:bg-[var(--surface-soft)] hover:text-[var(--foreground)] sm:flex" aria-label="Aide">
          <CircleHelp className="h-5 w-5" />
        </button>
      </div>
    </header>
  );
}