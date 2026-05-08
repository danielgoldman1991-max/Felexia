import type { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <Card className="border-dashed bg-[linear-gradient(180deg,#fff_0%,#fbfcff_100%)]">
      <CardContent className="flex min-h-72 flex-col items-center justify-center text-center">
        <div className="mb-4 h-1.5 w-16 rounded-full bg-[linear-gradient(90deg,var(--primary),var(--accent))]" />
        <h2 className="text-lg font-semibold text-[var(--foreground)]">{title}</h2>
        <p className="mt-2 max-w-md text-sm leading-6 text-[var(--muted)]">{description}</p>
        {action ? <div className="mt-5">{action}</div> : null}
      </CardContent>
    </Card>
  );
}
