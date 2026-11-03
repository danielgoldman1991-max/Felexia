import Link from "next/link";
import { ArrowUpRight, Check, Plus } from "lucide-react";
import { LandingEffects } from "@/components/landing/LandingEffects";
import { LandingFooter } from "@/components/landing/LandingFooter";
import { LandingHeader } from "@/components/landing/LandingHeader";
import styles from "@/components/marketing/blog.module.css";
import { JsonLd } from "@/components/seo/JsonLd";
import { blogCategoryLabel } from "@/lib/content/blog/index";
import type { BlogArticle as BlogArticleData, TextRun } from "@/lib/content/blog/types";
import { formatBlogDate, headings, readingMinutes } from "@/lib/content/blog/text";
import { getBlogPostingStructuredData, getFaqPageStructuredData } from "@/lib/seo";
import "@/styles/landing.css";
import "@/components/landing/landing-conversion.css";

function Rich({ runs }: { runs: readonly TextRun[] }) {
  return runs.map((run, index) => {
    if (typeof run === "string") return <span key={index}>{run}</span>;
    const external = run.href.startsWith("http");
    return external
      ? <a key={index} href={run.href} target="_blank" rel="noopener noreferrer">{run.label}</a>
      : <Link key={index} href={run.href}>{run.label}</Link>;
  });
}

function Toc({ article }: { article: BlogArticleData }) {
  return (
    <nav className={styles.toc} aria-label="Sommaire de l’article">
      <p>Sommaire</p>
      <ol>
        {headings(article).map((heading) => (
          <li key={heading.id} data-level={heading.level}><a href={`#${heading.id}`}>{heading.text}</a></li>
        ))}
      </ol>
    </nav>
  );
}

export function BlogArticle({ article }: { article: BlogArticleData }) {
  const minutes = readingMinutes(article);
  return (
    <div id="top" className={"landing marketing-site " + styles.page}>
      <JsonLd id="felexia-article" data={getBlogPostingStructuredData(article)} />
      <JsonLd id="felexia-article-faq" data={getFaqPageStructuredData(article.questions, article.path)} />
      <LandingEffects />
      <a className="marketing-skip-link" href="#main-content">Aller au contenu</a>
      <LandingHeader />
      <main id="main-content" tabIndex={-1}>
        <header className={styles.hero + " " + styles.articleHero}>
          <div className="marketing-container">
            <nav className={styles.breadcrumb} aria-label="Fil d’Ariane">
              <ol>
                <li><Link href="/">Accueil</Link></li>
                <li aria-hidden="true">/</li>
                <li><Link href="/blog">Guides</Link></li>
                <li aria-hidden="true">/</li>
                <li><span aria-current="page">{article.h1}</span></li>
              </ol>
            </nav>
            <p className={styles.categoryRow}><Link href={`/blog?categorie=${article.category}`} className={styles.pill}>{blogCategoryLabel(article.category)}</Link></p>
            <h1 className={styles.title + " " + styles.articleTitle}>{article.h1}</h1>
            <ul className={styles.meta}>
              <li>Par {article.author}</li>
              <li>Publié le <time dateTime={article.publishedAt}>{formatBlogDate(article.publishedAt)}</time></li>
              <li>Mis à jour le <time dateTime={article.updatedAt}>{formatBlogDate(article.updatedAt)}</time></li>
              <li>{minutes} min de lecture</li>
            </ul>
            <figure className={styles.cover + " " + styles.media}>
              <picture>
                <source srcSet={article.cover.avif} type="image/avif" />
                <source srcSet={article.cover.webp} type="image/webp" />
                <img src={article.cover.webp} width={article.cover.width} height={article.cover.height} alt={article.cover.alt} fetchPriority="high" decoding="async" />
              </picture>
            </figure>
            <details className={styles.tocMobile}>
              <summary>Sommaire <Plus size={16} aria-hidden="true" /></summary>
              <Toc article={article} />
            </details>
          </div>
        </header>
        <div className="marketing-container">
          <div className={styles.layout}>
            <article className={styles.prose}>
              <section className={styles.essentials} aria-labelledby="essentiel-titre">
                <h2 id="essentiel-titre">L’essentiel</h2>
                <ul>
                  {article.essentials.map((item) => <li key={item}>{item}</li>)}
                </ul>
              </section>
              <p><Rich runs={article.introduction} /></p>
              {article.blocks.map((block, index) => {
                if (block.type === "h2") return <h2 key={block.id} id={block.id}>{block.text}</h2>;
                if (block.type === "h3") return <h3 key={block.id} id={block.id}>{block.text}</h3>;
                if (block.type === "p") return <p key={index}><Rich runs={block.runs} /></p>;
                if (block.type === "ul") {
                  return (
                    <ul key={index}>
                      {block.items.map((item, itemIndex) => <li key={itemIndex}><Rich runs={item} /></li>)}
                    </ul>
                  );
                }
                if (block.type === "table") {
                  return (
                    <div key={index} className={styles.tableWrap}>
                      <table>
                        <caption>{block.caption}</caption>
                        <thead>
                          <tr>{block.columns.map((column) => <th key={column} scope="col">{column}</th>)}</tr>
                        </thead>
                        <tbody>
                          {block.rows.map((row) => (
                            <tr key={row.join("|")}>{row.map((cell, cellIndex) => <td key={cellIndex}>{cell}</td>)}</tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  );
                }
                if (block.type === "checklist") {
                  return (
                    <section key={index} className={styles.checklist} aria-label={block.title}>
                      <h3>{block.title}</h3>
                      <ul>
                        {block.items.map((item) => <li key={item}><Check size={16} aria-hidden="true" /><span>{item}</span></li>)}
                      </ul>
                    </section>
                  );
                }
                if (block.type === "example") {
                  return (
                    <section key={index} className={styles.example} aria-label={block.title}>
                      <p className={styles.exampleKicker}>{block.kicker}</p>
                      <h3>{block.title}</h3>
                      <p className={styles.exampleNote}>{block.note}</p>
                      <dl>
                        {block.rows.map((row) => (
                          <div key={row.label}>
                            <dt>{row.label}</dt>
                            <dd>{row.value}<br /><small>{row.annotation}</small></dd>
                          </div>
                        ))}
                      </dl>
                    </section>
                  );
                }
                const tone = block.tone === "accountant" ? styles.calloutAccountant : block.tone === "product" ? styles.calloutProduct : styles.calloutNote;
                return (
                  <aside key={index} className={styles.callout + " " + tone}>
                    <h3>{block.title}</h3>
                    {block.paragraphs?.map((paragraph, paragraphIndex) => <p key={paragraphIndex}><Rich runs={paragraph} /></p>)}
                    {block.items ? <ul>{block.items.map((item) => <li key={item}>{item}</li>)}</ul> : null}
                  </aside>
                );
              })}
              <section className={styles.faq} aria-labelledby="faq-titre">
                <h2 id="faq-titre">Questions fréquentes</h2>
                <div className={styles.questions}>
                  {article.questions.map((item) => (
                    <details key={item.question}>
                      <summary>{item.question} <Plus size={16} aria-hidden="true" /></summary>
                      <p>{item.answer}</p>
                    </details>
                  ))}
                </div>
              </section>
              <section className={styles.sources} aria-labelledby="sources-titre">
                <h2 id="sources-titre">Sources</h2>
                <ol>
                  {article.sources.map((source) => (
                    <li key={source.href}>
                      {source.href.startsWith("http")
                        ? <a href={source.href} target="_blank" rel="noopener noreferrer">{source.label}</a>
                        : <Link href={source.href}>{source.label}</Link>}
                      <small>Consulté le {source.consulted}</small>
                    </li>
                  ))}
                </ol>
              </section>
              <section className={styles.related} aria-labelledby="suite-titre">
                <h2 id="suite-titre">Pour aller plus loin</h2>
                <ul className={styles.relatedGrid}>
                  {article.related.map((link) => (
                    <li key={link.href} className={styles.relatedCard}><h3><Link href={link.href}>{link.label}</Link></h3><Link href={link.href} className={styles.textLink}>Lire <ArrowUpRight size={16} aria-hidden="true" /></Link></li>
                  ))}
                </ul>
              </section>
              <aside className={styles.cta} aria-labelledby="article-cta-title">
                <div>
                  <h2 id="article-cta-title">{article.cta.label}</h2>
                  <p>{article.cta.note}</p>
                </div>
                <Link href={article.cta.href} className="marketing-button marketing-button-primary">{article.cta.label} <ArrowUpRight size={16} aria-hidden="true" /></Link>
              </aside>
              <p className={styles.disclaimer}>{article.disclaimer}</p>
            </article>
            <div className={styles.tocDesktop}><Toc article={article} /></div>
          </div>
        </div>
      </main>
      <LandingFooter />
    </div>
  );
}
