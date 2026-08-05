import type { ComponentType, ReactNode } from "react";
import { ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";

type PremiumKpiCardProps = {
  label: string;
  value: ReactNode;
  caption?: string;
  icon?: ComponentType<{ className?: string }>;
  tone?: "gold" | "cyan" | "success" | "warning" | "danger" | "violet";
  className?: string;
};

const toneStyles = {
  gold: "bg-[var(--accent-soft)] text-[var(--accent)]",
  cyan: "bg-[var(--info-soft)] text-[var(--info)]",
  success: "bg-[var(--success-soft)] text-[var(--success)]",
  warning: "bg-[var(--warning-soft)] text-[var(--warning)]",
  danger: "bg-[var(--danger-soft)] text-[var(--danger)]",
  violet: "bg-[var(--violet-soft)] text-[var(--violet)]",
};

export function PremiumKpiCard({
  label,
  value,
  caption,
  icon: Icon,
  tone = "gold",
  className,
}: PremiumKpiCardProps) {
  return (
    <section className={cn("rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--card)] p-5 shadow-[var(--shadow-sm)] transition duration-200 hover:-translate-y-0.5 hover:shadow-[var(--shadow-md)]", className)}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="section-title">{label}</p>
          <div className="kpi-value mt-3">{value}</div>
        </div>
        {Icon ? (
          <span className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ring-1 ring-[var(--border)]", toneStyles[tone])}>
            <Icon className="h-5 w-5" />
          </span>
        ) : null}
      </div>
      {caption ? (
        <p className="mt-4 flex items-center gap-1 text-sm text-[var(--muted)]">
          <ArrowUpRight className="h-3.5 w-3.5 text-[var(--primary)]" />
          {caption}
        </p>
      ) : null}
    </section>
  );
}