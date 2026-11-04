import { foldText } from "@/lib/treasury/statement-parse";

export const DEFAULT_RECONCILIATION_SETTINGS = {
  autoThreshold: 92,
  suggestThreshold: 70,
  dateWindowDays: 5,
  autoEnabled: true,
};

export type ReconciliationSettings = typeof DEFAULT_RECONCILIATION_SETTINGS;

export type MatchKind = "transaction" | "customer_invoice" | "supplier_invoice";
export type MatchCategory = "customer" | "supplier" | "fee" | "commission" | "vat_fee" | "agio" | "ignore" | "transfer";

export type StatementLineInput = {
  id: string;
  date: string;
  valueDate?: string | null;
  label: string;
  reference?: string | null;
  amount: number;
  direction: "in" | "out";
};

export type MatchCandidate = {
  id: string;
  kind: MatchKind;
  date: string;
  amount: number;
  direction: "in" | "out";
  reference?: string | null;
  number?: string | null;
  partyName?: string | null;
  partyId?: string | null;
  label?: string | null;
};

export type MatchRule = {
  id: string;
  labelContains: string;
  direction?: "in" | "out" | null;
  category: MatchCategory;
  thirdPartyId?: string | null;
  accountCode?: string | null;
  autoApply?: boolean;
  active?: boolean;
};

export type MatchLearning = {
  labelKey: string;
  direction: "in" | "out";
  thirdPartyId?: string | null;
  confirmations: number;
};

export type MatchTarget = {
  id: string;
  kind: MatchKind | "fee";
  amount: number;
  partyId: string | null;
};

export type ProposedMatch = {
  lineId: string;
  score: number;
  band: "auto" | "suggestion" | "todo";
  reason: string;
  category: MatchCategory | null;
  targets: MatchTarget[];
  ruleId: string | null;
  createPayment: boolean;
};

const STOPWORDS = new Set(["vir", "virement", "versement", "prelevement", "prlv", "mad", "ste", "sarl", "sa", "sas", "societe", "cheque", "chq", "fac", "ff"]);

const FEE_PATTERNS: { category: MatchCategory; pattern: RegExp }[] = [
  { category: "agio", pattern: /\bagios?\b|\binterets?\b|decouvert/ },
  { category: "vat_fee", pattern: /\btva\b/ },
  { category: "commission", pattern: /commission|frais banc|tenue de compte|cotisation carte|frais de virement|frais vir/ },
];

export function labelKey(label: string) {
  return foldText(label)
    .replace(/\d+[.,]\d{2}/g, " ")
    .replace(/\d{1,2}[\/.-]\d{1,2}[\/.-]\d{2,4}/g, " ")
    .replace(/\d+/g, " ")
    .replace(/[^a-z\s]/g, " ")
    .split(" ")
    .filter((word) => word.length > 2 && !STOPWORDS.has(word))
    .slice(0, 6)
    .join(" ");
}

export function nameScore(left: string, right: string) {
  const a = significantTokens(left);
  const b = significantTokens(right);
  if (a.length === 0 || b.length === 0) return 0;
  const shared = a.filter((token) => b.includes(token)).length;
  return (2 * shared) / (a.length + b.length);
}

export function documentMentioned(label: string, reference: string | null | undefined, number: string | null | undefined) {
  const needle = compact(number ?? "");
  if (needle.length < 4) return false;
  const haystack = compact(`${label} ${reference ?? ""}`);
  if (haystack.includes(needle)) return true;
  const digits = (number ?? "").replace(/\D/g, "");
  const hayDigits = `${label} ${reference ?? ""}`.replace(/\D/g, "");
  return digits.length >= 5 && hayDigits.includes(digits);
}

/** TVA bancaire isolée seulement si le libellé la donne. Le taux de 10 % n'est utilisé que pour un montant TTC explicitement taxé. */
export function splitBankCharge(label: string, amount: number, category: MatchCategory) {
  const expenseAccount = category === "agio" ? "6311" : "6147";
  const explicit = foldText(label).match(/tva[^0-9]{0,16}(\d+[.,]\d{2})/);
  if (explicit) {
    const vat = round2(Number(explicit[1].replace(",", ".")));
    if (vat > 0 && vat < amount) return { net: round2(amount - vat), vat, expenseAccount, vatAccount: "3455" };
  }
  const folded = foldText(label);
  if (folded.includes("ttc") && folded.includes("tva") && category !== "vat_fee") {
    const vat = round2(amount * 10 / 110);
    return { net: round2(amount - vat), vat, expenseAccount, vatAccount: "3455" };
  }
  if (category === "vat_fee") return { net: 0, vat: amount, expenseAccount, vatAccount: "3455" };
  return { net: amount, vat: 0, expenseAccount, vatAccount: "3455" };
}

export function reconciliationGap(book: number | null, statement: number | null) {
  if (book === null || statement === null || !Number.isFinite(book) || !Number.isFinite(statement)) return null;
  return round2(statement - book);
}

export function scoreCandidate(line: StatementLineInput, candidate: MatchCandidate, settings: ReconciliationSettings, learning: MatchLearning[], rule: MatchRule | null) {
  if (candidate.direction !== line.direction) return { score: 0, reasons: [] as string[], exact: false, partial: false, anchored: false };
  const exact = Math.abs(candidate.amount - line.amount) < 0.015;
  const partial = !exact && line.amount > 0.009 && line.amount + 0.015 < candidate.amount;
  if (!exact && !partial) return { score: 0, reasons: [] as string[], exact, partial, anchored: false };
  const reasons: string[] = [];
  let score = exact ? 45 : 18;
  reasons.push(exact ? "montant exact" : "paiement partiel");
  const diff = dateDistance(line, candidate.date);
  if (diff <= settings.dateWindowDays) {
    score += diff === 0 ? 20 : diff <= 2 ? 16 : 10;
    reasons.push(diff === 0 ? "même date" : `date à ${diff} jour${diff > 1 ? "s" : ""}`);
  }
  const mentioned = documentMentioned(line.label, line.reference, candidate.number) || documentMentioned(line.label, line.reference, candidate.reference);
  if (mentioned) {
    score += 25;
    reasons.push("pièce ou chèque reconnu dans le libellé");
  }
  if (partial && mentioned) {
    score += 20;
    reasons.push("acompte sur la pièce citée");
  }
  const similarity = nameScore(line.label, candidate.partyName ?? "");
  if (similarity >= 0.5) {
    score += Math.round(8 + similarity * 7);
    reasons.push("nom du client ou du fournisseur");
  }
  if (candidate.kind === "transaction" && exact) {
    score += 8;
    reasons.push("mouvement déjà saisi");
  }
  const learned = learning.find((item) => item.confirmations > 0 && item.direction === line.direction && item.labelKey === labelKey(line.label));
  if (learned?.thirdPartyId && learned.thirdPartyId === candidate.partyId) {
    score += 10;
    reasons.push("déjà validé sur un libellé semblable");
  }
  if (rule?.thirdPartyId && rule.thirdPartyId === candidate.partyId) {
    score += 8;
    reasons.push("règle de libellé");
  }
  if (partial && !mentioned) score = Math.min(score, 84);
  const anchored = mentioned || (diff <= 2 && (similarity >= 0.8 || Boolean(candidate.reference && line.reference && foldText(candidate.reference) === foldText(line.reference))));
  return { score: Math.min(100, score), reasons, exact, partial, anchored };
}

export function matchStatementLines(input: {
  lines: StatementLineInput[];
  candidates: MatchCandidate[];
  rules?: MatchRule[];
  learning?: MatchLearning[];
  settings?: Partial<ReconciliationSettings>;
}): ProposedMatch[] {
  const settings = { ...DEFAULT_RECONCILIATION_SETTINGS, ...input.settings };
  const rules = (input.rules ?? []).filter((rule) => rule.active !== false);
  const learning = input.learning ?? [];
  const consumed = new Set<string>();
  return input.lines.map((line) => {
    const available = input.candidates.filter((candidate) => !consumed.has(candidateKey(candidate)));
    const proposal = matchOne(line, available, rules, learning, settings);
    if (proposal.band !== "todo") {
      for (const target of proposal.targets) {
        if (target.kind !== "fee") consumed.add(`${target.kind}:${target.id}`);
      }
    }
    return proposal;
  });
}

function matchOne(line: StatementLineInput, candidates: MatchCandidate[], rules: MatchRule[], learning: MatchLearning[], settings: ReconciliationSettings): ProposedMatch {
  const rule = rules
    .filter((item) => foldText(line.label).includes(foldText(item.labelContains)) && (!item.direction || item.direction === line.direction))
    .sort((a, b) => b.labelContains.length - a.labelContains.length)[0] ?? null;
  if (rule?.category === "ignore") {
    return blank(line.id, "todo", 0, "Règle : laisser cette ligne de côté.", "ignore", rule.id);
  }
  const scored = candidates
    .map((candidate) => ({ candidate, ...scoreCandidate(line, candidate, settings, learning, rule) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || (a.candidate.kind === "transaction" ? -1 : 1));
  const best = scored[0];
  const booked = scored.find((item) => item.candidate.kind === "transaction" && item.exact && dateDistance(line, item.candidate.date) <= settings.dateWindowDays);
  if (booked) {
    const other = scored.find((item) => item !== booked && item.candidate.kind === "transaction");
    return fromCandidate(line, booked, !other || booked.score - other.score >= 12, settings, rule);
  }
  const group = findGroup(line, candidates.filter((candidate) => candidate.kind !== "transaction"));
  if (group && (!best || group.score >= best.score)) return finish(line.id, group.score, group.reason, "transfer", group.targets, settings, true, group.score >= settings.autoThreshold, rule?.id ?? null);
  if (best) {
    const second = scored[1];
    return fromCandidate(line, best, !second || best.score - second.score >= 12, settings, rule);
  }
  const fee = feeCategory(line, rule);
  if (fee) {
    const auto = Boolean(rule?.autoApply) && settings.autoEnabled;
    return {
      lineId: line.id,
      score: auto ? 96 : 76,
      band: auto ? "auto" : "suggestion",
      reason: fee.reason,
      category: fee.category,
      targets: [{ id: "", kind: "fee", amount: line.amount, partyId: rule?.thirdPartyId ?? null }],
      ruleId: rule?.id ?? null,
      createPayment: false,
    };
  }
  return blank(line.id, "todo", 0, "Aucun rapprochement fiable.", null, null);
}

function fromCandidate(line: StatementLineInput, best: { candidate: MatchCandidate; score: number; reasons: string[]; exact: boolean; partial: boolean; anchored: boolean }, unique: boolean, settings: ReconciliationSettings, rule: MatchRule | null): ProposedMatch {
  const strongPartial = best.partial && best.anchored && dateDistance(line, best.candidate.date) <= settings.dateWindowDays;
  const auto = settings.autoEnabled && best.score >= settings.autoThreshold && unique && ((best.exact && best.anchored) || strongPartial);
  const band = auto ? "auto" : best.score >= settings.suggestThreshold ? "suggestion" : "todo";
  const category: MatchCategory = best.candidate.kind === "supplier_invoice" ? "supplier" : best.candidate.kind === "customer_invoice" ? "customer" : "transfer";
  return {
    lineId: line.id,
    score: best.score,
    band,
    reason: best.reasons.join(", "),
    category,
    targets: [{ id: best.candidate.id, kind: best.candidate.kind, amount: Math.min(line.amount, best.candidate.amount), partyId: best.candidate.partyId ?? null }],
    ruleId: rule?.id ?? null,
    createPayment: best.candidate.kind !== "transaction",
  };
}

function findGroup(line: StatementLineInput, candidates: MatchCandidate[]) {
  const pool = candidates
    .filter((candidate) => candidate.direction === line.direction && candidate.amount > 0.009 && candidate.amount + 0.015 < line.amount)
    .filter((candidate) => nameScore(line.label, candidate.partyName ?? "") >= 0.5 || documentMentioned(line.label, line.reference, candidate.number))
    .slice(0, 8);
  const parties = new Map<string, MatchCandidate[]>();
  for (const candidate of pool) {
    const key = candidate.partyId || candidate.partyName || "";
    if (!key) continue;
    parties.set(key, [...(parties.get(key) ?? []), candidate]);
  }
  let best: { score: number; reason: string; targets: MatchTarget[] } | null = null;
  for (const group of parties.values()) {
    const combinations = combinationsOf(group, 2, 4);
    for (const combo of combinations) {
      const sum = round2(combo.reduce((total, item) => total + item.amount, 0));
      if (Math.abs(sum - line.amount) >= 0.015) continue;
      const named = combo.some((item) => documentMentioned(line.label, line.reference, item.number));
      const score = named ? 94 : 80;
      if (best && best.score >= score) continue;
      best = {
        score,
        reason: named
          ? `virement groupé de ${combo.length} pièces, numéro reconnu`
          : `virement groupé de ${combo.length} pièces du même tiers`,
        targets: combo.map((item) => ({ id: item.id, kind: item.kind, amount: item.amount, partyId: item.partyId ?? null })),
      };
    }
  }
  return best;
}

function finish(lineId: string, score: number, reason: string, category: MatchCategory, targets: MatchTarget[], settings: ReconciliationSettings, exact: boolean, anchored: boolean, ruleId: string | null): ProposedMatch {
  const auto = settings.autoEnabled && score >= settings.autoThreshold && exact && anchored;
  return {
    lineId,
    score,
    band: auto ? "auto" : score >= settings.suggestThreshold ? "suggestion" : "todo",
    reason,
    category,
    targets,
    ruleId,
    createPayment: targets.some((target) => target.kind !== "transaction" && target.kind !== "fee"),
  };
}

function feeCategory(line: StatementLineInput, rule: MatchRule | null) {
  if (rule && ["fee", "commission", "vat_fee", "agio"].includes(rule.category)) {
    return { category: rule.category, reason: `Règle « ${rule.labelContains} » : ${feeLabel(rule.category)}` };
  }
  if (line.direction !== "out") return null;
  const folded = foldText(line.label);
  const found = FEE_PATTERNS.find((item) => item.pattern.test(folded));
  if (!found) return null;
  return { category: found.category, reason: `Libellé de ${feeLabel(found.category)}` };
}

function feeLabel(category: MatchCategory) {
  if (category === "agio") return "agios";
  if (category === "vat_fee") return "TVA sur frais";
  if (category === "commission" || category === "fee") return "frais ou commission bancaire";
  return "frais bancaire";
}

function blank(lineId: string, band: ProposedMatch["band"], score: number, reason: string, category: MatchCategory | null, ruleId: string | null): ProposedMatch {
  return { lineId, score, band, reason, category, targets: [], ruleId, createPayment: false };
}

function dateDistance(line: StatementLineInput, candidateDate: string) {
  const dates = [line.date, line.valueDate].filter((date): date is string => Boolean(date));
  if (!candidateDate || dates.length === 0) return 999;
  return Math.min(...dates.map((date) => Math.abs(Math.round((Date.parse(`${date}T00:00:00Z`) - Date.parse(`${candidateDate}T00:00:00Z`)) / 86_400_000))));
}

function significantTokens(value: string) {
  return foldText(value).split(" ").filter((token) => token.length > 2 && !STOPWORDS.has(token));
}

function compact(value: string) {
  return foldText(value).replace(/[^a-z0-9]/g, "");
}

function candidateKey(candidate: MatchCandidate) {
  return `${candidate.kind}:${candidate.id}`;
}

function combinationsOf(items: MatchCandidate[], min: number, max: number) {
  const found: MatchCandidate[][] = [];
  const walk = (start: number, chosen: MatchCandidate[]) => {
    if (chosen.length >= min) found.push([...chosen]);
    if (chosen.length === max) return;
    for (let index = start; index < items.length; index += 1) {
      chosen.push(items[index]);
      walk(index + 1, chosen);
      chosen.pop();
    }
  };
  walk(0, []);
  return found;
}

function round2(value: number) {
  return Math.round(value * 100) / 100;
}
