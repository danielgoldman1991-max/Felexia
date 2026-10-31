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
import { lightSections, sections } from "@/components/layout/sidebar-data";
import type { ActiveWorkspace } from "@/lib/auth";
import { logoutAction } from "@/lib/auth-actions";
import { getRoleLabel } from "@/lib/auth/roles";
import { isOperatorPathAllowed, isOperatorRole } from "@/lib/auth/operator-access";

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
  fullAccess = false,
}: {
  mobileOpen: boolean;
  onCloseMobile: () => void;
  workspace?: ActiveWorkspace | null;
  showWelcomeGuide?: boolean;
  fullAccess?: boolean;
}) {
  const pathname = usePathname();
  const operator = isOperatorRole(workspace?.role);
  const visibleSections = useMemo(
    () =>
      (fullAccess && !operator ? sections : lightSections).map((section) => (
        operator && section.key === "settings"
          ? { ...section, label: "Mon compte", href: "/parametres/profil" }
          : { ...section, items: section.items?.filter((item) => !operator || isOperatorPathAllowed(item.href)) }
      )).filter((section) => {
        if (section.hidden) return false;
        if (operator && !isOperatorPathAllowed(section.href)) return false;
        if (section.key === "welcome") return showWelcomeGuide;
        if (!section.moduleKey) return true;
        return workspace?.enabledModules?.includes(section.moduleKey) ?? false;
      }),
    [fullAccess, operator, showWelcomeGuide, workspace?.enabledModules],
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

  const displayName = workspace?.profile?.full_name ?? workspace?.email ?? "Mon compte";
  const role = workspace?.role ? getRoleLabel(workspace.role) : "Utilisateur";
  const organizationName = workspace?.organization.name || "Organisation";
  const userEmail = workspace?.profile?.email ?? workspace?.email ?? "";

  return (
    <>
      {mobileOpen ? (
        <button
          type="button"
          aria-label="Fermer le menu"
          className="fixed inset-0 z-40 bg-slate-950/40 backdrop-blur-sm lg:hidden"
          onClick={onCloseMobile}
        />
      ) : null}

      <aside
        className={cn(
          "app-sidebar fixed inset-y-0 left-0 z-50 flex w-[272px] flex-col border-r border-[var(--sidebar-border)]",
          "bg-[var(--sidebar)] text-[var(--sidebar-foreground)] shadow-[var(--shadow-lg)] transition-transform duration-300 lg:translate-x-0 lg:shadow-none",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="relative z-10 flex h-full flex-col">
          <div className="flex h-[76px] shrink-0 items-center justify-between px-6">
            <Link href="/dashboard" className="flex min-w-0 items-center rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]" onClick={onCloseMobile}>
              <BrandLogo variant="horizontal" size="sm" priority />
            </Link>
            <button
              type="button"
              className="rounded-lg p-2 text-[var(--sidebar-muted)] hover:bg-[var(--surface-soft)] hover:text-[var(--sidebar-foreground)] focus-visible:outline-2 focus-visible:outline-[var(--ring)] lg:hidden"
              onClick={onCloseMobile}
              aria-label="Fermer le menu"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="px-4 pb-5 pt-2">
            <Link
              href={operator ? "/dashboard" : "/parametres/entreprise"}
              onClick={onCloseMobile}
              title={operator ? organizationName : "Paramètres de l’entreprise"}
              className="group flex items-center gap-2.5 rounded-xl border border-[var(--sidebar-border)] bg-[var(--card)] px-3 py-3 transition-colors hover:border-[var(--border-strong)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--primary-soft)] text-[var(--primary)]">
                <Building2 className="h-4 w-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--sidebar-muted)]">Mon entreprise</span>
                <span className="mt-0.5 block truncate text-sm font-semibold text-[var(--sidebar-foreground)] group-hover:text-[var(--primary)]">{organizationName}</span>
              </span>
              {!operator ? <Settings className="h-4 w-4 shrink-0 text-[var(--sidebar-muted)] transition group-hover:text-[var(--sidebar-foreground)]" /> : null}
            </Link>
            <div className="mt-3 flex items-center gap-2 lg:hidden">
              <NotificationDropdown align="left" />
              <HelpDropdown align="left" fullAccess={fullAccess && !operator} operator={operator} />
              <span className="text-xs text-[var(--sidebar-muted)]">Notifications et aide</span>
            </div>
          </div>

          <nav aria-label="Navigation principale" className="relative z-10 min-h-0 flex-1 space-y-1 overflow-y-auto border-t border-[var(--sidebar-border)] px-3 py-4 scrollbar-thin">
            {visibleSections.map((section) => {
              const Icon = section.icon;
              const active =
                pathMatches(pathname, section.href) ||
                Boolean(section.items?.some((item) => pathMatches(pathname, item.href)));
              const expanded = open.includes(section.key) || active;
              const hasItems = section.items && section.items.length > 0;

              return (
                <div key={section.key}>
                  <div className={cn("flex items-center gap-1 rounded-xl transition-colors", active && "bg-[var(--primary-soft)]")}>
                    <Link
                      href={section.href}
                      onClick={onCloseMobile}
                      className={cn(
                        "group relative flex min-h-11 min-w-0 flex-1 items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]",
                        active
                          ? "font-semibold text-[var(--primary)]"
                          : "text-[var(--sidebar-muted)] hover:bg-[var(--surface-soft)] hover:text-[var(--sidebar-foreground)]",
                      )}
                    >
                      <Icon className={cn("h-[18px] w-[18px] shrink-0", active ? "text-[var(--primary)]" : "")} />
                      <span className="min-w-0 flex-1 truncate">{section.label}</span>
                    </Link>
                    {hasItems ? (
                      <button
                        type="button"
                        onClick={() => toggle(section.key)}
                        className="flex h-9 w-8 shrink-0 items-center justify-center rounded-lg text-[var(--sidebar-muted)] transition-colors hover:bg-[var(--surface-soft)] hover:text-[var(--sidebar-foreground)] focus-visible:outline-2 focus-visible:outline-[var(--ring)]"
                        aria-label={`Ouvrir ${section.label}`}
                        aria-expanded={expanded}
                      >
                        <ChevronDown className={cn("h-4 w-4 transition-transform duration-200", expanded && "rotate-180")} />
                      </button>
                    ) : null}
                  </div>
                  {expanded && section.items ? (
                    <div className="mb-2 ml-5 mt-1 space-y-0.5 border-l border-[var(--sidebar-border)] pl-3">
                      {section.items.filter((item) => !item.hidden).map((item) => {
                        const ItemIcon = item.icon;
                        const itemActive = pathMatches(pathname, item.href);
                        return (
                          <Link
                            key={`${section.key}-${item.label}`}
                            href={item.href}
                            aria-current={pathname === item.href.split("?")[0] ? "page" : undefined}
                            onClick={onCloseMobile}
                            className={cn(
                              "flex min-h-10 items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]",
                              itemActive
                                ? "bg-[var(--primary-soft)] font-semibold text-[var(--primary)]"
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

          <div ref={accountRef} className="relative z-10 border-t border-[var(--sidebar-border)] p-3">
            {accountOpen ? (
              <div
                role="menu"
                className="absolute bottom-[82px] left-3 right-3 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--popover)] p-2 shadow-[var(--shadow-lg)]"
              >
                <div className="border-b border-[var(--border-subtle)] px-3 py-3">
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--primary)] text-sm font-semibold text-[var(--primary-foreground)]">
                      {initials(displayName) || "MO"}
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
                  <KeyRound className="h-4 w-4 text-[var(--muted)]" />
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
                className="flex min-w-0 flex-1 items-center gap-2.5 rounded-xl p-2 text-left transition-colors hover:bg-[var(--card)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--primary)] text-sm font-semibold text-[var(--primary-foreground)]">
                  {initials(displayName) || "MO"}
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
