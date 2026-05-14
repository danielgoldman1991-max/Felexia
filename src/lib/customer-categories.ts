import { createClient } from "@/lib/supabase/server";
import { requireActiveWorkspace } from "@/lib/auth";

export type CustomerCategory = {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  is_default: boolean;
  created_at: string;
  updated_at: string;
};

export async function listCustomerCategories(): Promise<CustomerCategory[]> {
  const workspace = await requireActiveWorkspace();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("customer_categories")
    .select("*")
    .eq("organization_id", workspace.organization.id)
    .order("name", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []) as CustomerCategory[];
}
