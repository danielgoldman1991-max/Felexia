"use server";

import { createHash } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireActiveWorkspace } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { TreasuryActionResult, TreasuryAccountType, TreasuryTransactionDirection, TreasuryTransactionType } from "@/lib/treasury-types";

function text(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? "").trim();
  return value === "" ? null : value;
}

function num(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function hashValue(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function normalizeFingerprintPart(value: unknown) {
  return String(value ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

function isMissingTreasuryImportColumn(error: { message?: string } | null | undefined) {
  return Boolean(error?.message?.includes("does not exist") || error?.message?.includes("schema cache"));
}

function financialIntegrityError(error: { code?: string; message?: string } | null | undefined) {
  if (error?.code === "PGRST202" || error?.code === "42883" || error?.message?.includes("schema cache")) {
    return "La mise a niveau de securite financiere doit etre appliquee avant cette operation.";
  }
  return error?.message ?? "L'operation financiere n'a pas pu etre confirmee.";
}

async function generateBankStatementImportCode(organizationId: string) {
  const supabase = await createClient();
  const now = new Date();
  const prefix = `IMP-BQ-${String(now.getFullYear()).slice(2)}${String(now.getMonth() + 1).padStart(2, "0")}`;
  const { data, error } = await supabase
    .from("bank_statement_imports")
    .select("import_code")
    .eq("organization_id", organizationId)
    .ilike("import_code", `${prefix}-%`)
    .order("import_code", { ascending: false })
    .limit(1);
  if (error) throw new Error(error.message);
  const last = data?.[0]?.import_code ? Number(String(data[0].import_code).split("-").at(-1) ?? 0) : 0;
  return `${prefix}-${String(last + 1).padStart(5, "0")}`;
}

async function recalculateBankStatementImportStatus(importId: string, organizationId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("bank_statement_lines")
    .select("reconciliation_status")
    .eq("organization_id", organizationId)
    .eq("import_id", importId);
  if (error) return error.message;
  const lines = data ?? [];
  const importedLinesCount = lines.length;
  const matchedLinesCount = lines.filter((line) => ["reconciled", "ignored"].includes(String(line.reconciliation_status))).length;
  const unmatchedLinesCount = importedLinesCount - matchedLinesCount;
  const status = importedLinesCount > 0 && unmatchedLinesCount === 0 ? "reconciled" : matchedLinesCount > 0 ? "partially_reconciled" : "imported";
  const update = await supabase
    .from("bank_statement_imports")
    .update({ imported_lines_count: importedLinesCount, matched_lines_count: matchedLinesCount, unmatched_lines_count: unmatchedLinesCount, status })
    .eq("organization_id", organizationId)
    .eq("id", importId);
  return update.error?.message ?? null;
}

async function applyDefaultAccount(organizationId: string, id: string) {
  const supabase = await createClient();
  const reset = await supabase.from("treasury_accounts").update({ is_default: false }).eq("organization_id", organizationId);
  if (reset.error) return reset.error.message;
  const set = await supabase.from("treasury_accounts").update({ is_default: true, status: "active", archived_at: null }).eq("organization_id", organizationId).eq("id", id);
  return set.error?.message ?? null;
}

export async function createTreasuryAccount(prev: TreasuryActionResult, formData: FormData): Promise<TreasuryActionResult> {
  void prev;
  const workspace = await requireActiveWorkspace();
  const name = text(formData, "name");
  if (!name) return { success: false, error: "Le nom du compte est obligatoire." };
  const opening = num(formData.get("opening_balance"));
  const isDefault = formData.get("is_default") === "on";
  const supabase = await createClient();
  const { data, error } = await supabase.from("treasury_accounts").insert({
    organization_id: workspace.organization.id,
    name,
    code: text(formData, "code"),
    account_type: (text(formData, "account_type") ?? "bank") as TreasuryAccountType,
    bank_name: text(formData, "bank_name"),
    agency_name: text(formData, "agency_name"),
    rib: text(formData, "rib"),
    iban: text(formData, "iban"),
    swift: text(formData, "swift"),
    account_number: text(formData, "account_number"),
    currency: text(formData, "currency") ?? "MAD",
    opening_balance: opening,
    current_balance: opening,
    opening_balance_date: text(formData, "opening_balance_date"),
    is_default: isDefault,
    status: text(formData, "status") ?? "active",
    notes: text(formData, "notes"),
    created_by: workspace.userId,
  }).select("id").single();
  if (error || !data) return { success: false, error: error?.message ?? "Impossible de creer le compte." };
  if (isDefault) {
    const defaultError = await applyDefaultAccount(workspace.organization.id, data.id);
    if (defaultError) return { success: false, error: defaultError };
  }
  revalidatePath("/tresorerie/comptes");
  redirect(`/tresorerie/comptes/${data.id}`);
}

export async function updateTreasuryAccount(prev: TreasuryActionResult, formData: FormData): Promise<TreasuryActionResult> {
  void prev;
  const workspace = await requireActiveWorkspace();
  const id = text(formData, "id");
  if (!id) return { success: false, error: "Compte introuvable." };
  const name = text(formData, "name");
  if (!name) return { success: false, error: "Le nom du compte est obligatoire." };
  const isDefault = formData.get("is_default") === "on";
  const supabase = await createClient();
  const { error } = await supabase.from("treasury_accounts").update({
    name,
    code: text(formData, "code"),
    account_type: text(formData, "account_type") ?? "bank",
    bank_name: text(formData, "bank_name"),
    agency_name: text(formData, "agency_name"),
    rib: text(formData, "rib"),
    iban: text(formData, "iban"),
    swift: text(formData, "swift"),
    account_number: text(formData, "account_number"),
    currency: text(formData, "currency") ?? "MAD",
    opening_balance_date: text(formData, "opening_balance_date"),
    is_default: isDefault,
    status: text(formData, "status") ?? "active",
    notes: text(formData, "notes"),
  }).eq("organization_id", workspace.organization.id).eq("id", id);
  if (error) return { success: false, error: error.message };
  if (isDefault) {
    const defaultError = await applyDefaultAccount(workspace.organization.id, id);
    if (defaultError) return { success: false, error: defaultError };
  }
  revalidatePath(`/tresorerie/comptes/${id}`);
  redirect(`/tresorerie/comptes/${id}`);
}

export async function archiveTreasuryAccount(prev: TreasuryActionResult, formData: FormData): Promise<TreasuryActionResult> {
  void prev;
  const workspace = await requireActiveWorkspace();
  const id = text(formData, "id");
  if (!id) return { success: false, error: "Compte introuvable." };
  const supabase = await createClient();
  const { error } = await supabase.from("treasury_accounts").update({ status: "archived", archived_at: new Date().toISOString(), is_default: false }).eq("organization_id", workspace.organization.id).eq("id", id);
  if (error) return { success: false, error: error.message };
  revalidatePath("/tresorerie/comptes");
  return { success: true };
}

export async function setDefaultTreasuryAccount(prev: TreasuryActionResult, formData: FormData): Promise<TreasuryActionResult> {
  void prev;
  const workspace = await requireActiveWorkspace();
  const id = text(formData, "id");
  if (!id) return { success: false, error: "Compte introuvable." };
  const error = await applyDefaultAccount(workspace.organization.id, id);
  if (error) return { success: false, error };
  revalidatePath("/tresorerie/comptes");
  return { success: true };
}

export async function createManualTreasuryTransaction(prev: TreasuryActionResult, formData: FormData): Promise<TreasuryActionResult> {
  void prev;
  const workspace = await requireActiveWorkspace();
  const accountId = text(formData, "treasury_account_id");
  const operationMode = text(formData, "operation_mode") ?? "movement";
  const amount = num(formData.get("amount"));
  const direction = (text(formData, "direction") ?? "in") as TreasuryTransactionDirection;
  const label = text(formData, "label");
  if (!accountId) return { success: false, error: "Selectionnez un compte." };
  if (amount <= 0) return { success: false, error: "Le montant doit etre superieur a zero." };
  if (!label) return { success: false, error: "Le libelle est obligatoire." };
  const supabase = await createClient();

  if (operationMode === "transfer") {
    const destinationAccountId = text(formData, "destination_account_id");
    if (!destinationAccountId) return { success: false, error: "Selectionnez le compte de destination." };
    if (destinationAccountId === accountId) return { success: false, error: "Les comptes source et destination doivent etre differents." };
    const { data: transfer, error: transferError } = await supabase.rpc("create_treasury_transfer", {
      p_source_account_id: accountId,
      p_destination_account_id: destinationAccountId,
      p_amount: amount,
      p_transaction_date: text(formData, "transaction_date") ?? new Date().toISOString().slice(0, 10),
      p_value_date: text(formData, "value_date"),
      p_label: label,
      p_reference: text(formData, "reference"),
      p_description: text(formData, "description"),
      p_idempotency_key: text(formData, "idempotency_key"),
    });
    if (transferError) return { success: false, error: financialIntegrityError(transferError) };
    const row = (transfer as Array<{ outgoing_transaction_id?: string }> | null)?.[0];
    if (!row?.outgoing_transaction_id) return { success: false, error: "Le transfert n'a pas pu etre confirme." };
    revalidatePath("/tresorerie/mouvements");
    revalidatePath("/tresorerie/comptes");
    redirect(`/tresorerie/mouvements/${row.outgoing_transaction_id}`);
  }

  const type = (text(formData, "transaction_type") ?? (direction === "in" ? "manual_in" : "manual_out")) as TreasuryTransactionType;
  const { data, error } = await supabase.rpc("create_treasury_transaction_atomic", {
    p_organization_id: workspace.organization.id,
    p_treasury_account_id: accountId,
    p_transaction_type: type,
    p_direction: direction,
    p_amount: amount,
    p_transaction_date: text(formData, "transaction_date") ?? new Date().toISOString().slice(0, 10),
    p_idempotency_key: text(formData, "idempotency_key"),
    p_value_date: text(formData, "value_date"),
    p_label: label,
    p_reference: text(formData, "reference"),
    p_description: text(formData, "description"),
    p_third_party_id: text(formData, "third_party_id"),
  });
  if (error) return { success: false, error: financialIntegrityError(error) };
  const row = (data as Array<{ transaction_id?: string }> | null)?.[0];
  if (!row?.transaction_id) return { success: false, error: "Le mouvement n'a pas pu etre confirme." };
  revalidatePath("/tresorerie/mouvements");
  revalidatePath("/tresorerie/comptes");
  redirect(`/tresorerie/mouvements/${row.transaction_id}`);
}

export async function archiveTreasuryTransaction(prev: TreasuryActionResult, formData: FormData): Promise<TreasuryActionResult> {
  void prev;
  const workspace = await requireActiveWorkspace();
  const id = text(formData, "id");
  if (!id) return { success: false, error: "Mouvement introuvable." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("archive_treasury_transaction_atomic", {
    p_organization_id: workspace.organization.id,
    p_transaction_id: id,
  });
  if (error) return { success: false, error: financialIntegrityError(error) };
  revalidatePath("/tresorerie/mouvements");
  revalidatePath("/tresorerie/comptes");
  return { success: true };
}

function parseCsv(textContent: string) {
  const lines = textContent.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map((header) => header.trim().toLowerCase());
  return lines.slice(1).map((line) => {
    const cells = line.split(",").map((cell) => cell.trim());
    return Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? ""]));
  });
}

export async function importBankStatement(prev: TreasuryActionResult, formData: FormData): Promise<TreasuryActionResult> {
  void prev;
  const workspace = await requireActiveWorkspace();
  const accountId = text(formData, "treasury_account_id");
  const file = formData.get("file");
  if (!accountId) return { success: false, error: "Selectionnez un compte bancaire." };
  if (!(file instanceof File) || file.size === 0) return { success: false, error: "Selectionnez un fichier CSV." };
  const fileContent = await file.text();
  const fileHash = hashValue(fileContent);
  const rows = parseCsv(fileContent);
  if (rows.length === 0) return { success: false, error: "Le fichier CSV ne contient aucune ligne exploitable." };
  const supabase = await createClient();
  const parsed = rows.map((row) => {
    const debit = num(row.debit);
    const credit = num(row.credit);
    const amount = credit > 0 ? credit : debit;
    return {
      operation_date: row.date || row.operation_date,
      value_date: row.value_date || null,
      label: row.label || row.libelle || "Operation bancaire",
      reference: row.reference || null,
      debit_amount: debit,
      credit_amount: credit,
      amount,
      direction: credit > 0 ? "in" : "out",
      balance_after: row.balance ? num(row.balance) : null,
      raw_data: row,
    };
  }).filter((row) => row.operation_date && row.amount > 0);
  if (parsed.length === 0) return { success: false, error: "Aucune ligne valide a importer." };
  const sameFileResult = await supabase
    .from("bank_statement_imports")
    .select("id")
    .eq("organization_id", workspace.organization.id)
    .eq("treasury_account_id", accountId)
    .eq("file_hash", fileHash)
    .is("archived_at", null)
    .limit(1)
    .maybeSingle();
  if (isMissingTreasuryImportColumn(sameFileResult.error)) return { success: false, error: "La migration 032 des releves bancaires doit etre appliquee avant d importer un releve." };
  const sameFile = sameFileResult.data;
  if (sameFile?.id) return { success: false, error: "Ce releve bancaire semble deja avoir ete importe sur ce compte." };

  const operationDates = parsed.map((row) => String(row.operation_date)).sort();
  const periodStart = operationDates[0];
  const periodEnd = operationDates[operationDates.length - 1];
  const totalDebit = parsed.reduce((sum, row) => sum + Number(row.debit_amount ?? 0), 0);
  const totalCredit = parsed.reduce((sum, row) => sum + Number(row.credit_amount ?? 0), 0);
  const statementFingerprint = hashValue([accountId, periodStart, periodEnd, parsed.length, totalDebit.toFixed(2), totalCredit.toFixed(2), parsed[0]?.balance_after ?? "", parsed.at(-1)?.balance_after ?? ""].map(normalizeFingerprintPart).join("|"));
  const sameStatementResult = await supabase
    .from("bank_statement_imports")
    .select("id")
    .eq("organization_id", workspace.organization.id)
    .eq("treasury_account_id", accountId)
    .eq("statement_fingerprint", statementFingerprint)
    .is("archived_at", null)
    .limit(1)
    .maybeSingle();
  if (isMissingTreasuryImportColumn(sameStatementResult.error)) return { success: false, error: "La migration 032 des releves bancaires doit etre appliquee avant d importer un releve." };
  const sameStatement = sameStatementResult.data;
  if (sameStatement?.id) return { success: false, error: "Un releve couvrant la meme periode et les memes montants semble deja importe." };

  const linesWithFingerprints = parsed.map((row) => {
    const lineFingerprint = hashValue([accountId, row.operation_date, row.value_date, row.label, row.reference, row.direction, Number(row.amount).toFixed(2), Number(row.debit_amount).toFixed(2), Number(row.credit_amount).toFixed(2), row.balance_after ?? ""].map(normalizeFingerprintPart).join("|"));
    return { ...row, line_hash: lineFingerprint, line_fingerprint: lineFingerprint };
  });
  const existingLinesResult = await supabase
    .from("bank_statement_lines")
    .select("line_fingerprint")
    .eq("organization_id", workspace.organization.id)
    .eq("treasury_account_id", accountId)
    .in("line_fingerprint", linesWithFingerprints.map((row) => row.line_fingerprint));
  if (isMissingTreasuryImportColumn(existingLinesResult.error)) return { success: false, error: "La migration 032 des releves bancaires doit etre appliquee avant d importer un releve." };
  const existingLines = existingLinesResult.data;
  if ((existingLines?.length ?? 0) === linesWithFingerprints.length) return { success: false, error: "Ce releve bancaire semble deja avoir ete importe." };
  if ((existingLines?.length ?? 0) > 0) return { success: false, error: "Certaines lignes de ce releve existent deja. Import annule pour eviter les doublons." };

  const importCode = await generateBankStatementImportCode(workspace.organization.id);
  const { data: imported, error } = await supabase.from("bank_statement_imports").insert({
    organization_id: workspace.organization.id,
    treasury_account_id: accountId,
    import_code: importCode,
    file_name: file.name,
    file_type: "csv",
    file_hash: fileHash,
    statement_fingerprint: statementFingerprint,
    period_start: periodStart,
    period_end: periodEnd,
    imported_lines_count: linesWithFingerprints.length,
    unmatched_lines_count: linesWithFingerprints.length,
    imported_by: workspace.userId,
  }).select("id").single();
  if (error || !imported) return { success: false, error: isMissingTreasuryImportColumn(error) ? "La migration 032 des releves bancaires doit etre appliquee avant d importer un releve." : error?.message ?? "Import impossible." };
  const lineInsert = await supabase.from("bank_statement_lines").insert(linesWithFingerprints.map((row) => ({ ...row, organization_id: workspace.organization.id, import_id: imported.id, treasury_account_id: accountId })));
  if (lineInsert.error) return { success: false, error: isMissingTreasuryImportColumn(lineInsert.error) ? "La migration 032 des releves bancaires doit etre appliquee avant d importer un releve." : lineInsert.error.message };
  revalidatePath("/tresorerie/releves");
  redirect(`/tresorerie/releves/${imported.id}`);
}

export async function cancelBankStatementImport(prev: TreasuryActionResult, formData: FormData): Promise<TreasuryActionResult> {
  void prev;
  const workspace = await requireActiveWorkspace();
  const id = text(formData, "id");
  if (!id) return { success: false, error: "Import introuvable." };
  const supabase = await createClient();
  const { error } = await supabase.from("bank_statement_imports").update({ status: "cancelled", archived_at: new Date().toISOString() }).eq("organization_id", workspace.organization.id).eq("id", id);
  if (error) return { success: false, error: error.message };
  revalidatePath("/tresorerie/releves");
  return { success: true };
}

export async function reconcileStatementLineWithTransaction(prev: TreasuryActionResult, formData: FormData): Promise<TreasuryActionResult> {
  void prev;
  const workspace = await requireActiveWorkspace();
  const statementLineId = text(formData, "statement_line_id");
  const transactionId = text(formData, "transaction_id");
  if (!statementLineId || !transactionId) return { success: false, error: "Selection incomplete." };
  const supabase = await createClient();
  const [{ data: line }, { data: tx }] = await Promise.all([
    supabase.from("bank_statement_lines").select("*").eq("organization_id", workspace.organization.id).eq("id", statementLineId).maybeSingle(),
    supabase.from("treasury_transactions").select("*").eq("organization_id", workspace.organization.id).eq("id", transactionId).maybeSingle(),
  ]);
  if (!line || !tx) return { success: false, error: "Ligne ou mouvement introuvable." };
  if (line.treasury_account_id !== tx.treasury_account_id || line.direction !== tx.direction) return { success: false, error: "Le compte et le sens doivent correspondre." };
  if (Math.abs(Number(line.amount) - Number(tx.amount)) > 0.01) return { success: false, error: "Les montants doivent correspondre pour cette V1." };
  if (line.reconciliation_status === "reconciled" || tx.reconciliation_status === "reconciled") return { success: false, error: "Element deja rapproche." };
  const { error } = await supabase.from("bank_reconciliations").insert({ organization_id: workspace.organization.id, treasury_account_id: line.treasury_account_id, statement_line_id: statementLineId, transaction_id: transactionId, amount: line.amount, created_by: workspace.userId });
  if (error) return { success: false, error: error.message };
  await Promise.all([
    supabase.from("bank_statement_lines").update({ reconciliation_status: "reconciled", matched_transaction_id: transactionId, matched_at: new Date().toISOString(), matched_by: workspace.userId }).eq("id", statementLineId),
    supabase.from("treasury_transactions").update({ reconciliation_status: "reconciled", reconciled_at: new Date().toISOString(), reconciled_by: workspace.userId }).eq("id", transactionId),
  ]);
  await recalculateBankStatementImportStatus(line.import_id, workspace.organization.id);
  revalidatePath("/tresorerie/rapprochement");
  revalidatePath("/tresorerie/releves");
  return { success: true };
}

export async function confirmAutomaticReconciliations(prev: TreasuryActionResult, formData: FormData): Promise<TreasuryActionResult> {
  void prev;
  const workspace = await requireActiveWorkspace();
  const selected = formData.getAll("suggestions").map((value) => String(value));
  if (selected.length === 0) return { success: false, error: "Selectionnez au moins une suggestion." };
  const supabase = await createClient();
  let confirmed = 0;
  let ignored = 0;
  const touchedImports = new Set<string>();
  for (const value of selected) {
    const [statementLineId, transactionId, scoreRaw, reasonRaw] = value.split("::");
    if (!statementLineId || !transactionId) {
      ignored += 1;
      continue;
    }
    const [{ data: line }, { data: tx }] = await Promise.all([
      supabase.from("bank_statement_lines").select("*").eq("organization_id", workspace.organization.id).eq("id", statementLineId).maybeSingle(),
      supabase.from("treasury_transactions").select("*").eq("organization_id", workspace.organization.id).eq("id", transactionId).maybeSingle(),
    ]);
    if (!line || !tx || line.reconciliation_status !== "unreconciled" || tx.reconciliation_status !== "unreconciled" || line.treasury_account_id !== tx.treasury_account_id || line.direction !== tx.direction || Math.abs(Number(line.amount) - Number(tx.amount)) > 0.01) {
      ignored += 1;
      continue;
    }
    const { error } = await supabase.from("bank_reconciliations").insert({ organization_id: workspace.organization.id, treasury_account_id: line.treasury_account_id, statement_line_id: statementLineId, transaction_id: transactionId, amount: line.amount, created_by: workspace.userId });
    if (error) {
      ignored += 1;
      continue;
    }
    await Promise.all([
      supabase.from("bank_statement_lines").update({ reconciliation_status: "reconciled", matched_transaction_id: transactionId, matched_at: new Date().toISOString(), matched_by: workspace.userId, match_score: num(scoreRaw), match_reason: decodeURIComponent(reasonRaw ?? "") }).eq("id", statementLineId),
      supabase.from("treasury_transactions").update({ reconciliation_status: "reconciled", reconciled_at: new Date().toISOString(), reconciled_by: workspace.userId }).eq("id", transactionId),
    ]);
    touchedImports.add(String(line.import_id));
    confirmed += 1;
  }
  for (const importId of touchedImports) {
    await recalculateBankStatementImportStatus(importId, workspace.organization.id);
  }
  revalidatePath("/tresorerie/rapprochement");
  revalidatePath("/tresorerie/releves");
  return { success: true, data: { message: `${confirmed} rapprochements confirmes. ${ignored} ignores car deja rapproches ou modifies.` } };
}

export async function ignoreStatementLine(prev: TreasuryActionResult, formData: FormData): Promise<TreasuryActionResult> {
  void prev;
  const workspace = await requireActiveWorkspace();
  const id = text(formData, "statement_line_id");
  if (!id) return { success: false, error: "Ligne introuvable." };
  const supabase = await createClient();
  const { error } = await supabase.from("bank_statement_lines").update({ reconciliation_status: "ignored" }).eq("organization_id", workspace.organization.id).eq("id", id);
  if (error) return { success: false, error: error.message };
  const { data: line } = await supabase.from("bank_statement_lines").select("import_id").eq("organization_id", workspace.organization.id).eq("id", id).maybeSingle();
  if (line?.import_id) await recalculateBankStatementImportStatus(line.import_id as string, workspace.organization.id);
  revalidatePath("/tresorerie/rapprochement");
  revalidatePath("/tresorerie/releves");
  return { success: true };
}

export async function createTransactionFromStatementLine(prev: TreasuryActionResult, formData: FormData): Promise<TreasuryActionResult> {
  void prev;
  const workspace = await requireActiveWorkspace();
  const id = text(formData, "statement_line_id");
  if (!id) return { success: false, error: "Ligne introuvable." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_treasury_transaction_from_statement_line_atomic", {
    p_organization_id: workspace.organization.id,
    p_statement_line_id: id,
  });
  if (error) return { success: false, error: financialIntegrityError(error) };
  const row = (data as Array<{ transaction_id?: string }> | null)?.[0];
  if (!row?.transaction_id) return { success: false, error: "Le mouvement n'a pas pu etre confirme." };
  const { data: line } = await supabase.from("bank_statement_lines").select("import_id").eq("organization_id", workspace.organization.id).eq("id", id).maybeSingle();
  if (line?.import_id) await recalculateBankStatementImportStatus(String(line.import_id), workspace.organization.id);
  revalidatePath("/tresorerie/rapprochement");
  revalidatePath("/tresorerie/releves");
  revalidatePath("/tresorerie/mouvements");
  revalidatePath("/tresorerie/comptes");
  return { success: true };
}

export async function unreconcileStatementLine(prev: TreasuryActionResult, formData: FormData): Promise<TreasuryActionResult> {
  void prev;
  void formData;
  return { success: false, error: "Annulation de rapprochement prevue dans une prochaine iteration." };
}
