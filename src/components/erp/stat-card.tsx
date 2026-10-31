import type { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";

export function StatCard({
  title,
  value,
  caption,
  icon,
}: {
  title: string;
  value: ReactNode;
  caption?: string;
  icon?: ReactNode;
}) {
  return (
    <Card className="erp-stat-card">
      <CardContent className="flex min-h-28 items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="erp-stat-label text-xs font-medium leading-5 text-[var(--muted)]">{title}</p>
          <div className="erp-stat-value mt-2 text-[1.75rem] font-semibold leading-tight tracking-[-0.035em] text-[var(--foreground)]">{value}</div>
          {caption ? <p className="mt-2 text-xs leading-5 text-[var(--muted)]">{caption}</p> : null}
        </div>
        {icon ? <div className="erp-stat-icon flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-[var(--primary-soft)] text-[var(--primary)]">{icon}</div> : null}
      </CardContent>
    </Card>
  );
}
