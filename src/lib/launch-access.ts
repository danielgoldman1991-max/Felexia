import "server-only";
import { cache } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

async function readCompletePlan(organizationId: string, client: SupabaseClient): Promise<boolean> {
  const { data, error } = await client.from("organization_subscriptions")
    .select("plan_code")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  // The durable Premium code now represents the public PRO offer. Keep full
  // reads after expiry; independent subscription guards protect every mutation.
  return !error && (data?.plan_code === "premium" || data?.plan_code === "pro");
}

const readCurrentCompletePlan = cache(async (organizationId: string) =>
  readCompletePlan(organizationId, await createClient()),
);

/** Server-owned PRO entitlement, with the existing operator overrides preserved. */
export async function hasFullErpAccess(organizationId: string, client?: SupabaseClient): Promise<boolean> {
  if (process.env.FELEXIA_ERP_MODE?.trim().toLowerCase() === "full") return true;
  if (!organizationId) return false;
  const enabledOrganizations = (process.env.FELEXIA_FULL_ERP_ORGANIZATION_IDS ?? "")
    .split(",")
    .map((id) => id.trim().toLowerCase())
    .filter(Boolean);
  if (enabledOrganizations.includes(organizationId.toLowerCase())) return true;
  try {
    return client
      ? await readCompletePlan(organizationId, client)
      : await readCurrentCompletePlan(organizationId);
  } catch {
    return false;
  }
}
