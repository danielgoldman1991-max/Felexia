"use client";

import { useEffect } from "react";

const clamp = (value: number) => Math.min(1, Math.max(0, value));

export function LandingEffects() {
  useEffect(() => {
    const root = document.querySelector<HTMLElement>(".marketing-site");
    if (!root) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const mobile = window.matchMedia("(max-width: 859px)");
    const hero = root.querySelector<HTMLElement>(".marketing-hero");
    const elements = root.querySelectorAll<HTMLElement>("[data-reveal]");
    let frame = 0;
    let heroTop = 0;
    let heroHeight = 1;
    let pageRange = 1;
    let observer: IntersectionObserver | undefined;
    let previousScrolled = "";

    const measure = () => {
      if (hero) {
        const rect = hero.getBoundingClientRect();
        heroTop = rect.top + window.scrollY;
        heroHeight = Math.max(1, rect.height);
      }
      pageRange = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    };

    const update = () => {
      frame = 0;
      const y = window.scrollY;
      const scrolled = String(y > 20);
      if (scrolled !== previousScrolled) { root.dataset.scrolled = scrolled; previousScrolled = scrolled; }
      root.style.setProperty("--reading-progress", clamp(y / pageRange).toFixed(4));
      const heroProgress = reduced.matches || mobile.matches || root.dataset.motionPaused === "true"
        ? 0 : clamp((y - heroTop) / heroHeight);
      root.style.setProperty("--hero-progress", heroProgress.toFixed(4));
    };

    const schedule = () => {
      if (!frame && !document.hidden) frame = requestAnimationFrame(update);
    };
    const resize = () => { measure(); schedule(); };
    const visibility = () => {
      if (document.hidden) { cancelAnimationFrame(frame); frame = 0; }
      else resize();
    };

    const setupReveals = () => {
      observer?.disconnect();
      for (const element of elements) element.removeAttribute("data-revealed");
      if (reduced.matches || !("IntersectionObserver" in window)) return;
      observer = new IntersectionObserver((entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.setAttribute("data-revealed", "true");
            observer?.unobserve(entry.target);
          }
        }
      }, { threshold: 0.1, rootMargin: "0px 0px -25px 0px" });
      for (const element of elements) {
        // Only enhance content below the fold; source content stays readable.
        if (element.getBoundingClientRect().top > window.innerHeight) element.dataset.revealed = "false";
        observer.observe(element);
      }
    };
    const preferences = () => { setupReveals(); resize(); };
    setupReveals(); measure(); update();
    const resizeObserver = "ResizeObserver" in window ? new ResizeObserver(resize) : undefined;
    resizeObserver?.observe(root);
    const pauseObserver = new MutationObserver(schedule);
    pauseObserver.observe(root, { attributes: true, attributeFilter: ["data-motion-paused"] });
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", resize, { passive: true });
    document.addEventListener("visibilitychange", visibility);
    reduced.addEventListener("change", preferences);
    mobile.addEventListener("change", resize);
    return () => {
      cancelAnimationFrame(frame); observer?.disconnect(); resizeObserver?.disconnect(); pauseObserver.disconnect();
      window.removeEventListener("scroll", schedule); window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", visibility);
      reduced.removeEventListener("change", preferences); mobile.removeEventListener("change", resize);
      for (const element of elements) element.removeAttribute("data-revealed");
      root.style.removeProperty("--reading-progress"); root.style.removeProperty("--hero-progress");
      delete root.dataset.scrolled;
    };
  }, []);
  return null;
}
