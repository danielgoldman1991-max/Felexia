import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--card)] shadow-[var(--shadow-sm)]", className)}>
      {children}
    </section>
  );
}

export function CardHeader({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("border-b border-[var(--border-subtle)] px-5 py-4", className)}>{children}</div>;
}

export function CardContent({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("p-5", className)}>{children}</div>;
}