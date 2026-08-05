import { BrandLogo } from "@/components/brand/BrandLogo";

export type LogoProps = {
  size?: number;
  withText?: boolean;
  className?: string;
};

export function Logo({ size = 32, withText = false, className }: LogoProps) {
  return withText ? (
    <BrandLogo variant="horizontal" height={size} className={className} />
  ) : (
    <BrandLogo variant="mark" height={size} className={className} />
  );
}

export { BrandLogo };
