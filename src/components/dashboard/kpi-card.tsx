import type { ComponentType } from "react";
import { ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";

type KpiCardProps = {
  title: string;
  value: string;
  change: string;
  caption: string;
  tone: string;
  icon: ComponentType<{ className?: string }>;
};

export function KpiCard({ title, value, change, caption, tone, icon: Icon }: KpiCardProps) {
  const positive = tone === "success";
  return (
    <section className="premium-card luxury-border min-w-0 rounded-[var(--radius-lg)] p-5 transition hover:-translate-y-0.5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 space-y-2">
          <p className="section-title">{title}</p>
          <p className="break-words text-2xl font-semibold tracking-tight text-[var(--foreground)]">{value}</p>
        </div>
        <div className={cn("flex h-11 w-11 items-center justify-center rounded-2xl ring-1", positive ? "bg-[var(--success-soft)] text-[var(--success)] ring-[var(--border)]" : "bg-[var(--danger-soft)] text-[var(--danger)] ring-[var(--border)]")}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
      <div className="mt-5 flex items-center gap-2 text-sm">
        <span className={cn("inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold", positive ? "border-[var(--border)] bg-[var(--success-soft)] text-[var(--success)]" : "border-[var(--border)] bg-[var(--danger-soft)] text-[var(--danger)]")}>
          <ArrowUpRight className="h-3.5 w-3.5" />
          {change}
        </span>
        <span className="truncate text-[var(--muted)]">{caption}</span>
      </div>
    </section>
  );
}
