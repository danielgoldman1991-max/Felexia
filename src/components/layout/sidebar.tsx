"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
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
import { getVisibleNavigationSections, resolveNavigationLocation } from "@/components/layout/navigation-model";
import type { ActiveWorkspace } from "@/lib/auth";
import { getRoleLabel } from "@/lib/auth/roles";
import { isOperatorRole } from "@/lib/auth/operator-access";

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
  desktop = true,
}: {
  mobileOpen: boolean;
  onCloseMobile: () => void;
  workspace?: ActiveWorkspace | null;
  showWelcomeGuide?: boolean;
  fullAccess?: boolean;
  desktop?: boolean;
}) {
  const pathname = usePathname();
  const search = useSearchParams()?.toString() ?? "";
  const operator = isOperatorRole(workspace?.role);
  const visibleSections = useMemo(
    () =>
      getVisibleNavigationSections({ fullAccess, operator, showWelcomeGuide, enabledModules: workspace?.enabledModules }),
    [fullAccess, operator, showWelcomeGuide, workspace?.enabledModules],
  );

  const location = useMemo(() => resolveNavigationLocation(visibleSections, pathname, search), [visibleSections, pathname, search]);
  const [open, setOpen] = useState<Record<string, { pathname: string; expanded: boolean }>>({});
  const [accountOpen, setAccountOpen] = useState(false);
  const accountRef = useRef<HTMLDivElement>(null);
  const accountTriggerRef = useRef<HTMLButtonElement>(null);
  const sidebarRef = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (accountRef.current && !accountRef.current.contains(event.target as Node)) {
        setAccountOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    function handleFocus(event: FocusEvent) {
      if (accountRef.current && !accountRef.current.contains(event.target as Node)) setAccountOpen(false);
    }
    document.addEventListener("focusin", handleFocus);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("focusin", handleFocus);
    };
  }, []);

  useEffect(() => {
    if (!accountOpen) return;
    const frame = requestAnimationFrame(() => accountRef.current?.querySelector<HTMLElement>("#app-account-panel a")?.focus());
    return () => cancelAnimationFrame(frame);
  }, [accountOpen]);

  useEffect(() => {
    if (!mobileOpen || desktop) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const frame = requestAnimationFrame(() => closeRef.current?.focus());
    function handleKey(event: KeyboardEvent) {
      if (event.defaultPrevented) return;
      if (event.key === "Escape") { event.preventDefault(); onCloseMobile(); return; }
      if (event.key !== "Tab") return;
      const nodes = [...(sidebarRef.current?.querySelectorAll<HTMLElement>("a[href],button,input,select,textarea,[tabindex]") ?? [])]
        .filter(node => node.tabIndex >= 0 && !node.matches(":disabled") && !node.closest("[inert],[hidden]") && node.getClientRects().length > 0);
      const first = nodes[0], last = nodes.at(-1);
      if (!first || !last) return;
      if (!nodes.includes(document.activeElement as HTMLElement) || (event.shiftKey ? document.activeElement === first : document.activeElement === last)) {
        event.preventDefault(); (event.shiftKey ? last : first).focus();
      }
    }
    document.addEventListener("keydown", handleKey);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("keydown", handleKey);
      document.body.style.overflow = previousOverflow;
      if (previousFocus?.isConnected && previousFocus.getClientRects().length) previousFocus.focus({ preventScroll: true });
    };
  }, [mobileOpen, desktop, onCloseMobile]);

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
          tabIndex={-1}
          className="app-sidebar-backdrop fixed inset-0 z-40 bg-slate-950/40 backdrop-blur-sm lg:hidden"
          onClick={onCloseMobile}
        />
      ) : null}

      <aside
        id="app-sidebar"
        ref={sidebarRef}
        inert={!desktop && !mobileOpen}
        role={!desktop && mobileOpen ? "dialog" : undefined}
        aria-modal={!desktop && mobileOpen ? true : undefined}
        aria-label={!desktop && mobileOpen ? "Navigation de l’ERP" : undefined}
        className={cn(
          "app-sidebar fixed inset-y-0 left-0 z-50 flex w-[272px] flex-col border-r border-[var(--sidebar-border)]",
          "bg-[var(--sidebar)] text-[var(--sidebar-foreground)] shadow-[var(--shadow-lg)] transition-transform duration-300 lg:translate-x-0 lg:shadow-none",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="relative z-10 flex h-full flex-col">
          <div className="app-sidebar-heading flex h-[76px] shrink-0 items-center justify-between px-6">
            <Link href="/dashboard" className="app-sidebar-brand flex min-w-0 items-center rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]" onClick={onCloseMobile}>
              <BrandLogo variant="horizontal" size="sm" priority />
            </Link>
            <button
              ref={closeRef}
              type="button"
              className="rounded-lg p-2 text-[var(--sidebar-muted)] hover:bg-[var(--surface-soft)] hover:text-[var(--sidebar-foreground)] focus-visible:outline-2 focus-visible:outline-[var(--ring)] lg:hidden"
              onClick={onCloseMobile}
              aria-label="Fermer le menu"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="app-sidebar-workspace-area px-4 pb-5 pt-2">
            <Link
              href={operator ? "/dashboard" : "/parametres/entreprise"}
              onClick={onCloseMobile}
              title={operator ? organizationName : "Paramètres de l’entreprise"}
              className="app-sidebar-workspace group flex items-center gap-2.5 rounded-xl border border-[var(--sidebar-border)] bg-[var(--card)] px-3 py-3 transition-colors hover:border-[var(--border-strong)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]"
            >
              <span className="app-sidebar-workspace-icon flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--primary-soft)] text-[var(--primary)]">
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

          <nav aria-label="Navigation principale" className="app-sidebar-nav relative z-10 min-h-0 flex-1 space-y-1 overflow-y-auto border-t border-[var(--sidebar-border)] px-3 py-4 scrollbar-thin">
            <p className="app-nav-caption">Espace de travail</p>
            {visibleSections.map((section) => {
              const Icon = section.icon;
              const active = location.sectionKey === section.key;
              const manual = open[section.key];
              const expanded = manual?.pathname === pathname ? manual.expanded : active || Boolean(manual?.expanded);
              const hasItems = section.items && section.items.length > 0;

              return (
                <div key={section.key} className="app-nav-section" data-key={section.key}>
                  <div data-active={active} className={cn("app-nav-module flex items-center gap-1 rounded-xl transition-colors", active && "bg-[var(--primary-soft)]")}>
                    <Link
                      href={section.href}
                      aria-current={active && !location.item ? location.isExact ? "page" : "location" : undefined}
                      onClick={onCloseMobile}
                      className={cn(
                        "app-nav-link group relative flex min-h-11 min-w-0 flex-1 items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]",
                        active
                          ? "font-semibold text-[var(--primary)]"
                          : "text-[var(--sidebar-muted)] hover:bg-[var(--surface-soft)] hover:text-[var(--sidebar-foreground)]",
                      )}
                    >
                      <Icon className={cn("h-[18px] w-[18px] shrink-0", active ? "text-[var(--primary)]" : "")} />
                      <span className="app-nav-label min-w-0 flex-1 truncate">{section.label}</span>
                    </Link>
                    {hasItems ? (
                      <button
                        type="button"
                        onClick={() => setOpen(current => ({ ...current, [section.key]: { pathname, expanded: !expanded } }))}
                        className="app-nav-toggle flex h-9 w-8 shrink-0 items-center justify-center rounded-lg text-[var(--sidebar-muted)] transition-colors hover:bg-[var(--surface-soft)] hover:text-[var(--sidebar-foreground)] focus-visible:outline-2 focus-visible:outline-[var(--ring)]"
                        aria-label={`${expanded ? "Replier" : "Déplier"} ${section.label}`}
                        aria-controls={`app-nav-${section.key}`}
                        aria-expanded={expanded}
                      >
                        <ChevronDown className={cn("h-4 w-4 transition-transform duration-200", expanded && "rotate-180")} />
                      </button>
                    ) : null}
                  </div>
                  {section.items ? (
                    <div id={`app-nav-${section.key}`} hidden={!expanded} className="app-nav-children mb-2 ml-5 mt-1 space-y-0.5 border-l border-[var(--sidebar-border)] pl-3">
                      {section.items.filter((item) => !item.hidden).map((item) => {
                        const ItemIcon = item.icon;
                        const itemActive = location.item === item;
                        return (
                          <Link
                            key={`${section.key}-${item.label}`}
                            href={item.href}
                            aria-current={itemActive ? location.isExact ? "page" : "location" : undefined}
                            data-active={itemActive}
                            onClick={onCloseMobile}
                            className={cn(
                              "app-nav-subitem flex min-h-10 items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]",
                              itemActive
                                ? "bg-[var(--primary-soft)] font-semibold text-[var(--primary)]"
                                : "text-[var(--sidebar-muted)] hover:bg-[var(--surface-soft)] hover:text-[var(--sidebar-foreground)]",
                            )}
                          >
                            {ItemIcon ? <ItemIcon className="h-3.5 w-3.5 shrink-0" /> : null}
                            <span className="app-nav-label flex-1 truncate">{item.label}</span>
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

          <div ref={accountRef} className="app-sidebar-account relative z-10 border-t border-[var(--sidebar-border)] p-3" onKeyDown={event => { if (event.key === "Escape" && accountOpen) { event.preventDefault(); event.stopPropagation(); setAccountOpen(false); accountTriggerRef.current?.focus(); } }}>
            {accountOpen ? (
              <div
                id="app-account-panel"
                className="app-account-panel absolute bottom-[82px] left-3 right-3 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--popover)] p-2 shadow-[var(--shadow-lg)]"
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
                  className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-[var(--muted-strong)] transition hover:bg-[var(--surface-soft)] hover:text-[var(--foreground)]"
                >
                  <KeyRound className="h-4 w-4 text-[var(--muted)]" />
                  Modifier mon mot de passe
                </Link>
                <form action="/auth/logout" method="post">
                  <button
                    type="submit"
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
                ref={accountTriggerRef}
                aria-controls="app-account-panel"
                aria-expanded={accountOpen}
                onClick={() => setAccountOpen((value) => !value)}
                className="app-account-trigger flex min-w-0 flex-1 items-center gap-2.5 rounded-xl p-2 text-left transition-colors hover:bg-[var(--card)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]"
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
