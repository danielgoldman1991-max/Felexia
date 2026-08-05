import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  children: ReactNode;
};

const variants = {
  primary:
    "bg-[var(--primary)] text-[var(--primary-foreground)] shadow-[var(--shadow-sm)] hover:bg-[color-mix(in_srgb,var(--primary)_90%,black)] focus-visible:ring-[var(--ring)]",
  secondary:
    "border border-[var(--border)] bg-[var(--card)] text-[var(--foreground)] shadow-[var(--shadow-sm)] hover:bg-[var(--surface-soft)] hover:border-[var(--border-strong)]",
  ghost: "text-[var(--muted)] hover:bg-[var(--surface-soft)] hover:text-[var(--foreground)]",
  danger:
    "border border-[color-mix(in_srgb,var(--danger)_22%,transparent)] bg-[var(--danger-soft)] text-[var(--danger)] hover:bg-[color-mix(in_srgb,var(--danger-soft)_80%,var(--danger))]",
};

export function Button({ className, variant = "primary", ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex h-10 items-center justify-center gap-2 rounded-[var(--radius-md)] px-4 text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)] disabled:cursor-not-allowed disabled:opacity-50",
        variants[variant],
        className,
      )}
      {...props}
    />
  );
}