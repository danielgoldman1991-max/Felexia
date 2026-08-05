import {
  cloneElement,
  isValidElement,
  type ButtonHTMLAttributes,
  type ReactElement,
  type ReactNode,
} from "react";
import { cn } from "@/lib/utils";

const variants = {
  primary:
    "bg-[var(--primary)] text-[var(--primary-foreground)] shadow-[var(--shadow-sm)] hover:bg-[color-mix(in_srgb,var(--primary)_90%,black)] focus-visible:ring-[var(--ring)]",
  secondary:
    "border border-[var(--border)] bg-[var(--card)] text-[var(--foreground)] shadow-[var(--shadow-sm)] hover:bg-[var(--surface-soft)] hover:border-[var(--border-strong)]",
  ghost: "text-[var(--muted)] hover:bg-[var(--surface-soft)] hover:text-[var(--foreground)]",
  danger:
    "border border-[color-mix(in_srgb,var(--danger)_22%,transparent)] bg-[var(--danger-soft)] text-[var(--danger)] hover:bg-[color-mix(in_srgb,var(--danger-soft)_80%,var(--danger))]",
  landingPrimary:
    "border border-[#174EA6] bg-[#1456B8] !text-white shadow-[0_10px_24px_rgba(20,86,184,0.24)] hover:bg-[#0F478F] hover:!text-white hover:shadow-[0_14px_30px_rgba(20,86,184,0.30)] focus-visible:ring-[#4A90E2]",
  landingSecondary:
    "border border-[#DCE3EF] bg-white !text-[#0F2548] shadow-sm hover:bg-[#F8FAFD] hover:!text-[#0F2548] focus-visible:ring-[#4A90E2]",
} as const;

type ButtonVariant = keyof typeof variants;

const buttonBase =
  "inline-flex h-10 items-center justify-center gap-2 rounded-[var(--radius-md)] px-4 text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)] disabled:cursor-not-allowed disabled:opacity-50";

const landingBase =
  "relative isolate inline-flex items-center justify-center gap-2 overflow-hidden rounded-2xl text-sm font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50";

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  asChild?: boolean;
  children?: ReactNode;
};

export function Button({
  className,
  variant = "primary",
  asChild = false,
  children,
  ...props
}: ButtonProps) {
  const isLanding = variant === "landingPrimary" || variant === "landingSecondary";
  const classes = cn(isLanding ? landingBase : buttonBase, variants[variant], className);

  if (asChild && isValidElement(children)) {
    const child = children as ReactElement<{ className?: string }>;
    return cloneElement(child, {
      ...props,
      className: cn(child.props.className, classes),
    });
  }

  return (
    <button className={classes} {...props}>
      {children}
    </button>
  );
}
