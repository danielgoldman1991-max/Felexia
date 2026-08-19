import type { ReactNode } from "react";

export function PrintHeader({ children }: { children: ReactNode }) {
  return <header className="print-header">{children}</header>;
}
