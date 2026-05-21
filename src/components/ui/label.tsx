import type { ReactNode } from "react";

export function Label({ children, htmlFor, className }: { children: ReactNode; htmlFor?: string; className?: string }) {
  return (
    <label htmlFor={htmlFor} className={`text-sm font-medium text-[var(--foreground)] ${className ?? ""}`}>
      {children}
    </label>
  );
}
