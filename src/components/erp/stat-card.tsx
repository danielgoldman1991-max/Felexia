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
    <Card className="transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-md)]">
      <CardContent className="flex min-h-28 items-start justify-between">
        <div>
          <p className="text-sm font-medium text-[var(--muted)]">{title}</p>
          <div className="mt-2 text-2xl font-semibold tracking-normal text-[var(--foreground)]">{value}</div>
          {caption ? <p className="mt-2 text-xs text-[var(--muted)]">{caption}</p> : null}
        </div>
        {icon ? <div className="rounded-[var(--radius-md)] bg-[var(--primary-soft)] p-2 text-[var(--primary)]">{icon}</div> : null}
      </CardContent>
    </Card>
  );
}
