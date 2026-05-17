import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const { email, fullName } = await request.json();

    const supabase = await createClient();

    const { data: userResult, error: userError } = await supabase.auth.getUser();

    if (userError || !userResult.user) {
      return NextResponse.json(
        { error: "Utilisateur non authentifié." },
        { status: 401 },
      );
    }

    const { data, error } = await supabase.rpc("ensure_user_profile", {
      p_full_name: fullName ?? null,
      p_email: email ?? userResult.user.email ?? null,
    });

    if (error) {
      console.error("create-profile error:", error.message);
      return NextResponse.json(
        { error: error.message },
        { status: 400 },
      );
    }

    return NextResponse.json({ success: true, profile_id: data });
  } catch (err) {
    console.error("create-profile unexpected error:", err);
    return NextResponse.json(
      { error: "Erreur inattendue." },
      { status: 500 },
    );
  }
}
