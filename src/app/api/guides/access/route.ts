import { handleGuideRedeem } from "@/lib/newsletter/http";
import { redeemGuideAccess } from "@/lib/newsletter/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function POST(request: Request) {
  return handleGuideRedeem(request, redeemGuideAccess);
}
