/* Détail des anomalies restantes hors SOCIETE DEMO — lecture seule.
 * Cible : orgs != SOCIETE DEMO avec anomalies (LALA HOME21, Felexia Demo, FELEXIA DEMO SARL).
 */
import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";

function loadEnv(file: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i <= 0) continue;
    out[t.slice(0, i).trim()] = t.slice(i + 1).trim().replace(/^"|"$/g, "");
  }
  return out;
}

const env = loadEnv(path.resolve(process.cwd(), ".env.local"));
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const cents = (v: unknown) => Math.round(Number(v ?? 0) * 100);
const MAD = (c: number) => (c / 100).toFixed(2);

(async () => {
  const out: string[] = [];
  const log = (s: string) => { out.push(s); console.log(s); };

  // LALA HOME21 : trésorerie
  const { data: orgs } = await admin.from("organizations" as any).select("id,name").in("name", ["LALA HOME21", "Felexia Demo", "FELEXIA DEMO SARL"]);
  for (const o of orgs ?? []) {
    log(`\n=== ${o.name} (${o.id}) ===`);
    if (o.name === "LALA HOME21") {
      const { data: accs } = await admin.from("treasury_accounts" as any).select("id,name,opening_balance,current_balance,status,archived_at").eq("organization_id", o.id);
      const { data: moves } = await admin.from("treasury_transactions" as any).select("treasury_account_id,direction,amount,transaction_type,reference,archived_at").eq("organization_id", o.id);
      for (const a of accs ?? []) {
        if (a.status === "archived") continue;
        let inn = 0, outt = 0, n = 0;
        for (const m of moves ?? []) {
          if (m.treasury_account_id !== a.id || m.archived_at) continue;
          n++;
          if (m.direction === "in") inn += cents(m.amount); else outt += cents(m.amount);
        }
        const expected = cents(a.opening_balance) + inn - outt;
        const diff = expected - cents(a.current_balance);
        log(`Compte ${a.name}: opening=${MAD(cents(a.opening_balance))} in=${MAD(inn)} out=${MAD(outt)} (${n} mvts) attendu=${MAD(expected)} actuel=${MAD(cents(a.current_balance))} écart=${MAD(diff)}`);
        if (Math.abs(diff) > 1) {
          const first = (moves ?? []).filter((m) => m.treasury_account_id === a.id && !m.archived_at);
          log(`  → ${first.length} mouvements pour ce compte, exemples: ${first.slice(0, 5).map((m) => `${m.reference ?? "?"} ${m.direction} ${MAD(cents(m.amount))} (${m.transaction_type})`).join(" | ")}`);
        }
      }
      // totals sur les transactions archivées éventuelles
      const archived = (moves ?? []).filter((m) => m.archived_at);
      if (archived.length) log(`Mouvements archivés: ${archived.length}`);
    }
    // Écritures comptables vs source
    const { data: entries } = await admin.from("accounting_entries" as any).select("id,entry_number,status,total_debit,total_credit,source_document_type,source_document_id").eq("organization_id", o.id);
    const { data: elines } = await admin.from("accounting_entry_lines" as any).select("entry_id,debit,credit").eq("organization_id", o.id);
    const sumByEntry = new Map<string, number>();
    for (const l of elines ?? []) sumByEntry.set(l.entry_id, (sumByEntry.get(l.entry_id) ?? 0) + cents(l.debit));
    for (const e of entries ?? []) {
      const deb = sumByEntry.get(e.id) ?? 0;
      const diff = deb - cents(e.total_debit);
      log(`Écriture ${e.entry_number ?? e.id} status=${e.status} source=${e.source_document_type}:${e.source_document_id} debit-lignes=${MAD(deb)} debit-stocké=${MAD(cents(e.total_debit))} écart=${MAD(diff)}`);
    }
    // Stock mismatch produits
    const { data: prods } = await admin.from("products" as any).select("id,sku,name,current_stock,track_stock").eq("organization_id", o.id);
    const { data: levels } = await admin.from("stock_levels" as any).select("product_id,quantity").eq("organization_id", o.id);
    const lvlByProd = new Map<string, number>();
    for (const l of levels ?? []) lvlByProd.set(l.product_id, (lvlByProd.get(l.product_id) ?? 0) + l.quantity);
    for (const p of prods ?? []) {
      if (!p.track_stock) continue;
      const lvl = lvlByProd.get(p.id) ?? 0;
      if (Math.abs(Number(p.current_stock) - lvl) > 0.001)
        log(`Stock ${p.sku} ${p.name}: current=${p.current_stock} cumul emplacements=${lvl} (écart ${(Number(p.current_stock) - lvl).toFixed(3)})`);
    }
  }

  fs.writeFileSync(
    path.resolve(process.cwd(), "training/transaction-stress-test/database-checks/02_anomalies_non_demo_" + new Date().toISOString().replace(/[:.]/g, "-") + ".txt"),
    out.join("\n"), "utf8");
})().catch((e) => { console.error(e); process.exit(1); });
