const LOCAL_APP_URL = "http://localhost:3000";

function normalizeAppUrl(value: string): string {
  return value.trim().replace(/\/+$/, "");
}

/**
 * Returns the single public base URL used by FelexiaERP.
 *
 * NEXT_PUBLIC_APP_URL is authoritative when configured (Production must use
 * https://felexia.pro). Vercel system URLs are server-side fallbacks. In a
 * browser Preview where those server-only variables are not exposed, callers
 * may provide window.location.origin as the runtime fallback.
 */
export function getAppUrl(runtimeOrigin?: string): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (configured) {
    return normalizeAppUrl(configured);
  }

  if (typeof window !== "undefined" && runtimeOrigin) {
    return normalizeAppUrl(runtimeOrigin);
  }

  const productionUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (productionUrl) {
    return `https://${normalizeAppUrl(productionUrl)}`;
  }

  const deploymentUrl = process.env.VERCEL_URL?.trim();
  if (deploymentUrl) {
    return `https://${normalizeAppUrl(deploymentUrl)}`;
  }

  if (runtimeOrigin) {
    return normalizeAppUrl(runtimeOrigin);
  }

  return LOCAL_APP_URL;
}
