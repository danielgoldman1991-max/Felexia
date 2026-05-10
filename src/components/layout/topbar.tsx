"use client";

import { Bell, CircleHelp, Menu, Plus, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { initials } from "@/lib/utils";
import type { ActiveWorkspace } from "@/lib/auth";

export function Topbar({ workspace, onOpenMenu }: { workspace: ActiveWorkspace; onOpenMenu: () => void }) {
  const displayName = workspace.profile?.full_name ?? workspace.email ?? "Youssef";
  const role = workspace.role ?? "Admin";

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/85 backdrop-blur-xl">
      <div className="flex h-18 items-center gap-3 px-4 sm:px-6 lg:px-8">
        <button type="button" onClick={onOpenMenu} className="flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-600 shadow-sm lg:hidden" aria-label="Ouvrir le menu">
          <Menu className="h-5 w-5" />
        </button>

        <div className="hidden min-w-0 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2 lg:block">
          <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Societe</p>
          <p className="max-w-52 truncate text-sm font-semibold text-slate-900">{workspace.organization.name || "Societe SARL"}</p>
        </div>

        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input className="h-11 rounded-2xl border-slate-200 bg-slate-50 pl-10 text-sm shadow-none" placeholder="Rechercher un client, document, produit..." />
        </div>

        <button type="button" className="flex h-11 w-11 items-center justify-center rounded-full bg-blue-600 text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-700" aria-label="Creer">
          <Plus className="h-5 w-5" />
        </button>
        <button type="button" className="relative hidden h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-sm transition hover:text-slate-900 sm:flex" aria-label="Notifications">
          <Bell className="h-5 w-5" />
          <span className="absolute right-2.5 top-2.5 h-2.5 w-2.5 rounded-full bg-rose-500 ring-2 ring-white" />
        </button>
        <button type="button" className="hidden h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-sm transition hover:text-slate-900 sm:flex" aria-label="Aide">
          <CircleHelp className="h-5 w-5" />
        </button>

        <div className="hidden items-center gap-3 rounded-2xl border border-slate-200 bg-white px-3 py-2 shadow-sm md:flex">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-950 text-sm font-bold text-white">{initials(displayName) || "Y"}</div>
          <div className="min-w-0">
            <p className="max-w-32 truncate text-sm font-semibold text-slate-950">{displayName}</p>
            <p className="text-xs text-slate-500">{role}</p>
          </div>
        </div>
      </div>
    </header>
  );
}
