import {
  cloneElement,
  isValidElement,
  type ButtonHTMLAttributes,
  type ReactElement,
  type ReactNode,
} from "react";
import { cn } from "@/lib/utils";

const variants = {
  primary: "",
  secondary: "border",
  ghost: "",
  danger: "border",
  landingPrimary:
    "border border-[#174EA6] bg-[#1456B8] !text-white shadow-[0_10px_24px_rgba(20,86,184,0.24)] hover:bg-[#0F478F] hover:!text-white hover:shadow-[0_14px_30px_rgba(20,86,184,0.30)] focus-visible:ring-[#4A90E2]",
  landingSecondary:
    "border border-[#DCE3EF] bg-white !text-[#0F2548] shadow-sm hover:bg-[#F8FAFD] hover:!text-[#0F2548] focus-visible:ring-[#4A90E2]",
} as const;

type ButtonVariant = keyof typeof variants;

const buttonBase =
  "ui-button inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-[var(--radius-md)] text-sm font-semibold transition-[background-color,border-color,color,box-shadow] duration-150 disabled:cursor-not-allowed disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:cursor-not-allowed aria-disabled:opacity-50";

const landingBase =
  "relative isolate inline-flex items-center justify-center gap-2 overflow-hidden rounded-2xl text-sm font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:cursor-not-allowed aria-disabled:opacity-50";

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
    const child = children as ReactElement<{
      className?: string;
      children?: ReactNode;
      href?: string;
      title?: string;
      "aria-label"?: string;
      onClick?: (event: { preventDefault(): void; stopPropagation(): void }) => void;
      tabIndex?: number;
      "aria-disabled"?: ButtonHTMLAttributes<HTMLButtonElement>["aria-disabled"];
      "data-variant"?: ButtonVariant;
    }>;
    const { disabled, ...childCompatibleProps } = props;
    if (disabled) {
      return (
        <span
          className={cn(child.props.className, classes)}
          data-variant={variant}
          role={child.props.href ? "link" : undefined}
          aria-disabled="true"
          aria-label={props["aria-label"] ?? child.props["aria-label"]}
          title={props.title ?? child.props.title}
        >
          {child.props.children}
        </span>
      );
    }
    const childButtonOnClick = childCompatibleProps.onClick as unknown as typeof child.props.onClick;
    return cloneElement(child, {
      ...childCompatibleProps,
      className: cn(child.props.className, classes),
      "data-variant": variant,
      tabIndex: child.props.tabIndex,
      onClick: childButtonOnClick ?? child.props.onClick,
    });
  }

  return (
    <button className={classes} {...props} data-variant={variant}>
      {children}
    </button>
  );
}
