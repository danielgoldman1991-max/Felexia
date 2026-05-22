import { createBrowserClient } from "@supabase/ssr";
import { requireSupabasePublicEnv } from "@/lib/env";

export function createClient() {
  const { supabaseUrl, supabaseAnonKey } = requireSupabasePublicEnv();

  return createBrowserClient(supabaseUrl, supabaseAnonKey);
}
