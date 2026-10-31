import type { TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "ui-textarea min-h-28 w-full min-w-0 rounded-[var(--radius-md)] border px-3 py-2.5 text-sm leading-6 transition-[background-color,border-color,box-shadow] duration-150 disabled:cursor-not-allowed disabled:opacity-60",
        className,
      )}
      {...props}
    />
  );
}
