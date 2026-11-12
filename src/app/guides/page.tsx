import Link from "next/link";
import { GuideDownloadButton } from "@/components/guides/GuideDownload";
import { LandingFooter } from "@/components/landing/LandingFooter";
import { LandingHeader } from "@/components/landing/LandingHeader";
import { NewsletterBand } from "@/components/newsletter/NewsletterForm";
import styles from "@/components/marketing/guides.module.css";
import { BLOG_ARTICLES, articlesInCategory, blogCategoryLabel } from "@/lib/content/blog";
import { formatBlogDate, readingMinutes } from "@/lib/content/blog/text";
import { BLOG_PILLARS, type BlogArticle, type BlogPillarSlug } from "@/lib/content/blog/types";
import { PRODUCT_GUIDES } from "@/lib/content/product-guides";
import { createPublicMetadata } from "@/lib/seo";
import "@/styles/landing.css";
import "@/styles/landing-motion.css";

const description = "Articles pour facturer, suivre le stock et préparer vos échanges au Maroc. Le guide PDF de l’ERP complet se télécharge en bas de page, après un court formulaire.";

export const metadata = createPublicMetadata({
  title: "Guides et ressources pour PME au Maroc | Felexia",
  description,
  path: "/guides",
});

function Cover({ article, priority = false }: { article: BlogArticle; priority?: boolean }) {
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

function ArticleMeta({ article }: { article: BlogArticle }) {
  return (
    <p className={styles.meta}>
      <time dateTime={article.publishedAt}>{formatBlogDate(article.publishedAt)}</time>
      <span aria-hidden="true">·</span>
      <span>{readingMinutes(article)} min de lecture</span>
    </p>
  );
}

export default async function GuidesPage({ searchParams }: { searchParams: Promise<{ categorie?: string }> }) {
  const { categorie } = await searchParams;
  const active = BLOG_PILLARS.some((pillar) => pillar.slug === categorie) ? categorie as BlogPillarSlug : undefined;
  const visible = active ? articlesInCategory(active) : [...BLOG_ARTICLES];
  const featured = visible.find((article) => article.featured) ?? visible[0];
  const cards = featured ? visible.filter((article) => article.path !== featured.path) : [];

  return (
    <div id="top" className="landing marketing-site">
      <a className="marketing-skip-link" href="#main-content">Aller au contenu</a>
      <LandingHeader />
      <main id="main-content" tabIndex={-1}>
        <header className={styles.hero}>
          <div className="marketing-container">
            <p className={styles.kicker}>Ressources</p>
            <h1>Guides & ressources</h1>
            <p className={styles.lede}>Des articles pour facturer, suivre le stock et préparer vos échanges. Le guide PDF de l’ERP complet est en bas de page.</p>
            <nav aria-label="Catégories">
              <ul className={styles.filters}>
                <li><Link href="/guides" aria-current={active ? undefined : "page"}>Tous</Link></li>
                {BLOG_PILLARS.map((pillar) => (
                  <li key={pillar.slug}>
                    <Link href={`/guides?categorie=${pillar.slug}`} aria-current={active === pillar.slug ? "page" : undefined}>{pillar.label}</Link>
                  </li>
                ))}
              </ul>
            </nav>
          </div>
        </header>
        <section className={styles.section} aria-labelledby="articles-title">
          <div className="marketing-container">
            <h2 id="articles-title" className={styles.sectionTitle}>{active ? blogCategoryLabel(active) : "Articles"}</h2>
            {featured ? (
              <Link href={featured.path} className={styles.featured}>
                <span className={styles.media}><Cover article={featured} priority /></span>
                <span className={styles.featuredCopy}>
                  <span className={styles.badge}>{blogCategoryLabel(featured.category)}</span>
                  <h3 className={styles.featuredTitle}>{featured.h1}</h3>
                  <span className={styles.excerpt}>{featured.description}</span>
                  <ArticleMeta article={featured} />
                </span>
              </Link>
            ) : null}
            {cards.length > 0 ? (
              <ul className={styles.grid}>
                {cards.map((article) => (
                  <li key={article.path}>
                    <Link href={article.path} className={styles.card}>
                      <span className={styles.media}><Cover article={article} /></span>
                      <span className={styles.cardBody}>
                        <span className={styles.badge}>{blogCategoryLabel(article.category)}</span>
                        <h3 className={styles.cardTitle}>{article.h1}</h3>
                        <span className={styles.excerpt}>{article.description}</span>
                        <ArticleMeta article={article} />
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : null}
            {visible.length === 0 ? <p className={styles.empty}>Les prochains articles de cette catégorie sont en préparation. Les textes déjà publiés restent dans <Link href="/guides">tous les articles</Link>.</p> : null}
            <NewsletterBand
              source="guides"
              title="Les prochains articles"
              text="Un e-mail lorsqu’un article est publié. La case d’accord reste à cocher, et vous pouvez vous désinscrire."
            />
            <aside className={styles.guideBanner} aria-labelledby="guide-pdf-title">
              {PRODUCT_GUIDES.map((guide) => (
                <div key={guide.slug} className={styles.guideRow}>
                  <picture className={styles.guideCover}>
                    <source srcSet={guide.cover.avif} type="image/avif" />
                    <source srcSet={guide.cover.webp} type="image/webp" />
                    <img src={guide.cover.webp} width={guide.cover.width} height={guide.cover.height} alt={guide.cover.alt} />
                  </picture>
                  <div className={styles.guideCopy}>
                    <p className={styles.kicker}>{guide.kicker} · {guide.pages} pages</p>
                    <h2 id="guide-pdf-title">{guide.title}</h2>
                    <p>{guide.description}</p>
                  </div>
                  <GuideDownloadButton slug={guide.slug} className="marketing-button marketing-button-primary">Télécharger le guide</GuideDownloadButton>
                </div>
              ))}
            </aside>
          </div>
        </section>
      </main>
      <LandingFooter />
    </div>
  );
}
