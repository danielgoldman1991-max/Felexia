import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  children: ReactNode;
};

const variants = {
  primary: "bg-gradient-to-r from-[#D6B56D] via-[#C9A85D] to-[#B8924F] text-[#08090d] shadow-[var(--shadow-gold)] hover:brightness-110",
  secondary: "border border-white/10 bg-white/[0.055] text-[var(--foreground)] shadow-[var(--shadow-sm)] backdrop-blur-xl hover:border-white/18 hover:bg-white/[0.09]",
  ghost: "text-[var(--muted)] hover:bg-white/[0.06] hover:text-[var(--foreground)]",
  danger: "border border-red-400/20 bg-red-500/14 text-red-200 shadow-[var(--shadow-sm)] hover:bg-red-500/22 hover:text-white",
};

export function Button({ className, variant = "primary", ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex h-10 items-center justify-center gap-2 rounded-[var(--radius-md)] px-4 text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)] disabled:cursor-not-allowed disabled:opacity-50",
        variants[variant],
        className,
      )}
      {...props}
    />
  );
}
