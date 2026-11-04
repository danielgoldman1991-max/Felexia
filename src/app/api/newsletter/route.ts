import { handleNewsletterSignup } from "@/lib/newsletter/http";
import { saveNewsletter } from "@/lib/newsletter/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function POST(request: Request) {
  return handleNewsletterSignup(request, saveNewsletter);
}
