import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  children: ReactNode;
};

const variants = {
  primary: "bg-[var(--primary)] text-white shadow-[var(--shadow-sm)] hover:bg-[#6840dc]",
  secondary: "border border-[var(--border)] bg-white text-[var(--secondary)] shadow-[var(--shadow-sm)] hover:border-[#c8d0e1] hover:bg-[var(--surface-soft)]",
  ghost: "text-[var(--muted)] hover:bg-[var(--primary-soft)] hover:text-[var(--secondary)]",
  danger: "bg-[var(--danger)] text-white shadow-[var(--shadow-sm)] hover:bg-[#a92d4b]",
};

export function Button({ className, variant = "primary", ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex h-10 items-center justify-center gap-2 rounded-[var(--radius-md)] px-4 text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
        variants[variant],
        className,
      )}
      {...props}
    />
  );
}
