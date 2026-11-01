import { z } from "zod";
import { getAppUrl } from "@/lib/app-url";

export const MAX_SUPPORT_BODY_BYTES = 65_536;
export const MAX_SUPPORT_USER_CHARACTERS = 2_000;
export const MAX_SUPPORT_ASSISTANT_CHARACTERS = 6_000;
export const MAX_SUPPORT_MESSAGES = 11;
export const MAX_SUPPORT_CONVERSATION_CHARACTERS = 16_000;

export class SupportRequestError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "SupportRequestError";
  }
}

const messageSchema = z.discriminatedUnion("role", [
  z.object({
    role: z.literal("user"),
    content: z.string().trim().min(1).max(MAX_SUPPORT_USER_CHARACTERS),
  }).strict(),
  z.object({
    role: z.literal("assistant"),
    content: z.string().trim().min(1).max(MAX_SUPPORT_ASSISTANT_CHARACTERS),
  }).strict(),
]);

const requestSchema = z.object({
  requestId: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9_-]{15,79}$/),
  messages: z.array(messageSchema).min(1).max(MAX_SUPPORT_MESSAGES),
}).strict();

export type SupportRequest = z.infer<typeof requestSchema>;

/** Only conversation text is accepted; callers cannot supply system prompts or tools. */
export function parseSupportRequest(body: unknown): SupportRequest {
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    throw new SupportRequestError(400, "INVALID_REQUEST", "La conversation est invalide ou trop longue. Raccourcissez votre message et réessayez.");
  }
  const messages = parsed.data.messages;
  const rolesAreValid = messages.length % 2 === 1
    && messages.every((message, index) => message.role === (index % 2 === 0 ? "user" : "assistant"));
  if (!rolesAreValid) {
    throw new SupportRequestError(400, "INVALID_CONVERSATION", "La conversation est invalide. Ouvrez une nouvelle discussion et réessayez.");
  }
  if (messages.reduce((total, message) => total + message.content.length, 0) > MAX_SUPPORT_CONVERSATION_CHARACTERS) {
    throw new SupportRequestError(400, "CONVERSATION_TOO_LONG", "La conversation est trop longue. Ouvrez une nouvelle discussion pour continuer.");
  }
  return parsed.data;
}

function exactOrigin(value: string): URL | null {
  try {
    const url = new URL(value);
    return (url.protocol === "https:" || url.protocol === "http:") && value === url.origin ? url : null;
  } catch {
    return null;
  }
}

function isLoopback(hostname: string): boolean {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";
}

/** This limits browser cross-site use; it does not replace authentication or rate limits. */
export function checkSupportOrigin(request: Request): void {
  const fail = () => { throw new SupportRequestError(403, "ORIGIN_NOT_ALLOWED", "Cette demande doit être envoyée depuis le site Felexia."); };
  const origin = exactOrigin(request.headers.get("origin") ?? "");
  if (!origin || request.headers.get("sec-fetch-site") === "cross-site") return fail();
  const requestUrl = new URL(request.url);
  const allowed = new Set([requestUrl.origin]);

  // A local fallback in getAppUrl must never authorize localhost against production.
  try {
    const configured = new URL(getAppUrl());
    if (!isLoopback(configured.hostname) || isLoopback(requestUrl.hostname)) allowed.add(configured.origin);
  } catch { /* A bad optional URL must not broaden the accepted origins. */ }

  if (process.env.VERCEL_ENV === "production" || ["felexia.pro", "www.felexia.pro"].includes(requestUrl.hostname)) {
    allowed.add("https://felexia.pro");
    allowed.add("https://www.felexia.pro");
  }
  if (!allowed.has(origin.origin)) return fail();
}

/** Read the actual stream before parsing; Content-Length alone is not a size boundary. */
export async function readSupportBody(request: Request): Promise<unknown> {
  if (request.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase() !== "application/json") {
    throw new SupportRequestError(415, "JSON_REQUIRED", "Envoyez votre demande au format JSON.");
  }
  const declaredLength = request.headers.get("content-length");
  if (declaredLength !== null && !/^\d+$/.test(declaredLength)) {
    throw new SupportRequestError(400, "INVALID_CONTENT_LENGTH", "La demande est invalide.");
  }
  if (declaredLength !== null && Number(declaredLength) > MAX_SUPPORT_BODY_BYTES) {
    throw new SupportRequestError(413, "BODY_TOO_LARGE", "La demande est trop volumineuse. Raccourcissez votre message.");
  }
  if (!request.body) throw new SupportRequestError(400, "INVALID_JSON", "La demande est vide.");

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  let onAbort: () => void = () => {};
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const stopped = new Promise<never>((_, reject) => {
    onAbort = () => reject(new SupportRequestError(408, "REQUEST_INTERRUPTED", "La demande a été interrompue. Réessayez."));
    request.signal.addEventListener("abort", onAbort, { once: true });
    timeout = setTimeout(() => reject(new SupportRequestError(408, "BODY_TIMEOUT", "La réception de la demande a pris trop de temps. Réessayez.")), 8_000);
  });
  try {
    if (request.signal.aborted) onAbort();
    while (true) {
      const { done, value } = await Promise.race([reader.read(), stopped]);
      if (done) break;
      total += value.byteLength;
      if (total > MAX_SUPPORT_BODY_BYTES) {
        throw new SupportRequestError(413, "BODY_TOO_LARGE", "La demande est trop volumineuse. Raccourcissez votre message.");
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    try {
      return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
    } catch {
      throw new SupportRequestError(400, "INVALID_JSON", "La demande JSON est invalide.");
    }
  } catch (error) {
    void reader.cancel().catch(() => undefined);
    if (error instanceof SupportRequestError) throw error;
    throw new SupportRequestError(400, "BODY_READ_FAILED", "La demande n’a pas pu être lue. Réessayez.");
  } finally {
    clearTimeout(timeout);
    request.signal.removeEventListener("abort", onAbort);
    reader.releaseLock();
  }
}

export type SupportRateLimitResult = { allowed: boolean; retryAfter: number };

/**
 * Bounded, synchronous rolling-window protection for one server instance.
 * It is a first line of defense, not a distributed quota or a monetary budget.
 * The caller supplies an opaque key (for example a server-side hash), never raw logs.
 */
export function createSupportRateLimiter(): (key: string, now?: number) => SupportRateLimitResult {
  const minute = 60_000;
  const hour = 60 * minute;
  const entries = new Map<string, number[]>();
  let globalRequests: number[] = [];
  let lastCleanup = -Infinity;
  const denied = (milliseconds: number): SupportRateLimitResult => ({ allowed: false, retryAfter: Math.max(1, Math.ceil(milliseconds / 1_000)) });

  return (key, requestedNow = Date.now()) => {
    const now = Number.isFinite(requestedNow) ? requestedNow : Date.now();
    if (!key || key.length > 256) return denied(minute);
    globalRequests = globalRequests.filter((time) => time > now - minute);
    if (globalRequests.length >= 120) return denied(globalRequests[0] + minute - now);

    if (now - lastCleanup >= minute) {
      for (const [entryKey, timestamps] of entries) {
        if (timestamps[timestamps.length - 1] <= now - hour) entries.delete(entryKey);
      }
      lastCleanup = now;
    }
    const previous = entries.get(key);
    if (!previous && entries.size >= 5_000) return denied(lastCleanup + minute - now);
    const timestamps = (previous ?? []).filter((time) => time > now - hour);
    if (timestamps.length >= 40) return denied(timestamps[0] + hour - now);
    const recent = timestamps.filter((time) => time > now - minute);
    if (recent.length >= 8) return denied(recent[0] + minute - now);

    timestamps.push(now);
    entries.set(key, timestamps);
    globalRequests.push(now);
    return { allowed: true, retryAfter: 0 };
  };
}

export const checkSupportRateLimit = createSupportRateLimiter();
