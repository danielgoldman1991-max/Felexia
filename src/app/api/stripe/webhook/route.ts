import { NextRequest, NextResponse } from "next/server";
import { handleStripeWebhook } from "@/lib/stripe-webhook";

export async function POST(req: NextRequest) {
  try {
    const signature = req.headers.get("stripe-signature");
    if (!signature) {
      return NextResponse.json({ error: "Missing stripe-signature header" }, { status: 400 });
    }

    const body = await req.text();
    const result = await handleStripeWebhook(body, signature);
    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    const message = (err as Error).message;
    const status = message.includes("signature") ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
