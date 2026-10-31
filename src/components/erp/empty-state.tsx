import type { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Inbox } from "lucide-react";

export function EmptyState({
  title,
  description,
  action,
  icon,
}: {
  title: string;
  description: string;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <Card className="erp-empty-state">
      <CardContent className="flex min-h-60 flex-col items-center justify-center px-6 py-10 text-center sm:py-12">
        <div aria-hidden="true" className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] text-[var(--primary)] [&_svg]:h-5 [&_svg]:w-5">{icon ?? <Inbox />}</div>
        <h2 className="text-base font-semibold tracking-[-0.015em] text-[var(--foreground)]">{title}</h2>
        <p className="mt-2 max-w-md text-sm leading-6 text-[var(--muted)]">{description}</p>
        {action ? <div className="mt-5">{action}</div> : null}
      </CardContent>
    </Card>
  );
}
