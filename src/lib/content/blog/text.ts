import type { BlogArticle, BlogBlock, TextRun } from "@/lib/content/blog/types";

export function runText(run: TextRun): string {
  return typeof run === "string" ? run : run.label;
}

function blockText(block: BlogBlock): string {
  switch (block.type) {
    case "h2":
    case "h3":
      return block.text;
    case "p":
      return block.runs.map(runText).join(" ");
    case "ul":
      return block.items.map((item) => item.map(runText).join(" ")).join(" ");
    case "callout":
      return [block.title, ...(block.paragraphs ?? []).map((item) => item.map(runText).join(" ")), ...(block.items ?? [])].join(" ");
    case "table":
      return [block.caption, ...block.columns, ...block.rows.flat()].join(" ");
    case "checklist":
      return [block.title, ...block.items].join(" ");
    case "example":
      return [block.kicker, block.title, block.note, ...block.rows.flatMap((row) => [row.label, row.value, row.annotation])].join(" ");
    default:
      return "";
  }
}

/** Guide length, excluding the FAQ, the source list, the CTA and the legal disclaimer. */
export function articleWordCount(article: BlogArticle): number {
  const text = [article.essentials.join(" "), article.introduction.map(runText).join(" "), ...article.blocks.map(blockText)].join(" ");
  const words = text.replace(/[’']/g, "'").match(/[\p{L}\p{N}]+(?:[’'-][\p{L}\p{N}]+)*/gu);
  return words?.length ?? 0;
}

export function readingMinutes(article: BlogArticle): number {
  return Math.max(1, Math.round(articleWordCount(article) / 200));
}

export function formatBlogDate(isoDate: string): string {
  return new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${isoDate}T00:00:00Z`));
}

export function headings(article: BlogArticle): { id: string; text: string; level: 2 | 3 }[] {
  return article.blocks.flatMap((block) => block.type === "h2" || block.type === "h3" ? [{ id: block.id, text: block.text, level: block.type === "h2" ? 2 as const : 3 as const }] : []);
}
