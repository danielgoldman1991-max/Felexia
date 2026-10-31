"use client";

import type { ReactNode } from "react";

/** Server authorization remains authoritative; this explains an issuance lock. */
export function EinvoiceOperationForm({ action, confirmation, children }: { action: (formData: FormData) => Promise<void>; confirmation: string; children: ReactNode }) {
  return <form action={action} onSubmit={(event) => { if (!window.confirm(confirmation)) event.preventDefault(); }}>{children}</form>;
}
