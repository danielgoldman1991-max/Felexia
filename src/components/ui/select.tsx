import type { SelectHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Select({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        "h-10 w-full rounded-[var(--radius-md)] border border-white/10 bg-white/[0.045] px-3 text-sm text-[var(--foreground)] outline-none transition focus:border-cyan-300/45 focus:ring-2 focus:ring-cyan-300/15",
        className,
      )}
      {...props}
    >
      {children}
    </select>
  );
}
