import { handleGuideProfile } from "@/lib/newsletter/http";
import { saveGuideProfile } from "@/lib/newsletter/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function POST(request: Request) {
  return handleGuideProfile(request, saveGuideProfile);
}
