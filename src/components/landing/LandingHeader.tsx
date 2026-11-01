"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Menu, X } from "lucide-react";
import { BrandLogo } from "@/components/brand/BrandLogo";
import "./landing-header-overlay.css";

const navLinks = [
  { href: "/#facturation-electronique", label: "Facture électronique" },
  { href: "/#modules", label: "La solution" },
  { href: "/#pricing", label: "Tarifs" },
  { href: "/#resources", label: "Questions fréquentes" },
];

export function LandingHeader({ overlay = false }: { overlay?: boolean }) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const headerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") { setOpen(false); triggerRef.current?.focus(); }
    };
    const closeOutside = (event: PointerEvent) => {
      if (event.target instanceof Node && !headerRef.current?.contains(event.target)) setOpen(false);
    };
    const desktop = window.matchMedia("(min-width: 1100px)");
    const closeOnDesktop = () => { if (desktop.matches) setOpen(false); };
    document.addEventListener("keydown", closeOnEscape);
    document.addEventListener("pointerdown", closeOutside);
    desktop.addEventListener("change", closeOnDesktop);
    return () => {
      document.removeEventListener("keydown", closeOnEscape);
      document.removeEventListener("pointerdown", closeOutside);
      desktop.removeEventListener("change", closeOnDesktop);
    };
  }, [open]);

  return (
    <header className={`marketing-header${overlay ? " marketing-header-overlay" : ""}`} ref={headerRef}>
      <div className="marketing-reading-progress" aria-hidden="true"><span /></div>
      <div className="marketing-container marketing-header-inner">
        <Link href="/" aria-label="FelexiaERP — accueil" className="marketing-brand"><BrandLogo variant="horizontal" height={46} priority /></Link>
        <nav className="marketing-desktop-nav" aria-label="Navigation principale">{navLinks.map((link) => <a key={link.href} href={link.href}>{link.label}</a>)}</nav>
        <div className="marketing-header-actions">
          <Link href="/login" className="marketing-login">Connexion</Link>
          <Link href="/login?mode=register" className="marketing-button marketing-button-primary marketing-header-cta">Commencer<ArrowUpRight size={16} aria-hidden="true" /></Link>
        </div>
        <button ref={triggerRef} type="button" onClick={() => setOpen((value) => !value)} aria-label={open ? "Fermer le menu" : "Ouvrir le menu"} aria-expanded={open} aria-controls="landing-mobile-menu" className="marketing-menu-toggle">{open ? <X size={21} aria-hidden="true" /> : <Menu size={21} aria-hidden="true" />}</button>
      </div>
      {open ? <nav id="landing-mobile-menu" className="marketing-mobile-nav" aria-label="Navigation mobile">
        {navLinks.map((link) => <a key={link.href} href={link.href} onClick={() => setOpen(false)}>{link.label}<ArrowUpRight size={16} aria-hidden="true" /></a>)}
        <Link href="/login" onClick={() => setOpen(false)}>Connexion<ArrowUpRight size={16} aria-hidden="true" /></Link>
        <Link href="/login?mode=register" className="marketing-button marketing-button-primary" onClick={() => setOpen(false)}>Démarrer gratuitement<ArrowUpRight size={16} aria-hidden="true" /></Link>
      </nav> : null}
    </header>
  );
}
