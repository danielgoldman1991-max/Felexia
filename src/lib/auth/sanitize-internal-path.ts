/**
 * Sanitise un chemin de redirection interne (anti open-redirect).
 *
 * Règles :
 * - doit commencer par `/` ;
 * - ne doit pas commencer par `//` (schéma/protocole) ;
 * - ne doit pas contenir de caractère de contrôle ;
 * - fallback : "/dashboard".
 */
export function sanitizeInternalPath(path: string | null | undefined): string {
  if (
    typeof path !== "string" ||
    path.length === 0 ||
    !path.startsWith("/") ||
    path.startsWith("//") ||
    path.length > 4096 ||
    path.includes("\\") ||
    /[\u0000-\u001f\u007f]/.test(path)
  ) {
    return "/dashboard";
  }

  try {
    const url = new URL(path, "https://felexia.internal");
    const decodedPath = decodeURIComponent(url.pathname);
    if (url.origin !== "https://felexia.internal" || decodedPath.startsWith("//") || decodedPath.includes("\\") || /[\u0000-\u001f\u007f]/.test(decodedPath)) {
      return "/dashboard";
    }
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return "/dashboard";
  }
}
