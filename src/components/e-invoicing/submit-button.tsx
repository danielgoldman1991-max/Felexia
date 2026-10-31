"use client";

import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import type { EinvoiceLanguage } from "@/lib/e-invoicing/view-types";
import { einvoiceText as t } from "./presentation";

export function EinvoiceSubmit({ children, lang, variant = "primary", disabled = false }: { children: React.ReactNode; lang: EinvoiceLanguage; variant?: "primary" | "secondary" | "danger"; disabled?: boolean }) {
  const { pending } = useFormStatus();
  return <Button type="submit" variant={variant} disabled={disabled || pending}>{pending ? t(lang, "pending") : children}</Button>;
}
