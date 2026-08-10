import { getAppUrl } from "../src/lib/app-url";

const CANONICAL_APP_URL = "https://felexia.pro";

type Check = {
  label: string;
  ok: boolean;
  detail?: string;
};

const appUrl = getAppUrl();
const callbackUrl = new URL("/auth/callback", `${appUrl}/`).toString();
const isProduction =
  process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production";

const checks: Check[] = [
  {
    label: "NEXT_PUBLIC_APP_URL present",
    ok: Boolean(process.env.NEXT_PUBLIC_APP_URL?.trim()),
  },
  {
    label: `NEXT_PUBLIC_APP_URL = ${CANONICAL_APP_URL}`,
    ok: appUrl === CANONICAL_APP_URL,
    detail: `resolved=${appUrl}`,
  },
  {
    label: "NEXT_PUBLIC_SUPABASE_URL present",
    ok: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()),
  },
  {
    label: "NEXT_PUBLIC_SUPABASE_ANON_KEY present",
    ok: Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()),
    detail: "NEXT_PUBLIC_SUPABASE_ANON_KEY=PRESENT",
  },
  {
    label: "production app URL uses HTTPS",
    ok: appUrl.startsWith("https://"),
  },
  {
    label: "callback URL calculated",
    ok: callbackUrl === `${CANONICAL_APP_URL}/auth/callback`,
    detail: callbackUrl,
  },
  {
    label: "no localhost value in production",
    ok: !isProduction || !appUrl.includes("localhost"),
  },
];

for (const check of checks) {
  const marker = check.ok ? "✓" : "✗";
  const safeDetail = check.detail ? ` (${check.detail})` : "";
  console.log(`${marker} ${check.label}${safeDetail}`);
}

if (checks.some((check) => !check.ok)) {
  console.error("Production configuration check failed.");
  process.exit(1);
}

console.log("Production configuration is valid. Secrets were not displayed.");
