import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { getClientIp } from "@/lib/rate-limit";
import { answerSupportQuestion, isSupportAiEnabled, type SupportReply } from "@/lib/support/assistant";
import { checkSupportOrigin, checkSupportRateLimit, parseSupportRequest, readSupportBody, SupportRequestError } from "@/lib/support/request-policy";

export const runtime = "nodejs";
export const maxDuration = 45;
const headers = { "Cache-Control": "no-store, max-age=0", "X-Content-Type-Options": "nosniff" };
type PendingReply = { fingerprint: string; expires: number; value: Promise<SupportReply> };
const recentRequests = new Map<string, PendingReply>();
const activeVisitors = new Set<string>();

export function GET() {
  return NextResponse.json({ available: true, aiAvailable: isSupportAiEnabled() }, { headers });
}

export async function POST(request: Request) {
  try {
    checkSupportOrigin(request);
    const visitor = createHash("sha256").update(getClientIp(request)).digest("hex");
    const limit = checkSupportRateLimit(visitor);
    if (!limit.allowed) return NextResponse.json({ error: "Vous avez envoyé plusieurs questions. Réessayez dans quelques instants.", code: "RATE_LIMITED", retryAfter: limit.retryAfter }, { status: 429, headers: { ...headers, "Retry-After": String(limit.retryAfter) } });
    const body = parseSupportRequest(await readSupportBody(request));
    const fingerprint = createHash("sha256").update(JSON.stringify(body.messages)).digest("hex");
    const key = `${visitor}:${body.requestId}`;
    const now = Date.now();
    for (const [id, entry] of recentRequests) if (entry.expires < now) recentRequests.delete(id);
    const existing = recentRequests.get(key);
    if (existing) {
      if (existing.fingerprint !== fingerprint) throw new SupportRequestError(409, "REQUEST_ID_REUSED", "Cette demande a changé. Envoyez un nouveau message.");
      return NextResponse.json(await existing.value, { headers });
    }
    if (activeVisitors.has(visitor) || recentRequests.size >= 2_000) return NextResponse.json({ error: "Une réponse est déjà en préparation. Réessayez dans quelques instants.", code: "REQUEST_IN_PROGRESS", retryAfter: 5 }, { status: 429, headers: { ...headers, "Retry-After": "5" } });
    activeVisitors.add(visitor);
    const value = answerSupportQuestion(body, request.signal).finally(() => activeVisitors.delete(visitor));
    recentRequests.set(key, { fingerprint, expires: now + 120_000, value });
    try { return NextResponse.json(await value, { headers }); }
    catch (error) { recentRequests.delete(key); throw error; }
  } catch (error) {
    if (error instanceof SupportRequestError) return NextResponse.json({ error: error.message, code: error.code }, { status: error.status, headers });
    if (request.signal.aborted) return NextResponse.json({ error: "La demande a été interrompue.", code: "REQUEST_INTERRUPTED" }, { status: 408, headers });
    return NextResponse.json({ error: "La réponse n’a pas pu aboutir. Réessayez ou contactez notre équipe.", code: "SUPPORT_UNAVAILABLE" }, { status: 503, headers });
  }
}
