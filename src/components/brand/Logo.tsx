import { cn } from "@/lib/utils";

export type LogoProps = {
  size?: number;
  withText?: boolean;
  className?: string;
};

export function Logo({ size = 32, withText = false, className }: LogoProps) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="shrink-0"
        aria-hidden="true"
      >
        <circle cx="50" cy="50" r="48" fill="#000000" />
        <polygon points="50,22 78,72 22,72" fill="#ffffff" />
      </svg>
      {withText ? (
        <span
          className="font-bold tracking-tight"
          style={{ fontSize: Math.round(size * 0.4) }}
        >
          Felexia
        </span>
      ) : null}
    </div>
  );
}
