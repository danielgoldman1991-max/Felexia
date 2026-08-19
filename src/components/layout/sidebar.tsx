"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Building2,
  ChevronDown,
  KeyRound,
  LogOut,
  Settings,
  User,
  X,
} from "lucide-react";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { HelpDropdown } from "@/components/layout/help-dropdown";
import { NotificationDropdown } from "@/components/notifications/notification-dropdown";
import { cn, initials } from "@/lib/utils";
import { sections } from "@/components/layout/sidebar-data";
import type { ActiveWorkspace } from "@/lib/auth";
import { logoutAction } from "@/lib/auth-actions";

function pathMatches(pathname: string, href: string) {
  const cleanHref = href.split("?")[0];
  return pathname === cleanHref || pathname.startsWith(`${cleanHref}/`);
}

function Badge({ value, tone = "info" }: { value: string; tone?: "danger" | "warning" | "info" }) {
  const styles = {
    danger: "bg-[var(--danger-soft)] text-[var(--danger)]",
    warning: "bg-[var(--warning-soft)] text-[var(--warning)]",
    info: "bg-[var(--info-soft)] text-[var(--info)]",
  };
  return <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", styles[tone])}>{value}</span>;
}

export function Sidebar({
  mobileOpen,
  onCloseMobile,
  workspace,
  showWelcomeGuide = true,
}: {
  mobileOpen: boolean;
  onCloseMobile: () => void;
  workspace?: ActiveWorkspace | null;
  showWelcomeGuide?: boolean;
}) {
  const pathname = usePathname();
  const visibleSections = useMemo(
    () =>
      sections.filter((section) => {
        if (section.hidden) return false;
        if (section.key === "welcome") return showWelcomeGuide;
        if (!section.moduleKey) return true;
        return workspace?.enabledModules?.includes(section.moduleKey) ?? false;
      }),
    [showWelcomeGuide, workspace?.enabledModules],
  );

  const initiallyOpen = useMemo(
    () =>
      visibleSections
        .filter(
          (section) =>
            section.items?.some((item) => pathMatches(pathname, item.href)) ||
            pathMatches(pathname, section.href),
        )
        .map((section) => section.key),
    [pathname, visibleSections],
  );
  const [open, setOpen] = useState<string[]>(initiallyOpen);
  const [accountOpen, setAccountOpen] = useState(false);
  const accountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (accountRef.current && !accountRef.current.contains(event.target as Node)) {
        setAccountOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, []);

  function toggle(key: string) {
    setOpen((current) =>
      current.includes(key)
        ? current.filter((item) => item !== key)
        : [...current, key],
    );
  }

  const displayName = workspace?.profile?.full_name ?? workspace?.email ?? "Sophie Laurent";
  const role = workspace?.role ?? "Administratrice";
  const organizationName = workspace?.organization.name || "Organisation";
  const userEmail = workspace?.profile?.email ?? workspace?.email ?? "";

  return (
    <>
      {mobileOpen ? (
        <button
          type="button"
          aria-label="Fermer le menu"
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={onCloseMobile}
        />
      ) : null}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-[288px] flex-col border-r border-[var(--sidebar-border)]",
          "bg-[var(--sidebar)] text-[var(--sidebar-foreground)] shadow-[var(--shadow-lg)] transition-transform duration-300 lg:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="relative z-10 flex flex-col h-full">
          <div className="flex items-center justify-between px-5 pt-6 pb-5">
            <Link href="/dashboard" className="flex min-w-0 items-center gap-3" onClick={onCloseMobile}>
              <div className="rounded-xl bg-white/95 px-3 py-2 shadow-sm ring-1 ring-black/5">
                <BrandLogo variant="horizontal" size="sm" priority />
              </div>
            </Link>
            <button
              type="button"
              className="rounded-xl p-2 text-[var(--sidebar-muted)] hover:bg-[var(--surface-soft)] hover:text-[var(--sidebar-foreground)] lg:hidden"
              onClick={onCloseMobile}
              aria-label="Fermer le menu"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="px-4 pb-4">
            <Link
              href="/parametres/entreprise"
              onClick={onCloseMobile}
              title="Paramètres de l’entreprise"
              className="group flex items-center gap-3 rounded-2xl border border-[var(--sidebar-border)] bg-[var(--card)] px-3 py-3 transition hover:border-[var(--border-strong)]"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--primary-soft)] text-[var(--primary)] ring-1 ring-[var(--border)]">
                <Building2 className="h-4 w-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--sidebar-muted)]">Organisation</span>
                <span className="block truncate text-sm font-semibold text-[var(--sidebar-foreground)] group-hover:text-[var(--primary)]">{organizationName}</span>
              </span>
              <Settings className="h-4 w-4 shrink-0 text-[var(--sidebar-muted)] transition group-hover:text-[var(--sidebar-foreground)]" />
            </Link>
            <div className="mt-3 flex items-center gap-2 lg:hidden">
              <NotificationDropdown align="left" />
              <HelpDropdown align="left" />
              <span className="text-xs text-[var(--sidebar-muted)]">Notifications et aide</span>
            </div>
          </div>

          <nav className="relative z-10 flex-1 space-y-0.5 overflow-y-auto border-t border-[var(--sidebar-border)] px-3 py-4 scrollbar-thin">
            {visibleSections.map((section) => {
              const Icon = section.icon;
              const active =
                pathMatches(pathname, section.href) ||
                Boolean(section.items?.some((item) => pathMatches(pathname, item.href)));
              const expanded = open.includes(section.key) || active;
              const hasItems = section.items && section.items.length > 0;

              return (
                <div key={section.key}>
                  <div className="flex items-center gap-1">
                    <Link
                      href={section.href}
                      onClick={onCloseMobile}
                      className={cn(
                        "group relative flex min-h-11 flex-1 items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-medium transition-all",
                        active
                          ? "bg-[var(--sidebar-accent)] text-[var(--sidebar-accent-foreground)] shadow-[var(--shadow-sm)] ring-1 ring-[var(--border)]"
                          : "text-[var(--sidebar-muted)] hover:bg-[var(--surface-soft)] hover:text-[var(--sidebar-foreground)]",
                      )}
                    >
                      {active ? (
                        <span className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-[var(--primary)]" />
                      ) : null}
                      <Icon className={cn("h-4 w-4 shrink-0", active ? "text-[var(--primary)]" : "")} />
                      <span className="min-w-0 flex-1 truncate">{section.label}</span>
                      {section.key === "facturation" ? (
                        <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--danger-soft)] px-1.5 text-[10px] font-bold text-[var(--danger)]">12</span>
                      ) : null}
                    </Link>
                    {hasItems ? (
                      <button
                        type="button"
                        onClick={() => toggle(section.key)}
                        className="flex h-10 w-9 items-center justify-center rounded-xl text-[var(--sidebar-muted)] hover:bg-[var(--surface-soft)] hover:text-[var(--sidebar-foreground)]"
                        aria-label={`Ouvrir ${section.label}`}
                      >
                        <ChevronDown className={cn("h-4 w-4 transition-transform duration-200", expanded && "rotate-180")} />
                      </button>
                    ) : null}
                  </div>
                  {expanded && section.items ? (
                    <div className="ml-2 mt-0.5 space-y-0.5 border-l border-[var(--sidebar-border)] pl-3">
                      {section.items.filter((item) => !item.hidden).map((item) => {
                        const ItemIcon = item.icon;
                        const itemActive = pathMatches(pathname, item.href);
                        return (
                          <Link
                            key={`${section.key}-${item.label}`}
                            href={item.href}
                            onClick={onCloseMobile}
                            className={cn(
                              "flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-medium transition-all",
                              itemActive
                                ? "bg-[var(--surface-soft)] text-[var(--primary)]"
                                : "text-[var(--sidebar-muted)] hover:bg-[var(--surface-soft)] hover:text-[var(--sidebar-foreground)]",
                            )}
                          >
                            {ItemIcon ? <ItemIcon className="h-3.5 w-3.5 shrink-0" /> : null}
                            <span className="flex-1 truncate">{item.label}</span>
                            {item.badge ? <Badge value={item.badge} tone={item.badgeTone} /> : null}
                          </Link>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </nav>

          <div ref={accountRef} className="relative z-10 border-t border-[var(--sidebar-border)] px-4 py-4">
            {accountOpen ? (
              <div
                role="menu"
                className="absolute bottom-[84px] left-4 right-4 overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--popover)] p-2 shadow-[var(--shadow-lg)]"
              >
                <div className="border-b border-[var(--border-subtle)] px-3 py-3">
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--primary)] text-sm font-semibold text-[var(--primary-foreground)]">
                      {initials(displayName) || "SL"}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-[var(--popover-foreground)]">{displayName}</span>
                      <span className="block truncate text-xs text-[var(--muted)]">{userEmail}</span>
                    </span>
                  </div>
                </div>
                <Link
                  href="/parametres/profil"
                  onClick={() => {
                    setAccountOpen(false);
                    onCloseMobile();
                  }}
                  role="menuitem"
                  className="mt-2 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-[var(--muted-strong)] transition hover:bg-[var(--surface-soft)] hover:text-[var(--foreground)]"
                >
                  <User className="h-4 w-4 text-[var(--primary)]" />
                  Mon profil
                </Link>
                <Link
                  href="/parametres/securite"
                  onClick={() => {
                    setAccountOpen(false);
                    onCloseMobile();
                  }}
                  role="menuitem"
                  className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-[var(--muted-strong)] transition hover:bg-[var(--surface-soft)] hover:text-[var(--foreground)]"
                >
                  <KeyRound className="h-4 w-4 text-[var(--accent)]" />
                  Modifier mon mot de passe
                </Link>
                <form action={logoutAction}>
                  <button
                    type="submit"
                    role="menuitem"
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-[var(--danger)] transition hover:bg-[var(--danger-soft)]"
                  >
                    <LogOut className="h-4 w-4" />
                    Se déconnecter
                  </button>
                </form>
              </div>
            ) : null}

            <div className="flex items-center gap-3">
              <button
                type="button"
                aria-haspopup="menu"
                aria-expanded={accountOpen}
                onClick={() => setAccountOpen((value) => !value)}
                className="flex min-w-0 flex-1 items-center gap-3 rounded-2xl border border-[var(--sidebar-border)] bg-[var(--card)] p-2 text-left transition hover:border-[var(--border-strong)]"
              >
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--primary)] text-sm font-semibold text-[var(--primary-foreground)] shadow-[var(--shadow-sm)]">
                  {initials(displayName) || "SL"}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-[var(--sidebar-foreground)]">{displayName}</span>
                  <span className="block truncate text-xs text-[var(--sidebar-muted)]">{role}</span>
                </span>
                <ChevronDown className={cn("h-4 w-4 shrink-0 text-[var(--sidebar-muted)] transition-transform", accountOpen && "rotate-180")} />
              </button>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
