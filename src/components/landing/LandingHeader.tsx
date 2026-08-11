"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const navLinks = [
  { href: "#modules", label: "Modules" },
  { href: "#why", label: "Pourquoi Felexia" },
  { href: "#features", label: "Fonctionnalités" },
  { href: "#pricing", label: "Tarifs" },
  { href: "#resources", label: "Ressources" },
  { href: "#contact", label: "Contact" },
];

const ghostButton =
  "inline-flex h-11 items-center justify-center whitespace-nowrap rounded-2xl px-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 hover:text-[#061B3F]";

export function LandingHeader() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200/70 bg-white/95 backdrop-blur-xl">
      <div className="mx-auto grid h-20 max-w-[1440px] grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-8 px-6 xl:px-8">
        <div className="flex shrink-0 items-center justify-start">
          <Link href="/" aria-label="FelexiaERP - accueil" className="flex shrink-0 items-center">
            <BrandLogo variant="horizontal" size="sm" priority />
          </Link>
        </div>

        <nav
          className="hidden min-w-0 items-center justify-center gap-6 xl:flex"
          aria-label="Navigation principale"
        >
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="whitespace-nowrap text-sm font-medium text-slate-600 transition-colors hover:text-[#0B2A5B]"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="hidden shrink-0 items-center justify-end gap-3 xl:flex">
          <Link href="/login" className={ghostButton}>
            Connexion
          </Link>
          <Button asChild variant="landingPrimary" className="h-11 px-5">
            <Link href="/login?mode=register">
              <span className="relative z-10 !text-white">Démarrer gratuitement</span>
            </Link>
          </Button>
        </div>

        <div className="col-start-3 flex h-full items-center justify-end xl:hidden">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? "Fermer le menu" : "Ouvrir le menu"}
            aria-expanded={open}
            aria-controls="landing-mobile-menu"
            className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:bg-slate-50"
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {open && (
        <div
          id="landing-mobile-menu"
          className="border-t border-slate-200 bg-white/95 shadow-xl backdrop-blur-xl xl:hidden"
        >
          <nav className="mx-auto max-w-[1440px] px-6 py-5 xl:px-8" aria-label="Navigation mobile">
            <div className="flex flex-col gap-1">
              {navLinks.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={() => setOpen(false)}
                  className="rounded-xl px-3 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 hover:text-[#0B2A5B]"
                >
                  {link.label}
                </a>
              ))}
            </div>
            <div className="mt-4 flex flex-col gap-2.5 border-t border-slate-100 pt-4">
              <Link
                href="/login"
                onClick={() => setOpen(false)}
                className={cn(ghostButton, "w-full border border-slate-200 bg-white shadow-sm")}
              >
                Connexion
              </Link>
              <Button asChild variant="landingPrimary" className="h-11 w-full px-5">
                <Link href="/login?mode=register" onClick={() => setOpen(false)}>
                  <span className="relative z-10 !text-white">Démarrer gratuitement</span>
                </Link>
              </Button>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
