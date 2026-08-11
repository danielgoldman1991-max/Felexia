import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    {
      error: "La vente et l'activation module par module sont desactivees. Les modules sont inclus dans l'offre Essentiel.",
    },
    { status: 410 },
  );
}

