"use server";

import { financialErrorMessage } from "@/lib/financial-errors";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireActiveWorkspace } from "@/lib/auth";
import { requireProWorkspace } from "@/lib/pro-access";
import { isOperatorRole, OPERATOR_ACCESS_ERROR } from "@/lib/auth/operator-access";
import { isAccountingRole } from "@/lib/auth/roles";
import { logAudit } from "@/lib/audit";
import { createClient } from "@/lib/supabase/server";
import { getAccountByNumber, getJournalByCode, getExistingEntryBySource, buildCustomerInvoiceLines, buildSupplierInvoiceLines, verifyBalanced, getAccountingSettings as getAccountingSettingsFromLib } from "@/lib/accounting";
import type { AccountingActionResult, AccountingEntryLineFormValue } from "@/lib/accounting-types";

function text(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? "").trim();
  return value === "" ? null : value;
}

function firstText(formData: FormData, keys: string[]) {
  for (const key of keys) {
    const value = text(formData, key);
    if (value) return value;
  }
  return null;
}

function num(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseLines(formData: FormData): AccountingEntryLineFormValue[] {
  try {
    const parsed = JSON.parse(String(formData.get("lines") ?? "[]"));
    if (!Array.isArray(parsed)) return [];
    return parsed.map((raw: Record<string, unknown>) => ({
      id: typeof raw.id === "string" ? raw.id : "",
      account_id: typeof raw.account_id === "string" ? raw.account_id : "",
      account_code: typeof raw.account_code === "string" ? raw.account_code : "",
      account_label: typeof raw.account_label === "string" ? raw.account_label : "",
      debit: num(raw.debit),
      credit: num(raw.credit),
      label: typeof raw.label === "string" ? raw.label : "",
    }));
  } catch {
    return [];
  }
}



async function saveAtomicAccountingEntry(supabase: Awaited<ReturnType<typeof createClient>>, header: Record<string, unknown>, lines: Record<string, unknown>[]) {
  if (header.organization_id && header.entry_date) {
    try {
      const { assertDateInOpenPeriod } = await import("@/lib/accounting/period-lock");
      await assertDateInOpenPeriod(supabase, String(header.organization_id), String(header.entry_date ?? ""));
    } catch (error) {
      return { error: { message: error instanceof Error ? error.message : "Période verrouillée." }, entry: null };
    }
  }
  const result = await supabase.rpc("save_accounting_entry_atomic", {
    p_organization_id: header.organization_id,
    p_entry_id: null,
    p_header: header,
    p_lines: lines,
  });
  const row = Array.isArray(result.data) ? result.data[0] : result.data;
  return { error: result.error ? { ...result.error, message: financialErrorMessage(result.error) } : null, entry: row ? { id: String(row.entry_id), entry_number: String(row.entry_number) } : null };
}

export async function listAccountingJournals() {
  const workspace = await requireActiveWorkspace({ module: "comptabilite", level: "read" });
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("accounting_journals")
    .select("*")
    .eq("organization_id", workspace.organization.id)
    .order("code");
  if (error) return { success: false, error: financialErrorMessage(error) } as AccountingActionResult;
  return { success: true, data } as AccountingActionResult;
}

export async function listAccountingAccounts(filters?: { query?: string; class_number?: string; type?: string }) {
  const workspace = await requireActiveWorkspace({ module: "comptabilite", level: "read" });
  const supabase = await createClient();
  let query = supabase
    .from("accounting_accounts")
    .select("*")
    .eq("organization_id", workspace.organization.id);
  if (filters?.query) {
    query = query.or(`code.ilike.%${filters.query}%,name.ilike.%${filters.query}%`);
  }
  if (filters?.class_number) {
    query = query.eq("class_number", filters.class_number);
  }
  if (filters?.type) {
    query = query.eq("type", filters.type);
  }
  const { data, error } = await query.order("code");
  if (error) return { success: false, error: financialErrorMessage(error) } as AccountingActionResult;
  return { success: true, data } as AccountingActionResult;
}

export async function getAccountingAccount(id: string) {
  const workspace = await requireActiveWorkspace({ module: "comptabilite", level: "read" });
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("accounting_accounts")
    .select("*")
    .eq("organization_id", workspace.organization.id)
    .eq("id", id)
    .maybeSingle();
  if (error) return { success: false, error: financialErrorMessage(error) } as AccountingActionResult;
  if (!data) return { success: false, error: "Compte introuvable." } as AccountingActionResult;
  return { success: true, data } as AccountingActionResult;
}

export async function generateAccountingAuxiliaries(prev: AccountingActionResult, _formData: FormData): Promise<AccountingActionResult> {
  void prev;
  void _formData;
  const workspace = await requireProWorkspace({ module: "comptabilite" });
  if (isOperatorRole(workspace.role)) return { success: false, error: OPERATOR_ACCESS_ERROR };
  const { backfillOrganizationAuxiliaries } = await import("@/lib/accounting/auxiliaries");
  const supabase = await createClient();
  const result = await backfillOrganizationAuxiliaries(supabase, workspace.organization.id);
  if (result.error) return { success: false, error: "Les auxiliaires n’ont pas pu être générés. Réessayez dans un instant." };
  revalidatePath("/comptabilite/auxiliaires");
  return { success: true, data: { message: result.created > 0 ? `${result.created} auxiliaire${result.created > 1 ? "s" : ""} ajouté${result.created > 1 ? "s" : ""}.` : "Tous les clients et fournisseurs ont déjà un auxiliaire." } };
}

export async function listAccountingAuxiliaries(filters?: { query?: string; type?: string }) {
  const workspace = await requireActiveWorkspace({ module: "comptabilite", level: "read" });
  const supabase = await createClient();
  let query = supabase
    .from("accounting_auxiliaries")
    .select("*")
    .eq("organization_id", workspace.organization.id);
  if (filters?.query) {
    query = query.or(`code.ilike.%${filters.query}%,name.ilike.%${filters.query}%`);
  }
  if (filters?.type) {
    query = query.eq("type", filters.type);
  }
  const { data, error } = await query.order("code");
  if (error) return { success: false, error: financialErrorMessage(error) } as AccountingActionResult;
  return { success: true, data } as AccountingActionResult;
}

export async function listAccountingFiscalYears() {
  const workspace = await requireActiveWorkspace({ module: "comptabilite", level: "read" });
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("accounting_fiscal_years")
    .select("*")
    .eq("organization_id", workspace.organization.id)
    .order("start_date", { ascending: false });
  if (error) return { success: false, error: financialErrorMessage(error) } as AccountingActionResult;
  return { success: true, data } as AccountingActionResult;
}

export async function listAccountingPeriods(fiscalYearId?: string) {
  const workspace = await requireActiveWorkspace({ module: "comptabilite", level: "read" });
  const supabase = await createClient();
  let query = supabase
    .from("accounting_periods")
    .select("*, fiscal_year:accounting_fiscal_years!inner(name)")
    .eq("organization_id", workspace.organization.id);
  if (fiscalYearId) {
    query = query.eq("fiscal_year_id", fiscalYearId);
  }
  const { data, error } = await query.order("start_date");
  if (error) return { success: false, error: financialErrorMessage(error) } as AccountingActionResult;
  return { success: true, data } as AccountingActionResult;
}

export async function listAccountingEntries(filters?: {
  query?: string;
  status?: string;
  journal_id?: string;
  page?: number;
  pageSize?: number;
}) {
  const workspace = await requireActiveWorkspace({ module: "comptabilite", level: "read" });
  const supabase = await createClient();
  const page = filters?.page ?? 1;
  const pageSize = filters?.pageSize ?? 50;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from("accounting_entries")
    .select("*, journal:accounting_journals!inner(code, name)", { count: "exact" })
    .eq("organization_id", workspace.organization.id)
    .in("status", ["draft", "posted"]);

  if (filters?.query) {
    query = query.or(`entry_number.ilike.%${filters.query}%,label.ilike.%${filters.query}%`);
  }
  if (filters?.status && ["draft", "posted"].includes(filters.status)) {
    query = query.eq("status", filters.status);
  }
  if (filters?.journal_id) {
    query = query.eq("journal_id", filters.journal_id);
  }

  const { data, error, count } = await query
    .order("entry_date", { ascending: false })
    .range(from, to);

  if (error) return { success: false, error: financialErrorMessage(error) } as AccountingActionResult;
  const entries = (data ?? []).map((entry) => {
    const journalValue = (entry as { journal?: { code?: string; name?: string } | Array<{ code?: string; name?: string }> }).journal;
    const journal = Array.isArray(journalValue) ? journalValue[0] : journalValue;
    return {
      ...entry,
      journal_code: journal?.code ?? null,
      journal_name: journal?.name ?? null,
    };
  });
  return { success: true, data: { entries, total: count ?? 0 } } as AccountingActionResult;
}

export async function getAccountingEntry(id: string) {
  const workspace = await requireActiveWorkspace({ module: "comptabilite", level: "read" });
  const supabase = await createClient();
  const { data: entry, error: entryError } = await supabase
    .from("accounting_entries")
    .select("*, journal:accounting_journals!inner(code, name)")
    .eq("organization_id", workspace.organization.id)
    .eq("id", id)
    .in("status", ["draft", "posted"])
    .maybeSingle();
  if (entryError) return { success: false, error: entryError.message } as AccountingActionResult;
  if (!entry) return { success: false, error: "Écriture introuvable." } as AccountingActionResult;

  const { data: lines, error: linesError } = await supabase
    .from("accounting_entry_lines")
    .select("*")
    .eq("organization_id", workspace.organization.id)
    .eq("entry_id", id)
    .order("line_number");
  if (linesError) return { success: false, error: linesError.message } as AccountingActionResult;

  return {
    success: true,
    data: {
      entry: {
        ...entry,
        journal_code: (entry as Record<string, unknown>).journal_code as string ?? (entry as { journal?: { code: string } }).journal?.code,
        journal_name: (entry as Record<string, unknown>).journal_name as string ?? (entry as { journal?: { name: string } }).journal?.name,
      },
      lines: lines ?? [],
    },
  } as AccountingActionResult;
}

export async function getAccountingSettings() {
  const workspace = await requireActiveWorkspace({ module: "comptabilite", level: "read" });
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("accounting_settings")
    .select("*")
    .eq("organization_id", workspace.organization.id)
    .maybeSingle();
  if (error) return { success: false, error: financialErrorMessage(error) } as AccountingActionResult;
  return { success: true, data } as AccountingActionResult;
}

export async function createAccountingEntry(prev: AccountingActionResult, formData: FormData): Promise<AccountingActionResult> {
  void prev;
  const workspace = await requireActiveWorkspace({ module: "comptabilite", level: "write" });
  if (isOperatorRole(workspace.role)) return { success: false, error: OPERATOR_ACCESS_ERROR };
  const journalId = text(formData, "journal_id");
  const entryDate = text(formData, "entry_date");
  const label = text(formData, "label");
  const reference = text(formData, "reference");
  const notes = text(formData, "notes");
  const lines = parseLines(formData);

  if (!journalId) return { success: false, error: "Sélectionnez un journal." };
  if (!entryDate) return { success: false, error: "La date d'écriture est obligatoire." };
  if (!label) return { success: false, error: "Le libelle est obligatoire." };
  if (lines.length < 2) return { success: false, error: "Une écriture doit avoir au moins 2 lignes." };

  let totalDebit = 0;
  let totalCredit = 0;
  for (const [index, line] of lines.entries()) {
    if (!line.account_id) return { success: false, error: `La ligne ${index + 1} doit avoir un compte selectionne.` };
    if (line.debit <= 0 && line.credit <= 0) return { success: false, error: `La ligne ${index + 1} doit avoir un montant debit ou credit.` };
    if (line.debit > 0 && line.credit > 0) return { success: false, error: `La ligne ${index + 1} ne peut pas avoir debit et credit simultanement.` };
    totalDebit += line.debit;
    totalCredit += line.credit;
  }

  if (Math.abs(totalDebit - totalCredit) > 0.01) return { success: false, error: "Le total des debits doit etre egal au total des credits." };

  const supabase = await createClient();
  const { data: journal } = await supabase
    .from("accounting_journals")
    .select("code")
    .eq("organization_id", workspace.organization.id)
    .eq("id", journalId)
    .maybeSingle();

  if (!journal) return { success: false, error: "Sélectionnez un journal de votre entreprise." };

  const { entry, error: insertError } = await saveAtomicAccountingEntry(supabase, {
      organization_id: workspace.organization.id,
      entry_number: null,
      journal_id: journalId,
      entry_date: entryDate,
      reference,
      label,
      notes,
      status: "draft",
      total_debit: totalDebit,
      total_credit: totalCredit,
      created_by: workspace.userId,
    }, lines.map((line, index) => ({
      organization_id: workspace.organization.id,

      line_number: index + 1,
      account_id: line.account_id,
      account_code: line.account_code,
      account_label: line.account_label,
      debit: line.debit,
      credit: line.credit,
      label: line.label || null,
    })));

  if (insertError || !entry) return { success: false, error: insertError?.message ?? "Impossible de créer l'écriture." };

  revalidatePath("/comptabilite/ecritures");
  redirect(`/comptabilite/ecritures/${entry.id}`);
}

export async function postAccountingEntry(prev: AccountingActionResult, formData: FormData): Promise<AccountingActionResult> {
  void prev;
  const workspace = await requireActiveWorkspace({ module: "comptabilite", level: "write" });
  if (!isAccountingRole(workspace.role)) return { success: false, error: "La comptabilisation est réservée au propriétaire, à l’administrateur ou au comptable." };
  const id = text(formData, "id");
  if (!id) return { success: false, error: "Écriture introuvable." };
  const supabase = await createClient();
  const { data: entry, error: fetchError } = await supabase
    .from("accounting_entries")
    .select("id, status, total_debit, total_credit")
    .eq("organization_id", workspace.organization.id)
    .eq("id", id)
    .maybeSingle();
  if (fetchError || !entry) return { success: false, error: "Écriture introuvable." };
  if (entry.status !== "draft") return { success: false, error: "Seule une écriture brouillon peut etre validee." };
  if (Math.abs(Number(entry.total_debit) - Number(entry.total_credit)) > 0.01) return { success: false, error: "L'écriture n'est pas equilibree." };
  const { error: updateError } = await supabase
    .from("accounting_entries")
    .update({ status: "posted", posted_by: workspace.userId, posted_at: new Date().toISOString() })
    .eq("organization_id", workspace.organization.id)
    .eq("id", id);
  if (updateError) return { success: false, error: financialErrorMessage(updateError) };
  revalidatePath("/comptabilite/ecritures");
  revalidatePath(`/comptabilite/ecritures/${id}`);
  return { success: true };
}

export async function cancelAccountingEntry(prev: AccountingActionResult, formData: FormData): Promise<AccountingActionResult> {
  void prev;
  const workspace = await requireActiveWorkspace({ module: "comptabilite", level: "write" });
  if (isOperatorRole(workspace.role)) return { success: false, error: OPERATOR_ACCESS_ERROR };
  const id = text(formData, "id");
  if (!id) return { success: false, error: "Écriture introuvable." };
  const supabase = await createClient();
  const { data: entry, error: fetchError } = await supabase
    .from("accounting_entries")
    .select("id, status")
    .eq("organization_id", workspace.organization.id)
    .eq("id", id)
    .maybeSingle();
  if (fetchError || !entry) return { success: false, error: "Écriture introuvable." };
  if (entry.status === "posted") {
    return { success: false, error: "Une écriture comptabilisee ne peut pas etre annulee directement. Utilisez un avoir ou une écriture corrective." };
  }
  return { success: false, error: "L'annulation directe des écritures comptables est desactivee. Utilisez une écriture corrective si necessaire." };
}

export async function archiveAccountingEntry(prev: AccountingActionResult, formData: FormData): Promise<AccountingActionResult> {
  void prev;
  const workspace = await requireActiveWorkspace({ module: "comptabilite", level: "write" });
  if (isOperatorRole(workspace.role)) return { success: false, error: OPERATOR_ACCESS_ERROR };
  const id = text(formData, "id");
  if (!id) return { success: false, error: "Écriture introuvable." };
  const supabase = await createClient();
  const { data: entry, error: fetchError } = await supabase
    .from("accounting_entries")
    .select("id, status")
    .eq("organization_id", workspace.organization.id)
    .eq("id", id)
    .maybeSingle();
  if (fetchError || !entry) return { success: false, error: "Écriture introuvable." };
  if (entry.status === "posted") {
    return { success: false, error: "Une écriture comptabilisee ne peut pas etre archivee directement. Utilisez un avoir ou une écriture corrective." };
  }
  return { success: false, error: "L'archivage direct des écritures comptables est desactive." };
}

const ACCOUNT_FALLBACKS: Record<string, { name: string; type: string }> = {
  "3421": { name: "Clients", type: "third_party" },
  "4411": { name: "Fournisseurs", type: "third_party" },
  "5141": { name: "Banques", type: "treasury" },
  "5161": { name: "Caisses", type: "treasury" },
  "6111": { name: "Achats de marchandises", type: "expense" },
  "6122": { name: "Achats consommes / services", type: "expense" },
  "7111": { name: "Ventes de marchandises", type: "revenue" },
  "7121": { name: "Ventes de biens et services produits", type: "revenue" },
  "7124": { name: "Prestations de services", type: "revenue" },
  "3455": { name: "Etat - TVA recuperable", type: "tax" },
  "34552": { name: "État - TVA récupérable sur charges", type: "tax" },
  "4443": { name: "Caisses de retraite", type: "liability" },
  "4452": { name: "État - TVA due", type: "tax" },
  "4711": { name: "Compte d'attente", type: "liability" },
  "6147": { name: "Services bancaires", type: "expense" },
  "6311": { name: "Interets des emprunts", type: "expense" },
  "4455": { name: "Etat - TVA facturée", type: "tax" },
};

async function ensureAccounts(organizationId: string, codes: string[]) {
  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("accounting_accounts")
    .select("id, code")
    .eq("organization_id", organizationId)
    .in("code", codes);
  const existingCodes = new Set((existing ?? []).map((a) => a.code));
  const missing = codes.filter((c) => !existingCodes.has(c));
  if (missing.length > 0) {
    const { error } = await supabase.from("accounting_accounts").insert(
      missing.map((code) => ({
        organization_id: organizationId,
        code,
        name: ACCOUNT_FALLBACKS[code]?.name ?? `Compte ${code}`,
        class_number: code.charAt(0),
        type: ACCOUNT_FALLBACKS[code]?.type ?? "other",
        is_system: true,
      })),
    );
    if (error && error.code !== "23505") {
      console.error("[accounting] ensureAccounts", { code: error.code, message: error.message, missing });
    }
  }
}



async function getTreasuryPostingSetup(organizationId: string, treasuryAccountId: string | null) {
  const supabase = await createClient();
  const settings = await getAccountingSettingsFromLib(organizationId);
  const bankCode = (settings?.default_bank_account_code as string) ?? "5141";
  const cashCode = (settings?.default_cash_account_code as string) ?? "5161";
  let accountType = "bank";

  if (treasuryAccountId) {
    const { data } = await supabase
      .from("treasury_accounts")
      .select("account_type")
      .eq("organization_id", organizationId)
      .eq("id", treasuryAccountId)
      .maybeSingle();
    accountType = (data?.account_type as string | null) ?? "bank";
  }

  const journalCode = accountType === "cash" ? "CA" : "BQ";
  const accountCode = accountType === "cash" ? cashCode : bankCode;
  return { journalCode, accountCode };
}

export async function generateCustomerInvoiceAccountingEntry(invoiceId: string): Promise<{ success: boolean; error?: string; data?: { entry_id: string; entry_number: string } }> {
  const workspace = await requireActiveWorkspace({ module: "comptabilite", level: "write" });
  if (isOperatorRole(workspace.role)) return { success: false, error: OPERATOR_ACCESS_ERROR };
  const orgId = workspace.organization.id;
  const supabase = await createClient();

  const existing = await getExistingEntryBySource(orgId, "customer_invoice", invoiceId);
  if (existing) {
    return { success: true, data: { entry_id: existing.id, entry_number: existing.entry_number } };
  }

  const { data: invoice } = await supabase
    .from("customer_invoices")
    .select("id, invoice_number, invoice_date, total_ttc, subtotal_ht, tax_total, customer_id, status")
    .eq("organization_id", orgId)
    .eq("id", invoiceId)
    .maybeSingle();
  if (!invoice) return { success: false, error: "Facture client introuvable dans l'organisation active." };
  if (invoice.status === "draft") return { success: false, error: "Validez d'abord la facture avant de la comptabiliser." };
  if (invoice.status === "cancelled") return { success: false, error: "Impossible de comptabiliser une facture annulee." };
  if (Number(invoice.total_ttc ?? 0) <= 0) return { success: false, error: "Impossible de comptabiliser une facture avec un total nul." };

  const { data: customer } = await supabase
    .from("third_parties")
    .select("id, name")
    .eq("organization_id", orgId)
    .eq("id", invoice.customer_id)
    .maybeSingle();

  const { data: lines } = await supabase
    .from("customer_invoice_lines")
    .select("product_id, product_name, description, subtotal_ht, discount_amount, tax_amount, total_ttc, tax_rate")
    .eq("organization_id", orgId)
    .eq("invoice_id", invoiceId)
    .order("line_order");
  if (!lines || lines.length === 0) return { success: false, error: "La facture n'a pas de lignes." };

  const journal = await getJournalByCode(orgId, "VE");
  if (!journal) return { success: false, error: "Journal des ventes VE introuvable." };

  const settings = await getAccountingSettingsFromLib(orgId);
  const customerAccountCode = (settings?.default_customer_account_code as string) ?? "3421";
  const salesProductCode = (settings?.default_sales_account_code as string) ?? "7111";
  const salesServiceCode = "7124";
  const salesVatCode = (settings?.default_sales_vat_account_code as string) ?? "4455";

  await ensureAccounts(orgId, [customerAccountCode, salesProductCode, salesServiceCode, salesVatCode]);

  const customerAccount = await getAccountByNumber(orgId, customerAccountCode);
  const salesProductAccount = await getAccountByNumber(orgId, salesProductCode);
  const salesServiceAccount = await getAccountByNumber(orgId, salesServiceCode);
  const salesVatAccount = await getAccountByNumber(orgId, salesVatCode);
  if (!customerAccount) return { success: false, error: `Compte client ${customerAccountCode} introuvable.` };
  if (!salesProductAccount) return { success: false, error: `Compte vente ${salesProductCode} introuvable.` };
  if (!salesServiceAccount) return { success: false, error: `Compte vente service ${salesServiceCode} introuvable.` };
  if (!salesVatAccount) return { success: false, error: `Compte TVA collectée ${salesVatCode} introuvable.` };

  const accountLines = buildCustomerInvoiceLines(
    lines.map((l) => ({
      product_id: l.product_id as string | null,
      product_name: l.product_name as string | null,
      description: l.description as string,
      subtotal_ht: Number(l.subtotal_ht ?? 0),
      discount_amount: Number(l.discount_amount ?? 0),
      tax_amount: Number(l.tax_amount ?? 0),
      total_ttc: Number(l.total_ttc ?? 0),
      tax_rate: Number(l.tax_rate ?? 0),
    })),
    {
      sales_product: salesProductAccount.id,
      sales_service: salesServiceAccount.id,
      customer: customerAccount.id,
      sales_vat: salesVatAccount.id,
    },
  );

  const { totalDebit, totalCredit, balanced } = verifyBalanced(accountLines);
  if (!balanced) return { success: false, error: "Validation impossible : l'écriture comptable generee n'est pas equilibree." };

  const label = `Facture client ${invoice.invoice_number} - ${customer?.name ?? "Client"}`;
  const accountLabels = new Map([
    [customerAccount.id, { code: customerAccount.code, name: customerAccount.name }],
    [salesProductAccount.id, { code: salesProductAccount.code, name: salesProductAccount.name }],
    [salesServiceAccount.id, { code: salesServiceAccount.code, name: salesServiceAccount.name }],
    [salesVatAccount.id, { code: salesVatAccount.code, name: salesVatAccount.name }],
  ]);

  const { entry, error: insertError } = await saveAtomicAccountingEntry(supabase, {
      organization_id: orgId,
      entry_number: null,
      journal_id: journal.id,
      entry_date: invoice.invoice_date,
      label,
      source_module: "sales",
      source_document_type: "customer_invoice",
      source_document_id: invoice.id,
      status: "posted",
      total_debit: totalDebit,
      total_credit: totalCredit,
      posted_at: new Date().toISOString(),
      created_by: workspace.userId,
    }, accountLines.map((l, i) => ({
      organization_id: orgId,

      line_number: i + 1,
      account_id: l.account_id,
      account_code: accountLabels.get(l.account_id)?.code ?? l.account_code,
      account_label: accountLabels.get(l.account_id)?.name ?? l.account_name,
      debit: l.debit,
      credit: l.credit,
      label: l.label,
    })));

  if (insertError || !entry) return { success: false, error: insertError?.message ?? "Impossible de créer l'écriture comptable." };

  revalidatePath("/comptabilite/ecritures");
  return { success: true, data: { entry_id: entry.id, entry_number: entry.entry_number } };
}

export async function generateSupplierInvoiceAccountingEntry(invoiceId: string): Promise<{ success: boolean; error?: string; data?: { entry_id: string; entry_number: string } }> {
  const workspace = await requireActiveWorkspace({ module: "comptabilite", level: "write" });
  if (isOperatorRole(workspace.role)) return { success: false, error: OPERATOR_ACCESS_ERROR };
  const orgId = workspace.organization.id;
  const supabase = await createClient();

  const existing = await getExistingEntryBySource(orgId, "supplier_invoice", invoiceId);
  if (existing) {
    return { success: true, data: { entry_id: existing.id, entry_number: existing.entry_number } };
  }

  const { data: invoice, error: invoiceError } = await supabase
    .from("supplier_invoices")
    .select("id, invoice_number, supplier_invoice_number, invoice_date, total_ttc, subtotal_ht, tax_total, supplier_id, status, supplier:supplier_id (name)")
    .eq("organization_id", orgId)
    .eq("id", invoiceId)
    .maybeSingle();
  if (invoiceError) return { success: false, error: invoiceError.message };
  if (!invoice) return { success: false, error: `Facture fournisseur introuvable.` };
  if (invoice.status === "draft") return { success: false, error: "Validez d'abord la facture fournisseur avant de la comptabiliser." };
  if (invoice.status === "cancelled") return { success: false, error: "Impossible de comptabiliser une facture fournisseur annulee." };
  if (Number(invoice.total_ttc ?? 0) <= 0) return { success: false, error: "Impossible de comptabiliser une facture avec un total nul." };

  const invoiceRow = invoice as unknown as Record<string, unknown>;
  const supplierRaw = invoiceRow.supplier as Record<string, unknown> | undefined;
  const supplierName = supplierRaw?.name as string | null ?? null;

  const { data: lines, error: linesError } = await supabase
    .from("supplier_invoice_lines")
    .select("product_id, product_name, description, subtotal_ht, discount_amount, tax_amount, total_ttc, tax_rate")
    .eq("organization_id", orgId)
    .eq("invoice_id", invoiceId)
    .order("line_order");
  if (linesError) return { success: false, error: linesError.message };
  if (!lines || lines.length === 0) return { success: false, error: "La facture n'a pas de lignes." };

  const journal = await getJournalByCode(orgId, "AC");
  if (!journal) return { success: false, error: "Journal des achats AC introuvable." };

  const settings = await getAccountingSettingsFromLib(orgId);
  const supplierAccountCode = (settings?.default_supplier_account_code as string) ?? "4411";
  const purchaseProductCode = (settings?.default_purchase_account_code as string) ?? "6111";
  const purchaseServiceCode = "6122";
  const purchaseVatCode = (settings?.default_purchase_vat_account_code as string) ?? "34552";

  await ensureAccounts(orgId, [supplierAccountCode, purchaseProductCode, purchaseServiceCode, purchaseVatCode]);

  const supplierAccount = await getAccountByNumber(orgId, supplierAccountCode);
  const purchaseProductAccount = await getAccountByNumber(orgId, purchaseProductCode);
  const purchaseServiceAccount = await getAccountByNumber(orgId, purchaseServiceCode);
  const purchaseVatAccount = await getAccountByNumber(orgId, purchaseVatCode);
  if (!supplierAccount) return { success: false, error: `Compte fournisseur ${supplierAccountCode} introuvable.` };
  if (!purchaseProductAccount) return { success: false, error: `Compte achat ${purchaseProductCode} introuvable.` };
  if (!purchaseServiceAccount) return { success: false, error: `Compte achat service ${purchaseServiceCode} introuvable.` };
  if (!purchaseVatAccount) return { success: false, error: `Compte TVA récupérable ${purchaseVatCode} introuvable.` };

  const accountLines = buildSupplierInvoiceLines(
    lines.map((l) => ({
      product_id: l.product_id as string | null,
      product_name: l.product_name as string | null,
      description: l.description as string,
      subtotal_ht: Number(l.subtotal_ht ?? 0),
      discount_amount: Number(l.discount_amount ?? 0),
      tax_amount: Number(l.tax_amount ?? 0),
      total_ttc: Number(l.total_ttc ?? 0),
      tax_rate: Number(l.tax_rate ?? 0),
    })),
    {
      purchase_product: purchaseProductAccount.id,
      purchase_service: purchaseServiceAccount.id,
      supplier: supplierAccount.id,
      purchase_vat: purchaseVatAccount.id,
    },
  );

  const { totalDebit, totalCredit, balanced } = verifyBalanced(accountLines);
  if (!balanced) return { success: false, error: "Validation impossible : l'écriture comptable generee n'est pas equilibree." };

  const displayNumber = invoice.supplier_invoice_number || invoice.invoice_number;
  const label = `Facture fournisseur ${displayNumber} - ${supplierName ?? "Fournisseur"}`;
  const accountLabels = new Map([
    [supplierAccount.id, { code: supplierAccount.code, name: supplierAccount.name }],
    [purchaseProductAccount.id, { code: purchaseProductAccount.code, name: purchaseProductAccount.name }],
    [purchaseServiceAccount.id, { code: purchaseServiceAccount.code, name: purchaseServiceAccount.name }],
    [purchaseVatAccount.id, { code: purchaseVatAccount.code, name: purchaseVatAccount.name }],
  ]);

  const { entry, error: insertError } = await saveAtomicAccountingEntry(supabase, {
      organization_id: orgId,
      entry_number: null,
      journal_id: journal.id,
      entry_date: invoice.invoice_date,
      label,
      source_module: "purchases",
      source_document_type: "supplier_invoice",
      source_document_id: invoice.id,
      source_number: displayNumber,
      status: "posted",
      total_debit: totalDebit,
      total_credit: totalCredit,
      posted_at: new Date().toISOString(),
      created_by: workspace.userId,
    }, accountLines.map((l, i) => ({
      organization_id: orgId,

      line_number: i + 1,
      account_id: l.account_id,
      account_code: accountLabels.get(l.account_id)?.code ?? l.account_code,
      account_label: accountLabels.get(l.account_id)?.name ?? l.account_name,
      debit: l.debit,
      credit: l.credit,
      label: l.label,
    })));

  if (insertError || !entry) return { success: false, error: insertError?.message ?? "Impossible de créer l'écriture comptable." };

  revalidatePath("/comptabilite/ecritures");
  return { success: true, data: { entry_id: entry.id, entry_number: entry.entry_number } };
}

export async function generateCustomerPaymentAccountingEntry(paymentId: string): Promise<{ success: boolean; error?: string; data?: { entry_id: string; entry_number: string } }> {
  const workspace = await requireActiveWorkspace({ module: "comptabilite", level: "write" });
  if (isOperatorRole(workspace.role)) return { success: false, error: OPERATOR_ACCESS_ERROR };
  const orgId = workspace.organization.id;
  const supabase = await createClient();

  const existing = await getExistingEntryBySource(orgId, "customer_payment", paymentId);
  if (existing) {
    return { success: true, data: { entry_id: existing.id, entry_number: existing.entry_number } };
  }

  const { data: payment } = await supabase
    .from("customer_payments")
    .select("id, payment_number, payment_date, amount, third_party_id, treasury_account_id, status")
    .eq("organization_id", orgId)
    .eq("id", paymentId)
    .maybeSingle();
  if (!payment) return { success: false, error: "Paiement client introuvable." };
  if (payment.status === "draft") return { success: false, error: "Confirmez d'abord le paiement client avant de le comptabiliser." };
  if (payment.status === "cancelled") return { success: false, error: "Impossible de comptabiliser un paiement annule." };
  const amount = Math.round(Number(payment.amount ?? 0) * 100) / 100;
  if (amount <= 0) return { success: false, error: "Montant du paiement invalide." };

  const { data: customer } = await supabase
    .from("third_parties")
    .select("id, name")
    .eq("organization_id", orgId)
    .eq("id", payment.third_party_id)
    .maybeSingle();

  const { journalCode, accountCode: treasuryAccountCode } = await getTreasuryPostingSetup(orgId, payment.treasury_account_id);

  const journal = await getJournalByCode(orgId, journalCode);
  if (!journal) return { success: false, error: `Journal ${journalCode} introuvable.` };

  const settings = await getAccountingSettingsFromLib(orgId);
  const customerAccountCode = (settings?.default_customer_account_code as string) ?? "3421";

  await ensureAccounts(orgId, [customerAccountCode, treasuryAccountCode]);

  const customerAccount = await getAccountByNumber(orgId, customerAccountCode);
  const treasuryAccount = await getAccountByNumber(orgId, treasuryAccountCode);
  if (!customerAccount) return { success: false, error: `Compte client ${customerAccountCode} introuvable.` };
  if (!treasuryAccount) return { success: false, error: `Compte tresorerie ${treasuryAccountCode} introuvable.` };

  const lines = [
    { account_id: treasuryAccount.id, account_code: treasuryAccount.code, account_name: treasuryAccount.name, debit: amount, credit: 0, label: "Encaissement client" },
    { account_id: customerAccount.id, account_code: customerAccount.code, account_name: customerAccount.name, debit: 0, credit: amount, label: `Encaissement ${payment.payment_number}` },
  ];

  const { totalDebit, totalCredit, balanced } = verifyBalanced(lines);
  if (!balanced) return { success: false, error: "L'écriture generee n'est pas equilibree." };

  const label = `Encaissement client ${payment.payment_number} - ${customer?.name ?? "Client"}`;

  const { entry, error: insertError } = await saveAtomicAccountingEntry(supabase, {
      organization_id: orgId,
      entry_number: null,
      journal_id: journal.id,
      entry_date: payment.payment_date,
      label,
      source_module: "sales",
      source_document_type: "customer_payment",
      source_document_id: payment.id,
      source_number: payment.payment_number,
      status: "posted",
      total_debit: totalDebit,
      total_credit: totalCredit,
      posted_at: new Date().toISOString(),
      created_by: workspace.userId,
    }, lines.map((l, i) => ({
      organization_id: orgId,

      line_number: i + 1,
      account_id: l.account_id,
      account_code: l.account_code,
      account_label: l.account_name,
      debit: l.debit,
      credit: l.credit,
      label: l.label,
    })));

  if (insertError || !entry) return { success: false, error: insertError?.message ?? "Impossible de créer l'écriture comptable." };

  revalidatePath("/comptabilite/ecritures");
  return { success: true, data: { entry_id: entry.id, entry_number: entry.entry_number } };
}

export async function generateSupplierPaymentAccountingEntry(paymentId: string): Promise<{ success: boolean; error?: string; data?: { entry_id: string; entry_number: string } }> {
  const workspace = await requireActiveWorkspace({ module: "comptabilite", level: "write" });
  if (isOperatorRole(workspace.role)) return { success: false, error: OPERATOR_ACCESS_ERROR };
  const orgId = workspace.organization.id;
  const supabase = await createClient();

  const existing = await getExistingEntryBySource(orgId, "supplier_payment", paymentId);
  if (existing) {
    return { success: true, data: { entry_id: existing.id, entry_number: existing.entry_number } };
  }

  const { data: payment } = await supabase
    .from("supplier_payments")
    .select("id, payment_number, payment_date, amount, supplier_id, treasury_account_id, status")
    .eq("organization_id", orgId)
    .eq("id", paymentId)
    .maybeSingle();
  if (!payment) return { success: false, error: "Paiement fournisseur introuvable." };
  if (payment.status === "draft") return { success: false, error: "Confirmez d'abord le paiement fournisseur avant de le comptabiliser." };
  if (payment.status === "cancelled") return { success: false, error: "Impossible de comptabiliser un paiement annule." };
  const amount = Math.round(Number(payment.amount ?? 0) * 100) / 100;
  if (amount <= 0) return { success: false, error: "Montant du paiement invalide." };

  const { data: supplier } = await supabase
    .from("third_parties")
    .select("id, name")
    .eq("organization_id", orgId)
    .eq("id", payment.supplier_id)
    .maybeSingle();

  const { journalCode, accountCode: treasuryAccountCode } = await getTreasuryPostingSetup(orgId, payment.treasury_account_id);

  const journal = await getJournalByCode(orgId, journalCode);
  if (!journal) return { success: false, error: `Journal ${journalCode} introuvable.` };

  const settings = await getAccountingSettingsFromLib(orgId);
  const supplierAccountCode = (settings?.default_supplier_account_code as string) ?? "4411";

  await ensureAccounts(orgId, [supplierAccountCode, treasuryAccountCode]);

  const supplierAccount = await getAccountByNumber(orgId, supplierAccountCode);
  const treasuryAccount = await getAccountByNumber(orgId, treasuryAccountCode);
  if (!supplierAccount) return { success: false, error: `Compte fournisseur ${supplierAccountCode} introuvable.` };
  if (!treasuryAccount) return { success: false, error: `Compte tresorerie ${treasuryAccountCode} introuvable.` };

  const lines = [
    { account_id: supplierAccount.id, account_code: supplierAccount.code, account_name: supplierAccount.name, debit: amount, credit: 0, label: "Paiement fournisseur" },
    { account_id: treasuryAccount.id, account_code: treasuryAccount.code, account_name: treasuryAccount.name, debit: 0, credit: amount, label: `Paiement ${payment.payment_number}` },
  ];

  const { totalDebit, totalCredit, balanced } = verifyBalanced(lines);
  if (!balanced) return { success: false, error: "L'écriture generee n'est pas equilibree." };

  const label = `Paiement fournisseur ${payment.payment_number} - ${supplier?.name ?? "Fournisseur"}`;

  const { entry, error: insertError } = await saveAtomicAccountingEntry(supabase, {
      organization_id: orgId,
      entry_number: null,
      journal_id: journal.id,
      entry_date: payment.payment_date,
      label,
      source_module: "purchases",
      source_document_type: "supplier_payment",
      source_document_id: payment.id,
      source_number: payment.payment_number,
      status: "posted",
      total_debit: totalDebit,
      total_credit: totalCredit,
      posted_at: new Date().toISOString(),
      created_by: workspace.userId,
    }, lines.map((l, i) => ({
      organization_id: orgId,

      line_number: i + 1,
      account_id: l.account_id,
      account_code: l.account_code,
      account_label: l.account_name,
      debit: l.debit,
      credit: l.credit,
      label: l.label,
    })));

  if (insertError || !entry) return { success: false, error: insertError?.message ?? "Impossible de créer l'écriture comptable." };

  revalidatePath("/comptabilite/ecritures");
  return { success: true, data: { entry_id: entry.id, entry_number: entry.entry_number } };
}

export async function generateBankFeeAccountingEntry(input: {
  statementLineId: string;
  date: string;
  label: string;
  amount: number;
  treasuryAccountId: string;
  category: string;
  accountCode?: string | null;
  net: number;
  vat: number;
  expenseAccount: string;
}): Promise<{ success: boolean; error?: string; data?: { entry_id: string; entry_number: string } }> {
  const workspace = await requireProWorkspace({ module: "comptabilite" });
  const orgId = workspace.organization.id;
  const supabase = await createClient();
  const existing = await getExistingEntryBySource(orgId, "bank_statement_fee", input.statementLineId);
  if (existing) return { success: true, data: { entry_id: existing.id, entry_number: existing.entry_number } };
  const amount = Math.round(input.amount * 100) / 100;
  if (amount <= 0) return { success: false, error: "Montant de frais invalide." };
  const { journalCode, accountCode: treasuryAccountCode } = await getTreasuryPostingSetup(orgId, input.treasuryAccountId);
  const journal = await getJournalByCode(orgId, journalCode);
  if (!journal) return { success: false, error: `Journal ${journalCode} introuvable.` };
  const settings = await getAccountingSettingsFromLib(orgId);
  const expenseCode = input.category === "agio"
    ? "6311"
    : input.accountCode || (settings?.default_bank_fees_account_code as string | undefined) || input.expenseAccount;
  const vatCode = "3455";
  const codes = [expenseCode, treasuryAccountCode, ...(input.vat > 0 ? [vatCode] : [])];
  await ensureAccounts(orgId, codes);
  const expense = await getAccountByNumber(orgId, expenseCode);
  const treasury = await getAccountByNumber(orgId, treasuryAccountCode);
  const vat = input.vat > 0 ? await getAccountByNumber(orgId, vatCode) : null;
  if (!expense || !treasury || (input.vat > 0 && !vat)) return { success: false, error: "Le compte de frais ou de banque est introuvable." };
  const lines = [
    ...(input.net > 0 ? [{ account_id: expense.id, account_code: expense.code, account_name: expense.name, debit: input.net, credit: 0, label: input.label }] : []),
    ...(input.vat > 0 && vat ? [{ account_id: vat.id, account_code: vat.code, account_name: vat.name, debit: input.vat, credit: 0, label: "TVA sur frais bancaires" }] : []),
    { account_id: treasury.id, account_code: treasury.code, account_name: treasury.name, debit: 0, credit: amount, label: input.label },
  ];
  const { totalDebit, totalCredit, balanced } = verifyBalanced(lines);
  if (!balanced) return { success: false, error: "L'écriture de frais n'est pas équilibrée." };
  const { entry, error } = await saveAtomicAccountingEntry(supabase, {
    organization_id: orgId,
    entry_number: null,
    journal_id: journal.id,
    entry_date: input.date,
    label: input.label,
    source_module: "treasury",
    source_document_type: "bank_statement_fee",
    source_document_id: input.statementLineId,
    source_number: input.statementLineId.slice(0, 8),
    status: "posted",
    total_debit: totalDebit,
    total_credit: totalCredit,
    posted_at: new Date().toISOString(),
    created_by: workspace.userId,
  }, lines.map((line, index) => ({
    organization_id: orgId,
    line_number: index + 1,
    account_id: line.account_id,
    account_code: line.account_code,
    account_label: line.account_name,
    debit: line.debit,
    credit: line.credit,
    label: line.label,
  })));
  if (error || !entry) return { success: false, error: error?.message ?? "Impossible de comptabiliser le frais." };
  revalidatePath("/comptabilite/ecritures");
  return { success: true, data: { entry_id: entry.id, entry_number: entry.entry_number } };
}

export async function reverseAccountingEntry(entryId: string): Promise<{ success: boolean; error?: string }> {
  const workspace = await requireProWorkspace({ module: "comptabilite" });
  const orgId = workspace.organization.id;
  const supabase = await createClient();
  const existing = await getExistingEntryBySource(orgId, "bank_reconciliation_reversal", entryId);
  if (existing) return { success: true };
  const { data: entry } = await supabase.from("accounting_entries").select("id, journal_id, entry_date, label, entry_number").eq("organization_id", orgId).eq("id", entryId).maybeSingle();
  if (!entry) return { success: true };
  const { data: lines } = await supabase.from("accounting_entry_lines").select("account_id, account_code, account_label, debit, credit, label, line_number").eq("organization_id", orgId).eq("entry_id", entryId).order("line_number");
  if (!lines?.length) return { success: false, error: "L'écriture d'origine n'a pas de lignes." };
  const swapped = lines.map((line) => ({
    account_id: line.account_id as string,
    account_code: line.account_code as string,
    account_name: line.account_label as string,
    debit: Number(line.credit ?? 0),
    credit: Number(line.debit ?? 0),
    label: `Extourne ${line.label ?? ""}`.trim(),
  }));
  const { totalDebit, totalCredit, balanced } = verifyBalanced(swapped);
  if (!balanced) return { success: false, error: "L'extourne n'est pas équilibrée." };
  const saved = await saveAtomicAccountingEntry(supabase, {
    organization_id: orgId,
    entry_number: null,
    journal_id: entry.journal_id,
    entry_date: new Date().toISOString().slice(0, 10),
    label: `Extourne ${entry.entry_number ?? ""} ${entry.label ?? ""}`.trim(),
    source_module: "treasury",
    source_document_type: "bank_reconciliation_reversal",
    source_document_id: entryId,
    source_number: entry.entry_number,
    status: "posted",
    total_debit: totalDebit,
    total_credit: totalCredit,
    posted_at: new Date().toISOString(),
    created_by: workspace.userId,
  }, swapped.map((line, index) => ({
    organization_id: orgId,
    line_number: index + 1,
    account_id: line.account_id,
    account_code: line.account_code,
    account_label: line.account_name,
    debit: line.debit,
    credit: line.credit,
    label: line.label,
  })));
  if (saved.error) return { success: false, error: saved.error.message };
  revalidatePath("/comptabilite/ecritures");
  return { success: true };
}

export async function updateAccountingSettings(prev: AccountingActionResult, formData: FormData): Promise<AccountingActionResult> {
  void prev;
  const workspace = await requireActiveWorkspace({ module: "comptabilite", level: "write" });
  if (isOperatorRole(workspace.role)) return { success: false, error: OPERATOR_ACCESS_ERROR };
  const supabase = await createClient();
  const payload: Record<string, string> = {};
  const fields = [
    "sales_journal_code", "purchases_journal_code", "bank_journal_code", "cash_journal_code", "od_journal_code",
    "default_customer_account_code", "default_supplier_account_code", "default_sales_account_code",
    "default_purchase_account_code", "default_sales_vat_account_code", "default_purchase_vat_account_code",
    "default_bank_account_code", "default_cash_account_code", "default_bank_fees_account_code",
    "numbering_prefix",
  ];
  for (const field of fields) {
    const value = text(formData, field);
    if (value) payload[field] = value;
  }
  const withFlag: Record<string, string | boolean> = { ...payload, auto_post_on_validation: formData.get("auto_post_on_validation") === "on" };
  const { error } = await supabase
    .from("accounting_settings")
    .update(withFlag)
    .eq("organization_id", workspace.organization.id);
  if (error?.code === "42703") {
    const fallback = await supabase.from("accounting_settings").update(payload).eq("organization_id", workspace.organization.id);
    if (fallback.error) return { success: false, error: financialErrorMessage(fallback.error) };
    revalidatePath("/comptabilite/parametres");
    return { success: false, error: "L’option de comptabilisation automatique nécessite la migration 133." };
  }
  if (error) return { success: false, error: financialErrorMessage(error) };
  revalidatePath("/comptabilite/parametres");
  return { success: true };
}

export async function updateAccountingEntryLineAccount(prev: AccountingActionResult, formData: FormData): Promise<AccountingActionResult> {
  void prev;
  const workspace = await requireActiveWorkspace({ module: "comptabilite", level: "write" });
  if (isOperatorRole(workspace.role)) return { success: false, error: OPERATOR_ACCESS_ERROR };
  const lineId = text(formData, "entry_line_id");
  const accountId = text(formData, "account_id");
  if (!lineId) return { success: false, error: "Ligne d'écriture introuvable." };
  if (!accountId) return { success: false, error: "Sélectionnez un compte comptable." };

  const supabase = await createClient();
  const { data: line, error: lineError } = await supabase
    .from("accounting_entry_lines")
    .select("id, entry_id, account_code, account_label")
    .eq("organization_id", workspace.organization.id)
    .eq("id", lineId)
    .maybeSingle();
  if (lineError) return { success: false, error: lineError.message };
  if (!line) return { success: false, error: "Ligne d'écriture introuvable." };

  const { data: entry, error: entryError } = await supabase
    .from("accounting_entries")
    .select("id, entry_number, status")
    .eq("organization_id", workspace.organization.id)
    .eq("id", line.entry_id)
    .maybeSingle();
  if (entryError) return { success: false, error: entryError.message };
  if (!entry) return { success: false, error: "Écriture introuvable." };
  if (entry.status === "cancelled") return { success: false, error: "Cette écriture est annulee, les lignes ne sont plus modifiables." };

  const { data: account, error: accountError } = await supabase
    .from("accounting_accounts")
    .select("id, code, name, is_active")
    .eq("organization_id", workspace.organization.id)
    .eq("id", accountId)
    .maybeSingle();
  if (accountError) return { success: false, error: accountError.message };
  if (!account) return { success: false, error: "Compte comptable introuvable." };
  if (!account.is_active) return { success: false, error: "Ce compte comptable est inactif." };

  const { error: updateError } = await supabase
    .from("accounting_entry_lines")
    .update({
      account_id: account.id,
      account_code: account.code,
      account_label: account.name,
    })
    .eq("organization_id", workspace.organization.id)
    .eq("id", lineId);
  if (updateError) return { success: false, error: financialErrorMessage(updateError) };

  const { data: totals, error: totalsError } = await supabase
    .from("accounting_entry_lines")
    .select("debit, credit")
    .eq("organization_id", workspace.organization.id)
    .eq("entry_id", entry.id);
  if (totalsError) return { success: false, error: totalsError.message };
  const totalDebit = (totals ?? []).reduce((sum, row) => sum + Number(row.debit ?? 0), 0);
  const totalCredit = (totals ?? []).reduce((sum, row) => sum + Number(row.credit ?? 0), 0);
  if (Math.abs(totalDebit - totalCredit) > 0.01) {
    return { success: false, error: "La modification a été enregistrée, mais l’écriture est déséquilibrée. Vérifiez les débits et les crédits." };
  }

  revalidatePath(`/comptabilite/ecritures/${entry.id}`);
  revalidatePath("/comptabilite/ecritures");
  return { success: true };
}

export async function postCustomerInvoiceToAccounting(prev: AccountingActionResult, formData: FormData): Promise<AccountingActionResult> {
  void prev;
  const invoiceId = firstText(formData, ["invoice_id", "customer_invoice_id", "id"]);
  if (!invoiceId) return { success: false, error: "Facture client introuvable : identifiant manquant." };

  const workspace = await requireActiveWorkspace({ module: "comptabilite", level: "write" });
  if (!isAccountingRole(workspace.role)) return { success: false, error: "La comptabilisation est réservée au propriétaire, à l’administrateur ou au comptable." };
  const supabase = await createClient();

  const { data: invoice, error: invoiceError } = await supabase
    .from("customer_invoices")
    .select("id, status, total_ttc")
    .eq("organization_id", workspace.organization.id)
    .eq("id", invoiceId)
    .maybeSingle();
  if (invoiceError) return { success: false, error: invoiceError.message };
  if (!invoice) return { success: false, error: "Facture client introuvable dans l'organisation active." };
  if (invoice.status === "draft") return { success: false, error: "Validez d'abord la facture avant de la comptabiliser." };
  if (invoice.status === "cancelled") return { success: false, error: "Impossible de comptabiliser une facture annulee." };
  if (Number(invoice.total_ttc ?? 0) <= 0) return { success: false, error: "Impossible de comptabiliser une facture avec un total nul." };

  const existing = await getExistingEntryBySource(workspace.organization.id, "customer_invoice", invoiceId);
  if (existing) {
    revalidatePath(`/facturation/factures/${invoiceId}`);
    return { success: true, data: { entry_id: existing.id, entry_number: existing.entry_number } };
  }

  const result = await generateCustomerInvoiceAccountingEntry(invoiceId);
  if (!result.success) return result;

  revalidatePath(`/facturation/factures/${invoiceId}`);
  return { success: true, data: result.data };
}

export async function postSupplierInvoiceToAccounting(prev: AccountingActionResult, formData: FormData): Promise<AccountingActionResult> {
  void prev;
  const invoiceId = firstText(formData, ["invoice_id", "supplier_invoice_id", "id"]);
  if (!invoiceId) return { success: false, error: "Facture fournisseur introuvable : identifiant manquant." };

  const workspace = await requireActiveWorkspace({ module: "comptabilite", level: "write" });
  if (!isAccountingRole(workspace.role)) return { success: false, error: "La comptabilisation est réservée au propriétaire, à l’administrateur ou au comptable." };
  const supabase = await createClient();

  const { data: invoice } = await supabase
    .from("supplier_invoices")
    .select("id, status, total_ttc")
    .eq("organization_id", workspace.organization.id)
    .eq("id", invoiceId)
    .maybeSingle();
  if (!invoice) return { success: false, error: "Facture fournisseur introuvable." };
  if (invoice.status === "draft") return { success: false, error: "Validez d'abord la facture fournisseur avant de la comptabiliser." };
  if (invoice.status === "cancelled") return { success: false, error: "Impossible de comptabiliser une facture fournisseur annulee." };
  if (Number(invoice.total_ttc ?? 0) <= 0) return { success: false, error: "Impossible de comptabiliser une facture avec un total nul." };

  const existing = await getExistingEntryBySource(workspace.organization.id, "supplier_invoice", invoiceId);
  if (existing) {
    revalidatePath(`/achats/factures/${invoiceId}`);
    return { success: true, data: { entry_id: existing.id, entry_number: existing.entry_number } };
  }

  const result = await generateSupplierInvoiceAccountingEntry(invoiceId);
  if (!result.success) return result;

  revalidatePath(`/achats/factures/${invoiceId}`);
  return { success: true, data: result.data };
}

export async function postCustomerPaymentToAccounting(prev: AccountingActionResult, formData: FormData): Promise<AccountingActionResult> {
  void prev;
  const paymentId = firstText(formData, ["payment_id", "customer_payment_id", "id"]);
  if (!paymentId) return { success: false, error: "Paiement client introuvable : identifiant manquant." };

  const workspace = await requireActiveWorkspace({ module: "comptabilite", level: "write" });
  if (!isAccountingRole(workspace.role)) return { success: false, error: "La comptabilisation est réservée au propriétaire, à l’administrateur ou au comptable." };
  const supabase = await createClient();

  const { data: payment } = await supabase
    .from("customer_payments")
    .select("id, status, amount")
    .eq("organization_id", workspace.organization.id)
    .eq("id", paymentId)
    .maybeSingle();
  if (!payment) return { success: false, error: "Paiement client introuvable." };
  if (payment.status === "draft") return { success: false, error: "Confirmez d'abord le paiement client avant de le comptabiliser." };
  if (payment.status === "cancelled") return { success: false, error: "Impossible de comptabiliser un paiement client annule." };
  if (Number(payment.amount ?? 0) <= 0) return { success: false, error: "Montant du paiement invalide." };

  const existing = await getExistingEntryBySource(workspace.organization.id, "customer_payment", paymentId);
  if (existing) {
    revalidatePath(`/facturation/paiements/${paymentId}`);
    return { success: true, data: { entry_id: existing.id, entry_number: existing.entry_number } };
  }

  const result = await generateCustomerPaymentAccountingEntry(paymentId);
  if (!result.success) return result;

  revalidatePath(`/facturation/paiements/${paymentId}`);
  return { success: true, data: result.data };
}

export async function postSupplierPaymentToAccounting(prev: AccountingActionResult, formData: FormData): Promise<AccountingActionResult> {
  void prev;
  const paymentId = firstText(formData, ["payment_id", "supplier_payment_id", "id"]);
  if (!paymentId) return { success: false, error: "Paiement fournisseur introuvable : identifiant manquant." };

  const workspace = await requireActiveWorkspace({ module: "comptabilite", level: "write" });
  if (!isAccountingRole(workspace.role)) return { success: false, error: "La comptabilisation est réservée au propriétaire, à l’administrateur ou au comptable." };
  const supabase = await createClient();

  const { data: payment } = await supabase
    .from("supplier_payments")
    .select("id, status, amount")
    .eq("organization_id", workspace.organization.id)
    .eq("id", paymentId)
    .maybeSingle();
  if (!payment) return { success: false, error: "Paiement fournisseur introuvable." };
  if (payment.status === "draft") return { success: false, error: "Confirmez d'abord le paiement fournisseur avant de le comptabiliser." };
  if (payment.status === "cancelled") return { success: false, error: "Impossible de comptabiliser un paiement fournisseur annule." };
  if (Number(payment.amount ?? 0) <= 0) return { success: false, error: "Montant du paiement invalide." };

  const existing = await getExistingEntryBySource(workspace.organization.id, "supplier_payment", paymentId);
  if (existing) {
    revalidatePath(`/achats/paiements/${paymentId}`);
    return { success: true, data: { entry_id: existing.id, entry_number: existing.entry_number } };
  }

  const result = await generateSupplierPaymentAccountingEntry(paymentId);
  if (!result.success) return result;

  revalidatePath(`/achats/paiements/${paymentId}`);
  return { success: true, data: result.data };
}

const JOURNAL_TYPES = ["sales", "purchases", "bank", "cash", "od"] as const;

export async function createAccountingJournal(prev: AccountingActionResult, formData: FormData): Promise<AccountingActionResult> {
  void prev;
  const workspace = await requireProWorkspace({ module: "comptabilite" });
  if (isOperatorRole(workspace.role)) return { success: false, error: OPERATOR_ACCESS_ERROR };
  const code = (text(formData, "code") ?? "").toUpperCase();
  const name = text(formData, "name");
  const type = text(formData, "type");
  if (!code) return { success: false, error: "Le code du journal est obligatoire." };
  if (!/^[A-Z0-9]{1,8}$/.test(code)) return { success: false, error: "Le code du journal contient 1 à 8 lettres ou chiffres." };
  if (!name) return { success: false, error: "Le nom du journal est obligatoire." };
  if (!type || !JOURNAL_TYPES.includes(type as (typeof JOURNAL_TYPES)[number])) {
    return { success: false, error: "Choisissez un type : ventes, achats, banque, caisse ou opérations diverses." };
  }
  const treasuryAccountId = text(formData, "treasury_account_id");
  const supabase = await createClient();
  if (treasuryAccountId && (type === "bank" || type === "cash")) {
    const { data: account } = await supabase.from("treasury_accounts").select("id").eq("organization_id", workspace.organization.id).eq("id", treasuryAccountId).is("archived_at", null).maybeSingle();
    if (!account) return { success: false, error: "Le compte de trésorerie sélectionné est introuvable." };
  }
  const { data: existing } = await supabase.from("accounting_journals").select("id").eq("organization_id", workspace.organization.id).eq("code", code).is("archived_at", null).maybeSingle();
  if (existing) return { success: false, error: "Ce code de journal existe déjà pour votre entreprise." };
  const payload: Record<string, unknown> = {
    organization_id: workspace.organization.id,
    code,
    name,
    type,
    description: text(formData, "description"),
    is_active: true,
  };
  if (treasuryAccountId && (type === "bank" || type === "cash")) payload.treasury_account_id = treasuryAccountId;
  const { data, error } = await supabase.from("accounting_journals").insert(payload).select("id").single();
  if (error?.code === "23505") return { success: false, error: "Ce code de journal existe déjà pour votre entreprise." };
  if (error?.code === "42703" && payload.treasury_account_id) {
    return { success: false, error: "Le lien vers le compte de trésorerie nécessite la migration 130. Créez le journal sans compte, ou appliquez la migration." };
  }
  if (error || !data) return { success: false, error: financialErrorMessage(error, "Le journal n’a pas pu être créé.") };
  revalidatePath("/comptabilite/journaux");
  redirect(`/comptabilite/journaux/${data.id}`);
}

export async function createChartOfAccount(prev: AccountingActionResult, formData: FormData): Promise<AccountingActionResult> {
  void prev;
  const workspace = await requireProWorkspace({ module: "comptabilite" });
  if (isOperatorRole(workspace.role)) return { success: false, error: OPERATOR_ACCESS_ERROR };
  const code = text(formData, "code");
  const name = text(formData, "name");
  if (!code) return { success: false, error: "Le numero de compte est obligatoire." };
  if (!name) return { success: false, error: "L'intitule du compte est obligatoire." };
  if (!/^\d+$/.test(code)) return { success: false, error: "Le numero de compte doit contenir uniquement des chiffres." };

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("accounting_accounts")
    .select("id")
    .eq("organization_id", workspace.organization.id)
    .eq("code", code)
    .maybeSingle();
  if (existing) return { success: false, error: "Ce numero de compte existe deja dans le plan comptable." };

  const parentId = text(formData, "parent_account_id");
  if (parentId && parentId !== "none") {
    const { data: parent } = await supabase
      .from("accounting_accounts")
      .select("id")
      .eq("organization_id", workspace.organization.id)
      .eq("id", parentId)
      .maybeSingle();
    if (!parent) return { success: false, error: "Compte parent introuvable." };
  }

  const type = text(formData, "type") ?? "other";
  const isAuxiliary = formData.get("is_auxiliary") === "on";
  const notes = text(formData, "notes");

  const { error } = await supabase.from("accounting_accounts").insert({
    organization_id: workspace.organization.id,
    code,
    name,
    class_number: code.charAt(0),
    type,
    parent_account_id: parentId && parentId !== "none" ? parentId : null,
    is_auxiliary: isAuxiliary,
    is_active: true,
    notes,
  });
  if (error) {
    if (error.code === "23505") return { success: false, error: "Ce numéro de compte existe déjà dans le plan comptable." };
    return { success: false, error: financialErrorMessage(error) };
  }

  revalidatePath("/comptabilite/plan-comptable");
  return { success: true };
}

export async function updateChartOfAccount(prev: AccountingActionResult, formData: FormData): Promise<AccountingActionResult> {
  void prev;
  const workspace = await requireProWorkspace({ module: "comptabilite" });
  if (isOperatorRole(workspace.role)) return { success: false, error: OPERATOR_ACCESS_ERROR };
  const id = text(formData, "id");
  if (!id) return { success: false, error: "Compte introuvable." };

  const supabase = await createClient();
  const { data: account } = await supabase
    .from("accounting_accounts")
    .select("id, code, type")
    .eq("organization_id", workspace.organization.id)
    .eq("id", id)
    .maybeSingle();
  if (!account) return { success: false, error: "Compte introuvable." };

  const name = text(formData, "name");
  if (!name) return { success: false, error: "L'intitule du compte est obligatoire." };

  const newCode = text(formData, "code");
  const { data: lines } = await supabase
    .from("accounting_entry_lines")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", workspace.organization.id)
    .eq("account_id", id)
    .limit(1);
  const isUsed = (lines?.length ?? 0) > 0;

  if (newCode && newCode !== account.code) {
    if (isUsed) return { success: false, error: "Ce compte est deja utilise dans des écritures. Son numero ne peut pas etre modifie." };
    if (!/^\d+$/.test(newCode)) return { success: false, error: "Le numero de compte doit contenir uniquement des chiffres." };
    const { data: dup } = await supabase
      .from("accounting_accounts")
      .select("id")
      .eq("organization_id", workspace.organization.id)
      .eq("code", newCode)
      .neq("id", id)
      .maybeSingle();
    if (dup) return { success: false, error: "Ce numero de compte existe deja dans le plan comptable." };
  }

  const parentId = text(formData, "parent_account_id");
  if (parentId && parentId === id) return { success: false, error: "Un compte ne peut pas etre son propre parent." };
  if (parentId && parentId !== "none") {
    const { data: parent } = await supabase
      .from("accounting_accounts")
      .select("id")
      .eq("organization_id", workspace.organization.id)
      .eq("id", parentId)
      .maybeSingle();
    if (!parent) return { success: false, error: "Compte parent introuvable." };
  }

  const type = text(formData, "type") ?? account.type;
  const isAuxiliary = formData.get("is_auxiliary") === "on";
  const isActive = formData.get("is_active") !== "off";
  const notes = text(formData, "notes");

  const payload: Record<string, unknown> = {
    name,
    type,
    parent_account_id: parentId && parentId !== "none" ? parentId : null,
    is_auxiliary: isAuxiliary,
    is_active: isActive,
    notes,
  };
  if (newCode && newCode !== account.code) {
    payload.code = newCode;
    payload.class_number = newCode.charAt(0);
  }

  const { error } = await supabase
    .from("accounting_accounts")
    .update(payload)
    .eq("organization_id", workspace.organization.id)
    .eq("id", id);
  if (error) return { success: false, error: financialErrorMessage(error) };

  revalidatePath("/comptabilite/plan-comptable");
  revalidatePath(`/comptabilite/comptes/${id}`);
  return { success: true };
}

export async function archiveChartOfAccount(prev: AccountingActionResult, formData: FormData): Promise<AccountingActionResult> {
  void prev;
  const workspace = await requireProWorkspace({ module: "comptabilite" });
  if (isOperatorRole(workspace.role)) return { success: false, error: OPERATOR_ACCESS_ERROR };
  const id = text(formData, "id");
  if (!id) return { success: false, error: "Compte introuvable." };

  const supabase = await createClient();
  const { data: account } = await supabase
    .from("accounting_accounts")
    .select("id")
    .eq("organization_id", workspace.organization.id)
    .eq("id", id)
    .maybeSingle();
  if (!account) return { success: false, error: "Compte introuvable." };

  const { data: lines } = await supabase
    .from("accounting_entry_lines")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", workspace.organization.id)
    .eq("account_id", id)
    .limit(1);
  if ((lines?.length ?? 0) > 0) {
    return { success: false, error: "Ce compte est utilise dans des écritures. Il peut etre desactive mais pas archive." };
  }

  const { error } = await supabase
    .from("accounting_accounts")
    .update({ archived_at: new Date().toISOString(), is_active: false })
    .eq("organization_id", workspace.organization.id)
    .eq("id", id);
  if (error) return { success: false, error: financialErrorMessage(error) };

  revalidatePath("/comptabilite/plan-comptable");
  revalidatePath(`/comptabilite/comptes/${id}`);
  return { success: true };
}

export async function toggleChartOfAccountActive(prev: AccountingActionResult, formData: FormData): Promise<AccountingActionResult> {
  void prev;
  const workspace = await requireProWorkspace({ module: "comptabilite" });
  if (isOperatorRole(workspace.role)) return { success: false, error: OPERATOR_ACCESS_ERROR };
  const id = text(formData, "id");
  if (!id) return { success: false, error: "Compte introuvable." };

  const supabase = await createClient();
  const { data: account } = await supabase
    .from("accounting_accounts")
    .select("id, is_active")
    .eq("organization_id", workspace.organization.id)
    .eq("id", id)
    .maybeSingle();
  if (!account) return { success: false, error: "Compte introuvable." };

  const { error } = await supabase
    .from("accounting_accounts")
    .update({ is_active: !account.is_active })
    .eq("organization_id", workspace.organization.id)
    .eq("id", id);
  if (error) return { success: false, error: financialErrorMessage(error) };

  revalidatePath("/comptabilite/plan-comptable");
  revalidatePath(`/comptabilite/comptes/${id}`);
  return { success: true };
}

export async function ensureDefaultChartOfAccountsAction(prev: AccountingActionResult, formData: FormData): Promise<AccountingActionResult> {
  void prev;
  void formData;
  const workspace = await requireProWorkspace({ module: "comptabilite" });
  if (isOperatorRole(workspace.role)) return { success: false, error: OPERATOR_ACCESS_ERROR };
  const { ensureDefaultChartOfAccounts } = await import("@/lib/accounting");
  try {
    const result = await ensureDefaultChartOfAccounts(workspace.organization.id);
    revalidatePath("/comptabilite/plan-comptable");
    return { success: true, data: result };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Erreur lors de l'initialisation du plan comptable." };
  }
}

export async function openAccountingFiscalYear(prev: AccountingActionResult, formData: FormData): Promise<AccountingActionResult> {
  void prev;
  const workspace = await requireProWorkspace({ module: "comptabilite" });
  if (!isAccountingRole(workspace.role)) return { success: false, error: "L'ouverture d'exercice est réservée au propriétaire, à l’administrateur ou au comptable." };
  const year = Number(text(formData, "year") ?? new Date().getFullYear());
  if (!Number.isInteger(year) || year < 2000 || year > 2100) return { success: false, error: "Indiquez une année entre 2000 et 2100." };
  const supabase = await createClient();
  const name = String(year);
  const { data: existing } = await supabase.from("accounting_fiscal_years").select("id").eq("organization_id", workspace.organization.id).eq("name", name).maybeSingle();
  if (existing?.id) return { success: false, error: `L'exercice ${name} existe déjà.` };
  const { data: fiscalYear, error } = await supabase.from("accounting_fiscal_years").insert({
    organization_id: workspace.organization.id,
    name,
    start_date: `${year}-01-01`,
    end_date: `${year}-12-31`,
    status: "open",
  }).select("id").single();
  if (error || !fiscalYear) return { success: false, error: financialErrorMessage(error) };
  const months = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];
  const periods = months.map((month, index) => {
    const start = `${year}-${String(index + 1).padStart(2, "0")}-01`;
    const endDate = new Date(Date.UTC(year, index + 1, 0));
    return {
      organization_id: workspace.organization.id,
      fiscal_year_id: fiscalYear.id,
      name: month,
      start_date: start,
      end_date: endDate.toISOString().slice(0, 10),
      status: "open",
    };
  });
  const { error: periodError } = await supabase.from("accounting_periods").insert(periods);
  if (periodError) return { success: false, error: financialErrorMessage(periodError) };
  await logAudit(workspace.organization.id, "open_fiscal_year", "accounting_fiscal_years", fiscalYear.id, { year });
  revalidatePath("/comptabilite/exercices");
  return { success: true };
}

export type PendingAccountingDocument = {
  id: string;
  kind: "customer_invoice" | "supplier_invoice" | "customer_credit_note" | "supplier_credit_note" | "customer_payment" | "supplier_payment";
  label: string;
  number: string;
};

export async function listPendingAccountingDocuments(): Promise<PendingAccountingDocument[]> {
  const workspace = await requireActiveWorkspace({ module: "comptabilite", level: "read" });
  const supabase = await createClient();
  const orgId = workspace.organization.id;
  const [invoices, supplierInvoices, creditNotes, supplierCredits, payments, supplierPayments, entries] = await Promise.all([
    supabase.from("customer_invoices").select("id, invoice_number").eq("organization_id", orgId).not("status", "in", "(draft,cancelled)").is("archived_at", null).limit(80),
    supabase.from("supplier_invoices").select("id, invoice_number, supplier_invoice_number").eq("organization_id", orgId).not("status", "in", "(draft,cancelled)").is("archived_at", null).limit(80),
    supabase.from("customer_credit_notes").select("id, credit_note_number").eq("organization_id", orgId).not("status", "in", "(draft,cancelled)").limit(80),
    supabase.from("supplier_credit_notes").select("id, credit_note_number").eq("organization_id", orgId).not("status", "in", "(draft,cancelled)").limit(80),
    supabase.from("customer_payments").select("id, payment_number").eq("organization_id", orgId).eq("status", "confirmed").is("archived_at", null).limit(80),
    supabase.from("supplier_payments").select("id, payment_number").eq("organization_id", orgId).not("status", "in", "(draft,cancelled)").is("archived_at", null).limit(80),
    supabase.from("accounting_entries").select("source_document_type, source_document_id").eq("organization_id", orgId).neq("status", "cancelled").limit(2000),
  ]);
  const posted = new Set((entries.data ?? []).map((row) => `${row.source_document_type}:${row.source_document_id}`));
  const rows: PendingAccountingDocument[] = [];
  for (const row of invoices.data ?? []) if (!posted.has(`customer_invoice:${row.id}`)) rows.push({ id: row.id, kind: "customer_invoice", label: "Facture client", number: row.invoice_number });
  for (const row of supplierInvoices.data ?? []) if (!posted.has(`supplier_invoice:${row.id}`)) rows.push({ id: row.id, kind: "supplier_invoice", label: "Facture fournisseur", number: row.supplier_invoice_number || row.invoice_number });
  for (const row of creditNotes.error ? [] : creditNotes.data ?? []) if (!posted.has(`customer_credit_note:${row.id}`)) rows.push({ id: row.id, kind: "customer_credit_note", label: "Avoir client", number: row.credit_note_number });
  for (const row of supplierCredits.error ? [] : supplierCredits.data ?? []) if (!posted.has(`supplier_credit_note:${row.id}`)) rows.push({ id: row.id, kind: "supplier_credit_note", label: "Avoir fournisseur", number: row.credit_note_number });
  for (const row of payments.data ?? []) if (!posted.has(`customer_payment:${row.id}`)) rows.push({ id: row.id, kind: "customer_payment", label: "Règlement client", number: row.payment_number ?? row.id.slice(0, 8) });
  for (const row of supplierPayments.data ?? []) if (!posted.has(`supplier_payment:${row.id}`)) rows.push({ id: row.id, kind: "supplier_payment", label: "Règlement fournisseur", number: row.payment_number ?? row.id.slice(0, 8) });
  return rows;
}

export async function postPendingAccountingDocuments(prev: AccountingActionResult, _formData: FormData): Promise<AccountingActionResult> {
  void prev;
  void _formData;
  const workspace = await requireActiveWorkspace({ module: "comptabilite", level: "write" });
  if (!isAccountingRole(workspace.role)) return { success: false, error: "La comptabilisation est réservée au propriétaire, à l’administrateur ou au comptable." };
  const pending = await listPendingAccountingDocuments();
  if (pending.length === 0) return { success: true, data: { message: "Aucune pièce en attente." } };
  const { postCustomerCreditNote } = await import("@/lib/credit-note-actions");
  const { postSupplierCreditNoteToAccounting } = await import("@/lib/supplier-credit-note-actions");
  let posted = 0;
  const failures: string[] = [];
  for (const item of pending) {
    const formData = new FormData();
    formData.set("id", item.id);
    const previous = { success: true as const };
    const result = item.kind === "customer_invoice"
      ? await postCustomerInvoiceToAccounting(previous, formData)
      : item.kind === "supplier_invoice"
        ? await postSupplierInvoiceToAccounting(previous, formData)
        : item.kind === "customer_payment"
          ? await postCustomerPaymentToAccounting(previous, formData)
          : item.kind === "supplier_payment"
            ? await postSupplierPaymentToAccounting(previous, formData)
            : item.kind === "customer_credit_note"
              ? await postCustomerCreditNote(previous, formData)
              : await postSupplierCreditNoteToAccounting(previous, formData);
    if (result.success) posted += 1;
    else failures.push(`${item.label} ${item.number}`);
  }
  revalidatePath("/comptabilite/ecritures");
  const message = `${posted} pièce${posted > 1 ? "s" : ""} comptabilisée${posted > 1 ? "s" : ""}.${failures.length ? ` Non passées : ${failures.slice(0, 3).join(", ")}.` : ""}`;
  return failures.length && posted === 0 ? { success: false, error: message } : { success: true, data: { message } };
}

export async function letterAccountingLines(prev: AccountingActionResult, formData: FormData): Promise<AccountingActionResult> {
  void prev;
  const workspace = await requireProWorkspace({ module: "comptabilite" });
  if (!isAccountingRole(workspace.role)) return { success: false, error: "Le lettrage est réservé au propriétaire, à l’administrateur ou au comptable." };
  const requested = (text(formData, "lettering_code") ?? "").toUpperCase();
  const ids = formData.getAll("line_ids").map((value) => String(value).trim()).filter(Boolean);
  if (ids.length < 2) return { success: false, error: "Sélectionnez au moins deux lignes." };
  const supabase = await createClient();
  const { nextLetteringCode } = await import("@/lib/accounting-lettering");
  const { data: usedCodes } = await supabase.from("accounting_entry_lines").select("lettering_code").eq("organization_id", workspace.organization.id).not("lettering_code", "is", null).limit(500);
  const code = /^[A-Z0-9]{1,6}$/.test(requested) ? requested : nextLetteringCode((usedCodes ?? []).map((row) => row.lettering_code as string | null));
  const { data, error } = await supabase
    .from("accounting_entry_lines")
    .select("id, account_code, debit, credit, lettering_code")
    .eq("organization_id", workspace.organization.id)
    .in("id", ids);
  if (error) return { success: false, error: financialErrorMessage(error) };
  const lines = data ?? [];
  if (lines.length !== ids.length) return { success: false, error: "Certaines lignes n'appartiennent pas à l'entreprise." };
  if (lines.some((line) => line.lettering_code)) return { success: false, error: "Une ligne est déjà lettrée." };
  const { canLetterLines } = await import("@/lib/accounting-lettering");
  if (!canLetterLines(lines.map((line) => ({ accountCode: String(line.account_code), debit: Number(line.debit), credit: Number(line.credit) })))) {
    return { success: false, error: "Le lettrage exige un même compte 3421 ou 4411, et un total débit égal au total crédit." };
  }
  const today = new Date().toISOString().slice(0, 10);
  let updateError = (await supabase.from("accounting_entry_lines").update({ lettering_code: code, lettering_date: today }).eq("organization_id", workspace.organization.id).in("id", ids)).error;
  if (updateError && (updateError.code === "42703" || updateError.code === "PGRST204")) {
    updateError = (await supabase.from("accounting_entry_lines").update({ lettering_code: code }).eq("organization_id", workspace.organization.id).in("id", ids)).error;
  }
  if (updateError) return { success: false, error: financialErrorMessage(updateError) };
  await logAudit(workspace.organization.id, "letter_accounting_lines", "accounting_entry_lines", ids[0], { code, count: ids.length });
  revalidatePath("/comptabilite/lettrage");
  revalidatePath("/comptabilite/grand-livre");
  revalidatePath("/comptabilite/ecritures");
  return { success: true, data: { message: `Lettrage ${code} enregistré.` } };
}

export async function unletterAccountingLines(prev: AccountingActionResult, formData: FormData): Promise<AccountingActionResult> {
  void prev;
  const workspace = await requireProWorkspace({ module: "comptabilite" });
  if (!isAccountingRole(workspace.role)) return { success: false, error: "Le délettrage est réservé au propriétaire, à l’administrateur ou au comptable." };
  const ids = formData.getAll("line_ids").map((value) => String(value).trim()).filter(Boolean);
  if (ids.length === 0) return { success: false, error: "Sélectionnez au moins une ligne lettrée." };
  const supabase = await createClient();
  let updateError = (await supabase.from("accounting_entry_lines").update({ lettering_code: null, lettering_date: null }).eq("organization_id", workspace.organization.id).in("id", ids)).error;
  if (updateError && (updateError.code === "42703" || updateError.code === "PGRST204")) {
    updateError = (await supabase.from("accounting_entry_lines").update({ lettering_code: null }).eq("organization_id", workspace.organization.id).in("id", ids)).error;
  }
  if (updateError) return { success: false, error: financialErrorMessage(updateError) };
  await logAudit(workspace.organization.id, "unletter_accounting_lines", "accounting_entry_lines", ids[0], { count: ids.length });
  revalidatePath("/comptabilite/lettrage");
  revalidatePath("/comptabilite/grand-livre");
  revalidatePath("/comptabilite/ecritures");
  return { success: true, data: { message: "Lettrage retiré." } };
}

export async function setAccountingPeriodLock(prev: AccountingActionResult, formData: FormData): Promise<AccountingActionResult> {
  void prev;
  const workspace = await requireProWorkspace({ module: "comptabilite" });
  if (!isAccountingRole(workspace.role)) return { success: false, error: "Le verrouillage est réservé au propriétaire, à l’administrateur ou au comptable." };
  const id = text(formData, "period_id");
  const lock = formData.get("locked") === "1";
  if (!id) return { success: false, error: "Période introuvable." };
  const supabase = await createClient();
  const patch = lock
    ? { status: "locked", locked_at: new Date().toISOString(), lock_reason: text(formData, "lock_reason") ?? "Verrouillage manuel" }
    : { status: "open", locked_at: null, lock_reason: null };
  let updated = await supabase.from("accounting_periods").update(patch).eq("organization_id", workspace.organization.id).eq("id", id);
  if (updated.error && (updated.error.code === "42703" || updated.error.code === "PGRST204")) {
    updated = await supabase.from("accounting_periods").update({ status: lock ? "locked" : "open" }).eq("organization_id", workspace.organization.id).eq("id", id);
  }
  if (updated.error) return { success: false, error: financialErrorMessage(updated.error) };
  revalidatePath("/comptabilite/exercices");
  revalidatePath("/comptabilite/cloture");
  return { success: true, data: { message: lock ? "Période verrouillée." : "Période rouverte." } };
}
