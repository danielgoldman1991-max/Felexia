import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { createClient as createServiceClient } from "@/lib/supabase/service";
import { isEinvoiceRolloutEnabled } from "@/lib/e-invoicing/access";
import { processEinvoiceJobs } from "@/lib/e-invoicing/jobs";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store" };

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "Service indisponible" }, { status: 503, headers });
  const supplied = Buffer.from(request.headers.get("authorization") || ""), expected = Buffer.from(`Bearer ${secret}`);
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return NextResponse.json({ error: "Non autorisé" }, { status: 401, headers });
  if (process.env.FELEXIA_EINVOICING_ENABLED !== "true" && !(process.env.FELEXIA_EINVOICING_ORGANIZATION_IDS || "").trim()) return NextResponse.json({ processed: 0, moduleDisabled: true }, { headers });
  try {
    const client = createServiceClient();
    // Select eligible tenants before limiting. Disabled tenants must not starve
    // pilot organizations behind an arbitrary first page of pending jobs.
    const organizations = process.env.FELEXIA_EINVOICING_ENABLED === "true" ? null : (process.env.FELEXIA_EINVOICING_ORGANIZATION_IDS || "").split(",").map(id => id.trim().toLowerCase()).filter(id => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(id));
    const { data, error } = await client.rpc("einvoice_due_organizations", { p_organization_ids: organizations, p_limit: 10 });
    if (error) throw new Error("JOB_QUERY_FAILED");
    let processed = 0;
    for (const org of new Set<string>((data ?? []).map((row: { organization_id: string }) => row.organization_id))) {
      if (processed >= 10) break;
      if (isEinvoiceRolloutEnabled(org)) processed += (await processEinvoiceJobs(org, undefined, 10 - processed)).processed;
    }
    return NextResponse.json({ processed, simulation: true, officialTransmissions: 0 }, { headers });
  } catch {
    console.error("[einvoice] cron batch incomplete");
    return NextResponse.json({ error: "Les tâches restent conservées pour reprise." }, { status: 503, headers });
  }
}
