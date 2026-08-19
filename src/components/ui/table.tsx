import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Table({
  children,
  className,
  containerClassName,
}: {
  children: ReactNode;
  className?: string;
  containerClassName?: string;
}) {
  return (
    <div className={cn("overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--card)] shadow-[var(--shadow-sm)]", containerClassName)}>
      <div
        aria-label="Tableau défilable horizontalement"
        className="overflow-x-auto overscroll-x-contain focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--primary)]"
        role="region"
        tabIndex={0}
      >
        <table className={cn("w-full min-w-max border-collapse text-left text-sm text-[var(--foreground)]", className)}>{children}</table>
      </div>
    </div>
  );
}

export function Th({ children, className, ...props }: ComponentPropsWithoutRef<"th">) {
  return <th className={cn("whitespace-nowrap bg-[var(--surface-soft)] px-4 py-3 text-xs font-semibold uppercase tracking-[0.13em] text-[var(--muted)]", className)} {...props}>{children}</th>;
}

export function Td({ children, className, ...props }: ComponentPropsWithoutRef<"td"> & { children: ReactNode }) {
  return <td className={cn("border-t border-[var(--border-subtle)] px-4 py-3.5 align-middle text-[var(--foreground)]/90", className)} {...props}>{children}</td>;
}
