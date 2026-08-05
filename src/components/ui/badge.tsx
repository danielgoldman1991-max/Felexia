import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type BadgeProps = {
  children: ReactNode;
  tone?: "neutral" | "info" | "success" | "warning" | "danger";
  className?: string;
};

const tones = {
  neutral: "border-[var(--border)] bg-[var(--surface-soft)] text-[var(--muted)]",
  info: "border-[color-mix(in_srgb,var(--info)_26%,transparent)] bg-[var(--info-soft)] text-[var(--info)]",
  success: "border-[color-mix(in_srgb,var(--success)_26%,transparent)] bg-[var(--success-soft)] text-[var(--success)]",
  warning: "border-[color-mix(in_srgb,var(--warning)_30%,transparent)] bg-[var(--warning-soft)] text-[var(--warning)]",
  danger: "border-[color-mix(in_srgb,var(--danger)_26%,transparent)] bg-[var(--danger-soft)] text-[var(--danger)]",
};

export function Badge({ children, tone = "neutral", className }: BadgeProps) {
  return (
    <span className={cn("inline-flex rounded-full border px-2.5 py-1 text-xs font-medium", tones[tone], className)}>
      {children}
    </span>
  );
}