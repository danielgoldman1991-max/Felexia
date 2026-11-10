"use client";

import { useEffect, useRef, type ReactNode, type RefObject } from "react";
import { cn } from "@/lib/utils";

type FormDialogProps = {
  open: boolean;
  onDismiss: () => void;
  labelledBy: string;
  describedBy?: string;
  pending?: boolean;
  initialFocusRef?: RefObject<HTMLElement | null>;
  className?: string;
  children: ReactNode;
};

export function FormDialog({ open, onDismiss, labelledBy, describedBy, pending = false, initialFocusRef, className, children }: FormDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!open || !dialog) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (!dialog.open) dialog.showModal();
    initialFocusRef?.current?.focus({ preventScroll: true });

    return () => {
      if (dialog.open) dialog.close();
      if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
    };
  }, [open, initialFocusRef]);

  return (
    <dialog
      ref={dialogRef}
      className={cn("erp-form-dialog", className)}
      aria-modal="true"
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      aria-busy={pending || undefined}
      tabIndex={-1}
      onCancel={(event) => {
        event.preventDefault();
        if (!pending) onDismiss();
      }}
      onKeyDown={(event) => {
        if (event.key === "Tab" && !event.defaultPrevented) {
          const dialog = event.currentTarget;
          const focusable = Array.from(dialog.querySelectorAll<HTMLElement>("a[href], button, input, select, textarea, [tabindex]"))
            .filter((element) => element.tabIndex >= 0
              && !element.matches(':disabled, [aria-disabled="true"]')
              && !element.closest("[hidden], [inert]")
              && element.getClientRects().length > 0
              && getComputedStyle(element).visibility !== "hidden");
          const first = focusable[0];
          const last = focusable.at(-1);
          if (!first || !last) {
            event.preventDefault();
            dialog.focus();
          } else if (!focusable.includes(document.activeElement as HTMLElement)
            || (event.shiftKey ? document.activeElement === first : document.activeElement === last)) {
            event.preventDefault();
            (event.shiftKey ? last : first).focus();
          }
          return;
        }
        // These dialogs can be inside a commercial form. Enter in a modal field
        // must not implicitly submit that surrounding document.
        if (event.key === "Enter" && event.target instanceof HTMLInputElement && !["button", "submit", "reset"].includes(event.target.type)) {
          event.preventDefault();
          event.stopPropagation();
        }
      }}
    >
      {children}
    </dialog>
  );
}
