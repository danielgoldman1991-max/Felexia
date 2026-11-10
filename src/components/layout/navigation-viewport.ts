"use client";

import { useSyncExternalStore } from "react";

const desktopQuery = "(min-width: 1024px)";
function subscribe(onChange: () => void) {
  const media = window.matchMedia(desktopQuery);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}
function snapshot() { return window.matchMedia(desktopQuery).matches; }
function serverSnapshot() { return true; }

export function useDesktopNavigation() {
  return useSyncExternalStore(subscribe, snapshot, serverSnapshot);
}
