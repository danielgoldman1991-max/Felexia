import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { ensureAccountingBaseSetup } from "@/lib/accounting";
import { requireActiveWorkspace } from "@/lib/auth";

export async function POST() {
  const workspace = await requireActiveWorkspace();
  try {
    await ensureAccountingBaseSetup(workspace.organization.id);
    revalidatePath("/comptabilite/plan-comptable");
    revalidatePath("/comptabilite/journaux");
  } catch {
    // silent fail - redirect anyway
  }
  redirect("/comptabilite/plan-comptable");
}
