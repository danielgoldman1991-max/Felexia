import { handleUnsubscribe } from "@/lib/newsletter/http";
import { unsubscribeNewsletter } from "@/lib/newsletter/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function POST(request: Request) {
  return handleUnsubscribe(request, unsubscribeNewsletter);
}
