import { admin } from "./lib/harness.ts";
const org = (await admin.from("organizations" as any).select("id").eq("slug", "stress-flx-2026-001").single()).data;
const p1 = (await admin.from("products" as any).select("id").eq("organization_id", org.id).eq("sku", "STRESS-P1").single()).data;
const m = await admin.from("stock_moves" as any).select("move_type,direction,quantity,source_document_id,created_at").eq("organization_id", org.id).eq("product_id", p1.id).order("created_at");
for (const r of m.data ?? []) console.log(r.move_type, r.direction, r.quantity, r.source_document_id?.slice(0, 8), r.created_at);
