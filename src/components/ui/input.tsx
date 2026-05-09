import { forwardRef } from "react";
import type { InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return (
      <input
        ref={ref}
        className={cn(
          "h-10 w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-white px-3 text-sm text-[var(--foreground)] outline-none transition placeholder:text-[#98a2b8] focus:border-[var(--primary)] focus:ring-2 focus:ring-[rgb(124_79_242_/_16%)]",
          className,
        )}
        {...props}
      />
    );
  },
);
