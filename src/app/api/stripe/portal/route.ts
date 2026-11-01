import { NextResponse } from "next/server";
import { getActiveWorkspace } from "@/lib/auth";
import { createClient as createServiceClient } from "@/lib/supabase/service";
import { createPortalSession, getStripe } from "@/lib/stripe";
import { hasStripeEnv } from "@/lib/env";
import { isAdminRole, isOperatorRole } from "@/lib/auth/roles";
import { OPERATOR_ACCESS_ERROR } from "@/lib/auth/operator-access";
import { getBillingRequestRejection } from "@/lib/billing-request-policy";

export async function POST(request: Request) {
  try {
    const workspace = await getActiveWorkspace();
    if (!workspace) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
    if (!isAdminRole(workspace.role)) return NextResponse.json({ error: isOperatorRole(workspace.role) ? OPERATOR_ACCESS_ERROR : "Seul un administrateur peut gérer l'abonnement.", code: isOperatorRole(workspace.role) ? "OPERATOR_ACCESS_DENIED" : "BILLING_ADMIN_REQUIRED" }, { status: 403 });
    const rejected = getBillingRequestRejection(request, workspace.organization.id);
    if (rejected) return NextResponse.json({ error: rejected.error, code: rejected.code }, { status: rejected.status, headers: { "Cache-Control": "private, no-store", ...(rejected.retryAfter ? { "Retry-After": String(rejected.retryAfter) } : {}) } });
    if (!hasStripeEnv()) return NextResponse.json({ error: "La facturation est momentanément indisponible." }, { status: 503 });
    const { data: org, error } = await createServiceClient().from("organizations").select("stripe_customer_id").eq("id", workspace.organization.id).single();
    if (error || !org?.stripe_customer_id) return NextResponse.json({ error: "Aucun abonnement Stripe à gérer. Choisissez ESSENTIEL pour souscrire ou contactez-nous pour un devis PRO." }, { status: 400 });
    const customer = await getStripe().customers.retrieve(org.stripe_customer_id);
    if (customer.deleted || customer.metadata.organization_id !== workspace.organization.id) throw new Error("BILLING_CUSTOMER_MISMATCH");
    const session = await createPortalSession(customer.id);
    return NextResponse.json({ url: session.url });
  } catch {
    console.error("[billing] portal preparation failed");
    return NextResponse.json({ error: "Le portail de facturation n'a pas pu être ouvert. Réessayez ou contactez l'assistance." }, { status: 503 });
  }
}
