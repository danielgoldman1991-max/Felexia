import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function PrintPage({ children, className, orientation = "portrait" }: { children: ReactNode; className?: string; orientation?: "portrait" | "landscape" }) {
  return <main className={cn("print-page", orientation === "landscape" && "print-page-landscape", className)}><div className="print-page-body">{children}</div></main>;
}
