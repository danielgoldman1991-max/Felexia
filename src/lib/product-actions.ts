"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireActiveWorkspace } from "@/lib/auth";
import { getDefaultStockLocationId } from "@/lib/stock-locations";
import { recordStockMovementsAtomic } from "@/lib/stock/record-stock-movements";
import { resolveDefaultTaxRateId } from "@/lib/tax-reference";
import type { ProductType } from "@/lib/product-types";

export type ProductActionResult = {
  success: boolean;
  error?: string;
  data?: unknown;
};

function text(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? "").trim();
  return value === "" ? null : value;
}

async function resolveCategoryId(type: ProductType, organizationId: string): Promise<string | null> {
  const defaultName = type === "service" ? "Services" : "Marchandises";
  const fallbackName = type === "service" ? "Autre" : "Marchandises";

  const supabase = await createClient();
  const { data } = await supabase
    .from("product_categories")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("name", defaultName)
    .is("archived_at", null)
    .maybeSingle();

  if (data) return data.id;

  const { data: fallback } = await supabase
    .from("product_categories")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("name", fallbackName)
    .is("archived_at", null)
    .maybeSingle();

  if (fallback) return fallback.id;

  const { data: anyCat } = await supabase
    .from("product_categories")
    .select("id")
    .eq("organization_id", organizationId)
    .is("archived_at", null)
    .limit(1)
    .maybeSingle();

  return anyCat?.id ?? null;
}

async function resolveTaxRateId(): Promise<string | null> {
  return resolveDefaultTaxRateId();
}

function numberValue(formData: FormData, key: string) {
  const raw = text(formData, key);
  if (!raw) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : NaN;
}

function numberOrZero(formData: FormData, key: string) {
  const value = numberValue(formData, key);
  return value === null || Number.isNaN(value) ? 0 : value;
}

async function recordStockDelta({
  organizationId,
  productId,
  operationKey,
  quantity,
  direction,
  moveType,
  notes,
}: {
  organizationId: string;
  productId: string;
  operationKey: string;
  quantity: number;
  direction: "in" | "out";
  moveType: "initial_stock" | "adjustment_in" | "adjustment_out";
  notes: string;
}) {
  if (quantity <= 0) return null;
  const warehouseId = await getDefaultStockLocationId(organizationId);
  const result = await recordStockMovementsAtomic({
    organizationId,
    operationKey,
    movements: [{
      warehouse_id: warehouseId,
      product_id: productId,
      move_type: moveType,
      direction,
      quantity,
      movement_date: new Date().toISOString(),
      notes,
    }],
  });
  return result.error;
}

// =============================================
// PRODUCTS / SERVICES
// =============================================

export async function createProduct(
  previousState: ProductActionResult,
  formData: FormData,
): Promise<ProductActionResult> {
  void previousState;
  const workspace = await requireActiveWorkspace();
  const name = text(formData, "name");
  const type = text(formData, "type") as ProductType | null;

  if (!name) return { success: false, error: "Le nom est obligatoire." };
  if (!type || !["product", "service"].includes(type)) {
    return { success: false, error: "Le type est obligatoire (produit ou service)." };
  }

  const trackStock = type === "service" ? false : formData.get("track_stock") === "on";
  const minStock = type === "service" ? 0 : numberOrZero(formData, "min_stock");
  const currentStock = type === "service" ? 0 : numberOrZero(formData, "current_stock");
  const purchasePriceHt = numberOrZero(formData, "purchase_price_ht");
  const salePriceHt = numberOrZero(formData, "sale_price_ht");
  const defaultDiscountRate = numberOrZero(formData, "default_discount_rate");

  if (purchasePriceHt < 0) return { success: false, error: "Le prix d'achat HT doit etre positif." };
  if (salePriceHt < 0) return { success: false, error: "Le prix de vente HT doit etre positif." };
  if (defaultDiscountRate < 0 || defaultDiscountRate > 100) {
    return { success: false, error: "La remise doit etre comprise entre 0 et 100." };
  }
  if (minStock < 0) return { success: false, error: "Le stock minimum doit etre positif." };
  if (currentStock < 0) return { success: false, error: "Le stock actuel doit etre positif." };

  let taxRateId = text(formData, "tax_rate_id");
  if (!taxRateId) {
    taxRateId = await resolveTaxRateId();
  }
  let salePriceTtc = salePriceHt;
  let marginAmount = 0;
  let marginRate = 0;

  if (taxRateId) {
    const supabase = await createClient();
    const { data: tax } = await supabase
      .from("tax_rates")
      .select("rate")
      .eq("id", taxRateId)
      .single();
    if (tax) {
      salePriceTtc = salePriceHt * (1 + Number(tax.rate) / 100);
    }
  }

  marginAmount = salePriceHt - purchasePriceHt;
  marginRate = salePriceHt > 0 ? (marginAmount / salePriceHt) * 100 : 0;

  const rawCategoryId = text(formData, "category_id");
  const categoryId = (!rawCategoryId || rawCategoryId === "-")
    ? await resolveCategoryId(type, workspace.organization.id)
    : rawCategoryId;

  const supabase = await createClient();
  const { data: created, error } = await supabase.from("products").insert({
    organization_id: workspace.organization.id,
    type,
    sku: text(formData, "sku"),
    barcode: text(formData, "barcode"),
    name,
    description: text(formData, "description"),
    category_id: categoryId,
    unit_id: text(formData, "unit_id"),
    tax_rate_id: taxRateId,
    purchase_price_ht: purchasePriceHt,
    sale_price_ht: salePriceHt,
    sale_price_ttc: Math.round(salePriceTtc * 100) / 100,
    margin_amount: Math.round(marginAmount * 100) / 100,
    margin_rate: Math.round(marginRate * 100) / 100,
    track_stock: trackStock,
    min_stock: minStock,
    current_stock: 0,
    stock_alert_enabled: formData.get("stock_alert_enabled") === "on",
    default_discount_rate: defaultDiscountRate,
    is_sellable: formData.get("is_sellable") !== "off",
    is_purchasable: formData.get("is_purchasable") !== "off",
    status: text(formData, "status") ?? "active",
    notes: text(formData, "notes"),
    created_by: workspace.userId,
  }).select("id").single();

  if (error || !created) return { success: false, error: error?.message ?? "Impossible de creer l'article." };

  if (trackStock && currentStock > 0) {
    try {
      const movementError = await recordStockDelta({
        organizationId: workspace.organization.id,
        productId: created.id,
        operationKey: created.id,
        quantity: currentStock,
        direction: "in",
        moveType: "initial_stock",
        notes: "Stock initial à la création de l'article",
      });
      if (movementError) throw new Error(movementError);
    } catch (movementError) {
      await supabase.from("products").delete().eq("organization_id", workspace.organization.id).eq("id", created.id);
      return { success: false, error: movementError instanceof Error ? movementError.message : "Impossible d'historiser le stock initial." };
    }
  }

  revalidatePath("/articles");
  redirect("/articles");
}

export async function updateProduct(
  previousState: ProductActionResult,
  formData: FormData,
): Promise<ProductActionResult> {
  void previousState;
  const workspace = await requireActiveWorkspace();
  const id = text(formData, "id");
  if (!id) return { success: false, error: "Identifiant article manquant." };

  const name = text(formData, "name");
  const type = text(formData, "type") as ProductType | null;

  if (!name) return { success: false, error: "Le nom est obligatoire." };
  if (!type || !["product", "service"].includes(type)) {
    return { success: false, error: "Le type est obligatoire (produit ou service)." };
  }

  const trackStock = type === "service" ? false : formData.get("track_stock") === "on";
  const minStock = type === "service" ? 0 : numberOrZero(formData, "min_stock");
  const purchasePriceHt = numberOrZero(formData, "purchase_price_ht");
  const salePriceHt = numberOrZero(formData, "sale_price_ht");
  const defaultDiscountRate = numberOrZero(formData, "default_discount_rate");

  if (purchasePriceHt < 0) return { success: false, error: "Le prix d'achat HT doit etre positif." };
  if (salePriceHt < 0) return { success: false, error: "Le prix de vente HT doit etre positif." };
  if (defaultDiscountRate < 0 || defaultDiscountRate > 100) {
    return { success: false, error: "La remise doit etre comprise entre 0 et 100." };
  }

  let taxRateId = text(formData, "tax_rate_id");
  if (!taxRateId) {
    taxRateId = await resolveTaxRateId();
  }
  let salePriceTtc = salePriceHt;

  if (taxRateId) {
    const supabase = await createClient();
    const { data: tax } = await supabase
      .from("tax_rates")
      .select("rate")
      .eq("id", taxRateId)
      .single();
    if (tax) {
      salePriceTtc = salePriceHt * (1 + Number(tax.rate) / 100);
    }
  }

  const marginAmount = salePriceHt - purchasePriceHt;
  const marginRate = salePriceHt > 0 ? (marginAmount / salePriceHt) * 100 : 0;

  const rawCategoryId = text(formData, "category_id");
  const categoryId = (!rawCategoryId || rawCategoryId === "-")
    ? await resolveCategoryId(type, workspace.organization.id)
    : rawCategoryId;

  const supabase = await createClient();
  const { data: existingProduct, error: existingProductError } = await supabase
    .from("products")
    .select("current_stock")
    .eq("organization_id", workspace.organization.id)
    .eq("id", id)
    .maybeSingle();
  if (existingProductError || !existingProduct) {
    return { success: false, error: existingProductError?.message ?? "Article introuvable." };
  }
  if (type === "service" && Math.abs(Number(existingProduct.current_stock ?? 0)) > 0.0005) {
    return { success: false, error: "Ramenez le stock a zero avant de convertir ce produit en service." };
  }
  const { error } = await supabase
    .from("products")
    .update({
      type,
      sku: text(formData, "sku"),
      barcode: text(formData, "barcode"),
      name,
      description: text(formData, "description"),
      category_id: categoryId,
      unit_id: text(formData, "unit_id"),
      tax_rate_id: taxRateId,
      purchase_price_ht: purchasePriceHt,
      sale_price_ht: salePriceHt,
      sale_price_ttc: Math.round(salePriceTtc * 100) / 100,
      margin_amount: Math.round(marginAmount * 100) / 100,
      margin_rate: Math.round(marginRate * 100) / 100,
      track_stock: trackStock,
      min_stock: minStock,
      stock_alert_enabled: formData.get("stock_alert_enabled") === "on",
      default_discount_rate: defaultDiscountRate,
      is_sellable: formData.get("is_sellable") !== "off",
      is_purchasable: formData.get("is_purchasable") !== "off",
      status: text(formData, "status") ?? "active",
      notes: text(formData, "notes"),
    })
    .eq("organization_id", workspace.organization.id)
    .eq("id", id);

  if (error) return { success: false, error: error.message };

  revalidatePath("/articles");
  revalidatePath(`/articles/${id}`);
  redirect(`/articles/${id}`);
}

export async function archiveProduct(
  previousState: ProductActionResult,
  formData: FormData,
): Promise<ProductActionResult> {
  void previousState;
  const workspace = await requireActiveWorkspace();
  const id = text(formData, "id");
  if (!id) return { success: false, error: "Identifiant article manquant." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("products")
    .update({ status: "archived", archived_at: new Date().toISOString() })
    .eq("organization_id", workspace.organization.id)
    .eq("id", id);

  if (error) return { success: false, error: "Impossible d'archiver cet article." };

  revalidatePath("/articles");
  redirect("/articles");
}

// =============================================
// CATEGORIES
// =============================================

export async function createProductCategory(
  previousState: ProductActionResult,
  formData: FormData,
): Promise<ProductActionResult> {
  void previousState;
  const workspace = await requireActiveWorkspace();
  const name = text(formData, "name");
  if (!name) return { success: false, error: "Le nom de la categorie est obligatoire." };

  const supabase = await createClient();
  const { error } = await supabase.from("product_categories").insert({
    organization_id: workspace.organization.id,
    name,
    description: text(formData, "description"),
    type: text(formData, "type") ?? "mixed",
    status: "active",
    created_by: workspace.userId,
  });

  if (error) return { success: false, error: error.message };

  revalidatePath("/articles/categories");
  return { success: true };
}

export async function updateProductCategory(
  previousState: ProductActionResult,
  formData: FormData,
): Promise<ProductActionResult> {
  void previousState;
  const workspace = await requireActiveWorkspace();
  const id = text(formData, "id");
  if (!id) return { success: false, error: "Identifiant categorie manquant." };

  const name = text(formData, "name");
  if (!name) return { success: false, error: "Le nom de la categorie est obligatoire." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("product_categories")
    .update({
      name,
      description: text(formData, "description"),
      type: text(formData, "type") ?? "mixed",
    })
    .eq("organization_id", workspace.organization.id)
    .eq("id", id);

  if (error) return { success: false, error: error.message };

  revalidatePath("/articles/categories");
  return { success: true };
}

export async function archiveProductCategory(
  previousState: ProductActionResult,
  formData: FormData,
): Promise<ProductActionResult> {
  void previousState;
  const workspace = await requireActiveWorkspace();
  const id = text(formData, "id");
  if (!id) return { success: false, error: "Identifiant categorie manquant." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("product_categories")
    .update({ status: "archived", archived_at: new Date().toISOString() })
    .eq("organization_id", workspace.organization.id)
    .eq("id", id);

  if (error) return { success: false, error: "Impossible d'archiver cette categorie." };

  revalidatePath("/articles/categories");
  return { success: true };
}

// =============================================
// UNITS
// =============================================

export async function createUnit(
  previousState: ProductActionResult,
  formData: FormData,
): Promise<ProductActionResult> {
  void previousState;
  const workspace = await requireActiveWorkspace();
  const name = text(formData, "name");
  const symbol = text(formData, "symbol");

  if (!name) return { success: false, error: "Le nom de l'unite est obligatoire." };
  if (!symbol) return { success: false, error: "Le symbole de l'unite est obligatoire." };

  const supabase = await createClient();
  const { error } = await supabase.from("units").insert({
    organization_id: workspace.organization.id,
    name,
    symbol,
    description: text(formData, "description"),
    created_by: workspace.userId,
  });

  if (error) return { success: false, error: error.message };

  revalidatePath("/articles/unites");
  return { success: true };
}

export async function updateUnit(
  previousState: ProductActionResult,
  formData: FormData,
): Promise<ProductActionResult> {
  void previousState;
  const workspace = await requireActiveWorkspace();
  const id = text(formData, "id");
  if (!id) return { success: false, error: "Identifiant unite manquant." };

  const name = text(formData, "name");
  const symbol = text(formData, "symbol");

  if (!name) return { success: false, error: "Le nom de l'unite est obligatoire." };
  if (!symbol) return { success: false, error: "Le symbole de l'unite est obligatoire." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("units")
    .update({ name, symbol, description: text(formData, "description") })
    .eq("organization_id", workspace.organization.id)
    .eq("id", id);

  if (error) return { success: false, error: error.message };

  revalidatePath("/articles/unites");
  return { success: true };
}

export async function archiveUnit(
  previousState: ProductActionResult,
  formData: FormData,
): Promise<ProductActionResult> {
  void previousState;
  const workspace = await requireActiveWorkspace();
  const id = text(formData, "id");
  if (!id) return { success: false, error: "Identifiant unite manquant." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("units")
    .update({ status: "archived", archived_at: new Date().toISOString() })
    .eq("organization_id", workspace.organization.id)
    .eq("id", id);

  if (error) return { success: false, error: "Impossible d'archiver cette unite." };

  revalidatePath("/articles/unites");
  return { success: true };
}

// =============================================
// TAX RATES
// =============================================

export async function createTaxRate(
  previousState: ProductActionResult,
  formData: FormData,
): Promise<ProductActionResult> {
  void previousState;
  const workspace = await requireActiveWorkspace();
  const name = text(formData, "name");
  const rate = numberValue(formData, "rate");

  if (!name) return { success: false, error: "Le nom du taux est obligatoire." };
  if (rate === null || Number.isNaN(rate)) {
    return { success: false, error: "Le taux est obligatoire." };
  }
  if (rate < 0 || rate > 100) {
    return { success: false, error: "Le taux doit etre compris entre 0 et 100." };
  }

  const supabase = await createClient();
  const isDefault = formData.get("is_default") === "on";

  if (isDefault) {
    await supabase
      .from("tax_rates")
      .update({ is_default: false })
      .eq("organization_id", workspace.organization.id);
  }

  const { error } = await supabase.from("tax_rates").insert({
    organization_id: workspace.organization.id,
    name,
    rate,
    is_default: isDefault,
    description: text(formData, "description"),
    created_by: workspace.userId,
  });

  if (error) return { success: false, error: error.message };

  revalidatePath("/articles/tva");
  return { success: true };
}

export async function updateTaxRate(
  previousState: ProductActionResult,
  formData: FormData,
): Promise<ProductActionResult> {
  void previousState;
  const workspace = await requireActiveWorkspace();
  const id = text(formData, "id");
  if (!id) return { success: false, error: "Identifiant taux manquant." };

  const name = text(formData, "name");
  const rate = numberValue(formData, "rate");

  if (!name) return { success: false, error: "Le nom du taux est obligatoire." };
  if (rate === null || Number.isNaN(rate)) {
    return { success: false, error: "Le taux est obligatoire." };
  }
  if (rate < 0 || rate > 100) {
    return { success: false, error: "Le taux doit etre compris entre 0 et 100." };
  }

  const supabase = await createClient();
  const isDefault = formData.get("is_default") === "on";

  if (isDefault) {
    await supabase
      .from("tax_rates")
      .update({ is_default: false })
      .eq("organization_id", workspace.organization.id)
      .neq("id", id);
  }

  const { error } = await supabase
    .from("tax_rates")
    .update({ name, rate, is_default: isDefault, description: text(formData, "description") })
    .eq("organization_id", workspace.organization.id)
    .eq("id", id);

  if (error) return { success: false, error: error.message };

  revalidatePath("/articles/tva");
  return { success: true };
}

export async function archiveTaxRate(
  previousState: ProductActionResult,
  formData: FormData,
): Promise<ProductActionResult> {
  void previousState;
  const workspace = await requireActiveWorkspace();
  const id = text(formData, "id");
  if (!id) return { success: false, error: "Identifiant taux manquant." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("tax_rates")
    .update({ status: "archived", archived_at: new Date().toISOString() })
    .eq("organization_id", workspace.organization.id)
    .eq("id", id);

  if (error) return { success: false, error: "Impossible d'archiver ce taux." };

  revalidatePath("/articles/tva");
  return { success: true };
}

export async function setDefaultTaxRate(
  previousState: ProductActionResult,
  formData: FormData,
): Promise<ProductActionResult> {
  void previousState;
  const workspace = await requireActiveWorkspace();
  const id = text(formData, "id");
  if (!id) return { success: false, error: "Identifiant taux manquant." };

  const supabase = await createClient();
  await supabase
    .from("tax_rates")
    .update({ is_default: false })
    .eq("organization_id", workspace.organization.id);

  const { error } = await supabase
    .from("tax_rates")
    .update({ is_default: true })
    .eq("organization_id", workspace.organization.id)
    .eq("id", id);

  if (error) return { success: false, error: "Impossible de definir ce taux par defaut." };

  revalidatePath("/articles/tva");
  return { success: true };
}
