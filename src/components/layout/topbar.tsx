"use client";

import { CalendarDays, CircleHelp, Menu } from "lucide-react";
import { GlobalSearch } from "@/components/layout/global-search";
import { QuickCreateMenu } from "@/components/layout/quick-create-menu";
import { NotificationDropdown } from "@/components/notifications/notification-dropdown";

export function Topbar({ onOpenMenu }: { onOpenMenu: () => void }) {
  return (
    <header className="sticky top-0 z-30 border-b border-white/10 bg-[#06070A]/72 backdrop-blur-2xl">
      <div className="flex h-18 items-center gap-3 px-4 sm:px-6 lg:px-8">
        <button type="button" onClick={onOpenMenu} className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.055] text-[var(--muted)] shadow-sm lg:hidden" aria-label="Ouvrir le menu">
          <Menu className="h-5 w-5" />
        </button>

        <GlobalSearch />
        <QuickCreateMenu />
        <button type="button" className="hidden h-11 items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.045] px-3 text-sm font-medium text-[var(--muted)] shadow-sm transition hover:bg-white/[0.08] hover:text-white xl:flex" aria-label="Période active">
          <CalendarDays className="h-4 w-4 text-[var(--primary)]" />
          Ce mois
        </button>
        <div className="hidden sm:flex">
          <NotificationDropdown />
        </div>
        <button type="button" className="hidden h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/[0.045] text-[var(--muted)] shadow-sm transition hover:bg-white/[0.08] hover:text-white sm:flex" aria-label="Aide">
          <CircleHelp className="h-5 w-5" />
        </button>
      </div>
    </header>
  );
}
