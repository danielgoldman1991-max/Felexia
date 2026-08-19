"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { BookOpen, CircleHelp, FileText, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

const helpLinks = [
  { href: "/bienvenue", label: "Guide de démarrage", description: "Reprendre la checklist de configuration.", icon: BookOpen },
  { href: "/documents", label: "Centre de documents", description: "Retrouver, imprimer et exporter vos documents.", icon: FileText },
  { href: "/parametres", label: "Paramètres", description: "Configurer votre entreprise et vos modules.", icon: Settings },
];

export function HelpDropdown({ align = "right" }: { align?: "left" | "right" }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function closeOutside(event: PointerEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", closeOutside);
    return () => document.removeEventListener("pointerdown", closeOutside);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen((value) => !value)} className="flex h-11 w-11 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--card)] text-[var(--muted)] shadow-[var(--shadow-sm)] transition hover:bg-[var(--surface-soft)] hover:text-[var(--foreground)]" aria-label="Aide" aria-expanded={open}>
        <CircleHelp className="h-5 w-5" />
      </button>
      {open ? (
        <div className={cn("absolute top-full z-50 mt-2 w-[min(360px,calc(100vw-2rem))] overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--popover)] shadow-[var(--shadow-lg)]", align === "right" ? "right-0" : "left-0")}>
          <div className="border-b border-[var(--border-subtle)] px-4 py-3">
            <h3 className="text-sm font-semibold">Comment pouvons-nous vous aider ?</h3>
            <p className="mt-1 text-xs text-[var(--muted)]">Choisissez une ressource pour continuer.</p>
          </div>
          <div className="p-2">
            {helpLinks.map((item) => {
              const Icon = item.icon;
              return <Link key={item.href} href={item.href} onClick={() => setOpen(false)} className="flex items-start gap-3 rounded-xl p-3 transition hover:bg-[var(--surface-soft)]"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--primary-soft)] text-[var(--primary)]"><Icon className="h-4 w-4" /></span><span><span className="block text-sm font-semibold">{item.label}</span><span className="mt-0.5 block text-xs text-[var(--muted)]">{item.description}</span></span></Link>;
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
