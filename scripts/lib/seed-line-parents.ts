export type SeedParentColumn =
  | "document_id"
  | "invoice_id"
  | "credit_note_id";

export function resolveSeedLineParents(
  lines: Record<string, unknown>[],
  parentIdsByReference: Record<string, string>,
  parentColumn: SeedParentColumn,
) {
  for (const line of lines) {
    const reference = String(line.__parent_reference ?? "");
    const parentId = parentIdsByReference[reference];
    if (!reference || !parentId) {
      throw new Error(`Parent introuvable pour une ligne de seed (${parentColumn}).`);
    }
    line[parentColumn] = parentId;
    delete line.__parent_reference;
  }
}
