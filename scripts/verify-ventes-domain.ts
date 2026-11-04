import assert from "node:assert/strict";
import { forecastOpportunities } from "../src/lib/sales/pipeline";
import { resolveCustomerPrice } from "../src/lib/sales/price-lists";
import { dueForReminder } from "../src/lib/sales/reminder-schedule";
import { dgiFlowState } from "../src/lib/sales/dgi-flow";

const forecast = forecastOpportunities([
  { stage: "proposition", amount: 1000 },
  { stage: "gagnee", amount: 500 },
  { stage: "perdue", amount: 800 },
]);
assert.equal(forecast.weighted, 900);
assert.equal(resolveCustomerPrice({ catalogPrice: 100, listPrice: 80, discountPercent: 10 }).net, 72);
assert.equal(resolveCustomerPrice({ catalogPrice: 50 }).net, 50);
const due = dueForReminder([{ id: "a", dueDate: "2026-10-01", remaining: 10 }, { id: "b", dueDate: "2026-11-20", remaining: 10 }], 7, "2026-11-03");
assert.deepEqual(due.map((invoice) => invoice.id), ["a"]);
const flow = dgiFlowState({ hasPdf: true, hasXml: true, issued: true, transmissionConfigured: false });
assert.equal(flow.reached, "issued");
assert.equal(flow.transmissionAvailable, false);
console.log("Ventes : prévision, prix client, relance automatique et parcours DGI fermé vérifiés.");
