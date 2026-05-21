import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Table({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("overflow-hidden rounded-[var(--radius-lg)] border border-white/10 bg-white/[0.025] shadow-[var(--shadow-sm)] backdrop-blur-xl", className)}>
      <table className="w-full border-collapse text-left text-sm text-[var(--foreground)]">{children}</table>
    </div>
  );
}

export function Th({ children, className }: { children?: ReactNode; className?: string }) {
  return <th className={cn("bg-white/[0.045] px-4 py-3 text-xs font-semibold uppercase tracking-[0.13em] text-[var(--muted)]", className)}>{children}</th>;
}

export function Td({ children, className }: { children: ReactNode; className?: string }) {
  return <td className={cn("border-t border-white/8 px-4 py-3.5 align-middle text-[var(--foreground)]/90", className)}>{children}</td>;
}
