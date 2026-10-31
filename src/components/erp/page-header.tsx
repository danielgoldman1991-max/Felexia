import type { ReactNode } from "react";

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="erp-page-header flex min-w-0 flex-col items-start justify-between gap-4 md:flex-row">
      <div className="min-w-0">
        <h1 className="erp-page-title text-2xl font-semibold leading-tight tracking-[-0.035em] text-[var(--foreground)] md:text-[1.75rem]">{title}</h1>
        {description ? <p className="erp-page-description mt-2 max-w-2xl text-sm leading-6 text-[var(--muted)]">{description}</p> : null}
      </div>
      {actions ? <div className="erp-page-actions flex max-w-full shrink-0 flex-wrap items-center gap-2 md:self-center">{actions}</div> : null}
    </header>
  );
}
