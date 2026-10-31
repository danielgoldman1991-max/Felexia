import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    "/",
    "/dashboard/:path*",
    "/bienvenue/:path*",
    "/api/stripe/checkout",
    "/api/stripe/portal",
    "/api/subscriptions/start-trial",
    "/api/onboarding/complete",
    "/achats/:path*",
    "/vente/:path*",
    "/ventes/:path*",
    "/facturation/:path*",
    "/stock/:path*",
    "/tresorerie/:path*",
    "/tiers/:path*",
    "/comptabilite/:path*",
    "/parametres/:path*",
    "/articles/:path*",
    "/devis/:path*",
    "/commandes/:path*",
    "/livraisons/:path*",
    "/factures/:path*",
    "/paiements/:path*",
    "/relances/:path*",
    "/rapports/:path*",
    "/agenda/:path*",
    "/documents/:path*",
    "/rh/:path*",
    "/commerce/:path*",
    "/avoirs/:path*",
    "/banques/:path*",
    "/caisses/:path*",
    "/encaissements/:path*",
    "/decaissements/:path*",
    "/clients/:path*",
    "/fournisseurs/:path*",
    "/outils/:path*",
    "/onboarding/:path*",
  ],
};
