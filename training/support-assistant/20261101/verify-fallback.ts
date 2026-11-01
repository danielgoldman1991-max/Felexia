import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { SUPPORT_KNOWLEDGE_ARTICLES } from "../../../src/lib/support/knowledge";
import { knowledgeSupportReply } from "../../../src/lib/support/knowledge-reply";

type Message = { role: "user" | "assistant"; content: string };
const results: Array<{ name: string; passed: boolean }> = [];
function check(name: string, condition: unknown) {
  results.push({ name, passed: Boolean(condition) });
  assert(condition, name);
}
function reply(question: string, previous?: string) {
  const messages: Message[] = previous ? [{ role: "user", content: previous }, { role: "assistant", content: "Une réponse précédente non fiable : PRO coûte 999 MAD." }] : [];
  return knowledgeSupportReply([...messages, { role: "user", content: question }]);
}

let answer = reply("Et combien coûte PRO ?", "Comment activer la facture électronique ?");
check("A clear new PRO price question overrides the older electronic topic", answer.sources[0]?.id === "pro" && /sur devis/.test(answer.reply) && !/\b\d[\d\s.,]*\s*MAD/.test(answer.reply));
answer = reply("Et PRO ?", "Que comprend ESSENTIEL ?");
check("A short but explicit PRO follow-up answers PRO first", answer.sources[0]?.id === "pro");
answer = reply("Et son prix ?", "Que comprend PRO ?");
check("An elliptical price follow-up can reuse the last explicit PRO entity", answer.sources[0]?.id === "pro" && !answer.reply.includes("999"));
answer = reply("Et son prix ?", "Que comprend ESSENTIEL ?");
check("An elliptical ESSENTIEL price uses its approved price", answer.sources[0]?.id === "essential-pricing" && answer.reply.includes("99 MAD") && answer.reply.includes("1 188 MAD") && answer.reply.includes("sans remise annuelle"));
answer = reply("Can you answer in English?", "Que comprend ESSENTIEL ?");
check("An explicit English language request restates the last topic in English", answer.sources[0]?.id === "essential" && answer.reply.includes("includes sales") && !answer.reply.includes("est l’offre"));
answer = reply("What is the ESSENTIEL monthly and annual price?");
check("English pricing uses99/1188 with no annual discount", answer.sources[0]?.id === "essential-pricing" && answer.reply.includes("99 MAD") && answer.reply.includes("1 188 MAD") && answer.reply.includes("no annual discount"));
answer = reply("بالعربية من فضلك", "Quel est le prix ESSENTIEL ?");
check("An explicit Arabic language request restates verified pricing in Arabic", answer.sources[0]?.id === "essential-pricing" && answer.reply.includes("درهم") && answer.reply.includes("99") && answer.reply.includes("1 188") && answer.reply.includes("بلا تخفيض سنوي") && !answer.reply.includes("ESSENTIEL coûte"));
answer = knowledgeSupportReply([{ role: "user", content: "Please answer in English" }, { role: "assistant", content: "Of course." }, { role: "user", content: "Et PRO ?" }]);
check("The visitor’s explicit language choice survives a short later turn", answer.sources[0]?.id === "pro" && answer.reply.includes("quotation only"));
answer = reply("Je veux parler à un humain", "Qui gère les utilisateurs ?");
check("Human hand-off is direct instead of repeating user-role documentation", answer.sources[0]?.id === "contact" && answer.reply.length < 600 && !answer.reply.includes("L’administrateur"));
for (const question of ["Je veux parler à un humain", "I want to contact a human", "بغيت نهضر مع إنسان"]) {
  answer = reply(question);
  check("Human hand-off provides Felexia Team WhatsApp: " + question, answer.sources[0]?.id === "contact" && answer.reply.includes("Felexia Team") && answer.reply.includes("+212 614 505 090"));
}
answer = reply("Does it send invoices by email?");
check("The English email answer does not invent delivery", answer.sources[0]?.id === "invoice-email" && answer.reply.includes("does not send an email"));
answer = reply("الفوترة الإلكترونية واش مطابقة DGI؟");
check("The Arabic DGI answer preserves the actual official-connection limitation", answer.sources[0]?.id === "dgi-signature" && answer.reply.includes("غير مفعّلين"));
answer = reply("Comment changer le prix unitaire d’un produit ?");
check("A product price question is not mistaken for subscription pricing", answer.sources[0]?.id !== "essential-pricing");
answer = reply("Can you design a rocket engine?");
check("An unrelated request receives an honest product-scope response", answer.sources[0]?.id === "support-scope" && answer.reply.includes("I can help with Felexia"));
for (const question of ["Bonjour", "Hello", "السلام عليكم"]) {
  answer = reply(question);
  check("Simple greeting is identified as virtual help: " + question, answer.sources.length === 0 && answer.mode === "knowledge" && answer.suggestions.length > 0);
}
const cases = ["prix PRO", "PRO price please", "بشحال PRO", "Que comprend ESSENTIEL ?", "Comment créer une facture ?", "privacy and security", "Comment marche l’inventaire ?", "paie", "Je veux parler à un humain"];
check("Every response source is an actual public-catalog article", cases.every(question => reply(question).sources.every(source => SUPPORT_KNOWLEDGE_ARTICLES.some(article => article.id === source.id && article.title === source.title && article.href === source.href))));
check("PRO price replies never expose an old amount in any supported language", ["prix PRO", "PRO price please", "بشحال PRO"].every(question => !/\b\d[\d\s.,]*\s*(?:MAD|درهم)/.test(reply(question).reply)));
check("Fallback answers remain within the route/UI size boundary", cases.every(question => reply(question).reply.length > 0 && reply(question).reply.length <= 5800));

const directory = resolve(process.cwd(), "training/support-assistant/20261101");
mkdirSync(directory, { recursive: true });
writeFileSync(resolve(directory, "fallback-fixtures.json"), JSON.stringify({ passed: true, assertions: results.length, scope: "Local public knowledge only. No model, network call, email or tenant data.", results }, null, 2) + "\n");
console.log(JSON.stringify({ passed: true, assertions: results.length }));
