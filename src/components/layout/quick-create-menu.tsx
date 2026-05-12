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
  Truck,
  Users,
  WalletCards,
} from "lucide-react";
import { Button } from "@/components/ui/button";

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
      { label: "Importer releve bancaire", href: "/tresorerie/releves/import", icon: FilePlus2 },
    ],
  },
];

export function QuickCreateMenu() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex h-11 w-11 items-center justify-center rounded-full bg-blue-600 text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-700"
        aria-label="Creation rapide"
      >
        <Plus className="h-5 w-5" />
      </button>
      {open ? (
        <div className="absolute right-0 top-14 z-[100] w-[min(92vw,560px)] rounded-2xl border border-slate-200 bg-white p-3 shadow-xl">
          <div className="mb-2 px-2">
            <p className="text-sm font-semibold text-slate-950">Creation rapide</p>
            <p className="text-xs text-slate-500">Creez les documents importants sans changer de module.</p>
          </div>
          <div className="grid max-h-[70vh] gap-3 overflow-y-auto sm:grid-cols-2">
            {groups.map((group) => (
              <div key={group.title} className="rounded-xl border border-slate-100 p-2">
                <p className="px-2 pb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">{group.title}</p>
                <div className="space-y-1">
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setOpen(false)}
                        className="flex items-center gap-2 rounded-lg px-2 py-2 text-sm font-medium text-slate-700 transition hover:bg-blue-50 hover:text-blue-700"
                      >
                        <Icon className="h-4 w-4" />
                        {item.label}
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
