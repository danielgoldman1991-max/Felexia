/** Read complete, stably ordered lists without relying on the API's row cap. */
export async function readAllPages<T>(fetchPage: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>, batchSize = 500): Promise<T[]> {
  const rows: T[] = [];
  for (;;) {
    const { data, error } = await fetchPage(rows.length, rows.length + batchSize - 1);
    if (error) throw new Error(error.message);
    if (!data?.length) return rows;
    rows.push(...data);
  }
}

export function positivePage(value: unknown, fallback = 1): number {
  const page = Number(value);
  return Number.isSafeInteger(page) && page > 0 ? page : fallback;
}

export function pageRows<T>(rows: T[], page: number, pageSize: number) {
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const current = Math.min(positivePage(page), totalPages);
  return { rows: rows.slice((current - 1) * pageSize, current * pageSize), total: rows.length, page: current, pageSize, totalPages };
}

/** CSV cells from user text must never become spreadsheet formulas. */
export function csvResponse(name: string, headings: string[], rows: unknown[][]): Response {
  const cell = (value: unknown) => {
    let text = value == null ? "" : String(value);
    if (typeof value !== "number" && /^[\s]*[=+@\-\t\r]/.test(text)) text = `'${text}`;
    return `"${text.replaceAll('"', '""')}"`;
  };
  const csv = "\uFEFF" + [headings, ...rows].map((row) => row.map(cell).join(";")).join("\r\n");
  return new Response(csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${name}.csv"`, "Cache-Control": "private, no-store" } });
}

export function searchText(value: string | undefined): string {
  return (value ?? "").trim().toLocaleLowerCase("fr");
}
