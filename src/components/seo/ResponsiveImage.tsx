import type { CSSProperties } from "react";

type ResponsiveImageProps = {
  avif: string;
  webp: string;
  alt: string;
  width: number;
  height: number;
  className?: string;
  pictureClassName?: string;
  priority?: boolean;
  style?: CSSProperties;
};

/**
 * Local WebP/AVIF already sized for the layout. A raw img is intentional:
 * next/image would either preload the historical PNG or drop the AVIF source.
 */
export function ResponsiveImage({
  avif,
  webp,
  alt,
  width,
  height,
  className,
  pictureClassName,
  priority = false,
  style,
}: ResponsiveImageProps) {
  return (
    <picture className={pictureClassName}>
      <source srcSet={avif} type="image/avif" />
      <source srcSet={webp} type="image/webp" />
      <img
        src={webp}
        alt={alt}
        width={width}
        height={height}
        className={className}
        style={style}
        decoding="async"
        loading={priority ? "eager" : "lazy"}
      />
    </picture>
  );
}
