import { NextResponse } from "next/server";
import { globalSearch } from "@/lib/global-search";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q") ?? "";
  try {
    const results = await globalSearch(query);
    return NextResponse.json({ results });
  } catch (error) {
    console.error("[global-search] request failed", error);
    return NextResponse.json({ results: [], error: "La recherche est momentanément indisponible." }, { status: 503 });
  }
}
