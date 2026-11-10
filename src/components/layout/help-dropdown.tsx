"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { BookOpen, CircleHelp, FileText, Mail, Settings, Sparkles, X } from "lucide-react";
import { cn } from "@/lib/utils";

const helpLinks = [
  { href: "/bienvenue", label: "Guide de démarrage", description: "Reprendre la checklist de configuration.", icon: BookOpen },
  { href: "/documents", label: "Centre de documents", description: "Retrouver, imprimer et exporter vos documents.", icon: FileText },
  { href: "/parametres", label: "Paramètres", description: "Configurer votre entreprise et vos modules.", icon: Settings },
];

const lightHelpLinks = [
  { href: "/bienvenue", label: "Bien démarrer", description: "Configurer votre entreprise et créer votre première facture.", icon: BookOpen },
  { href: "/parametres", label: "Mon entreprise", description: "Votre entreprise, vos utilisateurs et votre abonnement.", icon: Settings },
  { href: "/parametres/modules", label: "Découvrir PRO", description: "Les modules de l’ERP complet pour votre entreprise.", icon: Sparkles },
];

const operatorHelpLinks = [
  { href: "/facturation/factures", label: "Factures de vente", description: "Retrouver et gérer les factures clients.", icon: FileText },
  { href: "/comptabilite/journaux", label: "Consulter les journaux", description: "Retrouver les écritures comptables de l’entreprise.", icon: BookOpen },
  { href: "/parametres/profil", label: "Mon compte", description: "Gérer vos informations personnelles.", icon: Settings },
];

export function HelpDropdown({ align = "right", fullAccess = false, operator = false }: { align?: "left" | "right"; fullAccess?: boolean; operator?: boolean }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const panelId = useId();

  useEffect(() => {
    function closeOutside(event: PointerEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", closeOutside);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
    };
  }, []);

  useEffect(() => {
    if (open) panelRef.current?.querySelector<HTMLAnchorElement>("a[href]")?.focus();
  }, [open]);

  function closeHelp() {
    triggerRef.current?.focus();
    setOpen(false);
  }

  return (
    <div
      ref={ref}
      className="relative"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false);
      }}
      onKeyDown={(event) => {
        if (open && event.key === "Escape") {
          event.preventDefault();
          event.stopPropagation();
          closeHelp();
        }
      }}
    >
      <button ref={triggerRef} type="button" onClick={() => setOpen((value) => !value)} onKeyDown={(event) => { if (event.key === "ArrowDown") { event.preventDefault(); setOpen(true); } }} className="app-help-trigger flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--card)] text-[var(--muted)] transition-colors hover:bg-[var(--surface-soft)] hover:text-[var(--foreground)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]" aria-label="Aide" aria-expanded={open} aria-controls={open ? panelId : undefined}>
        <CircleHelp aria-hidden="true" className="h-[18px] w-[18px]" />
      </button>
      {open ? (
        <div ref={panelRef} id={panelId} role="region" aria-labelledby={`${panelId}-title`} className={cn("app-help-panel absolute top-full z-50 mt-2 max-h-[calc(100dvh-6rem)] w-[min(360px,calc(100vw-2rem))] overflow-y-auto overscroll-contain rounded-xl border border-[var(--border)] bg-[var(--popover)] text-[var(--popover-foreground)] shadow-[var(--shadow-lg)]", align === "right" ? "right-0" : "left-0")}>
          <div className="border-b border-[var(--border-subtle)] px-4 py-3">
            <div className="flex items-start justify-between gap-2"><h2 id={`${panelId}-title`} className="text-sm font-semibold">Comment pouvons-nous vous aider ?</h2><button type="button" className="app-help-close shrink-0" aria-label="Fermer l’aide" onClick={closeHelp}><X aria-hidden="true" className="mx-auto h-4 w-4" /></button></div>
            <p className="mt-1 text-xs text-[var(--muted)]">Choisissez une ressource pour continuer.</p>
          </div>
          <div className="p-2">
            <a href={`mailto:${process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "contact@felexia.pro"}?subject=Assistance%20Felexia%20Pro`} onClick={() => setOpen(false)} className="flex items-start gap-3 rounded-xl p-3 transition hover:bg-[var(--surface-soft)] focus-visible:outline-2 focus-visible:outline-[var(--ring)]"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--primary-soft)] text-[var(--primary)]"><Mail aria-hidden="true" className="h-4 w-4" /></span><span><span className="block text-sm font-semibold">Contacter l’assistance</span><span className="mt-0.5 block text-xs text-[var(--muted)]">Décrivez votre besoin et indiquez le nom de votre entreprise.</span></span></a>
            {(operator ? operatorHelpLinks : fullAccess ? helpLinks : lightHelpLinks).map((item) => {
              const Icon = item.icon;
              return <Link key={item.href} href={item.href} onClick={() => setOpen(false)} className="flex items-start gap-3 rounded-xl p-3 transition hover:bg-[var(--surface-soft)] focus-visible:outline-2 focus-visible:outline-[var(--ring)]"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--primary-soft)] text-[var(--primary)]"><Icon aria-hidden="true" className="h-4 w-4" /></span><span><span className="block text-sm font-semibold">{item.label}</span><span className="mt-0.5 block text-xs text-[var(--muted)]">{item.description}</span></span></Link>;
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
