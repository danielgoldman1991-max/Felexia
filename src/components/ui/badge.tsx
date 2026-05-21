import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type BadgeProps = {
  children: ReactNode;
  tone?: "neutral" | "info" | "success" | "warning" | "danger";
  className?: string;
};

const tones = {
  neutral: "border-white/10 bg-white/[0.055] text-[var(--muted)]",
  info: "border-cyan-300/20 bg-cyan-300/10 text-cyan-200",
  success: "border-emerald-300/20 bg-emerald-300/10 text-emerald-200",
  warning: "border-amber-300/20 bg-amber-300/12 text-amber-200",
  danger: "border-red-300/20 bg-red-300/12 text-red-200",
};

export function Badge({ children, tone = "neutral", className }: BadgeProps) {
  return (
    <span className={cn("inline-flex rounded-full border px-2.5 py-1 text-xs font-medium", tones[tone], className)}>
      {children}
    </span>
  );
}
