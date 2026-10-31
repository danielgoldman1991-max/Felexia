"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { BookOpen, CircleHelp, FileText, Mail, Settings, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

const helpLinks = [
  { href: "/bienvenue", label: "Guide de démarrage", description: "Reprendre la checklist de configuration.", icon: BookOpen },
  { href: "/documents", label: "Centre de documents", description: "Retrouver, imprimer et exporter vos documents.", icon: FileText },
  { href: "/parametres", label: "Paramètres", description: "Configurer votre entreprise et vos modules.", icon: Settings },
];

const lightHelpLinks = [
  { href: "/bienvenue", label: "Bien démarrer", description: "Configurer votre entreprise et créer votre première facture.", icon: BookOpen },
  { href: "/parametres", label: "Mon entreprise", description: "Votre entreprise, vos utilisateurs et votre abonnement.", icon: Settings },
  { href: "/parametres/modules", label: "Un besoin supplémentaire ?", description: "Demander l'accès aux modules complémentaires.", icon: Sparkles },
];

const operatorHelpLinks = [
  { href: "/facturation/factures", label: "Factures de vente", description: "Retrouver et gérer les factures clients.", icon: FileText },
  { href: "/comptabilite/journaux", label: "Consulter les journaux", description: "Retrouver les écritures comptables de l’entreprise.", icon: BookOpen },
  { href: "/parametres/profil", label: "Mon compte", description: "Gérer vos informations personnelles.", icon: Settings },
];

export function HelpDropdown({ align = "right", fullAccess = false, operator = false }: { align?: "left" | "right"; fullAccess?: boolean; operator?: boolean }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function closeOutside(event: PointerEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, []);

  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen((value) => !value)} className="flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--card)] text-[var(--muted)] transition-colors hover:bg-[var(--surface-soft)] hover:text-[var(--foreground)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]" aria-label="Aide" aria-expanded={open}>
        <CircleHelp className="h-[18px] w-[18px]" />
      </button>
      {open ? (
        <div className={cn("absolute top-full z-50 mt-2 w-[min(360px,calc(100vw-2rem))] overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--popover)] text-[var(--popover-foreground)] shadow-[var(--shadow-lg)]", align === "right" ? "right-0" : "left-0")}>
          <div className="border-b border-[var(--border-subtle)] px-4 py-3">
            <h3 className="text-sm font-semibold">Comment pouvons-nous vous aider ?</h3>
            <p className="mt-1 text-xs text-[var(--muted)]">Choisissez une ressource pour continuer.</p>
          </div>
          <div className="p-2">
            <a href={`mailto:${process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "contact@felexia.pro"}?subject=Assistance%20Felexia%20Pro`} className="flex items-start gap-3 rounded-xl p-3 transition hover:bg-[var(--surface-soft)]"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--primary-soft)] text-[var(--primary)]"><Mail className="h-4 w-4" /></span><span><span className="block text-sm font-semibold">Contacter l’assistance</span><span className="mt-0.5 block text-xs text-[var(--muted)]">Décrivez votre besoin et indiquez le nom de votre entreprise.</span></span></a>
            {(operator ? operatorHelpLinks : fullAccess ? helpLinks : lightHelpLinks).map((item) => {
              const Icon = item.icon;
              return <Link key={item.href} href={item.href} onClick={() => setOpen(false)} className="flex items-start gap-3 rounded-xl p-3 transition hover:bg-[var(--surface-soft)]"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--primary-soft)] text-[var(--primary)]"><Icon className="h-4 w-4" /></span><span><span className="block text-sm font-semibold">{item.label}</span><span className="mt-0.5 block text-xs text-[var(--muted)]">{item.description}</span></span></Link>;
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
