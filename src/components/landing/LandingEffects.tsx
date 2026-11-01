"use client";
import { useEffect } from "react";

export function LandingEffects() {
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (media.matches || !("IntersectionObserver" in window)) return;
    const elements = document.querySelectorAll<HTMLElement>(".marketing-site [data-reveal]");
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) { entry.target.setAttribute("data-revealed", "true"); observer.unobserve(entry.target); }
      }
    }, { threshold: 0.08 });
    for (const element of elements) {
      // Content stays visible without JavaScript and in the initial viewport.
      if (element.getBoundingClientRect().top > window.innerHeight) element.setAttribute("data-revealed", "false");
      observer.observe(element);
    }
    const revealAll = () => {
      if (!media.matches) return;
      observer.disconnect();
      for (const element of elements) element.setAttribute("data-revealed", "true");
    };
    media.addEventListener("change", revealAll);
    return () => {
      observer.disconnect(); media.removeEventListener("change", revealAll);
      for (const element of elements) element.removeAttribute("data-revealed");
    };
  }, []);
  return null;
}
