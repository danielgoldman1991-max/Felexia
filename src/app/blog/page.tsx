import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { LandingFooter } from "@/components/landing/LandingFooter";
import { LandingHeader } from "@/components/landing/LandingHeader";
import styles from "@/components/landing/product-offer-page.module.css";
import { JsonLd } from "@/components/seo/JsonLd";
import { ARTICLES, LANDING_GUIDES } from "@/lib/content/guides";
import { createPublicMetadata, getBlogStructuredData } from "@/lib/seo";
import "@/styles/landing.css";
import "@/components/landing/landing-conversion.css";

const title = "Guides du logiciel de gestion pour PME au Maroc | Felexia";
const description = "Guides FelexiaERP : choisir entre ESSENTIEL et l’ERP PRO, facturer et suivre le stock au Maroc. Contenus tirés des offres publiées, sans témoignage inventé.";

export const metadata = createPublicMetadata({ title, description, path: "/blog" });

export default function BlogIndexPage() {
  return (
    <div id="top" className={"landing marketing-site " + styles.page}>
      <JsonLd id="felexia-blog" data={getBlogStructuredData(ARTICLES)} />
      <a className="marketing-skip-link" href="#main-content">Aller au contenu</a>
      <LandingHeader />
      <main id="main-content" tabIndex={-1}>
        <section className={styles.hero} aria-labelledby="blog-title">
          <div className="marketing-container">
            <nav className={styles.breadcrumb} aria-label="Fil d’Ariane">
              <ol>
                <li><Link href="/">Accueil</Link></li>
                <li aria-hidden="true">/</li>
                <li><span aria-current="page">Guides</span></li>
              </ol>
            </nav>
            <p className="marketing-eyebrow">Guides · PME au Maroc</p>
            <h1 id="blog-title" className={styles.title}>Guides pour la gestion des PME au Maroc</h1>
            <p className={styles.introduction}>Deux articles pour choisir une offre et comprendre le stock dans PRO, plus les pages de facturation. Aucun témoignage ni chiffre qui ne figure déjà sur le site.</p>
          </div>
        </section>
        <section className={styles.section} aria-labelledby="blog-articles-title">
          <div className="marketing-container">
            <div className={styles.sectionHeading}><h2 id="blog-articles-title">Articles</h2></div>
            <div className={styles.featureGrid}>
              {ARTICLES.map((article) => (
                <article key={article.path} className={styles.feature}>
                  <h3><Link href={article.path}>{article.h1}</Link></h3>
                  <p>{article.description}</p>
                  <Link href={article.path} className={styles.textLink}>Lire l’article <ArrowUpRight size={16} aria-hidden="true" /></Link>
                </article>
              ))}
            </div>
          </div>
        </section>
        <section className={styles.section} aria-labelledby="blog-landings-title">
          <div className="marketing-container">
            <div className={styles.sectionHeading}>
              <h2 id="blog-landings-title">Pages utiles</h2>
              <p>La facturation au quotidien et le parcours de facture électronique, avec le tarif ESSENTIEL affiché et PRO sur devis.</p>
            </div>
            <ul className={styles.relatedList}>
              {LANDING_GUIDES.map((guide) => (
                <li key={guide.path}><Link href={guide.path} className={styles.textLink}>{guide.h1} <ArrowUpRight size={16} aria-hidden="true" /></Link></li>
              ))}
              <li><Link href="/pricing" className={styles.textLink}>Tarifs du logiciel de gestion <ArrowUpRight size={16} aria-hidden="true" /></Link></li>
            </ul>
          </div>
        </section>
      </main>
      <LandingFooter />
    </div>
  );
}
