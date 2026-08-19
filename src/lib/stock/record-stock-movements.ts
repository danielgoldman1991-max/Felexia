import { createClient } from "@/lib/supabase/server";

export type AtomicStockMovement = {
  product_id: string;
  warehouse_id: string;
  source_document_id?: string | null;
  source_line_id?: string | null;
  move_type:
    | "delivery_out"
    | "customer_return_in"
    | "adjustment_in"
    | "adjustment_out"
    | "manual_stock_in"
    | "manual_stock_out"
    | "initial_stock"
    | "purchase_in"
    | "purchase_receipt_in";
  direction: "in" | "out";
  quantity: number;
  movement_date?: string | null;
  notes?: string | null;
};

type AtomicStockResult = {
  movement_id: string;
  source_line_id: string | null;
  replayed: boolean;
};

function stockIntegrityError(error: { code?: string; message?: string } | null | undefined) {
  if (error?.code === "PGRST202" || error?.code === "42883" || error?.message?.includes("schema cache")) {
    return "La mise a niveau de securite du stock doit etre appliquee avant cette operation.";
  }
  return error?.message ?? "Les mouvements de stock n'ont pas pu etre confirmes.";
}

export async function recordStockMovementsAtomic({
  organizationId,
  operationKey,
  movements,
  finalizeDocumentType,
  documentId,
}: {
  organizationId: string;
  operationKey: string;
  movements: AtomicStockMovement[];
  finalizeDocumentType?: "supplier_receipt" | "delivery_note" | "return_note";
  documentId?: string;
}): Promise<{ data: AtomicStockResult[]; error: string | null }> {
  if (!operationKey || (movements.length === 0 && !finalizeDocumentType)) {
    return { data: [], error: "Operation de stock incomplete." };
  }
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("record_stock_movements_atomic", {
    p_organization_id: organizationId,
    p_operation_key: operationKey,
    p_movements: movements,
    p_finalize_document_type: finalizeDocumentType ?? null,
    p_document_id: documentId ?? null,
  });
  if (error) return { data: [], error: stockIntegrityError(error) };
  return { data: (data ?? []) as AtomicStockResult[], error: null };
}
