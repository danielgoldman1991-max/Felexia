// Real PostgreSQL numeric oracle in a disposable local WASM database only.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { writeFileSync } from "node:fs";
import { calculateExactLine } from "../../../src/lib/e-invoicing/calculations";
const prefix = process.argv.find(value => value.startsWith("--pglite-root="))?.slice(14);
if (!prefix) throw new Error("Explicit isolated PGlite package directory required");
const require = createRequire(resolve(prefix, "package.json"));
const { PGlite } = require("@electric-sql/pglite");
const db = new PGlite();
let seed = 19790631;
function next(max: number) { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed % max; }
const cases = [
  ["1.5", "0.03", "0", "20"], ["3", "9.99", "12.5", "20"], ["0.0005", "100.005", "0.005", "7.555"],
  ["99999999999.999", "0.01", "99.99", "20"], ["0.001", "999999999999.99", "0", "20"],
];
for (let i = 0; i < 400; i++) cases.push([String(next(9999) + 1) + "." + String(next(100000)).padStart(5, "0"), String(next(100000)) + "." + String(next(100000)).padStart(5, "0"), String(next(10000) / 100), String(next(10000) / 100)]);
async function main() {
  let checks = 0;
  try {
    for (const [quantity, unitPriceHt, discountRate, taxRate] of cases) {
      const row = (await db.query(`with v as(select round($1::numeric,3)q,round($2::numeric,2)p,round($3::numeric,2)d,round($4::numeric,2)r),g as(select *,round(q*p,2)gross from v),n as(select *,round(gross*d/100,2)allowance from g) select q::text quantity,p::text "unitPriceHt",d::text "discountRate",r::text "taxRate",gross::text "grossHt",allowance::text "discountAmount",(gross-allowance)::text "subtotalHt",round((gross-allowance)*r/100,2)::text "taxAmount",(gross-allowance+round((gross-allowance)*r/100,2))::text "totalTtc" from n`, [quantity, unitPriceHt, discountRate, taxRate])).rows[0];
      const actual = calculateExactLine({ id: "fixture", description: "Fixture", quantity, unitPriceHt, discountRate, taxRate });
      for (const [key, value] of Object.entries(actual)) { assert.equal(value, row[key], key + " PostgreSQL parity"); checks++; }
    }
    const report = { success: true, cases: cases.length, checks, engine: "PostgreSQL numeric via disposable PGlite", scope: "No project schema, secrets, data or network" };
    writeFileSync(new URL("decimal-postgres-parity.json", import.meta.url), JSON.stringify(report, null, 2) + "\n");
    console.log(JSON.stringify(report));
  } finally { await db.close(); }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
