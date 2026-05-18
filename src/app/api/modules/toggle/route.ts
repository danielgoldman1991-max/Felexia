import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    {
      error: "La vente et l'activation module par module sont desactivees. Les modules sont inclus selon le pack Essentiel, Business ou Premium.",
    },
    { status: 410 },
  );
}

