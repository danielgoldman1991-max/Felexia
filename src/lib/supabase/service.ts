import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { getEnv } from "@/lib/env";

export function createClient() {
  const env = getEnv();
  return createSupabaseClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
