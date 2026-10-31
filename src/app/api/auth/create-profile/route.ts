import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ensureProfileFromAuthUser } from "@/lib/auth/ensure-profile-from-auth-user";

export async function POST() {
  try {
    const supabase = await createClient();

    const { data: userResult, error: userError } = await supabase.auth.getUser();

    if (userError || !userResult.user) {
      return NextResponse.json(
        { error: "Utilisateur non authentifié." },
        { status: 401 },
      );
    }

    const result = await ensureProfileFromAuthUser(supabase, userResult.user);
    if (!result.ok) {
      console.error("[create-profile] initialization failed", { userId: userResult.user.id, reason: result.reason });
      return NextResponse.json(
        { error: result.reason === "conflict" ? "Un autre compte utilise déjà cette adresse. Contactez le support." : "Le profil n’a pas pu être initialisé. Réessayez dans un instant." },
        { status: result.reason === "conflict" ? 409 : 503 },
      );
    }

    return NextResponse.json({ success: true, profile_id: userResult.user.id });
  } catch (err) {
    console.error("create-profile unexpected error:", err);
    return NextResponse.json(
      { error: "Erreur inattendue." },
      { status: 500 },
    );
  }
}
