export const GUIDE_ACCESS_KEY = "felexia:guide-access:v1";

type Memory = Pick<Storage, "getItem" | "setItem">;

function browserStorage(): Memory | null {
  try {
    if (typeof localStorage === "undefined") return null;
    return localStorage;
  } catch {
    return null;
  }
}

type Store = { v: 1; grants: Record<string, { token: string }> };

function readStore(storage: Memory): Store {
  try {
    const raw = storage.getItem(GUIDE_ACCESS_KEY);
    if (!raw) return { v: 1, grants: {} };
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return { v: 1, grants: {} };
    const record = parsed as { v?: unknown; grants?: unknown };
    if (record.v !== 1 || !record.grants || typeof record.grants !== "object") return { v: 1, grants: {} };
    const grants: Record<string, { token: string }> = {};
    for (const [slug, value] of Object.entries(record.grants as Record<string, unknown>)) {
      if (!value || typeof value !== "object") continue;
      const token = (value as { token?: unknown }).token;
      if (typeof token === "string" && token.length >= 20 && token.length <= 200) grants[slug] = { token };
    }
    return { v: 1, grants };
  } catch {
    return { v: 1, grants: {} };
  }
}

export function readGuideGrant(slug: string, storage: Memory | null = browserStorage()): string | null {
  if (!storage) return null;
  return readStore(storage).grants[slug]?.token ?? null;
}

export function writeGuideGrant(slug: string, token: string, storage: Memory | null = browserStorage()): void {
  if (!storage || token.length < 20) return;
  const current = readStore(storage);
  current.grants[slug] = { token };
  storage.setItem(GUIDE_ACCESS_KEY, JSON.stringify(current));
}

export function clearGuideGrant(slug: string, storage: Memory | null = browserStorage()): void {
  if (!storage) return;
  const current = readStore(storage);
  delete current.grants[slug];
  storage.setItem(GUIDE_ACCESS_KEY, JSON.stringify(current));
}
