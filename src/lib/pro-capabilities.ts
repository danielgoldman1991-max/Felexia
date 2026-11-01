import "server-only";
import { createClient } from "@/lib/supabase/server";

/** Fail closed until the authenticated database confirms the PRO write guards. */
export async function hasProWriteCapabilities(organizationId: string): Promise<boolean> {
  if (!organizationId) return false;
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("erp_get_capabilities", { p_organization_id: organizationId });
    return !error && data?.workflow_version >= 104 && data?.pro_write_guards === true;
  } catch {
    return false;
  }
}
