import { handleGuideRequest } from "@/lib/newsletter/http";
import { saveGuideRequest } from "@/lib/newsletter/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function POST(request: Request) {
  return handleGuideRequest(request, saveGuideRequest);
}
