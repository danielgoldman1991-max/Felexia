import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { LandingEffects } from "@/components/landing/LandingEffects";
import { LandingFooter } from "@/components/landing/LandingFooter";
import { LandingHeader } from "@/components/landing/LandingHeader";
import styles from "@/components/marketing/blog.module.css";
import { JsonLd } from "@/components/seo/JsonLd";
import { publicOfferCopy } from "@/lib/content/blog/offers";
import { BLOG_ARTICLES, articlesInCategory, blogCategoryLabel } from "@/lib/content/blog/index";
import { BLOG_PILLARS, type BlogPillarSlug } from "@/lib/content/blog/types";
import { formatBlogDate, readingMinutes } from "@/lib/content/blog/text";
import { LANDING_GUIDES } from "@/lib/content/guides";
import { getBlogStructuredData } from "@/lib/seo";
import "@/styles/landing.css";
import "@/components/landing/landing-conversion.css";

function Cover({ article, priority = false }: { article: (typeof BLOG_ARTICLES)[number]; priority?: boolean }) {
  return (
    <picture>
      <source srcSet={article.cover.avif} type="image/avif" />
      <source srcSet={article.cover.webp} type="image/webp" />
      <img
        src={article.cover.webp}
        width={article.cover.width}
        height={article.cover.height}
        alt={article.cover.alt}
        loading={priority ? "eager" : "lazy"}
        fetchPriority={priority ? "high" : "auto"}
        decoding="async"
      />
    </picture>
  );
}

export function BlogIndex({ category }: { category?: BlogPillarSlug }) {
  const offer = publicOfferCopy();
  const known = category ? BLOG_PILLARS.some((pillar) => pillar.slug === category) : false;
  const active = known ? category : undefined;
  const visible = active ? articlesInCategory(active) : [...BLOG_ARTICLES];
  const featured = visible.find((article) => article.featured) ?? null;
  const cards = featured ? visible.filter((article) => article.slug !== featured.slug) : visible;

  return (
    <div id="top" className={"landing marketing-site " + styles.page}>
      <JsonLd id="felexia-blog" data={getBlogStructuredData(BLOG_ARTICLES)} />
      <LandingEffects />
      <a className="marketing-skip-link" href="#main-content">Aller au contenu</a>
      <LandingHeader />
      <main id="main-content" tabIndex={-1}>
        <header className={styles.hero}>
          <div className="marketing-container">
            <nav className={styles.breadcrumb} aria-label="Fil d’Ariane">
              <ol>
                <li><Link href="/">Accueil</Link></li>
                <li aria-hidden="true">/</li>
                <li><span aria-current="page">Guides</span></li>
              </ol>
            </nav>
            <p className={styles.kicker}>Guides · PME au Maroc</p>
            <h1 className={styles.title}>Des guides pour gérer une PME au Maroc</h1>
            <p className={styles.lede}>Facturation, stock, fiscalité : des guides pratiques et sourcés pour piloter votre PME au Maroc.</p>
            <nav aria-label="Catégories des guides">
              <ul className={styles.filters}>
                <li><Link href="/blog" aria-current={active ? undefined : "page"}>Tous</Link></li>
                {BLOG_PILLARS.map((pillar) => (
                  <li key={pillar.slug}>
                    <Link href={`/blog?categorie=${pillar.slug}`} aria-current={active === pillar.slug ? "page" : undefined}>{pillar.label}</Link>
                  </li>
                ))}
              </ul>
            </nav>
          </div>
        </header>
        <section className={styles.section} aria-labelledby="blog-articles-title">
          <div className="marketing-container">
            <h2 id="blog-articles-title" className="marketing-section-title">{active ? blogCategoryLabel(active) : "Articles"}</h2>
            {featured ? (
              <article className={styles.featured}>
                <Link href={featured.path} className={styles.media}>
                  <Cover article={featured} priority />
                </Link>
                <div className={styles.featuredCopy}>
                  <Link href={`/blog?categorie=${featured.category}`} className={styles.pill}>{blogCategoryLabel(featured.category)}</Link>
                  <h2><Link href={featured.path}>{featured.h1}</Link></h2>
                  <p className={styles.excerpt}>{featured.description}</p>
                  <ul className={styles.meta}>
                    <li><time dateTime={featured.publishedAt}>{formatBlogDate(featured.publishedAt)}</time></li>
                    <li>{readingMinutes(featured)} min de lecture</li>
                  </ul>
                  <Link href={featured.path} className={styles.textLink}>Lire l’article <ArrowUpRight size={16} aria-hidden="true" /></Link>
                </div>
              </article>
            ) : null}
            {cards.length > 0 ? (
              <ul className={styles.grid}>
                {cards.map((article) => (
                  <li key={article.path}>
                    <article className={styles.card}>
                      <Link href={article.path} className={styles.media}><Cover article={article} /></Link>
                      <div className={styles.cardBody}>
                        <Link href={`/blog?categorie=${article.category}`} className={styles.pill}>{blogCategoryLabel(article.category)}</Link>
                        <h2><Link href={article.path}>{article.h1}</Link></h2>
                        <p className={styles.excerpt}>{article.description}</p>
                        <ul className={styles.meta}>
                          <li><time dateTime={article.publishedAt}>{formatBlogDate(article.publishedAt)}</time></li>
                          <li>{readingMinutes(article)} min de lecture</li>
                        </ul>
                        <Link href={article.path} className={styles.textLink}>Lire l’article <ArrowUpRight size={16} aria-hidden="true" /></Link>
                      </div>
                    </article>
                  </li>
                ))}
              </ul>
            ) : null}
            {visible.length === 0 ? <p className={styles.empty}>Les prochains guides de cette catégorie sont en préparation. Les articles déjà publiés restent dans <Link href="/blog">tous les guides</Link>.</p> : null}
            <div className={styles.useful}>
              <h2>Pages utiles</h2>
              <ul className={styles.usefulList}>
                {LANDING_GUIDES.map((guide) => (
                  <li key={guide.path}><Link href={guide.path} className={styles.textLink}>{guide.h1} <ArrowUpRight size={16} aria-hidden="true" /></Link></li>
                ))}
                <li><Link href="/pricing" className={styles.textLink}>Tarifs du logiciel de gestion <ArrowUpRight size={16} aria-hidden="true" /></Link></li>
              </ul>
            </div>
            <aside className={styles.cta} aria-labelledby="blog-cta-title">
              <div>
                <h2 id="blog-cta-title">Essayez Felexia {offer.trial}, sans carte bancaire</h2>
                <p>{offer.offerPitch}</p>
              </div>
              <Link href="/login?mode=register" className="marketing-button marketing-button-primary">Démarrer l’essai <ArrowUpRight size={16} aria-hidden="true" /></Link>
            </aside>
          </div>
        </section>
      </main>
      <LandingFooter />
    </div>
  );
}
