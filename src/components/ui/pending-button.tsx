"use client";

import { useFormStatus } from "react-dom";
import { Button, type ButtonProps } from "@/components/ui/button";

export function PendingButton({
  idle,
  pendingLabel,
  disabled,
  ...props
}: ButtonProps & { idle: string; pendingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={disabled || pending} aria-busy={pending} {...props}>
      {pending ? pendingLabel : idle}
    </Button>
  );
}
