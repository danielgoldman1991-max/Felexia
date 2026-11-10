"use client";

import { ChevronRight, Menu } from "lucide-react";
import { usePathname, useSearchParams } from "next/navigation";
import { GlobalSearch } from "@/components/layout/global-search";
import { HelpDropdown } from "@/components/layout/help-dropdown";
import { QuickCreateMenu } from "@/components/layout/quick-create-menu";
import { NotificationDropdown } from "@/components/notifications/notification-dropdown";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { getVisibleNavigationSections, resolveNavigationLocation } from "./navigation-model";

export function Topbar({ onOpenMenu, fullAccess = false, navigationFullAccess = fullAccess, readOnly = false, operator = false, enabledModules, showWelcomeGuide = false, mobileOpen = false }: {
  onOpenMenu: () => void;
  fullAccess?: boolean;
  navigationFullAccess?: boolean;
  readOnly?: boolean;
  operator?: boolean;
  enabledModules?: readonly string[];
  showWelcomeGuide?: boolean;
  mobileOpen?: boolean;
}) {
  const pathname = usePathname();
  const search = useSearchParams()?.toString() ?? "";
  const visibleSections = getVisibleNavigationSections({ fullAccess: navigationFullAccess, operator, showWelcomeGuide, enabledModules });
  const location = resolveNavigationLocation(visibleSections, pathname, search);
  const sectionLabel = location.section?.label ?? "Espace de travail";
  const itemLabel = location.item?.label;

  return (
    <header className="app-topbar sticky top-0 z-30 border-b border-[var(--border)] bg-[var(--card)]">
      <div className="app-topbar-inner mx-auto flex h-[72px] max-w-[1600px] items-center gap-3 px-4 sm:gap-4 sm:px-6 lg:px-8">
        <button type="button" onClick={onOpenMenu} className="app-mobile-menu-trigger flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--card)] text-[var(--muted)] transition hover:bg-[var(--surface-soft)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)] lg:hidden" aria-label="Ouvrir le menu" aria-expanded={mobileOpen} aria-controls="app-sidebar">
          <Menu aria-hidden="true" className="h-[18px] w-[18px]" />
        </button>

        <div className="app-navigation-context">
          <span className="sr-only">Emplacement actuel : </span>
          <span className="app-navigation-section">{sectionLabel}</span>
          {itemLabel && itemLabel !== sectionLabel ? <><ChevronRight aria-hidden="true" className="app-navigation-separator h-3.5 w-3.5" /><span className="app-navigation-label">{itemLabel}</span></> : null}
        </div>
        <GlobalSearch fullAccess={fullAccess} readOnly={readOnly} operator={operator} />
        <div className="app-toolbar-actions ml-auto flex shrink-0 items-center gap-2">
          {!readOnly ? <QuickCreateMenu fullAccess={fullAccess} operator={operator} /> : null}
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
