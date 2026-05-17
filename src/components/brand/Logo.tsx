import Image from "next/image";
import { cn } from "@/lib/utils";
import { APP_BRAND } from "@/lib/brand";

export type LogoProps = {
  size?: number;
  withText?: boolean;
  className?: string;
};

export function Logo({ size = 32, withText = false, className }: LogoProps) {
  const src = withText ? APP_BRAND.logo : APP_BRAND.icon;
  const alt = withText ? APP_BRAND.logoAlt : APP_BRAND.name;

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Image
        src={src}
        alt={alt}
        width={size}
        height={size}
        className="shrink-0 object-contain"
        unoptimized
      />
    </div>
  );
}
