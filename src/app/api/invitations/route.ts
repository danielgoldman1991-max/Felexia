import { NextRequest, NextResponse } from "next/server";
import { inviteOrganizationUser, InvitationError } from "@/lib/auth/invite-user";

/**
 * POST /api/invitations
 *
 * Invitation multi-tenant :
 * - l'organization_id est TOUJOURS dérivé de la session de l'utilisateur
 *   authentifié, jamais choisi depuis le corps de la requête (anti
 *   cross-tenant : un admin de Société A ne peut pas inviter pour Société B) ;
 * - l'email d'invitation est envoyé par l'Admin API Supabase
 *   (inviteUserByEmail) avec la clé service_role, exclusivement côté serveur ;
 * - toute erreur Supabase (SMTP, rate limit, domaine non autorisé, compte
 *   existant…) est remontée explicitement à l'interface.
 */
export async function POST(req: NextRequest) {
  try {
    const body: unknown = await req.json();

    if (typeof body !== "object" || body === null) {
      return NextResponse.json({ error: "Payload invalide." }, { status: 400 });
    }

    const { email, roleId, fullName, organizationId } = body as {
      email?: unknown;
      roleId?: unknown;
      fullName?: unknown;
      organizationId?: unknown;
    };

    // Older open tabs still include organizationId. The service checks that
    // it matches the authenticated workspace before any write/email; it never
    // uses this client value to select the invitation's organization.
    if (organizationId != null && typeof organizationId !== "string") {
      return NextResponse.json(
        { error: "Payload invalide." },
        { status: 400 },
      );
    }

    const result = await inviteOrganizationUser({
      email: typeof email === "string" ? email : "",
      roleId: typeof roleId === "string" && roleId ? roleId : null,
      fullName: typeof fullName === "string" ? fullName : null,
      legacyOrganizationId: typeof organizationId === "string" ? organizationId : null,
    });

    return NextResponse.json(
      { success: true, invitationId: result.invitationId },
      { status: 201 },
    );
  } catch (err) {
    if (err instanceof SyntaxError) return NextResponse.json({ error: "Payload invalide." }, { status: 400 });
    if (err instanceof InvitationError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: err.status });
    }
    console.error("[INVITE] unexpected error", err);
    return NextResponse.json(
      { error: "Erreur interne lors de l'invitation.", code: "SUPABASE_UNKNOWN" },
      { status: 500 },
    );
  }
}
