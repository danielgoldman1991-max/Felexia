import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Table({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border)] bg-white shadow-[var(--shadow-sm)]", className)}>
      <table className="w-full border-collapse text-left text-sm text-[var(--foreground)]">{children}</table>
    </div>
  );
}

export function Th({ children }: { children?: ReactNode }) {
  return <th className="bg-[#f4f6fb] px-4 py-3 text-xs font-semibold uppercase tracking-[0.03em] text-[var(--muted)]">{children}</th>;
}

export function Td({ children, className }: { children: ReactNode; className?: string }) {
  return <td className={cn("border-t border-[var(--border)] px-4 py-3.5 align-middle", className)}>{children}</td>;
}
