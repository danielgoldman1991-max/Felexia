"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireActiveWorkspace } from "@/lib/auth";
import type { ProductType } from "@/lib/product-types";

export async function quickCreateCustomerCategory(name: string): Promise<{ id: string; name: string } | { error: string }> {
  const workspace = await requireActiveWorkspace();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("customer_categories")
    .insert({ organization_id: workspace.organization.id, name })
    .select("id, name")
    .single();
  if (error) return { error: error.message };
  return data;
}

export async function quickCreateProductCategory(code: string, name: string): Promise<{ id: string; name: string; code: string | null } | { error: string }> {
  const workspace = await requireActiveWorkspace();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("product_categories")
    .insert({
      organization_id: workspace.organization.id,
      code: code || null,
      name,
      type: "product",
      status: "active",
      created_by: workspace.userId,
    })
    .select("id, name, code")
    .single();
  if (error) return { error: error.message };
  return data;
}

export async function quickCreateUnit(name: string, symbol: string): Promise<{ id: string; name: string; symbol: string } | { error: string }> {
  const workspace = await requireActiveWorkspace();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("units")
    .insert({
      organization_id: workspace.organization.id,
      name,
      symbol,
      status: "active",
      created_by: workspace.userId,
    })
    .select("id, name, symbol")
    .single();
  if (error) return { error: error.message };
  return data;
}

export async function quickCreateProduct(formData: FormData): Promise<{ success: boolean; error?: string; data?: { id: string } }> {
  const workspace = await requireActiveWorkspace();
  const supabase = await createClient();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { success: false, error: "Le nom est obligatoire." };

  const type = String(formData.get("type") ?? "product") as ProductType;
  let taxRateId = String(formData.get("tax_rate_id") ?? "").trim() || null;
  if (!taxRateId) {
    const { data: defaultTax } = await supabase
      .from("tax_rates")
      .select("id")
      .is("organization_id", null)
      .eq("status", "active")
      .eq("is_system", true)
      .eq("code", "VAT_20")
      .maybeSingle();
    taxRateId = defaultTax?.id ?? null;
  }
  let salePriceTtc = 0;

  if (taxRateId) {
    const { data: tax } = await supabase
      .from("tax_rates")
      .select("rate")
      .eq("id", taxRateId)
      .single();
    if (tax) {
      const salePriceHt = Number(formData.get("sale_price_ht") ?? 0);
      salePriceTtc = salePriceHt * (1 + Number(tax.rate) / 100);
    }
  }

  const { data, error } = await supabase
    .from("products")
    .insert({
      organization_id: workspace.organization.id,
      type,
      name,
      sku: null,
      barcode: String(formData.get("barcode") ?? "").trim() || null,
      description: String(formData.get("description") ?? "").trim() || null,
      category_id: String(formData.get("category_id") ?? "").trim() || null,
      unit_id: String(formData.get("unit_id") ?? "").trim() || null,
      tax_rate_id: taxRateId,
      purchase_price_ht: Number(formData.get("purchase_price_ht") ?? 0),
      sale_price_ht: Number(formData.get("sale_price_ht") ?? 0),
      sale_price_ttc: Math.round(salePriceTtc * 100) / 100,
      margin_amount: 0,
      margin_rate: 0,
      track_stock: type !== "service",
      min_stock: 0,
      current_stock: 0,
      stock_alert_enabled: false,
      default_discount_rate: Number(formData.get("default_discount_rate") ?? 0),
      is_sellable: formData.get("is_sellable") !== "off",
      is_purchasable: formData.get("is_purchasable") !== "off",
      status: "active",
      created_by: workspace.userId,
    })
    .select("id")
    .single();

  if (error) return { success: false, error: error.message };

  revalidatePath("/articles");
  return { success: true, data: { id: data.id } };
}
