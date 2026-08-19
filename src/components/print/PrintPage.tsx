import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function PrintPage({ children, className }: { children: ReactNode; className?: string }) {
  return <main className={cn("print-page", className)}>{children}</main>;
}
