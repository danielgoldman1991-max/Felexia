import { SUPPORT_KNOWLEDGE_ARTICLES, type SupportKnowledgeArticle } from "./knowledge";

const stopwords = new Set([
  "le", "la", "les", "de", "du", "des", "un", "une", "et", "en", "au", "aux", "sur", "dans", "pour", "avec", "est", "sont", "ce", "ces", "mon", "ma", "mes", "je", "tu", "il", "elle", "on", "nous", "vous", "votre", "vos", "que", "qui", "quoi", "comment", "quel", "quelle", "quels", "quelles", "peux", "peut", "puis", "faire", "pas", "oui", "non", "me", "se", "si", "ou", "ai", "aide", "svp", "bonjour", "salut", "gestion", "gerer", "utiliser", "utilisation",
  "the", "a", "an", "and", "or", "to", "of", "is", "are", "do", "does", "can", "could", "i", "my", "you", "your", "we", "our", "how", "what", "which", "for", "in", "on", "please", "hello", "hi", "need", "want", "have", "has", "it", "this", "that", "about",
  "من", "في", "على", "الى", "عن", "هل", "هو", "هي", "انا", "انت", "انتم", "واش", "بغيت", "كيف", "كيفاش", "شنو", "عندي", "لي", "ديال", "هاد", "السلام", "عليكم", "بغينا", "wach", "bghit", "kifach", "dyal", "3ndi", "salam",
]);

/** A small public-language vocabulary makes retrieval useful across FR/EN/AR/darija. */
const concepts: Array<{ terms: string[]; expand: string[] }> = [
  { terms: ["prix", "tarif", "combien", "price", "pricing", "cost", "how much", "taman", "ch7al", "chhal", "bchhal", "bch7al", "ثمن", "سعر", "بشحال", "شحال"], expand: ["prix", "tarif"] },
  { terms: ["essentiel", "essential", "basic", "الاساسي", "اساسي"], expand: ["essentiel"] },
  { terms: ["pro", "premium", "احترافي"], expand: ["pro"] },
  { terms: ["facture", "factures", "invoice", "invoices", "factora", "فاتوره", "فاتورة", "فواتير"], expand: ["facture"] },
  { terms: ["electronic invoice", "e invoicing", "einvoice", "electronique", "الكترونيه", "الالكترونيه", "إلكترونية", "الكترونية", "xml", "ubl"], expand: ["electronique", "xml"] },
  { terms: ["gratuit", "essai", "trial", "free", "njereb", "njarab", "تجربه", "نجرب", "مجانا"], expand: ["essai"] },
  { terms: ["acheter", "achat", "achats", "purchase", "purchasing", "chra", "مشتريات", "شراء"], expand: ["achats"] },
  { terms: ["fournisseur", "supplier", "suppliers", "vendor", "مورد", "المورد"], expand: ["fournisseur"] },
  { terms: ["customer", "customers", "client", "زبون", "الزبناء", "زبناء"], expand: ["client"] },
  { terms: ["stock", "stok", "warehouse", "مخزون", "ستوك", "مستودع"], expand: ["stock"] },
  { terms: ["inventory", "inventaire", "جرد"], expand: ["inventaire"] },
  { terms: ["cash", "bank", "treasury", "cashflow", "tresorerie", "banque", "caisse", "خزينه", "خزينة", "بنك", "صندوق"], expand: ["tresorerie"] },
  { terms: ["reconciliation", "rapprochement", "statement", "releve", "كشف"], expand: ["rapprochement"] },
  { terms: ["forecast", "forecasting", "prevision", "previsions", "توقع", "توقعات"], expand: ["prevision"] },
  { terms: ["accounting", "bookkeeping", "ledger", "comptabilite", "محاسبه", "محاسبة"], expand: ["comptabilite"] },
  { terms: ["payroll", "salary", "payslip", "salaire", "paie", "سالير", "اجره", "أجرة", "راتب"], expand: ["paie"] },
  { terms: ["employee", "human resources", "rh", "employe", "salarie", "موظف", "اجير", "اجراء"], expand: ["rh"] },
  { terms: ["leave", "holiday", "conge", "كونجي", "عطله", "عطلة"], expand: ["conge", "rh"] },
  { terms: ["cnss", "amo", "الصندوق الوطني"], expand: ["paie", "cnss"] },
  { terms: ["vat", "tax", "tva", "taxe", "ضريبه", "ضريبة", "تصريح"], expand: ["tva"] },
  { terms: ["certified", "compliance", "conforme", "certifie", "dgi", "توقيع", "مطابق", "اعتماد"], expand: ["conformite", "dgi"] },
  { terms: ["password", "login", "connexion", "mot de passe", "كلمه السر", "كلمة السر", "نسيت", "دخول", "ndkhel"], expand: ["connexion"] },
  { terms: ["subscription", "abonnement", "renew", "expired", "renouveler", "اشتراك", "تجديد", "انتهى"], expand: ["abonnement"] },
  { terms: ["payment", "paiement", "reglement", "khlass", "khelles", "خلص", "خلاص", "دفعة"], expand: ["reglement"] },
  { terms: ["human", "conseiller", "support", "contact", "agent humain", "bghit nhder", "تواصل", "مساعده", "مساعدة", "انسان"], expand: ["contact"] },
  { terms: ["error", "bug", "probleme", "not working", "broken", "makhdamch", "مشكل", "خطا", "ماخدامش"], expand: ["erreur"] },
  { terms: ["security", "privacy", "confidentialite", "securite", "data", "خصوصيه", "خصوصية", "امان", "بيانات"], expand: ["confidentialite", "securite"] },
];

export function normalizeSupportQuery(value: string): string {
  return value.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase()
    .replace(/[أإآٱ]/g, "ا").replace(/ى/g, "ي").replace(/ة/g, "ه")
    .replace(/[^\p{L}\p{N}]+/gu, " ").trim().replace(/\s+/g, " ");
}

function tokens(value: string): string[] {
  return [...new Set(normalizeSupportQuery(value).split(" ").filter((token) => token.length > 1 && !stopwords.has(token)))];
}

const normalizedConcepts = concepts.map((concept) => ({
  terms: concept.terms.map(normalizeSupportQuery), expand: concept.expand,
}));

const index = SUPPORT_KNOWLEDGE_ARTICLES.map((article) => ({
  article,
  title: tokens(article.title),
  keywords: tokens(article.keywords.join(" ")),
  content: tokens(article.content),
}));

/** Adjacent swaps and a single typo are common in short support questions. */
function isOneEditAway(left: string, right: string): boolean {
  if (left === right) return true;
  if (Math.abs(left.length - right.length) > 1) return false;
  if (left.length === right.length) {
    const differences: number[] = [];
    for (let i = 0; i < left.length; i++) if (left[i] !== right[i]) differences.push(i);
    return differences.length === 1 || (differences.length === 2 && differences[1] === differences[0] + 1 && left[differences[0]] === right[differences[1]] && left[differences[1]] === right[differences[0]]);
  }
  const [shorter, longer] = left.length < right.length ? [left, right] : [right, left];
  let i = 0; let j = 0; let skipped = false;
  while (i < shorter.length && j < longer.length) {
    if (shorter[i] === longer[j]) { i++; j++; }
    else if (skipped) return false;
    else { skipped = true; j++; }
  }
  return true;
}

function matchWeight(queryToken: string, field: string[]): number {
  if (field.includes(queryToken)) return 1;
  if (queryToken.length < 4) return 0;
  if (field.some((word) => word.length >= 4 && (word.startsWith(queryToken) || queryToken.startsWith(word)))) return 0.75;
  if (field.some((word) => word.length >= 4 && isOneEditAway(queryToken, word))) return 0.55;
  return 0;
}

/** Returns at most 8 public, curated articles; it never fetches tenant data or web content. */
export function searchSupportKnowledge(query: string, limit = 5): SupportKnowledgeArticle[] {
  const maximum = Number.isFinite(limit) ? Math.max(1, Math.min(8, Math.floor(limit))) : 5;
  const normalized = normalizeSupportQuery(query.slice(0, 4000));
  const queryTokens = new Set(tokens(normalized));
  for (const concept of normalizedConcepts) {
    if (concept.terms.some((term) => (` ${normalized} `).includes(` ${term} `))) {
      concept.expand.forEach((token) => queryTokens.add(token));
    }
  }
  const ranked = index.map((entry, position) => {
    let score = 0;
    let matches = 0;
    for (const token of queryTokens) {
      const title = matchWeight(token, entry.title);
      const keyword = matchWeight(token, entry.keywords);
      const content = matchWeight(token, entry.content);
      score += title * 8 + keyword * 6 + content;
      if (title || keyword || content) matches++;
    }
    // Reward answers covering several parts of a question rather than generic single matches.
    score += matches > 1 ? Math.min(matches - 1, 4) * 2 : 0;
    return { article: entry.article, score, position };
  }).filter((entry) => entry.score >= 3)
    .sort((left, right) => right.score - left.score || left.position - right.position);

  if (ranked.length) return ranked.slice(0, maximum).map((entry) => entry.article);
  const fallbackIds = normalized ? ["support-scope", "contact"] : ["overview", "essential", "pro", "contact"];
  return fallbackIds.flatMap((id) => SUPPORT_KNOWLEDGE_ARTICLES.filter((article) => article.id === id)).slice(0, maximum);
}
