/** Public marketing routes only. Safe to import from server or client code. */
export const PUBLIC_SITE_ORIGIN = "https://www.felexia.pro";

export const PUBLIC_SITE_PATHS = [
  "/",
  "/essentiel",
  "/pro",
  "/pricing",
  "/mentions-legales",
  "/conditions",
  "/confidentialite",
] as const;

/** Accept a pathname, never a full URL, query, fragment or private child route. */
export function isPublicSitePath(pathname: string): boolean {
  if (!pathname.startsWith("/") || pathname.startsWith("//") || /[\\?#]/.test(pathname)) return false;
  const normalized = pathname.replace(/\/+$/, "") || "/";
  return PUBLIC_SITE_PATHS.some((path) => path === normalized);
}
