import { getAppUrl } from "@/lib/app-url";

export function getSupabasePublicKey(): string {
  return process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
    ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    ?? "";
}

export function requireSupabasePublicEnv() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const supabaseAnonKey = getSupabasePublicKey();

  if (!supabaseUrl) {
    throw new Error("Missing environment variable: NEXT_PUBLIC_SUPABASE_URL");
  }

  if (!supabaseAnonKey) {
    throw new Error(
      "Missing environment variable: NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY",
    );
  }

  return { supabaseUrl, supabaseAnonKey };
}

export function getEnv() {
  return {
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    supabaseAnonKey: getSupabasePublicKey(),
    supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    stripeSecretKey: process.env.STRIPE_SECRET_KEY ?? "",
    stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET ?? "",
    stripePublishableKey: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "",
    appUrl: getAppUrl(),
  };
}

export function hasRequiredEnv(): boolean {
  const env = getEnv();
  return Boolean(env.supabaseUrl && env.supabaseAnonKey);
}

export function hasStripeEnv(): boolean {
  const env = getEnv();
  return Boolean(env.stripeSecretKey && env.stripeWebhookSecret && env.stripePublishableKey);
}

export function hasServiceRoleKey(): boolean {
  return Boolean(getEnv().supabaseServiceRoleKey);
}
