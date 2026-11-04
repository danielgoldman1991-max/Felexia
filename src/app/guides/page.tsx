import Link from "next/link";
import { GuideDownloadButton } from "@/components/guides/GuideDownload";
import { LandingFooter } from "@/components/landing/LandingFooter";
import { LandingHeader } from "@/components/landing/LandingHeader";
import { NewsletterBand } from "@/components/newsletter/NewsletterForm";
import styles from "@/components/marketing/guides.module.css";
import { BLOG_ARTICLES } from "@/lib/content/blog";
import { PRODUCT_GUIDES } from "@/lib/content/product-guides";
import { createPublicMetadata } from "@/lib/seo";
import "@/styles/landing.css";
import "@/styles/landing-motion.css";

const description = "Téléchargez le guide FelexiaERP PRO, 32 pages sur l’ERP complet, puis retrouvez les articles pour gérer votre PME au Maroc. Fichier gratuit après un court formulaire.";

export const metadata = createPublicMetadata({
  title: "Guides et ressources pour PME au Maroc | Felexia",
  description,
  path: "/guides",
});

export default function GuidesPage() {
  return (
    <div id="top" className="landing marketing-site">
      <a className="marketing-skip-link" href="#main-content">Aller au contenu</a>
      <LandingHeader />
      <main id="main-content" tabIndex={-1}>
        <header className={styles.hero}>
          <div className="marketing-container">
            <p className="marketing-eyebrow">Ressources</p>
            <h1>Guides & ressources</h1>
            <p className={styles.lede}>Des documents pour voir Felexia avant de créer votre espace. Le guide PRO se télécharge gratuitement : un e-mail suffit, sans engagement.</p>
          </div>
        </header>
        <section className={styles.section} aria-labelledby="guides-list-title">
          <div className="marketing-container">
            <h2 id="guides-list-title" className="marketing-section-title">Guides à télécharger</h2>
            <ul className={styles.list}>
              {PRODUCT_GUIDES.map((guide) => (
                <li key={guide.slug}>
                  <article className={styles.card}>
                    <picture className={styles.cover}>
                      <source srcSet={guide.cover.avif} type="image/avif" />
                      <source srcSet={guide.cover.webp} type="image/webp" />
                      <img src={guide.cover.webp} width={guide.cover.width} height={guide.cover.height} alt={guide.cover.alt} />
                    </picture>
                    <div>
                      <p className={styles.kicker}>{guide.kicker}</p>
                      <h3>{guide.title}</h3>
                      <p>{guide.description}</p>
                      <p className={styles.meta}>{guide.pages} pages · PDF</p>
                      <div className={styles.actions}>
                        <GuideDownloadButton slug={guide.slug} className="marketing-button marketing-button-primary">Télécharger le guide (PDF)</GuideDownloadButton>
                      </div>
                    </div>
                  </article>
                </li>
              ))}
            </ul>
            <NewsletterBand
              source="guides"
              title="Les actualités, même sans le guide"
              text="Si vous voulez seulement les prochains articles, indiquez votre e-mail ici. La case d’accord reste à cocher."
            />
            <div className={styles.articles}>
              <h2>Articles pour votre gestion</h2>
              <ul className={styles.articleList}>
                {BLOG_ARTICLES.map((article) => (
                  <li key={article.path}>
                    <Link href={article.path}>{article.h1}</Link>
                    <p>{article.description}</p>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>
      </main>
      <LandingFooter />
    </div>
  );
}
