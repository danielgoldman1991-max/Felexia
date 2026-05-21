import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function PageShell({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("space-y-6", className)}>{children}</div>;
}

export function PremiumSection({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={cn("premium-card rounded-[var(--radius-lg)] p-5", className)}>{children}</section>;
}
