"use server";

import { createClient } from "@/lib/supabase/server";
import { requireActiveWorkspace } from "@/lib/auth";
import { DEFAULT_CUSTOMER_CATEGORIES, DEFAULT_PRODUCT_CATEGORIES, DEFAULT_UNITS } from "@/lib/reference-lists";

export async function ensureCustomerCategories() {
  const workspace = await requireActiveWorkspace();
  const supabase = await createClient();

  const { data: existing, error: checkError } = await supabase
    .from("customer_categories")
    .select("id")
    .eq("organization_id", workspace.organization.id)
    .limit(1);

  if (checkError) throw new Error(`Impossible de verifier les categories clients: ${checkError.message}`);
  if (existing && existing.length > 0) return;

  const categories = DEFAULT_CUSTOMER_CATEGORIES.map((cat) => ({
    organization_id: workspace.organization.id,
    name: cat.name,
    description: cat.description,
    is_default: cat.is_default,
  }));

  const { error: upsertError } = await supabase.from("customer_categories").upsert(categories, {
    onConflict: "organization_id,name",
    ignoreDuplicates: true,
  });

  if (upsertError) throw new Error(`Impossible d'initialiser les categories clients: ${upsertError.message}`);
}

export async function ensureProductCategories() {
  const workspace = await requireActiveWorkspace();
  const supabase = await createClient();

  const { data: existing, error: checkError } = await supabase
    .from("product_categories")
    .select("id")
    .eq("organization_id", workspace.organization.id)
    .is("archived_at", null)
    .limit(1);

  if (checkError) throw new Error(`Impossible de verifier les categories: ${checkError.message}`);
  if (existing && existing.length > 0) return;

  const categories = DEFAULT_PRODUCT_CATEGORIES.map((cat) => ({
    organization_id: workspace.organization.id,
    code: cat.code,
    name: cat.name,
    description: cat.description,
    type: cat.type,
    status: "active",
  }));

  const { error: upsertError } = await supabase.from("product_categories").upsert(categories, {
    onConflict: "organization_id,name",
    ignoreDuplicates: true,
  });

  if (upsertError) throw new Error(`Impossible d'initialiser les categories: ${upsertError.message}`);
}

export async function ensureUnits() {
  const workspace = await requireActiveWorkspace();
  const supabase = await createClient();

  const { data: existing, error: checkError } = await supabase
    .from("units")
    .select("id")
    .eq("organization_id", workspace.organization.id)
    .is("archived_at", null)
    .limit(1);

  if (checkError) throw new Error(`Impossible de verifier les unites: ${checkError.message}`);
  if (existing && existing.length > 0) return;

  const units = DEFAULT_UNITS.map((unit) => ({
    organization_id: workspace.organization.id,
    name: unit.name,
    symbol: unit.symbol,
    description: unit.description,
    status: "active",
  }));

  const { error: upsertError } = await supabase.from("units").upsert(units, {
    onConflict: "organization_id,symbol",
    ignoreDuplicates: true,
  });

  if (upsertError) throw new Error(`Impossible d'initialiser les unites: ${upsertError.message}`);
}

export async function ensureAllReferenceData() {
  await ensureCustomerCategories();
  await ensureProductCategories();
  await ensureUnits();
}
