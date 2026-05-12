"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireActiveWorkspace } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getAccountByNumber, getJournalByCode, getExistingEntryBySource, buildCustomerInvoiceLines, buildSupplierInvoiceLines, verifyBalanced, generateEntryNumber, getAccountingSettings as getAccountingSettingsFromLib } from "@/lib/accounting";
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



export async function listAccountingJournals() {
  const workspace = await requireActiveWorkspace();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("accounting_journals")
    .select("*")
    .eq("organization_id", workspace.organization.id)
    .order("code");
  if (error) return { success: false, error: error.message } as AccountingActionResult;
  return { success: true, data } as AccountingActionResult;
}

export async function listAccountingAccounts(filters?: { query?: string; class_number?: string; type?: string }) {
  const workspace = await requireActiveWorkspace();
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
  if (error) return { success: false, error: error.message } as AccountingActionResult;
  return { success: true, data } as AccountingActionResult;
}

export async function getAccountingAccount(id: string) {
  const workspace = await requireActiveWorkspace();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("accounting_accounts")
    .select("*")
    .eq("organization_id", workspace.organization.id)
    .eq("id", id)
    .maybeSingle();
  if (error) return { success: false, error: error.message } as AccountingActionResult;
  if (!data) return { success: false, error: "Compte introuvable." } as AccountingActionResult;
  return { success: true, data } as AccountingActionResult;
}

export async function listAccountingAuxiliaries(filters?: { query?: string; type?: string }) {
  const workspace = await requireActiveWorkspace();
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
  if (error) return { success: false, error: error.message } as AccountingActionResult;
  return { success: true, data } as AccountingActionResult;
}

export async function listAccountingFiscalYears() {
  const workspace = await requireActiveWorkspace();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("accounting_fiscal_years")
    .select("*")
    .eq("organization_id", workspace.organization.id)
    .order("start_date", { ascending: false });
  if (error) return { success: false, error: error.message } as AccountingActionResult;
  return { success: true, data } as AccountingActionResult;
}

export async function listAccountingPeriods(fiscalYearId?: string) {
  const workspace = await requireActiveWorkspace();
  const supabase = await createClient();
  let query = supabase
    .from("accounting_periods")
    .select("*, fiscal_year:accounting_fiscal_years!inner(name)")
    .eq("organization_id", workspace.organization.id);
  if (fiscalYearId) {
    query = query.eq("fiscal_year_id", fiscalYearId);
  }
  const { data, error } = await query.order("start_date");
  if (error) return { success: false, error: error.message } as AccountingActionResult;
  return { success: true, data } as AccountingActionResult;
}

export async function listAccountingEntries(filters?: {
  query?: string;
  status?: string;
  journal_id?: string;
  page?: number;
  pageSize?: number;
}) {
  const workspace = await requireActiveWorkspace();
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

  if (error) return { success: false, error: error.message } as AccountingActionResult;
  return { success: true, data: { entries: data ?? [], total: count ?? 0 } } as AccountingActionResult;
}

export async function getAccountingEntry(id: string) {
  const workspace = await requireActiveWorkspace();
  const supabase = await createClient();
  const { data: entry, error: entryError } = await supabase
    .from("accounting_entries")
    .select("*, journal:accounting_journals!inner(code, name)")
    .eq("organization_id", workspace.organization.id)
    .eq("id", id)
    .in("status", ["draft", "posted"])
    .maybeSingle();
  if (entryError) return { success: false, error: entryError.message } as AccountingActionResult;
  if (!entry) return { success: false, error: "Ecriture introuvable." } as AccountingActionResult;

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
  const workspace = await requireActiveWorkspace();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("accounting_settings")
    .select("*")
    .eq("organization_id", workspace.organization.id)
    .maybeSingle();
  if (error) return { success: false, error: error.message } as AccountingActionResult;
  return { success: true, data } as AccountingActionResult;
}

export async function createAccountingEntry(prev: AccountingActionResult, formData: FormData): Promise<AccountingActionResult> {
  void prev;
  const workspace = await requireActiveWorkspace();
  const journalId = text(formData, "journal_id");
  const entryDate = text(formData, "entry_date");
  const label = text(formData, "label");
  const reference = text(formData, "reference");
  const notes = text(formData, "notes");
  const lines = parseLines(formData);

  if (!journalId) return { success: false, error: "Selectionnez un journal." };
  if (!entryDate) return { success: false, error: "La date d'ecriture est obligatoire." };
  if (!label) return { success: false, error: "Le libelle est obligatoire." };
  if (lines.length < 2) return { success: false, error: "Une ecriture doit avoir au moins 2 lignes." };

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

  const entryNumber = await generateEntryNumber(workspace.organization.id, (journal as { code: string })?.code ?? "EC");

  const { data: entry, error: insertError } = await supabase
    .from("accounting_entries")
    .insert({
      organization_id: workspace.organization.id,
      entry_number: entryNumber,
      journal_id: journalId,
      entry_date: entryDate,
      reference,
      label,
      notes,
      status: "draft",
      total_debit: totalDebit,
      total_credit: totalCredit,
      created_by: workspace.userId,
    })
    .select("id")
    .single();

  if (insertError || !entry) return { success: false, error: insertError?.message ?? "Impossible de creer l'ecriture." };

  const { error: linesError } = await supabase
    .from("accounting_entry_lines")
    .insert(lines.map((line, index) => ({
      organization_id: workspace.organization.id,
      entry_id: entry.id,
      line_number: index + 1,
      account_id: line.account_id,
      account_code: line.account_code,
      account_label: line.account_label,
      debit: line.debit,
      credit: line.credit,
      label: line.label || null,
    })));

  if (linesError) return { success: false, error: linesError.message };

  revalidatePath("/comptabilite/ecritures");
  redirect(`/comptabilite/ecritures/${entry.id}`);
}

export async function postAccountingEntry(prev: AccountingActionResult, formData: FormData): Promise<AccountingActionResult> {
  void prev;
  const workspace = await requireActiveWorkspace();
  const id = text(formData, "id");
  if (!id) return { success: false, error: "Ecriture introuvable." };
  const supabase = await createClient();
  const { data: entry, error: fetchError } = await supabase
    .from("accounting_entries")
    .select("id, status, total_debit, total_credit")
    .eq("organization_id", workspace.organization.id)
    .eq("id", id)
    .maybeSingle();
  if (fetchError || !entry) return { success: false, error: "Ecriture introuvable." };
  if (entry.status !== "draft") return { success: false, error: "Seule une ecriture brouillon peut etre validee." };
  if (Math.abs(Number(entry.total_debit) - Number(entry.total_credit)) > 0.01) return { success: false, error: "L'ecriture n'est pas equilibree." };
  const { error: updateError } = await supabase
    .from("accounting_entries")
    .update({ status: "posted", posted_by: workspace.userId, posted_at: new Date().toISOString() })
    .eq("organization_id", workspace.organization.id)
    .eq("id", id);
  if (updateError) return { success: false, error: updateError.message };
  revalidatePath("/comptabilite/ecritures");
  revalidatePath(`/comptabilite/ecritures/${id}`);
  return { success: true };
}

export async function cancelAccountingEntry(prev: AccountingActionResult, formData: FormData): Promise<AccountingActionResult> {
  void prev;
  const workspace = await requireActiveWorkspace();
  const id = text(formData, "id");
  if (!id) return { success: false, error: "Ecriture introuvable." };
  const supabase = await createClient();
  const { data: entry, error: fetchError } = await supabase
    .from("accounting_entries")
    .select("id, status")
    .eq("organization_id", workspace.organization.id)
    .eq("id", id)
    .maybeSingle();
  if (fetchError || !entry) return { success: false, error: "Ecriture introuvable." };
  if (entry.status === "posted") {
    return { success: false, error: "Une ecriture comptabilisee ne peut pas etre annulee directement. Utilisez un avoir ou une ecriture corrective." };
  }
  return { success: false, error: "L'annulation directe des ecritures comptables est desactivee. Utilisez une ecriture corrective si necessaire." };
}

export async function archiveAccountingEntry(prev: AccountingActionResult, formData: FormData): Promise<AccountingActionResult> {
  void prev;
  const workspace = await requireActiveWorkspace();
  const id = text(formData, "id");
  if (!id) return { success: false, error: "Ecriture introuvable." };
  const supabase = await createClient();
  const { data: entry, error: fetchError } = await supabase
    .from("accounting_entries")
    .select("id, status")
    .eq("organization_id", workspace.organization.id)
    .eq("id", id)
    .maybeSingle();
  if (fetchError || !entry) return { success: false, error: "Ecriture introuvable." };
  if (entry.status === "posted") {
    return { success: false, error: "Une ecriture comptabilisee ne peut pas etre archivee directement. Utilisez un avoir ou une ecriture corrective." };
  }
  return { success: false, error: "L'archivage direct des ecritures comptables est desactive." };
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
  "34552": { name: "Etat - TVA recuperable sur charges", type: "tax" },
  "4455": { name: "Etat - TVA facturee", type: "tax" },
};

const JOURNAL_FALLBACKS: Record<string, { name: string; type: string }> = {
  VE: { name: "Journal des ventes", type: "sales" },
  AC: { name: "Journal des achats", type: "purchases" },
  BQ: { name: "Journal banque", type: "bank" },
  CA: { name: "Journal caisse", type: "cash" },
  OD: { name: "Operations diverses", type: "od" },
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
    await supabase.from("accounting_accounts").insert(
      missing.map((code) => ({
        organization_id: organizationId,
        code,
        name: ACCOUNT_FALLBACKS[code]?.name ?? `Compte ${code}`,
        class_number: code.charAt(0),
        type: ACCOUNT_FALLBACKS[code]?.type ?? "other",
        is_system: true,
      })),
    );
  }
}

async function ensureJournals(organizationId: string, codes: string[]) {
  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("accounting_journals")
    .select("id, code")
    .eq("organization_id", organizationId)
    .in("code", codes);
  const existingCodes = new Set((existing ?? []).map((journal) => journal.code));
  const missing = codes.filter((code) => !existingCodes.has(code));
  if (missing.length > 0) {
    await supabase.from("accounting_journals").insert(
      missing.map((code) => ({
        organization_id: organizationId,
        code,
        name: JOURNAL_FALLBACKS[code]?.name ?? `Journal ${code}`,
        type: JOURNAL_FALLBACKS[code]?.type ?? "od",
        is_active: true,
      })),
    );
  }
}

async function ensureAccountingBaseSetup(organizationId: string) {
  await Promise.all([
    ensureAccounts(organizationId, ["3421", "4411", "5141", "5161", "6111", "6122", "7111", "7121", "7124", "3455", "34552", "4455"]),
    ensureJournals(organizationId, ["VE", "AC", "BQ", "CA", "OD"]),
  ]);
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
  const workspace = await requireActiveWorkspace();
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
  if (!salesVatAccount) return { success: false, error: `Compte TVA collectee ${salesVatCode} introuvable.` };

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
  if (!balanced) return { success: false, error: "Validation impossible : l'ecriture comptable generee n'est pas equilibree." };

  const entryNumber = await generateEntryNumber(orgId, "VE");
  const label = `Facture client ${invoice.invoice_number} - ${customer?.name ?? "Client"}`;
  const accountLabels = new Map([
    [customerAccount.id, { code: customerAccount.code, name: customerAccount.name }],
    [salesProductAccount.id, { code: salesProductAccount.code, name: salesProductAccount.name }],
    [salesServiceAccount.id, { code: salesServiceAccount.code, name: salesServiceAccount.name }],
    [salesVatAccount.id, { code: salesVatAccount.code, name: salesVatAccount.name }],
  ]);

  const { data: entry, error: insertError } = await supabase
    .from("accounting_entries")
    .insert({
      organization_id: orgId,
      entry_number: entryNumber,
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
    })
    .select("id")
    .single();

  if (insertError || !entry) return { success: false, error: insertError?.message ?? "Impossible de creer l'ecriture comptable." };

  const { error: linesError } = await supabase
    .from("accounting_entry_lines")
    .insert(accountLines.map((l, i) => ({
      organization_id: orgId,
      entry_id: entry.id,
      line_number: i + 1,
      account_id: l.account_id,
      account_code: accountLabels.get(l.account_id)?.code ?? l.account_code,
      account_label: accountLabels.get(l.account_id)?.name ?? l.account_name,
      debit: l.debit,
      credit: l.credit,
      label: l.label,
    })));

  if (linesError) return { success: false, error: linesError.message };

  revalidatePath("/comptabilite/ecritures");
  return { success: true, data: { entry_id: entry.id, entry_number: entryNumber } };
}

export async function generateSupplierInvoiceAccountingEntry(invoiceId: string): Promise<{ success: boolean; error?: string; data?: { entry_id: string; entry_number: string } }> {
  const workspace = await requireActiveWorkspace();
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
  if (!purchaseVatAccount) return { success: false, error: `Compte TVA recuperable ${purchaseVatCode} introuvable.` };

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
  if (!balanced) return { success: false, error: "Validation impossible : l'ecriture comptable generee n'est pas equilibree." };

  const entryNumber = await generateEntryNumber(orgId, "AC");
  const displayNumber = invoice.supplier_invoice_number || invoice.invoice_number;
  const label = `Facture fournisseur ${displayNumber} - ${supplierName ?? "Fournisseur"}`;

  const { data: entry, error: insertError } = await supabase
    .from("accounting_entries")
    .insert({
      organization_id: orgId,
      entry_number: entryNumber,
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
    })
    .select("id")
    .single();

  if (insertError || !entry) return { success: false, error: insertError?.message ?? "Impossible de creer l'ecriture comptable." };

  const { error: insertLinesError } = await supabase
    .from("accounting_entry_lines")
    .insert(accountLines.map((l, i) => ({
      organization_id: orgId,
      entry_id: entry.id,
      line_number: i + 1,
      account_id: l.account_id,
      account_code: l.account_code || "",
      account_label: l.account_name,
      debit: l.debit,
      credit: l.credit,
      label: l.label,
    })));

  if (insertLinesError) return { success: false, error: insertLinesError.message };

  revalidatePath("/comptabilite/ecritures");
  return { success: true, data: { entry_id: entry.id, entry_number: entryNumber } };
}

export async function generateCustomerPaymentAccountingEntry(paymentId: string): Promise<{ success: boolean; error?: string; data?: { entry_id: string; entry_number: string } }> {
  const workspace = await requireActiveWorkspace();
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
  if (!balanced) return { success: false, error: "L'ecriture generee n'est pas equilibree." };

  const entryNumber = await generateEntryNumber(orgId, journalCode);
  const label = `Encaissement client ${payment.payment_number} - ${customer?.name ?? "Client"}`;

  const { data: entry, error: insertError } = await supabase
    .from("accounting_entries")
    .insert({
      organization_id: orgId,
      entry_number: entryNumber,
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
    })
    .select("id")
    .single();

  if (insertError || !entry) return { success: false, error: insertError?.message ?? "Impossible de creer l'ecriture comptable." };

  const { error: linesError } = await supabase
    .from("accounting_entry_lines")
    .insert(lines.map((l, i) => ({
      organization_id: orgId,
      entry_id: entry.id,
      line_number: i + 1,
      account_id: l.account_id,
      account_code: l.account_code,
      account_label: l.account_name,
      debit: l.debit,
      credit: l.credit,
      label: l.label,
    })));

  if (linesError) return { success: false, error: linesError.message };

  revalidatePath("/comptabilite/ecritures");
  return { success: true, data: { entry_id: entry.id, entry_number: entryNumber } };
}

export async function generateSupplierPaymentAccountingEntry(paymentId: string): Promise<{ success: boolean; error?: string; data?: { entry_id: string; entry_number: string } }> {
  const workspace = await requireActiveWorkspace();
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
  if (!balanced) return { success: false, error: "L'ecriture generee n'est pas equilibree." };

  const entryNumber = await generateEntryNumber(orgId, journalCode);
  const label = `Paiement fournisseur ${payment.payment_number} - ${supplier?.name ?? "Fournisseur"}`;

  const { data: entry, error: insertError } = await supabase
    .from("accounting_entries")
    .insert({
      organization_id: orgId,
      entry_number: entryNumber,
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
    })
    .select("id")
    .single();

  if (insertError || !entry) return { success: false, error: insertError?.message ?? "Impossible de creer l'ecriture comptable." };

  const { error: linesError } = await supabase
    .from("accounting_entry_lines")
    .insert(lines.map((l, i) => ({
      organization_id: orgId,
      entry_id: entry.id,
      line_number: i + 1,
      account_id: l.account_id,
      account_code: l.account_code,
      account_label: l.account_name,
      debit: l.debit,
      credit: l.credit,
      label: l.label,
    })));

  if (linesError) return { success: false, error: linesError.message };

  revalidatePath("/comptabilite/ecritures");
  return { success: true, data: { entry_id: entry.id, entry_number: entryNumber } };
}

export async function updateAccountingSettings(prev: AccountingActionResult, formData: FormData): Promise<AccountingActionResult> {
  void prev;
  const workspace = await requireActiveWorkspace();
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
  const { error } = await supabase
    .from("accounting_settings")
    .update(payload)
    .eq("organization_id", workspace.organization.id);
  if (error) return { success: false, error: error.message };
  revalidatePath("/comptabilite/parametres");
  return { success: true };
}

export async function updateAccountingEntryLineAccount(prev: AccountingActionResult, formData: FormData): Promise<AccountingActionResult> {
  void prev;
  const workspace = await requireActiveWorkspace();
  const lineId = text(formData, "entry_line_id");
  const accountId = text(formData, "account_id");
  if (!lineId) return { success: false, error: "Ligne d'ecriture introuvable." };
  if (!accountId) return { success: false, error: "Selectionnez un compte comptable." };

  const supabase = await createClient();
  const { data: line, error: lineError } = await supabase
    .from("accounting_entry_lines")
    .select("id, entry_id, account_code, account_label")
    .eq("organization_id", workspace.organization.id)
    .eq("id", lineId)
    .maybeSingle();
  if (lineError) return { success: false, error: lineError.message };
  if (!line) return { success: false, error: "Ligne d'ecriture introuvable." };

  const { data: entry, error: entryError } = await supabase
    .from("accounting_entries")
    .select("id, entry_number, status")
    .eq("organization_id", workspace.organization.id)
    .eq("id", line.entry_id)
    .maybeSingle();
  if (entryError) return { success: false, error: entryError.message };
  if (!entry) return { success: false, error: "Ecriture introuvable." };
  if (entry.status === "cancelled") return { success: false, error: "Cette ecriture est annulee, les lignes ne sont plus modifiables." };

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
  if (updateError) return { success: false, error: updateError.message };

  const { data: totals, error: totalsError } = await supabase
    .from("accounting_entry_lines")
    .select("debit, credit")
    .eq("organization_id", workspace.organization.id)
    .eq("entry_id", entry.id);
  if (totalsError) return { success: false, error: totalsError.message };
  const totalDebit = (totals ?? []).reduce((sum, row) => sum + Number(row.debit ?? 0), 0);
  const totalCredit = (totals ?? []).reduce((sum, row) => sum + Number(row.credit ?? 0), 0);
  if (Math.abs(totalDebit - totalCredit) > 0.01) {
    return { success: false, error: "La modification a ete enregistree, mais l'ecriture est desequilibree. Verifiez les lignes." };
  }

  revalidatePath(`/comptabilite/ecritures/${entry.id}`);
  revalidatePath("/comptabilite/ecritures");
  return { success: true };
}

export async function postCustomerInvoiceToAccounting(prev: AccountingActionResult, formData: FormData): Promise<AccountingActionResult> {
  void prev;
  const invoiceId = firstText(formData, ["invoice_id", "customer_invoice_id", "id"]);
  if (!invoiceId) return { success: false, error: "Facture client introuvable : identifiant manquant." };

  const workspace = await requireActiveWorkspace();
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

  const workspace = await requireActiveWorkspace();
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

  const workspace = await requireActiveWorkspace();
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

  const workspace = await requireActiveWorkspace();
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

export async function createChartOfAccount(prev: AccountingActionResult, formData: FormData): Promise<AccountingActionResult> {
  void prev;
  const workspace = await requireActiveWorkspace();
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
    created_by: workspace.userId,
  });
  if (error) return { success: false, error: error.message };

  revalidatePath("/comptabilite/plan-comptable");
  return { success: true };
}

export async function updateChartOfAccount(prev: AccountingActionResult, formData: FormData): Promise<AccountingActionResult> {
  void prev;
  const workspace = await requireActiveWorkspace();
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
    if (isUsed) return { success: false, error: "Ce compte est deja utilise dans des ecritures. Son numero ne peut pas etre modifie." };
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
  if (error) return { success: false, error: error.message };

  revalidatePath("/comptabilite/plan-comptable");
  revalidatePath(`/comptabilite/comptes/${id}`);
  return { success: true };
}

export async function archiveChartOfAccount(prev: AccountingActionResult, formData: FormData): Promise<AccountingActionResult> {
  void prev;
  const workspace = await requireActiveWorkspace();
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
    return { success: false, error: "Ce compte est utilise dans des ecritures. Il peut etre desactive mais pas archive." };
  }

  const { error } = await supabase
    .from("accounting_accounts")
    .update({ archived_at: new Date().toISOString(), is_active: false })
    .eq("organization_id", workspace.organization.id)
    .eq("id", id);
  if (error) return { success: false, error: error.message };

  revalidatePath("/comptabilite/plan-comptable");
  revalidatePath(`/comptabilite/comptes/${id}`);
  return { success: true };
}

export async function toggleChartOfAccountActive(prev: AccountingActionResult, formData: FormData): Promise<AccountingActionResult> {
  void prev;
  const workspace = await requireActiveWorkspace();
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
  if (error) return { success: false, error: error.message };

  revalidatePath("/comptabilite/plan-comptable");
  revalidatePath(`/comptabilite/comptes/${id}`);
  return { success: true };
}

export async function ensureDefaultChartOfAccountsAction(prev: AccountingActionResult, formData: FormData): Promise<AccountingActionResult> {
  void prev;
  void formData;
  const workspace = await requireActiveWorkspace();
  const { ensureDefaultChartOfAccounts } = await import("@/lib/accounting");
  try {
    const result = await ensureDefaultChartOfAccounts(workspace.organization.id);
    revalidatePath("/comptabilite/plan-comptable");
    return { success: true, data: result };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Erreur lors de l'initialisation du plan comptable." };
  }
}
