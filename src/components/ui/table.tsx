import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Table({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--card)] shadow-[var(--shadow-sm)]", className)}>
      <table className="w-full border-collapse text-left text-sm text-[var(--foreground)]">{children}</table>
    </div>
  );
}

export function Th({ children, className }: { children?: ReactNode; className?: string }) {
  return <th className={cn("bg-[var(--surface-soft)] px-4 py-3 text-xs font-semibold uppercase tracking-[0.13em] text-[var(--muted)]", className)}>{children}</th>;
}

export function Td({ children, className }: { children: ReactNode; className?: string }) {
  return <td className={cn("border-t border-[var(--border-subtle)] px-4 py-3.5 align-middle text-[var(--foreground)]/90", className)}>{children}</td>;
}