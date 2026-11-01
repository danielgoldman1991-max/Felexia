import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { knowledgeSupportReply } from "../../../../src/lib/support/knowledge-reply";

type Message = { role: "user" | "assistant"; content: string };
const checks: { name: string; passed: true }[] = [];
function check(name: string, condition: unknown) { assert(condition, name); checks.push({ name, passed: true }); }
const history: Message[] = [{ role: "user", content: "Qu’apporte PRO par rapport à ESSENTIEL ?" }, { role: "assistant", content: "PRO est sur devis." }];
for (const question of ["Can I start without a bank card?", "Can I begin without a credit card?", "Is a debit card required for the free trial?", "L’essai gratuit demande-t-il une carte bancaire ?", "Peut-on commencer sans carte bancaire ?", "واش نقدر نجرب بلا بطاقة بنكية؟"]) {
  const answer = knowledgeSupportReply([...history, { role: "user", content: question }]);
  check("Trial/card intent wins over earlier PRO and treasury: " + question, answer.sources[0]?.id === "trial");
  check("Trial answer does not promise automatic PRO activation: " + question, /devis|quotation|عرض/.test(answer.reply));
}
const english: Message[] = [...history, { role: "user", content: "Can I start without a bank card?" }, { role: "assistant", content: "No bank card is required." }];
let answer = knowledgeSupportReply([...english, { role: "user", content: "L’essai gratuit demande-t-il une carte bancaire ?" }]);
check("Clear French question overrides earlier English", answer.sources[0]?.id === "trial" && answer.reply.includes("L’essai gratuit") && !answer.reply.includes("The free trial"));
answer = knowledgeSupportReply([{ role: "user", content: "Please answer in English" }, { role: "assistant", content: "Of course." }, { role: "user", content: "Et PRO ?" }]);
check("Explicit language survives an ambiguous short turn", answer.reply.includes("quotation only"));
answer = knowledgeSupportReply([{ role: "user", content: "Please answer in English" }, { role: "assistant", content: "Of course." }, { role: "user", content: "Comment commencer l’essai gratuit ?" }]);
check("Clear later French question overrides the earlier language choice", answer.reply.includes("essai") && !answer.reply.includes("The free trial"));
for (const question of ["Comment enregistrer un compte bancaire ?", "How do I manage bank accounts?", "Quels comptes pour ma trésorerie ?"]) {
  answer = knowledgeSupportReply([{ role: "user", content: question }]);
  check("Bank-account management is not a trial question: " + question, answer.sources[0]?.id !== "trial");
}
writeFileSync(new URL("regressions.json", import.meta.url), JSON.stringify({ passed: true, checks, assertions: checks.length, scope: "Actual knowledge reply module, synthetic conversation, no network or private company data." }, null, 2));
console.log(JSON.stringify({ passed: true, assertions: checks.length }));
