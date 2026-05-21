import { forwardRef } from "react";
import type { InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return (
      <input
        ref={ref}
        className={cn(
          "h-10 w-full rounded-[var(--radius-md)] border border-white/10 bg-white/[0.045] px-3 text-sm text-[var(--foreground)] outline-none transition placeholder:text-[var(--muted-2)] focus:border-cyan-300/45 focus:ring-2 focus:ring-cyan-300/15",
          className,
        )}
        {...props}
      />
    );
  },
);
