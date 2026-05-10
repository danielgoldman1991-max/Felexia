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
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <p className="text-sm font-medium text-slate-500">{title}</p>
          <p className="text-2xl font-bold tracking-tight text-slate-950">{value}</p>
        </div>
        <div className={cn("flex h-11 w-11 items-center justify-center rounded-2xl", positive ? "bg-green-50 text-green-600" : "bg-rose-50 text-rose-600")}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
      <div className="mt-5 flex items-center gap-2 text-sm">
        <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold", positive ? "bg-green-50 text-green-600" : "bg-rose-50 text-rose-600")}>
          <ArrowUpRight className="h-3.5 w-3.5" />
          {change}
        </span>
        <span className="truncate text-slate-500">{caption}</span>
      </div>
    </section>
  );
}
