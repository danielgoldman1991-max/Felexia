"use client";

import { useEffect } from "react";

const clamp = (value: number) => Math.min(1, Math.max(0, value));
const smoothstep = (value: number) => { const t = clamp(value); return t * t * (3 - 2 * t); };

// Coordinates of the laptop display in the generated 1672 × 941 landscape.
const LANDSCAPE = { width: 1672, height: 941, screenX: 831.6, screenY: 562.4, screenWidth: 67.2, screenHeight: 40.8 };

export function LandingEffects() {
  useEffect(() => {
    const root = document.querySelector<HTMLElement>(".marketing-site");
    if (!root) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const mobile = window.matchMedia("(max-width: 859px)");
    const shortViewport = window.matchMedia("(max-height: 600px)");
    const hero = root.querySelector<HTMLElement>(".horizon-hero, .marketing-hero");
    const heroWindow = root.querySelector<HTMLElement>(".horizon-window");
    const world = root.querySelector<HTMLElement>(".horizon-world");
    const laptop = root.querySelector<HTMLElement>(".horizon-laptop");
    const heroCopy = root.querySelector<HTMLElement>(".horizon-copy");
    const horizon = root.classList.contains("marketing-horizon-site");
    const elements = root.querySelectorAll<HTMLElement>("[data-reveal]");
    let frame = 0;
    let heroTop = 0;
    let heroHeight = 1;
    let heroWindowHeight = 1;
    let pageRange = 1;
    let observer: IntersectionObserver | undefined;
    let previousScrolled = "";
    let previousHeroVisible = "";
    let previousHorizonAway = "";
    let previousHeroProgress = -1;
    let viewportWidth = 1;
    let baseScale = 1;
    let targetScale = 1;
    let baseX = 0;
    let baseY = 0;
    let targetX = 0;
    let targetY = 0;

    const measure = () => {
      if (hero) {
        const rect = hero.getBoundingClientRect();
        heroTop = rect.top + window.scrollY;
        heroHeight = Math.max(1, rect.height);
        heroWindowHeight = heroWindow?.getBoundingClientRect().height ?? window.innerHeight;
        viewportWidth = heroWindow?.clientWidth ?? window.innerWidth;
        baseScale = Math.max(viewportWidth / LANDSCAPE.width, heroWindowHeight / LANDSCAPE.height);
        baseX = (viewportWidth - LANDSCAPE.width * baseScale) * 0.5;
        baseY = (heroWindowHeight - LANDSCAPE.height * baseScale) * (mobile.matches ? 0.7 : 0.68);
        // Stop with the complete display in view, leaving room for the navigation.
        const screenWidth = Math.min(viewportWidth * (mobile.matches ? 0.9 : 0.86), (heroWindowHeight - 170) * LANDSCAPE.screenWidth / LANDSCAPE.screenHeight);
        targetScale = Math.max(baseScale, screenWidth / LANDSCAPE.screenWidth);
        targetX = viewportWidth / 2 - LANDSCAPE.screenX * targetScale;
        targetY = (heroWindowHeight + (mobile.matches ? 50 : 60)) / 2 - LANDSCAPE.screenY * targetScale;
      }
      previousHeroProgress = -1;
      pageRange = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    };

    const update = () => {
      frame = 0;
      const y = window.scrollY;
      const scrolled = String(y > 20);
      if (scrolled !== previousScrolled) { root.dataset.scrolled = scrolled; previousScrolled = scrolled; }
      root.style.setProperty("--reading-progress", clamp(y / pageRange).toFixed(4));
      const heroRange = horizon ? Math.max(1, heroHeight - heroWindowHeight) : heroHeight;
      const heroProgress = reduced.matches || (horizon && (shortViewport.matches || heroHeight <= heroWindowHeight + 1)) || (!horizon && mobile.matches) || root.dataset.motionPaused === "true"
        ? 0 : clamp((y - heroTop) / heroRange);
      if (heroProgress !== previousHeroProgress) {
        root.style.setProperty("--hero-progress", heroProgress.toFixed(4));
        if (horizon && world && laptop) {
          // Logarithmic scale keeps the approach continuous over a large zoom.
          // The last 16% of the pinned sequence holds the interface for reading.
          const zoom = smoothstep((heroProgress - 0.035) / 0.805);
          const scale = baseScale * Math.pow(targetScale / baseScale, zoom);
          const framing = smoothstep(zoom);
          const initialCenterX = LANDSCAPE.screenX * baseScale + baseX;
          const initialCenterY = LANDSCAPE.screenY * baseScale + baseY;
          const centerX = initialCenterX + (viewportWidth / 2 - initialCenterX) * framing;
          const finalCenterY = LANDSCAPE.screenY * targetScale + targetY;
          const centerY = initialCenterY + (finalCenterY - initialCenterY) * framing;
          const x = zoom === 1 ? targetX : centerX - LANDSCAPE.screenX * scale;
          const yPosition = zoom === 1 ? targetY : centerY - LANDSCAPE.screenY * scale;
          world.style.transform = `translate3d(${x.toFixed(3)}px, ${yPosition.toFixed(3)}px, 0) scale(${scale.toFixed(6)})`;
          // Project the full-size HTML interface separately from the bitmap.
          // Nesting it at miniature scale inside the world would rasterize text.
          laptop.style.transform = `translate(${(x + 794.5 * scale).toFixed(3)}px, ${(yPosition + 538 * scale).toFixed(3)}px) scale(${(scale * 0.06).toFixed(6)})`;
          laptop.style.opacity = smoothstep((heroProgress - 0.12) / 0.2).toFixed(4);
        }
        previousHeroProgress = heroProgress;
      }
      if (horizon) {
        const visible = String(heroTop + heroHeight - y > 88 && heroProgress < 0.64);
        const away = String(heroProgress > 0.25);
        if (visible !== previousHeroVisible) { root.dataset.heroVisible = visible; previousHeroVisible = visible; }
        if (away !== previousHorizonAway) {
          root.dataset.horizonAway = away;
          // Faded links must not regain keyboard focus over the enlarged screen.
          if (heroCopy) heroCopy.inert = away === "true";
          previousHorizonAway = away;
        }
      }
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
    if (horizon) root.dataset.horizonEnhanced = "true";
    setupReveals(); measure(); update();
    const resizeObserver = "ResizeObserver" in window ? new ResizeObserver(resize) : undefined;
    resizeObserver?.observe(root);
    const pauseObserver = new MutationObserver(schedule);
    pauseObserver.observe(root, { attributes: true, attributeFilter: ["data-motion-paused"] });
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", resize, { passive: true });
    document.addEventListener("visibilitychange", visibility);
    reduced.addEventListener("change", preferences);
    shortViewport.addEventListener("change", resize);
    mobile.addEventListener("change", resize);
    return () => {
      cancelAnimationFrame(frame); observer?.disconnect(); resizeObserver?.disconnect(); pauseObserver.disconnect();
      window.removeEventListener("scroll", schedule); window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", visibility);
      reduced.removeEventListener("change", preferences); mobile.removeEventListener("change", resize);
      shortViewport.removeEventListener("change", resize);
      for (const element of elements) element.removeAttribute("data-revealed");
      root.style.removeProperty("--reading-progress"); root.style.removeProperty("--hero-progress");
      delete root.dataset.scrolled;
      delete root.dataset.heroVisible; delete root.dataset.horizonAway;
      delete root.dataset.horizonEnhanced;
      if (heroCopy) heroCopy.inert = false;
      world?.style.removeProperty("transform"); laptop?.style.removeProperty("opacity"); laptop?.style.removeProperty("transform");
    };
  }, []);
  return null;
}
