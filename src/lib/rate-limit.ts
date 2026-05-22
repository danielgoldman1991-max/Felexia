/**
 * Simple in-memory IP-based rate limiter for API routes.
 * Not distributed — suitable for single-instance deployments
 * or as a first line of defense before persistent rate limits.
 *
 * For multi-instance / production scale, replace with Redis or
 * the existing Supabase-based `company_lookup_rate_limits` table.
 */

export type RateLimitEntry = {
  count: number;
  windowStart: number;
};

const store = new Map<string, RateLimitEntry>();

/**
 * Check if an IP is allowed to make a request.
 * @param key      identifier (IP address or userId)
 * @param max      max requests per window
 * @param windowMs window duration in milliseconds
 */
export function isRateLimited(key: string, max = 1, windowMs = 30_000): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  const entry = store.get(key);

  if (!entry) {
    store.set(key, { count: 1, windowStart: now });
    return { allowed: true, remaining: max - 1, resetAt: now + windowMs };
  }

  if (now - entry.windowStart > windowMs) {
    // Window expired → reset
    store.set(key, { count: 1, windowStart: now });
    return { allowed: true, remaining: max - 1, resetAt: now + windowMs };
  }

  if (entry.count >= max) {
    return { allowed: false, remaining: 0, resetAt: entry.windowStart + windowMs };
  }

  entry.count += 1;
  return { allowed: true, remaining: max - entry.count, resetAt: entry.windowStart + windowMs };
}

/**
 * Get client IP from a Next.js request.
 * Falls back to a hashed forwarded header.
 */
export function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp;
  // Fallback: not ideal but prevents complete breakage
  return "unknown";
}

/**
 * Clean up expired entries (optional, call periodically).
 */
export function cleanupExpiredRateLimits(windowMs = 30_000): void {
  const now = Date.now();
  for (const [key, entry] of store.entries()) {
    if (now - entry.windowStart > windowMs * 2) {
      store.delete(key);
    }
  }
}
