import { buildArticle } from "@/lib/content/blog/article-shell";
import { PR3_ARTICLES } from "@/lib/content/blog/articles/pr3-wave";
import { MORE_SPECS } from "@/lib/content/blog/articles/pr3-more";
import { REST_SPECS } from "@/lib/content/blog/articles/pr3-rest";
import { SUITE_SPECS } from "@/lib/content/blog/articles/pr3-suite";
import { LAST_SPECS } from "@/lib/content/blog/articles/pr3-last";
import { END_SPECS, MORE_TAIL, TAIL_SPECS } from "@/lib/content/blog/articles/pr3-tail";

export const PR3_BLOG_ARTICLES = [
  ...PR3_ARTICLES,
  ...[...MORE_SPECS, ...REST_SPECS, ...SUITE_SPECS, ...LAST_SPECS, ...TAIL_SPECS, ...MORE_TAIL, ...END_SPECS].map(buildArticle),
];
