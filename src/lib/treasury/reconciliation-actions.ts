"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { generateBankFeeAccountingEntry, generateCustomerPaymentAccountingEntry, generateSupplierPaymentAccountingEntry, reverseAccountingEntry } from "@/lib/accounting-actions";
import { requireProWorkspace } from "@/lib/pro-access";
import { isMissingSchema } from "@/lib/optional-schema";
import { createClient } from "@/lib/supabase/server";
import { manualMatchError, planManualMatch } from "@/lib/treasury/manual-match";
import { loadManualMatchBoard } from "@/lib/treasury/manual-match-data";
import { labelKey, splitBankCharge, type ProposedMatch } from "@/lib/treasury/match-engine";
import { buildExpertState, type ExpertLineRecord } from "@/lib/treasury/reconciliation-view";
import type { TreasuryActionResult } from "@/lib/treasury-types";

function text(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? "").trim();
  return value === "" ? null : value;
}

function isRedirectError(error: unknown) {
  return typeof error === "object" && error !== null && "digest" in error && String((error as { digest?: string }).digest).startsWith("NEXT_REDIRECT");
}

export async function confirmExpertLine(prev: TreasuryActionResult, formData: FormData): Promise<TreasuryActionResult> {
  void prev;
  const accountId = text(formData, "account_id");
  const lineId = text(formData, "statement_line_id");
  if (!accountId || !lineId) return { success: false, error: "Ligne introuvable." };
  try {
    const workspace = await requireProWorkspace({ module: "tresorerie" });
    const state = await buildExpertState(accountId);
    const proposal = state.proposals.find((item) => item.lineId === lineId);
    const line = state.lines.find((item) => item.id === lineId);
    if (!proposal || !line || proposal.band === "todo" || proposal.targets.length === 0) {
      return { success: false, error: "Cette ligne n'a pas de proposition à valider." };
    }
    const applied = await applyProposal(workspace.organization.id, workspace.userId, line, proposal, proposal.band === "auto" ? "auto_confirmed" : "suggestion_confirmed");
    revalidateReconciliation();
    return applied;
  } catch (error) {
    if (isRedirectError(error)) throw error;
    return { success: false, error: error instanceof Error ? error.message : "Le rapprochement n'a pas abouti." };
  }
}

export async function confirmExpertAuto(prev: TreasuryActionResult, formData: FormData): Promise<TreasuryActionResult> {
  void prev;
  const accountId = text(formData, "account_id");
  if (!accountId) return { success: false, error: "Sélectionnez un compte." };
  try {
    const workspace = await requireProWorkspace({ module: "tresorerie" });
    const state = await buildExpertState(accountId);
    if (!state.view.settings.autoEnabled) return { success: false, error: "Le rapprochement automatique est désactivé pour cette entreprise." };
    const ready = state.proposals.filter((item) => item.band === "auto");
    let confirmed = 0;
    const warnings: string[] = [];
    for (const proposal of ready) {
      const line = state.lines.find((item) => item.id === proposal.lineId);
      if (!line) continue;
      const applied = await applyProposal(workspace.organization.id, workspace.userId, line, proposal, "auto_confirmed");
      if (applied.success) confirmed += 1;
      else if (applied.error) warnings.push(applied.error);
    }
    revalidateReconciliation();
    return { success: true, data: { message: `${confirmed} ligne${confirmed > 1 ? "s" : ""} rapprochée${confirmed > 1 ? "s" : ""}.${warnings.length ? ` ${warnings[0]}` : ""}` } };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Le rapprochement automatique n'a pas abouti." };
  }
}

export async function saveReconciliationSettings(prev: TreasuryActionResult, formData: FormData): Promise<TreasuryActionResult> {
  void prev;
  try {
    const workspace = await requireProWorkspace({ module: "tresorerie" });
    const autoThreshold = clamp(Number(formData.get("auto_threshold")), 80, 100, 92);
    const suggestThreshold = clamp(Number(formData.get("suggest_threshold")), 40, 90, 70);
    if (autoThreshold <= suggestThreshold) return { success: false, error: "Le seuil automatique doit être supérieur au seuil des suggestions." };
    const supabase = await createClient();
    const saved = await supabase.from("bank_reconciliation_settings").upsert({
      organization_id: workspace.organization.id,
      auto_threshold: autoThreshold,
      suggest_threshold: suggestThreshold,
      date_window_days: clamp(Number(formData.get("date_window_days")), 0, 15, 5),
      auto_enabled: formData.get("auto_enabled") === "on",
      updated_at: new Date().toISOString(),
    });
    if (isMissingSchema(saved.error)) return { success: false, error: "La migration 126 doit être appliquée avant d'enregistrer ces seuils." };
    if (saved.error) return { success: false, error: saved.error.message };
    revalidatePath("/tresorerie/rapprochement");
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Les seuils n'ont pas été enregistrés." };
  }
}

export async function saveBankMatchRule(prev: TreasuryActionResult, formData: FormData): Promise<TreasuryActionResult> {
  void prev;
  try {
    const workspace = await requireProWorkspace({ module: "tresorerie" });
    const label = text(formData, "label_contains");
    const category = text(formData, "category");
    if (!label || label.length < 2) return { success: false, error: "Indiquez un extrait de libellé d'au moins 2 caractères." };
    if (!category) return { success: false, error: "Choisissez une catégorie." };
    const supabase = await createClient();
    const id = text(formData, "id");
    const payload = {
      organization_id: workspace.organization.id,
      label_contains: label,
      direction: text(formData, "direction"),
      category,
      account_code: text(formData, "account_code"),
      auto_apply: formData.get("auto_apply") === "on",
      active: formData.get("active") !== "off",
    };
    const saved = id
      ? await supabase.from("bank_match_rules").update(payload).eq("organization_id", workspace.organization.id).eq("id", id)
      : await supabase.from("bank_match_rules").insert(payload);
    if (isMissingSchema(saved.error)) return { success: false, error: "La migration 126 doit être appliquée avant d'enregistrer une règle." };
    if (saved.error) return { success: false, error: saved.error.message };
    revalidatePath("/tresorerie/rapprochement/regles");
    redirect("/tresorerie/rapprochement/regles");
  } catch (error) {
    if (isRedirectError(error)) throw error;
    return { success: false, error: error instanceof Error ? error.message : "La règle n'a pas été enregistrée." };
  }
}

export async function deleteBankMatchRule(formData: FormData) {
  const workspace = await requireProWorkspace({ module: "tresorerie" });
  const id = text(formData, "id");
  if (!id) return;
  const supabase = await createClient();
  await supabase.from("bank_match_rules").delete().eq("organization_id", workspace.organization.id).eq("id", id);
  revalidatePath("/tresorerie/rapprochement/regles");
  redirect("/tresorerie/rapprochement/regles");
}

export async function undoExpertReconciliation(organizationId: string, userId: string, statementLineId: string, fallback: { createdPaymentId?: string; paymentKind?: "customer" | "supplier"; createdTransactionId?: string } = {}) {
  const supabase = await createClient();
  const latest = await supabase
    .from("bank_reconciliation_events")
    .select("id, action, payload")
    .eq("organization_id", organizationId)
    .eq("statement_line_id", statementLineId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (latest.error && isMissingSchema(latest.error)) return;
  if (latest.data?.action === "undone") return;
  const payload = { ...fallback, ...((latest.data?.payload ?? {}) as { createdPaymentId?: string; paymentKind?: "customer" | "supplier"; feeTransactionId?: string; accountingEntryId?: string; createdTransactionId?: string }) };
  if (payload.createdPaymentId && payload.paymentKind === "customer") {
    await supabase.rpc("cancel_customer_payment_atomic", { p_organization_id: organizationId, p_payment_id: payload.createdPaymentId });
  }
  if (payload.createdPaymentId && payload.paymentKind === "supplier") {
    await supabase.rpc("cancel_supplier_payment_atomic", { p_organization_id: organizationId, p_payment_id: payload.createdPaymentId });
  }
  if (payload.feeTransactionId) {
    await supabase.rpc("archive_treasury_transaction_atomic", { p_organization_id: organizationId, p_transaction_id: payload.feeTransactionId });
  }
  if (payload.createdTransactionId && payload.createdTransactionId !== payload.feeTransactionId) {
    await supabase.rpc("archive_treasury_transaction_atomic", { p_organization_id: organizationId, p_transaction_id: payload.createdTransactionId });
  }
  if (payload.accountingEntryId) await reverseAccountingEntry(payload.accountingEntryId);
  await supabase.from("bank_reconciliation_groups").update({ status: "cancelled" }).eq("organization_id", organizationId).eq("statement_line_id", statementLineId).eq("status", "confirmed");
  await supabase.from("bank_reconciliation_events").insert({
    organization_id: organizationId,
    statement_line_id: statementLineId,
    action: "undone",
    reason: "Annulation du rapprochement",
    payload,
    created_by: userId,
  });
}

async function applyProposal(organizationId: string, userId: string, line: ExpertLineRecord, proposal: ProposedMatch, action: "auto_confirmed" | "suggestion_confirmed"): Promise<TreasuryActionResult> {
  const supabase = await createClient();
  const warnings: string[] = [];
  let transactionId: string | null = null;
  let createdPaymentId: string | null = null;
  let paymentKind: "customer" | "supplier" | null = null;
  let accountingEntryId: string | null = null;
  const fee = proposal.targets.find((target) => target.kind === "fee");
  const transaction = proposal.targets.find((target) => target.kind === "transaction");
  if (fee) {
    const split = splitBankCharge(line.label, line.amount, proposal.category ?? "fee");
    const created = await supabase.rpc("create_treasury_transaction_atomic", {
      p_organization_id: organizationId,
      p_treasury_account_id: line.accountId,
      p_transaction_type: "bank_fee",
      p_direction: "out",
      p_amount: line.amount,
      p_transaction_date: line.date,
      p_idempotency_key: crypto.randomUUID(),
      p_value_date: line.valueDate,
      p_label: line.label,
      p_reference: line.reference,
      p_description: "Frais issu du rapprochement bancaire",
    });
    transactionId = firstId(created.data, "transaction_id");
    if (created.error || !transactionId) return { success: false, error: created.error?.message ?? "Le frais n'a pas pu être enregistré en trésorerie." };
    const entry = await generateBankFeeAccountingEntry({
      statementLineId: line.id,
      date: line.date,
      label: line.label,
      amount: line.amount,
      treasuryAccountId: line.accountId,
      category: proposal.category ?? "fee",
      net: split.net,
      vat: split.vat,
      expenseAccount: split.expenseAccount,
    });
    if (!entry.success) warnings.push(entry.error ?? "Écriture de frais non générée.");
    accountingEntryId = entry.data?.entry_id ?? null;
  } else if (transaction) {
    transactionId = transaction.id;
  } else {
    const invoices = proposal.targets.filter((target) => target.kind === "customer_invoice" || target.kind === "supplier_invoice");
    const partyId = invoices[0]?.partyId;
    if (!partyId || invoices.some((target) => target.partyId !== partyId)) return { success: false, error: "Le client ou le fournisseur n'est pas assez certain pour créer le règlement." };
    paymentKind = invoices[0].kind === "supplier_invoice" ? "supplier" : "customer";
    const amount = round2(invoices.reduce((sum, target) => sum + target.amount, 0));
    if (Math.abs(amount - line.amount) > 0.02 && invoices.length > 1) return { success: false, error: "Le total des pièces ne correspond pas au virement." };
    const paymentAmount = invoices.length > 1 ? amount : line.amount;
    const created = paymentKind === "customer"
      ? await supabase.rpc("create_customer_payment_atomic", {
        p_organization_id: organizationId,
        p_third_party_id: partyId,
        p_treasury_account_id: line.accountId,
        p_amount: paymentAmount,
        p_payment_date: line.date,
        p_idempotency_key: crypto.randomUUID(),
        p_allocations: invoices.map((target) => ({ invoice_id: target.id, amount: target.amount })),
        p_value_date: line.valueDate,
        p_payment_method: "bank_transfer",
        p_payment_type: "customer_payment",
        p_source_type: "bank_import",
        p_reference: line.reference,
        p_internal_notes: `rapprochement:${line.id}`,
        p_created_by: userId,
      })
      : await supabase.rpc("create_supplier_payment_atomic", {
        p_organization_id: organizationId,
        p_supplier_id: partyId,
        p_treasury_account_id: line.accountId,
        p_amount: paymentAmount,
        p_payment_date: line.date,
        p_idempotency_key: crypto.randomUUID(),
        p_allocations: invoices.map((target) => ({ invoice_id: target.id, amount: target.amount })),
        p_value_date: line.valueDate,
        p_payment_method: "bank_transfer",
        p_reference: line.reference,
        p_notes: `rapprochement:${line.id}`,
      });
    createdPaymentId = firstId(created.data, "payment_id");
    if (created.error || !createdPaymentId) return { success: false, error: created.error?.message ?? "Le règlement n'a pas pu être créé." };
    const tx = await supabase.from("treasury_transactions").select("id").eq("organization_id", organizationId).eq(paymentKind === "customer" ? "customer_payment_id" : "supplier_payment_id", createdPaymentId).is("archived_at", null).maybeSingle();
    transactionId = (tx.data?.id as string | undefined) ?? null;
    if (!transactionId) return { success: false, error: "Le règlement est créé, mais le mouvement de trésorerie est introuvable." };
    const entry = paymentKind === "customer"
      ? await generateCustomerPaymentAccountingEntry(createdPaymentId)
      : await generateSupplierPaymentAccountingEntry(createdPaymentId);
    if (!entry.success) warnings.push(entry.error ?? "Écriture comptable non générée.");
    else accountingEntryId = entry.data?.entry_id ?? null;
    await remember(organizationId, line, partyId, proposal.category);
  }
  const linked = await linkLine(organizationId, userId, line, transactionId, proposal);
  if (!linked.success) return linked;
  const groupInsert = await supabase.from("bank_reconciliation_groups").insert({
    organization_id: organizationId,
    statement_line_id: line.id,
    kind: fee ? "fee" : proposal.targets.length > 1 ? "grouped" : proposal.reason.includes("partiel") ? "partial" : "single",
    status: "confirmed",
    score: proposal.score,
    reason: proposal.reason,
  }).select("id").single();
  if (groupInsert.data?.id) {
    await supabase.from("bank_reconciliation_group_items").insert(proposal.targets.map((target) => ({
      organization_id: organizationId,
      group_id: groupInsert.data.id,
      target_type: target.kind,
      target_id: target.id || null,
      amount: target.amount,
    })));
  }
  const eventPayload = {
    organization_id: organizationId,
    treasury_account_id: line.accountId,
    statement_line_id: line.id,
    action: fee ? "fee_booked" : action,
    score: proposal.score,
    reason: proposal.reason,
    payload: { createdPaymentId, paymentKind, feeTransactionId: fee ? transactionId : null, accountingEntryId, createdTransactionId: transactionId },
    created_payment_id: createdPaymentId,
    created_transaction_id: transactionId,
    payment_kind: paymentKind,
    created_by: userId,
  };
  let event = await supabase.from("bank_reconciliation_events").insert(eventPayload);
  if (event.error && isMissingSchema(event.error)) {
    const { created_payment_id, created_transaction_id, payment_kind, ...legacy } = eventPayload;
    void created_payment_id; void created_transaction_id; void payment_kind;
    event = await supabase.from("bank_reconciliation_events").insert(legacy);
  }
  if (event.error && !isMissingSchema(event.error)) warnings.push("Le journal du rapprochement n'a pas été écrit.");
  return { success: true, data: { message: warnings[0] } };
}

async function linkLine(organizationId: string, userId: string, line: ExpertLineRecord, transactionId: string, proposal: ProposedMatch): Promise<TreasuryActionResult> {
  const supabase = await createClient();
  const inserted = await supabase.from("bank_reconciliations").insert({
    organization_id: organizationId,
    treasury_account_id: line.accountId,
    statement_line_id: line.id,
    transaction_id: transactionId,
    amount: line.amount,
    created_by: userId,
    notes: proposal.reason,
  });
  if (inserted.error) return { success: false, error: inserted.error.message };
  await Promise.all([
    supabase.from("bank_statement_lines").update({
      reconciliation_status: "reconciled",
      matched_transaction_id: transactionId,
      matched_at: new Date().toISOString(),
      matched_by: userId,
      match_score: proposal.score,
      match_reason: proposal.reason,
    }).eq("organization_id", organizationId).eq("id", line.id),
    supabase.from("treasury_transactions").update({
      reconciliation_status: "reconciled",
      reconciled_at: new Date().toISOString(),
      reconciled_by: userId,
    }).eq("organization_id", organizationId).eq("id", transactionId),
  ]);
  return { success: true };
}

async function remember(organizationId: string, line: ExpertLineRecord, partyId: string, category: ProposedMatch["category"]) {
  const key = labelKey(line.label);
  if (!key) return;
  const supabase = await createClient();
  const existing = await supabase.from("bank_match_learnings").select("id, confirmations").eq("organization_id", organizationId).eq("label_key", key).eq("direction", line.direction).maybeSingle();
  if (existing.error) return;
  if (existing.data?.id) {
    await supabase.from("bank_match_learnings").update({ confirmations: Number(existing.data.confirmations ?? 1) + 1, third_party_id: partyId, category, updated_at: new Date().toISOString() }).eq("id", existing.data.id);
  } else {
    await supabase.from("bank_match_learnings").insert({ organization_id: organizationId, label_key: key, direction: line.direction, third_party_id: partyId, category, confirmations: 1 });
  }
}

function firstId(data: unknown, key: string) {
  const row = Array.isArray(data) ? data[0] : data;
  if (!row || typeof row !== "object" || !(key in row)) return null;
  const value = (row as Record<string, unknown>)[key];
  return typeof value === "string" ? value : null;
}

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

function clamp(value: number, min: number, max: number, fallback: number) {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, Math.round(value)));
}

export async function saveManualMatch(prev: TreasuryActionResult, formData: FormData): Promise<TreasuryActionResult> {
  void prev;
  try {
    const workspace = await requireProWorkspace({ module: "tresorerie" });
    const accountId = text(formData, "account_id");
    if (!accountId) return { success: false, error: "Sélectionnez un compte." };
    const board = await loadManualMatchBoard(accountId);
    if (board.pendingMigration) return { success: false, error: manualMatchError("PGRST202") };
    const lines = formData.getAll("line_id").map(String).filter(Boolean).map((id) => {
      const line = board.lines.find((item) => item.id === id);
      return line ? { ...line, amount: numberAmount(formData.get(`line_amount_${id}`)) } : null;
    });
    const documents = formData.getAll("document_id").map(String).filter(Boolean).map((key) => {
      const [kind, id] = key.split(":");
      const document = board.documents.find((item) => item.kind === kind && item.id === id);
      return document ? { ...document, amount: numberAmount(formData.get(`document_amount_${kind}_${id}`)) } : null;
    });
    if (lines.some((line) => !line) || documents.some((document) => !document)) {
      return { success: false, error: "Une ligne ou une pièce n'est plus disponible. Actualisez la page." };
    }
    const planned = planManualMatch(lines.flatMap((line) => line ? [line] : []), documents.flatMap((document) => document ? [document] : []));
    if (!planned.ok) return { success: false, error: planned.error };
    const supabase = await createClient();
    const saved = await supabase.rpc("save_bank_manual_match", {
      p_organization_id: workspace.organization.id,
      p_treasury_account_id: accountId,
      p_lines: planned.plan.lines,
      p_documents: planned.plan.documents,
    });
    if (saved.error) return { success: false, error: manualMatchError(`${saved.error.code ?? ""} ${saved.error.message ?? ""}`) };
    revalidateReconciliation();
    const label = planned.plan.kind === "grouped" ? "groupé" : "partiel";
    return { success: true, data: { message: `Rapprochement ${label} enregistré${planned.plan.partial ? " pour une partie des montants" : ""}.` } };
  } catch (error) {
    if (isRedirectError(error)) throw error;
    return { success: false, error: error instanceof Error ? error.message : "Le rapprochement manuel n'a pas abouti." };
  }
}

export async function undoManualMatch(prev: TreasuryActionResult, formData: FormData): Promise<TreasuryActionResult> {
  void prev;
  try {
    const workspace = await requireProWorkspace({ module: "tresorerie" });
    const matchId = text(formData, "match_id");
    if (!matchId) return { success: false, error: "Rapprochement introuvable." };
    const supabase = await createClient();
    const undone = await supabase.rpc("undo_bank_manual_match", {
      p_organization_id: workspace.organization.id,
      p_match_id: matchId,
    });
    if (undone.error) return { success: false, error: manualMatchError(`${undone.error.code ?? ""} ${undone.error.message ?? ""}`) };
    revalidateReconciliation();
    return { success: true, data: { message: "Le rapprochement manuel est annulé. Les lignes couvertes seulement en partie redeviennent ouvertes." } };
  } catch (error) {
    if (isRedirectError(error)) throw error;
    return { success: false, error: error instanceof Error ? error.message : "L'annulation n'a pas abouti." };
  }
}

function numberAmount(value: FormDataEntryValue | null) {
  const parsed = Number(String(value ?? "").replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
}

function revalidateReconciliation() {
  revalidatePath("/tresorerie/rapprochement");
  revalidatePath("/tresorerie/releves");
  revalidatePath("/tresorerie/mouvements");
  revalidatePath("/facturation/paiements");
  revalidatePath("/facturation/factures");
  revalidatePath("/comptabilite/ecritures");
}
