import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    {
      error: "Les modules complémentaires sont disponibles sur demande auprès de Felexia. Contactez-nous depuis Paramètres → Modules sur demande.",
    },
    { status: 410 },
  );
}

