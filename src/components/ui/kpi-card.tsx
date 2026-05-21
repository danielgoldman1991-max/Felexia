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
  gold: "from-[#D6B56D]/22 text-[#D6B56D] ring-[#D6B56D]/20",
  cyan: "from-cyan-300/18 text-cyan-200 ring-cyan-300/20",
  success: "from-emerald-300/16 text-emerald-200 ring-emerald-300/20",
  warning: "from-amber-300/16 text-amber-200 ring-amber-300/20",
  danger: "from-red-300/16 text-red-200 ring-red-300/20",
  violet: "from-violet-300/16 text-violet-200 ring-violet-300/20",
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
    <section className={cn("premium-card luxury-border rounded-[var(--radius-lg)] p-5 transition duration-200 hover:-translate-y-0.5 hover:bg-white/[0.06]", className)}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="section-title">{label}</p>
          <div className="kpi-value mt-3">{value}</div>
        </div>
        {Icon ? (
          <span className={cn("flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br to-white/[0.035] ring-1", toneStyles[tone])}>
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
