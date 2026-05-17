import { createClient } from "@/lib/supabase/service";
import { DEFAULT_ACCOUNTING_JOURNALS, DEFAULT_CHART_OF_ACCOUNTS } from "@/lib/accounting";
import { DEFAULT_CUSTOMER_CATEGORIES, DEFAULT_PRODUCT_CATEGORIES, DEFAULT_UNITS } from "@/lib/reference-lists";

export async function initializeOrganizationDefaults(organizationId: string) {
  const svc = createClient();

  // Customer categories
  const customerCategories = DEFAULT_CUSTOMER_CATEGORIES.map((cat) => ({
    organization_id: organizationId,
    name: cat.name,
    description: cat.description,
    is_default: cat.is_default,
  }));
  await svc.from("customer_categories").upsert(customerCategories, {
    onConflict: "organization_id,name",
    ignoreDuplicates: true,
  });

  // Product categories
  const productCategories = DEFAULT_PRODUCT_CATEGORIES.map((cat) => ({
    organization_id: organizationId,
    code: cat.code,
    name: cat.name,
    description: cat.description,
    type: cat.type,
    status: "active",
  }));
  await svc.from("product_categories").upsert(productCategories, {
    onConflict: "organization_id,name",
    ignoreDuplicates: true,
  });

  // Units
  const units = DEFAULT_UNITS.map((unit) => ({
    organization_id: organizationId,
    name: unit.name,
    symbol: unit.symbol,
    description: unit.description,
    status: "active",
  }));
  await svc.from("units").upsert(units, {
    onConflict: "organization_id,symbol",
    ignoreDuplicates: true,
  });

  const [{ data: existingAccounts }, { data: existingJournals }] = await Promise.all([
    svc.from("accounting_accounts").select("code").eq("organization_id", organizationId),
    svc.from("accounting_journals").select("code").eq("organization_id", organizationId),
  ]);

  const existingAccountCodes = new Set((existingAccounts ?? []).map((account) => account.code as string));
  const missingAccounts = DEFAULT_CHART_OF_ACCOUNTS.filter((account) => !existingAccountCodes.has(account.code));
  if (missingAccounts.length > 0) {
    await svc.from("accounting_accounts").insert(
      missingAccounts.map((account) => ({
        organization_id: organizationId,
        code: account.code,
        name: account.name,
        class_number: account.code.charAt(0),
        type: account.type,
        is_active: true,
        is_movement_allowed: true,
        is_auxiliary_required: false,
        is_auxiliary: false,
        is_system: true,
      })),
    );
  }

  const existingJournalCodes = new Set((existingJournals ?? []).map((journal) => journal.code as string));
  const missingJournals = DEFAULT_ACCOUNTING_JOURNALS.filter((journal) => !existingJournalCodes.has(journal.code));
  if (missingJournals.length > 0) {
    await svc.from("accounting_journals").insert(
      missingJournals.map((journal) => ({
        organization_id: organizationId,
        code: journal.code,
        name: journal.name,
        type: journal.type,
        description: journal.description,
        is_active: true,
      })),
    );
  }

  const { data: existingSettings } = await svc
    .from("accounting_settings")
    .select("organization_id")
    .eq("organization_id", organizationId)
    .limit(1)
    .maybeSingle();

  if (!existingSettings) {
    await svc.from("accounting_settings").insert({
      organization_id: organizationId,
      sales_journal_code: "VE",
      purchases_journal_code: "AC",
      bank_journal_code: "BQ",
      cash_journal_code: "CA",
      od_journal_code: "OD",
    });
  }
}
