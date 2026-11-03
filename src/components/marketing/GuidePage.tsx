import Link from "next/link";
import { ArrowUpRight, Check, Plus } from "lucide-react";
import { LandingFooter } from "@/components/landing/LandingFooter";
import { LandingHeader } from "@/components/landing/LandingHeader";
import styles from "@/components/landing/product-offer-page.module.css";
import { JsonLd } from "@/components/seo/JsonLd";
import type { PublicGuide } from "@/lib/content/guides";
import { getBlogPostingStructuredData, getFaqPageStructuredData, getSoftwareApplicationStructuredData } from "@/lib/seo";
import "@/styles/landing.css";
import "@/components/landing/landing-conversion.css";

export function GuidePage({ guide }: { guide: PublicGuide }) {
  const crumbs = guide.kind === "article"
    ? [{ href: "/", label: "Accueil" }, { href: "/blog", label: "Guides" }, { href: guide.path, label: guide.h1 }]
    : [{ href: "/", label: "Accueil" }, { href: guide.path, label: guide.h1 }];

  return (
    <div id="top" className={"landing marketing-site " + styles.page}>
      <JsonLd id="felexia-guide-faq" data={getFaqPageStructuredData(guide.questions, guide.path)} />
      {guide.kind === "landing" ? <JsonLd id="felexia-guide-software" data={getSoftwareApplicationStructuredData()} /> : null}
      {guide.kind === "article" ? <JsonLd id="felexia-guide-article" data={getBlogPostingStructuredData(guide)} /> : null}
      <a className="marketing-skip-link" href="#main-content">Aller au contenu</a>
      <LandingHeader />
      <main id="main-content" tabIndex={-1}>
        <section className={styles.hero} aria-labelledby="guide-title">
          <div className="marketing-container">
            <nav className={styles.breadcrumb} aria-label="Fil d’Ariane">
              <ol>
                {crumbs.map((crumb, index) => (
                  <li key={crumb.href}>
                    {index > 0 ? <span aria-hidden="true">/ </span> : null}
                    {index === crumbs.length - 1 ? <span aria-current="page">{crumb.label}</span> : <Link href={crumb.href}>{crumb.label}</Link>}
                  </li>
                ))}
              </ol>
            </nav>
            <p className="marketing-eyebrow">{guide.eyebrow}</p>
            <h1 id="guide-title" className={styles.title}>{guide.h1}</h1>
            <p className={styles.introduction}>{guide.introduction}</p>
            <div className={styles.actions}>
              <Link href={guide.cta.href} className="marketing-button marketing-button-primary">{guide.cta.label} <ArrowUpRight size={17} aria-hidden="true" /></Link>
            </div>
            <p className={styles.ctaNote}>{guide.cta.note}</p>
          </div>
        </section>
        {guide.sections.map((section) => (
          <section key={section.heading} className={styles.section}>
            <div className="marketing-container">
              <div className={styles.sectionHeading}>
                <h2>{section.heading}</h2>
                {section.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
              </div>
              {section.points ? (
                <div className={styles.feature + " " + styles.pointList}>
                  <ul>
                    {section.points.map((point) => <li key={point}><Check size={16} aria-hidden="true" /><span>{point}</span></li>)}
                  </ul>
                </div>
              ) : null}
            </div>
          </section>
        ))}
        <section className={styles.section + " " + styles.faqSection} aria-labelledby="guide-faq-title">
          <div className="marketing-container">
            <div className={styles.sectionHeading}>
              <h2 id="guide-faq-title">Questions fréquentes</h2>
            </div>
            <div className={styles.questions}>
              {guide.questions.map((item) => (
                <details key={item.question}>
                  <summary>{item.question}<Plus size={18} aria-hidden="true" /></summary>
                  <p>{item.answer}</p>
                </details>
              ))}
            </div>
          </div>
        </section>
        <section className={styles.section}>
          <div className="marketing-container">
            <div className={styles.sectionHeading}>
              <h2>Continuer la lecture</h2>
              <p>Ces pages décrivent les mêmes offres, avec le tarif ESSENTIEL affiché et PRO sur devis.</p>
            </div>
            <ul className={styles.relatedList}>
              {guide.related.map((link) => (
                <li key={link.href}><Link href={link.href} className={styles.textLink}>{link.label} <ArrowUpRight size={16} aria-hidden="true" /></Link></li>
              ))}
            </ul>
          </div>
        </section>
      </main>
      <LandingFooter />
    </div>
  );
}
