"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  ArrowLeftRight,
  Banknote,
  Building2,
  FilePlus2,
  Landmark,
  PackagePlus,
  Plus,
  Receipt,
  RotateCcw,
  ShoppingCart,
  Sparkles,
  Truck,
  Users,
  WalletCards,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { isOperatorPathAllowed } from "@/lib/auth/operator-access";

const groups = [
  {
    title: "Tiers",
    items: [
      { label: "Nouveau prospect", href: "/tiers/new?type=prospect", icon: Users },
      { label: "Nouveau client", href: "/tiers/new?type=customer", icon: Users },
      { label: "Nouveau fournisseur", href: "/tiers/new?type=supplier", icon: Building2 },
    ],
  },
  {
    title: "Vente",
    items: [
      { label: "Nouveau devis", href: "/vente/devis/new", icon: FilePlus2 },
      { label: "Nouvelle commande client", href: "/vente/commandes/new", icon: Receipt },
      { label: "Nouveau bon de livraison", href: "/vente/livraisons/new", icon: Truck },
      { label: "Nouveau retour client", href: "/vente/retours", icon: RotateCcw },
    ],
  },
  {
    title: "Facturation",
    items: [
      { label: "Nouvelle facture client", href: "/facturation/factures/new", icon: Receipt },
      { label: "Nouveau paiement client", href: "/facturation/paiements/new", icon: WalletCards },
      { label: "Nouvelle relance client", href: "/facturation/relances/new", icon: FilePlus2 },
      { label: "Nouvel avoir client", href: "/facturation/avoirs/new", icon: RotateCcw },
    ],
  },
  {
    title: "Achats",
    items: [
      { label: "Nouvelle commande fournisseur", href: "/achats/commandes/new", icon: ShoppingCart },
      { label: "Nouvelle reception fournisseur", href: "/achats/receptions/new", icon: Truck },
      { label: "Nouvelle facture fournisseur", href: "/achats/factures/new", icon: Receipt },
      { label: "Nouveau paiement fournisseur", href: "/achats/paiements/new", icon: WalletCards },
    ],
  },
  {
    title: "Stock",
    items: [
      { label: "Nouvel article/service", href: "/articles/new", icon: PackagePlus },
      { label: "Nouvelle entree stock", href: "/stock/entrees/new", icon: PackagePlus },
      { label: "Nouvel ajustement stock", href: "/stock/ajustements/new", icon: ArrowLeftRight },
      { label: "Nouvel emplacement stock", href: "/stock/emplacements/new", icon: Building2 },
    ],
  },
  {
    title: "Tresorerie",
    items: [
      { label: "Nouveau compte bancaire / caisse", href: "/tresorerie/comptes/new", icon: Landmark },
      { label: "Nouveau mouvement tresorerie", href: "/tresorerie/mouvements/new", icon: Banknote },
      { label: "Nouvelle prevision de tresorerie", href: "/tresorerie/previsions/nouveau", icon: Sparkles },
    ],
  },
];

const lightGroups = [
  {
    title: "Ventes",
    items: [
      { label: "Facture client", href: "/facturation/factures/new", icon: Receipt },
      { label: "Encaisser un règlement", href: "/facturation/paiements/new", icon: WalletCards },
      { label: "Nouveau client", href: "/tiers/new?type=customer", icon: Users },
    ],
  },
  {
    title: "Achats",
    items: [
      { label: "Facture fournisseur", href: "/achats/factures/new", icon: Receipt },
      { label: "Régler un fournisseur", href: "/achats/paiements/new", icon: WalletCards },
      { label: "Nouveau fournisseur", href: "/tiers/new?type=supplier", icon: Building2 },
    ],
  },
  {
    title: "Trésorerie",
    items: [
      { label: "Compte bancaire ou caisse", href: "/tresorerie/comptes/new", icon: Landmark },
      { label: "Entrée ou sortie d'argent", href: "/tresorerie/mouvements/new", icon: Banknote },
    ],
  },
];

export function QuickCreateMenu({ fullAccess = false, operator = false }: { fullAccess?: boolean; operator?: boolean }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const visibleGroups = (fullAccess && !operator ? groups : lightGroups)
    .map((group) => ({ ...group, items: group.items.filter((item) => !operator || isOperatorPathAllowed(item.href)) }))
    .filter((group) => group.items.length > 0);

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--primary-soft)] text-[var(--primary)] transition hover:brightness-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]"
        aria-label="Creation rapide"
        aria-expanded={open}
      >
        <Plus className="h-[18px] w-[18px]" />
      </button>
      {open ? (
        <div className="fixed left-4 right-4 top-20 z-[100] max-h-[calc(100dvh-6rem)] overflow-y-auto rounded-xl border border-[var(--border)] bg-[var(--popover)] p-4 shadow-[var(--shadow-lg)] sm:left-auto sm:w-[min(92vw,640px)] xl:absolute xl:right-0 xl:top-12">
          <div className="mb-4 border-b border-[var(--border-subtle)] px-1 pb-4">
            <p className="text-base font-semibold text-[var(--popover-foreground)]">Création rapide</p>
            <p className="mt-1 text-xs leading-5 text-[var(--muted)]">Une facture, un règlement ou un contact en un clic.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {visibleGroups.map((group) => (
              <div key={group.title} className="rounded-xl border border-[var(--border-subtle)] p-2">
                <p className="px-2 pb-2 pt-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--muted)]">{group.title}</p>
                <div className="space-y-1">
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setOpen(false)}
                        className="flex items-center gap-2.5 rounded-lg px-2 py-2 text-sm font-medium text-[var(--foreground)] transition-colors hover:bg-[var(--surface-soft)] focus-visible:outline-2 focus-visible:outline-[var(--ring)]"
                      >
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--primary-soft)] text-[var(--primary)]">
                          <Icon className="h-4 w-4" />
                        </span>
                        <span>{item.label}</span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-3 flex justify-end">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Fermer</Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
