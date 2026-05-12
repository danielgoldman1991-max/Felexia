"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState } from "react";
import {
  ChevronDown,
  LogOut,
  Settings,
  Plus,
  X,
} from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { cn, initials } from "@/lib/utils";
import { quickActions, sections } from "@/components/layout/sidebar-data";
import type { ActiveWorkspace } from "@/lib/auth";
import { logoutAction } from "@/lib/auth-actions";

function pathMatches(pathname: string, href: string) {
  const cleanHref = href.split("?")[0];
  return pathname === cleanHref || pathname.startsWith(`${cleanHref}/`);
}

function Badge({ value, tone = "info" }: { value: string; tone?: "danger" | "warning" | "info" }) {
  const styles = {
    danger: "bg-rose-500 text-white",
    warning: "bg-amber-400 text-slate-950",
    info: "bg-blue-500 text-white",
  };
  return <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold", styles[tone])}>{value}</span>;
}

export function Sidebar({
  mobileOpen,
  onCloseMobile,
  workspace,
}: {
  mobileOpen: boolean;
  onCloseMobile: () => void;
  workspace?: ActiveWorkspace | null;
}) {
  const pathname = usePathname();
  const initiallyOpen = useMemo(
    () =>
      sections
        .filter(
          (section) =>
            section.items?.some((item) => pathMatches(pathname, item.href)) ||
            pathMatches(pathname, section.href),
        )
        .map((section) => section.key),
    [pathname],
  );
  const [open, setOpen] = useState<string[]>(initiallyOpen);

  function toggle(key: string) {
    setOpen((current) =>
      current.includes(key)
        ? current.filter((item) => item !== key)
        : [...current, key],
    );
  }

  const displayName = workspace?.profile?.full_name ?? workspace?.email ?? "Sophie Laurent";
  const role = workspace?.role ?? "Administratrice";

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
          "fixed inset-y-0 left-0 z-50 flex w-[300px] flex-col border-r border-white/10",
          "bg-[#06111f] text-white shadow-2xl transition-transform duration-300 lg:translate-x-0",
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
          <div className="absolute -left-20 -top-40 h-[500px] w-[500px] rounded-full bg-blue-500/8 blur-3xl" />
          <div className="absolute -bottom-20 -right-20 h-[300px] w-[300px] rounded-full bg-cyan-500/5 blur-3xl" />
        </div>

        <div className="relative z-10 flex flex-col h-full">
          <div className="flex items-center justify-between px-5 pt-6 pb-5">
            <Link href="/dashboard" className="flex items-center gap-3 min-w-0" onClick={onCloseMobile}>
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 via-blue-600 to-cyan-400 shadow-lg shadow-blue-500/25 ring-1 ring-white/10">
                <Logo size={36} />
              </div>
              <div className="min-w-0">
                <h1 className="text-xl font-bold tracking-tight text-white">Felexia</h1>
                <p className="text-[11px] font-medium uppercase tracking-[0.3em] text-white/40">Gestion PME</p>
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

          <div className="space-y-2 border-b border-white/10 px-4 pb-5">
            {quickActions.map((item) => {
              const Icon = item.icon ?? Plus;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onCloseMobile}
                  className="group flex items-center gap-3 rounded-2xl bg-gradient-to-r from-slate-800/90 via-slate-800/80 to-slate-700/80 px-4 py-3 text-sm font-semibold text-white shadow-sm ring-1 ring-white/10 transition-all hover:scale-[1.02] hover:from-slate-700/90 hover:via-slate-700/80 hover:to-slate-600/80 hover:shadow-md"
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </div>

          <nav className="relative z-10 flex-1 space-y-0.5 overflow-y-auto px-3 py-4 scrollbar-thin scrollbar-thumb-white/10">
            {sections.map((section) => {
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
                          ? "bg-white/10 text-white shadow-lg backdrop-blur-xl"
                          : "text-white/60 hover:bg-white/5 hover:text-white/90",
                      )}
                    >
                      {active ? (
                        <span className="absolute left-0 top-2.5 h-6 w-1 rounded-r-full bg-gradient-to-b from-cyan-400 to-blue-500 shadow-[0_0_8px_rgba(6,182,212,0.4)]" />
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
                                ? "bg-white/8 text-cyan-300"
                                : "text-white/45 hover:bg-white/5 hover:text-white/70",
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

          <div className="relative z-10 border-t border-white/10 px-4 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-cyan-400 text-sm font-bold text-white shadow-lg">
                {initials(displayName) || "SL"}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-white">{displayName}</p>
                <p className="truncate text-xs text-white/45">{role}</p>
              </div>
              <Link
                href="/parametres"
                onClick={onCloseMobile}
                className="flex h-9 w-9 items-center justify-center rounded-xl text-white/40 transition-all hover:bg-white/10 hover:text-white"
                aria-label="Paramètres"
              >
                <Settings className="h-4 w-4" />
              </Link>
              <form action={logoutAction}>
                <button
                  type="submit"
                  className="flex h-9 w-9 items-center justify-center rounded-xl text-white/40 transition-all hover:bg-white/10 hover:text-rose-400"
                  aria-label="Déconnexion"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </form>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
