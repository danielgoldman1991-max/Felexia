"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireActiveWorkspace } from "@/lib/auth";

export type PrefsState = { error: string | null; success: boolean };

export async function updatePreferencesAction(
  _prev: PrefsState,
  formData: FormData,
): Promise<PrefsState> {
  try {
    const workspace = await requireActiveWorkspace();
    const getVal = (key: string): string => {
      const v = formData.get(key);
      return typeof v === "string" && v.trim() ? v.trim() : "";
    };
    const getBool = (key: string): boolean => formData.get(key) === "on";
    const getInt = (key: string, def: number): number => {
      const v = formData.get(key);
      return typeof v === "string" && v.trim() ? parseInt(v, 10) || def : def;
    };

    const data = {
      user_id: workspace.userId,
      organization_id: workspace.organization.id,
      language: getVal("language") || "fr",
      currency: getVal("currency") || "MAD",
      date_format: getVal("date_format") || "DD/MM/YYYY",
      timezone: getVal("timezone") || "Africa/Casablanca",
      theme: getVal("theme") || "system",
      rows_per_page: getInt("rows_per_page", 20),
      compact_mode: getBool("compact_mode"),
    };

    const supabase = await createClient();

    const { data: existing } = await supabase
      .from("user_preferences")
      .select("id")
      .eq("user_id", workspace.userId)
      .eq("organization_id", workspace.organization.id)
      .maybeSingle();

    let error;
    if (existing) {
      ({ error } = await supabase
        .from("user_preferences")
        .update(data)
        .eq("id", existing.id));
    } else {
      ({ error } = await supabase
        .from("user_preferences")
        .insert(data));
    }

    if (error) return { error: error.message, success: false };

    revalidatePath("/parametres/preferences");
    return { error: null, success: true };
  } catch (err) {
    return { error: (err as Error).message, success: false };
  }
}
