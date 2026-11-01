import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    {
      error: "Les modules de l’ERP complet sont inclus dans PRO. Retrouvez les offres dans Paramètres → Abonnement.",
    },
    { status: 410 },
  );
}

