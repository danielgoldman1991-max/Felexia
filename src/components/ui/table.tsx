import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Table({
  children,
  className,
  containerClassName,
}: {
  children: ReactNode;
  className?: string;
  containerClassName?: string;
}) {
  return (
    <div className={cn("ui-table-shell min-w-0 overflow-hidden rounded-[var(--radius-lg)] border", containerClassName)}>
      <div
        aria-label="Tableau défilable horizontalement"
        className="ui-table-scroll overflow-x-auto overscroll-x-contain focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--primary)]"
        role="region"
        tabIndex={0}
      >
        <table className={cn("ui-table w-full min-w-max border-collapse text-left text-sm", className)}>{children}</table>
      </div>
    </div>
  );
}

export function Th({ children, className, ...props }: ComponentPropsWithoutRef<"th">) {
  return <th className={cn("ui-th whitespace-nowrap px-4 py-3 text-xs font-semibold tracking-[0.01em]", className)} {...props}>{children}</th>;
}

export function Td({ children, className, ...props }: ComponentPropsWithoutRef<"td"> & { children: ReactNode }) {
  return <td className={cn("ui-td border-t px-4 py-3.5 align-middle", className)} {...props}>{children}</td>;
}
