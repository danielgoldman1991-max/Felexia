import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

const COOKIE = "felexia_recovery";
const TTL_SECONDS = 600;

function signature(payload: string) {
  const key = process.env.RECOVERY_SIGNING_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("Recovery signing configuration is unavailable");
  return createHmac("sha256", key).update(payload).digest("hex");
}

export async function allowPasswordRecovery(userId: string) {
  const payload = `${userId}.${Date.now()}`;
  (await cookies()).set(COOKIE, `${payload}.${signature(payload)}`, {
    httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax",
    path: "/", maxAge: TTL_SECONDS,
  });
}

export async function canCompletePasswordRecovery(userId: string): Promise<boolean> {
  const value = (await cookies()).get(COOKIE)?.value;
  if (!value) return false;
  const [id, timestamp, signed, extra] = value.split(".");
  const issuedAt = Number(timestamp);
  if (extra || id !== userId || !Number.isFinite(issuedAt) || issuedAt > Date.now() || Date.now() - issuedAt > TTL_SECONDS * 1000 || !/^[a-f0-9]{64}$/.test(signed ?? "")) return false;
  try {
    return timingSafeEqual(Buffer.from(signed, "hex"), Buffer.from(signature(`${id}.${timestamp}`), "hex"));
  } catch { return false; }
}

export async function clearPasswordRecovery() {
  (await cookies()).delete(COOKIE);
}
