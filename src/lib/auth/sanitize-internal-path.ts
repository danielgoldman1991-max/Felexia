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
    path.includes("\u0000") ||
    path.includes("\r") ||
    path.includes("\n")
  ) {
    return "/dashboard";
  }

  return path;
}
