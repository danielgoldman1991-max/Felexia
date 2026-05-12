import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { ensureDefaultChartOfAccounts } from "@/lib/accounting";
import { requireActiveWorkspace } from "@/lib/auth";

export async function POST() {
  const workspace = await requireActiveWorkspace();
  try {
    await ensureDefaultChartOfAccounts(workspace.organization.id);
    revalidatePath("/comptabilite/plan-comptable");
  } catch {
    // silent fail - redirect anyway
  }
  redirect("/comptabilite/plan-comptable");
}