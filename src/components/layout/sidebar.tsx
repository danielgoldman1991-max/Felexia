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
import { Logo } from "@/components/brand/Logo";
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
    danger: "bg-red-400/15 text-red-200 ring-1 ring-red-300/20",
    warning: "bg-amber-300/15 text-amber-200 ring-1 ring-amber-300/20",
    info: "bg-cyan-300/15 text-cyan-200 ring-1 ring-cyan-300/20",
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
          "fixed inset-y-0 left-0 z-50 flex w-[288px] flex-col border-r border-white/10",
          "bg-[#080A0F]/92 text-white shadow-2xl backdrop-blur-2xl transition-transform duration-300 lg:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
          <svg className="h-full w-full opacity-[0.04]">
            <defs>
              <pattern id="sidebar-grid" width="32" height="32" patternUnits="userSpaceOnUse">
                <path d="M 32 0 L 0 0 0 32" fill="none" stroke="white" strokeWidth="0.5" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#sidebar-grid)" />
          </svg>
          <div className="absolute -left-24 -top-44 h-[420px] w-[420px] rounded-full bg-cyan-400/10 blur-3xl" />
          <div className="absolute -bottom-20 -right-24 h-[320px] w-[320px] rounded-full bg-[#D6B56D]/10 blur-3xl" />
        </div>

        <div className="relative z-10 flex flex-col h-full">
          <div className="flex items-center justify-between px-5 pt-6 pb-5">
            <Link href="/dashboard" className="flex items-center gap-3 min-w-0" onClick={onCloseMobile}>
              <div className="luxury-border flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/[0.06] shadow-[0_18px_50px_rgba(214,181,109,0.16)] ring-1 ring-white/10">
                <Logo size={36} />
              </div>
              <div className="min-w-0">
                <h1 className="text-xl font-semibold tracking-tight text-white">Felexia</h1>
                <p className="text-[10px] font-semibold uppercase tracking-[0.32em] text-[#D6B56D]/70">Obsidian ERP</p>
              </div>
            </Link>
            <button
              type="button"
              className="rounded-xl p-2 text-white/50 hover:bg-white/10 hover:text-white lg:hidden"
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
              className="group flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.035] px-3 py-3 transition hover:bg-white/[0.07]"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/[0.055] text-[#D6B56D] ring-1 ring-white/10">
                <Building2 className="h-4 w-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[10px] font-semibold uppercase tracking-[0.18em] text-white/35">Organisation</span>
                <span className="block truncate text-sm font-semibold text-white group-hover:text-[#D6B56D]">{organizationName}</span>
              </span>
              <Settings className="h-4 w-4 shrink-0 text-white/28 transition group-hover:text-white/70" />
            </Link>
          </div>

          <nav className="relative z-10 flex-1 space-y-0.5 overflow-y-auto border-t border-white/10 px-3 py-4 scrollbar-thin scrollbar-thumb-white/10">
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
                          ? "bg-white/[0.09] text-white shadow-lg ring-1 ring-white/10 backdrop-blur-xl"
                          : "text-white/58 hover:bg-white/[0.055] hover:text-white/90",
                      )}
                    >
                      {active ? (
                        <span className="absolute left-0 top-2.5 h-6 w-1 rounded-r-full bg-gradient-to-b from-[#D6B56D] to-cyan-300 shadow-[0_0_12px_rgba(214,181,109,0.42)]" />
                      ) : null}
                      <Icon className="h-4 w-4 shrink-0" />
                      <span className="min-w-0 flex-1 truncate">{section.label}</span>
                      {section.key === "facturation" ? (
                        <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500/20 px-1.5 text-[10px] font-bold text-rose-300">12</span>
                      ) : null}
                    </Link>
                    {hasItems ? (
                      <button
                        type="button"
                        onClick={() => toggle(section.key)}
                        className="flex h-10 w-9 items-center justify-center rounded-xl text-white/40 hover:bg-white/5 hover:text-white/80"
                        aria-label={`Ouvrir ${section.label}`}
                      >
                        <ChevronDown className={cn("h-4 w-4 transition-transform duration-200", expanded && "rotate-180")} />
                      </button>
                    ) : null}
                  </div>
                  {expanded && section.items ? (
                    <div className="ml-2 mt-0.5 space-y-0.5 border-l border-white/8 pl-3">
                      {section.items.map((item) => {
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
                                ? "bg-white/[0.07] text-cyan-200"
                                : "text-white/45 hover:bg-white/[0.045] hover:text-white/75",
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

          <div ref={accountRef} className="relative z-10 border-t border-white/10 px-4 py-4">
            {accountOpen ? (
              <div
                role="menu"
                className="absolute bottom-[84px] left-4 right-4 overflow-hidden rounded-2xl border border-white/10 bg-[#0B0E14]/98 p-2 shadow-[0_28px_90px_rgba(0,0,0,0.55)] backdrop-blur-2xl"
              >
                <div className="border-b border-white/10 px-3 py-3">
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#D6B56D] to-cyan-300 text-sm font-semibold text-[#06070A]">
                      {initials(displayName) || "SL"}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-white">{displayName}</span>
                      <span className="block truncate text-xs text-white/45">{userEmail}</span>
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
                  className="mt-2 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-white/70 transition hover:bg-white/[0.06] hover:text-white"
                >
                  <User className="h-4 w-4 text-cyan-200" />
                  Mon profil
                </Link>
                <Link
                  href="/parametres/securite"
                  onClick={() => {
                    setAccountOpen(false);
                    onCloseMobile();
                  }}
                  role="menuitem"
                  className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-white/70 transition hover:bg-white/[0.06] hover:text-white"
                >
                  <KeyRound className="h-4 w-4 text-[#D6B56D]" />
                  Modifier mon mot de passe
                </Link>
                <form action={logoutAction}>
                  <button
                    type="submit"
                    role="menuitem"
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-red-200/80 transition hover:bg-red-400/10 hover:text-red-100"
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
                className="flex min-w-0 flex-1 items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.035] p-2 text-left transition hover:bg-white/[0.07]"
              >
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#D6B56D] to-cyan-300 text-sm font-semibold text-[#06070A] shadow-lg">
                  {initials(displayName) || "SL"}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-white">{displayName}</span>
                  <span className="block truncate text-xs text-white/45">{role}</span>
                </span>
                <ChevronDown className={cn("h-4 w-4 shrink-0 text-white/35 transition-transform", accountOpen && "rotate-180")} />
              </button>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
