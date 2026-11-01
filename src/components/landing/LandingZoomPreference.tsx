"use client";

import { useState } from "react";

// Only shown when the browser requests reduced motion. The visitor can opt in
// to this scroll-controlled effect without changing their device preferences.
export function LandingZoomPreference() {
  const [enabled, setEnabled] = useState(false);

  return (
    <button
      type="button"
      className="horizon-zoom-preference"
      aria-pressed={enabled}
      onClick={(event) => {
        const root = event.currentTarget.closest<HTMLElement>(".marketing-site");
        if (!root) return;
        const next = !enabled;
        if (next) root.dataset.horizonMotion = "enabled";
        else delete root.dataset.horizonMotion;
        setEnabled(next);
      }}
    >
      {enabled ? "Désactiver le zoom" : "Activer le zoom au défilement"}
    </button>
  );
}
