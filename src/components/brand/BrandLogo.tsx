import Image from "next/image";
import { ResponsiveImage } from "@/components/seo/ResponsiveImage";
import { cn } from "@/lib/utils";
import { BRAND } from "@/lib/brand";

const LOGO_ALT = "FelexiaERP, logiciel de gestion pour PME au Maroc";

export type BrandLogoProps = {
  variant?: "horizontal" | "mark";
  size?: "sm" | "md" | "lg" | "xl";
  showText?: boolean;
  className?: string;
  priority?: boolean;
  height?: number;
};

// Fixed, controlled sizes: the logo must NEVER render at its native PNG size.
// width = CSS width; maxHeight = hard cap so the logo can never blow up the layout.
const HORIZONTAL_SIZES: Record<
  NonNullable<BrandLogoProps["size"]>,
  { width: number; height: number; className: string }
> = {
  sm: { width: 165, height: 55, className: "w-[165px] max-h-[56px]" },
  md: { width: 200, height: 66, className: "w-[200px] max-h-[54px]" },
  lg: { width: 240, height: 80, className: "w-[240px] max-h-[66px]" },
  xl: { width: 260, height: 86, className: "w-[260px] max-h-[74px]" },
};

const MARK_SIZES: Record<NonNullable<BrandLogoProps["size"]>, number> = {
  sm: 36,
  md: 44,
  lg: 52,
  xl: 64,
};

const LOGO_ASPECT = 867 / 288;

export function BrandLogo({
  variant = "horizontal",
  size = "md",
  showText = false,
  className,
  priority = false,
  height,
}: BrandLogoProps) {
  if (variant === "mark") {
    const px = height ?? MARK_SIZES[size];
    return (
      <span className={cn("inline-flex shrink-0 items-center gap-2", className)}>
        <Image
          src={BRAND.logoMark}
          alt={LOGO_ALT}
          width={px}
          height={px}
          className="shrink-0 object-contain"
          unoptimized
          loading={priority ? "eager" : "lazy"}
        />
        {showText && (
          <span className="whitespace-nowrap text-base font-bold text-current">{BRAND.name}</span>
        )}
      </span>
    );
  }

  if (height !== undefined) {
    const width = Math.round(height * LOGO_ASPECT);
    return (
      <ResponsiveImage
        avif="/brand/felexiaerp-logo-horizontal.avif"
        webp="/brand/felexiaerp-logo-horizontal.webp"
        alt={LOGO_ALT}
        width={width}
        height={height}
        className={cn("block h-auto max-w-full shrink-0 object-contain", className)}
        style={{ width, height }}
        priority={priority}
      />
    );
  }

  const { width, height: displayHeight, className: sizeClassName } = HORIZONTAL_SIZES[size];
  return (
    <ResponsiveImage
      avif="/brand/felexiaerp-logo-horizontal.avif"
      webp="/brand/felexiaerp-logo-horizontal.webp"
      alt={LOGO_ALT}
      width={width}
      height={displayHeight}
      className={cn("block h-auto max-w-full shrink-0 object-contain", sizeClassName, className)}
      priority={priority}
    />
  );
}
