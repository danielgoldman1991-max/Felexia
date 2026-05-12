import { createClient } from "@/lib/supabase/server";
import { requireActiveWorkspace } from "@/lib/auth";

const PLAN_MODULES: Record<string, string[]> = {
  starter: ["dashboard", "clients", "invoicing"],
  essentiel: ["dashboard", "clients", "invoicing", "accounting", "treasury"],
  pro: ["dashboard", "clients", "suppliers", "invoicing", "accounting", "treasury", "purchases", "stock"],
};

export function planAllowsModule(planSlug: string, module: string): boolean {
  const modules = PLAN_MODULES[planSlug] ?? PLAN_MODULES["starter"];
  return modules.includes(module);
}

export async function requireModuleAccess(moduleCode: string): Promise<void> {
  const workspace = await requireActiveWorkspace();
  const planSlug = workspace.subscription?.planSlug ?? "starter";
  if (!planAllowsModule(planSlug, moduleCode)) {
    const { redirect } = await import("next/navigation");
    redirect("/parametres/abonnement");
  }
}

export async function checkUserLimit(): Promise<{ allowed: boolean; current: number; max: number }> {
  const workspace = await requireActiveWorkspace();
  const maxMembers = workspace.subscription?.planSlug === "starter" ? 3
    : workspace.subscription?.planSlug === "essentiel" ? 10
    : workspace.subscription?.planSlug === "pro" ? 25
    : 1;

  const supabase = await createClient();
  const { count } = await supabase
    .from("organization_members")
    .select("*", { count: "exact", head: true })
    .eq("organization_id", workspace.organization.id)
    .eq("status", "active");

  const current = count ?? 0;
  return { allowed: current < maxMembers, current, max: maxMembers };
}
