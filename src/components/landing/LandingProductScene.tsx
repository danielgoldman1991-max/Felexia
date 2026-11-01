"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowDownLeft, ArrowUpRight, BookOpen, Check, ChevronDown, CircleHelp, FileText, LayoutDashboard, MoreHorizontal, Pause, Play, Plus, Search, Settings2, ShoppingBag, Wallet } from "lucide-react";

const previewNav = [
  { icon: LayoutDashboard, label: "Vue d’ensemble" },
  { icon: FileText, label: "Ventes" },
  { icon: ShoppingBag, label: "Achats" },
  { icon: Wallet, label: "Trésorerie" },
  { icon: BookOpen, label: "Journaux" },
];
const invoices = [
  { name: "Studio Atlas", initials: "SA", amount: "8 400,00", status: "Réglée", tone: "mint" },
  { name: "Maison Noria", initials: "MN", amount: "4 800,00", status: "À encaisser", tone: "blue" },
  { name: "Les Ateliers", initials: "LA", amount: "3 600,00", status: "Réglée", tone: "sand" },
];

export function LandingProductScene() {
  const sceneRef = useRef<HTMLDivElement>(null);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    const finePointer = window.matchMedia("(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)");
    let frame = 0;
    const reset = () => {
      cancelAnimationFrame(frame);
      scene.style.setProperty("--pointer-x", "0deg");
      scene.style.setProperty("--pointer-y", "0deg");
    };
    const move = (event: PointerEvent) => {
      if (!finePointer.matches || scene.dataset.paused === "true") return;
      const rect = scene.getBoundingClientRect();
      const x = (event.clientX - rect.left) / rect.width - 0.5;
      const y = (event.clientY - rect.top) / rect.height - 0.5;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        scene.style.setProperty("--pointer-x", `${x * 5}deg`);
        scene.style.setProperty("--pointer-y", `${-y * 4}deg`);
      });
    };
    const syncMotion = () => { if (!finePointer.matches) reset(); };
    const observer = "IntersectionObserver" in window ? new IntersectionObserver(([entry]) => {
      scene.dataset.active = String(entry.isIntersecting && !document.hidden);
    }) : null;
    const visibility = () => {
      scene.dataset.active = String(!document.hidden && scene.getBoundingClientRect().bottom > 0);
      if (document.hidden) reset();
    };
    observer?.observe(scene);
    scene.addEventListener("pointermove", move, { passive: true });
    scene.addEventListener("pointerleave", reset);
    finePointer.addEventListener("change", syncMotion);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      cancelAnimationFrame(frame); observer?.disconnect();
      scene.closest(".marketing-site")?.removeAttribute("data-motion-paused");
      scene.removeEventListener("pointermove", move); scene.removeEventListener("pointerleave", reset);
      finePointer.removeEventListener("change", syncMotion); document.removeEventListener("visibilitychange", visibility);
    };
  }, []);

  return (
    <figure className="product-figure">
      <div ref={sceneRef} className="product-scene" data-paused={paused} data-active="true" role="img" aria-label="Aperçu illustratif en 3D de Felexia : tableau de bord, suivi des factures et des règlements. Les entreprises et les montants sont fictifs.">
        <div className="product-scene-grid" aria-hidden="true" />
        <div className="product-orbit product-orbit-one" aria-hidden="true" /><div className="product-orbit product-orbit-two" aria-hidden="true" />
        <div className="product-cube-position" aria-hidden="true"><div className="product-cube">{["front", "back", "right", "left", "top", "bottom"].map((face) => <div key={face} className={`product-cube-face product-cube-${face}`}><span /><span /><span /><span /></div>)}</div></div>
        <div className="product-dashboard" aria-hidden="true">
          <div className="product-window-bar"><div><i /><i /><i /></div><span>Votre espace Felexia</span><MoreHorizontal size={15} /></div>
          <div className="product-dashboard-body">
            <aside className="product-sidebar">
              <div className="product-preview-brand"><span className="product-brand-mark">f.</span>felexia<span>pro</span></div>
              <div className="product-company"><span>A</span><div>Atlas Studio<small>Mon entreprise</small></div><ChevronDown size={11} /></div>
              <div className="product-sidebar-nav">{previewNav.map((item, index) => <div key={item.label} data-selected={index === 0}><item.icon size={13} /><span>{item.label}</span></div>)}</div>
              <div className="product-sidebar-bottom"><CircleHelp size={12} /> Centre d’aide<Settings2 size={12} /></div>
            </aside>
            <div className="product-main">
              <div className="product-topline"><span>Votre activité, en un regard.</span><span><Search size={12} /><i>AB</i></span></div>
              <div className="product-dashboard-heading"><div><small>VOTRE TABLEAU DE BORD</small><strong>Bonjour, Amine <span>✳</span></strong></div><span>Ce mois-ci<ChevronDown size={10} /></span></div>
              <div className="product-kpis"><div><span>Ventes du mois<ArrowUpRight size={13} /></span><strong>48 600<small>MAD</small></strong><i>Vos factures de vente</i></div><div><span>Trésorerie<Wallet size={13} /></span><strong>32 450<small>MAD</small></strong><i>Banques et caisses</i></div></div>
              <div className="product-chart"><div><strong>Vos flux de trésorerie</strong><span><i />Encaissements</span></div><div className="product-chart-plot"><div className="product-chart-labels"><span>30k</span><span>20k</span><span>10k</span></div><svg viewBox="0 0 330 90" fill="none" aria-hidden="true"><defs><linearGradient id="product-chart-fill" x1="0" y1="0" x2="0" y2="1"><stop stopColor="#3768ed" stopOpacity=".17" /><stop offset="1" stopColor="#3768ed" stopOpacity="0" /></linearGradient></defs><path d="M0 18H330M0 47H330M0 76H330" stroke="#edf0f6" strokeDasharray="3 3" /><path d="M0 77C20 77 25 64 45 65S65 80 85 58S115 59 135 46S155 59 175 35S195 41 220 28S245 39 270 16S310 17 330 5V90H0Z" fill="url(#product-chart-fill)" /><path d="M0 77C20 77 25 64 45 65S65 80 85 58S115 59 135 46S155 59 175 35S195 41 220 28S245 39 270 16S310 17 330 5" stroke="#3865de" strokeWidth="2.5" strokeLinecap="round" /></svg></div><div className="product-chart-months"><span>Sem. 01</span><span>Sem. 02</span><span>Sem. 03</span><span>Sem. 04</span></div></div>
              <div className="product-invoices-heading"><strong>Dernières factures</strong><span><Plus size={11} />Nouvelle facture</span></div>
              <div className="product-invoices">{invoices.map((invoice) => <div key={invoice.name}><span className={`product-avatar product-avatar-${invoice.tone}`}>{invoice.initials}</span><span>{invoice.name}<small>Facture de vente</small></span><strong>{invoice.amount}<small>MAD</small></strong><i data-paid={invoice.status === "Réglée"}>{invoice.status}</i></div>)}</div>
            </div>
          </div>
        </div>
        <div className="product-floating-payment" aria-hidden="true"><span className="product-payment-check"><Check size={18} /></span><div>Règlement enregistré<strong>+ 8 400,00 <small>MAD</small></strong><span><span />Tout est à jour.</span></div><ArrowDownLeft size={17} /></div>
        <div className="product-floating-invoice" aria-hidden="true"><span><FileText size={19} /></span><div>Votre prochaine facture ?<strong>Déjà une longueur d’avance.</strong></div></div>
        <span className="product-spark product-spark-one" aria-hidden="true">✳</span><span className="product-spark product-spark-two" aria-hidden="true">+</span>
      </div>
      <button className="product-motion-toggle" type="button" aria-pressed={paused} aria-label={paused ? "Reprendre les animations" : "Mettre les animations en pause"} title={paused ? "Reprendre" : "Mettre en pause"} onClick={() => {
        const nextPaused = !paused;
        setPaused(nextPaused);
        sceneRef.current?.closest(".marketing-site")?.setAttribute("data-motion-paused", String(nextPaused));
        sceneRef.current?.style.setProperty("--pointer-x", "0deg"); sceneRef.current?.style.setProperty("--pointer-y", "0deg");
      }}>{paused ? <Play size={14} aria-hidden="true" /> : <Pause size={14} aria-hidden="true" />}</button>
    </figure>
  );
}
