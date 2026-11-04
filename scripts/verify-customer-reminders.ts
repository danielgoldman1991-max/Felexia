import assert from "node:assert/strict";
import { agingBucket } from "../src/lib/sales/aged-receivables";
import { collectionQueue, daysSalesOutstanding, renderReminderMessage, whatsAppLink, DEFAULT_COLLECTION_SCENARIOS } from "../src/lib/sales/collection";
import { nextReminderDate } from "../src/lib/sales/reminder-schedule";

const rules = DEFAULT_COLLECTION_SCENARIOS.map((scenario, index) => ({
  id: String(index),
  name: scenario.name,
  daysAfterDue: scenario.daysAfterDue,
  level: scenario.level,
  channel: scenario.channel,
  subject: scenario.subject,
  message: scenario.message,
  active: true,
}));

const invoice = {
  id: "fac",
  number: "FAC-2611-00012",
  customerId: "atlas",
  customerName: "Atlas Négoce",
  dueDate: "2026-11-10",
  remaining: 1200,
  total: 1200,
  email: "compta@atlas.ma",
  phone: "0612345678",
};

assert.equal(nextReminderDate("2026-11-10", -3, "2026-11-01"), "2026-11-07");
assert.equal(collectionQueue({ invoices: [invoice], rules, today: "2026-11-01" }).length, 0);
const early = collectionQueue({ invoices: [invoice], rules, today: "2026-11-07", rib: "007 000 1234567890123456 12" });
assert.equal(early.length, 1);
assert.equal(early[0].rule.daysAfterDue, -3);
assert.match(early[0].message, /Atlas Négoce/);
assert.match(early[0].message, /FAC-2611-00012/);
assert.match(early[0].message, /1[.\s\u202f]?200,00 MAD/);
assert.doesNotMatch(early[0].message, /69-21/);

const firm = collectionQueue({ invoices: [{ ...invoice, dueDate: "2026-10-20" }], rules, today: "2026-11-04" });
assert.equal(firm[0].rule.daysAfterDue, 15);
assert.match(firm[0].message, /69-21/);
assert.match(firm[0].message, /32-10/);
assert.match(firm[0].message, /pas un conseil juridique|ne constitue pas un conseil juridique/);

const paid = collectionQueue({ invoices: [{ ...invoice, remaining: 0, dueDate: "2026-10-01" }], rules, today: "2026-11-04" });
assert.equal(paid.length, 0);

const paused = collectionQueue({
  invoices: [{ ...invoice, dueDate: "2026-10-20" }],
  rules,
  today: "2026-11-04",
  exclusions: [{ customerId: "atlas", until: "2026-12-01" }],
});
assert.equal(paused.length, 0);

const promised = collectionQueue({
  invoices: [{ ...invoice, dueDate: "2026-10-20" }],
  rules,
  today: "2026-11-04",
  promises: [{ customerId: "atlas", invoiceId: "fac", promisedOn: "2026-11-20" }],
});
assert.equal(promised.length, 0);

const already = collectionQueue({
  invoices: [{ ...invoice, dueDate: "2026-10-20" }],
  rules,
  today: "2026-11-04",
  sent: [{ invoiceId: "fac", level: 3 }],
});
assert.equal(already.length, 0);

const arabic = renderReminderMessage({
  customerName: "Atlas Négoce",
  invoiceNumber: "FAC-2611-00012",
  amount: 1200,
  dueDate: "2026-11-10",
  level: 1,
  daysAfterDue: -3,
  arabic: true,
});
assert.match(arabic.message, /نود تذكيركم/);

assert.equal(whatsAppLink("06 12 34 56 78", "Bonjour"), "https://wa.me/212612345678?text=Bonjour");
assert.equal(whatsAppLink("+212612345678", "A"), "https://wa.me/212612345678?text=A");
assert.equal(daysSalesOutstanding(30000, 90000, 90), 30);
assert.equal(daysSalesOutstanding(100, 0, 90), null);
assert.equal(agingBucket("2026-11-04", "2026-11-04", 50), "1_30");
assert.equal(agingBucket("2026-08-01", "2026-11-04", 50), "over_90");
assert.equal(agingBucket("2026-09-20", "2026-11-04", 50), "31_60");
assert.equal(agingBucket("2026-08-20", "2026-11-04", 50), "61_90");

console.log("Relances : échéances, file, exclusions, promesse, WhatsApp et DSO vérifiés.");
