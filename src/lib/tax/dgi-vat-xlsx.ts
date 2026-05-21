import type { DgiVatExportData } from "@/lib/tax/dgi-vat-types";

export const DGI_VAT_XLSX_AVAILABLE = false;

export async function generateDgiVatXlsx(data: DgiVatExportData): Promise<Uint8Array | null> {
  void data;
  return null;
}
