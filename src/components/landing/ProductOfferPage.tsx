import Link from "next/link";
import { ArrowUpRight, Check, FileCheck2, Plus } from "lucide-react";
import { LandingFooter } from "@/components/landing/LandingFooter";
import { LandingHeader } from "@/components/landing/LandingHeader";
import "@/styles/landing.css";
import "./landing-conversion.css";
import styles from "./product-offer-page.module.css";

type TextItem = { title: string; description: string };

export type ProductOfferContent = {
  name: "ESSENTIEL" | "PRO";
  eyebrow: string;
  title: string;
  introduction: string;
  price: string;
  priceUnit?: string;
  priceDetail: string;
  priceNote: string;
  facts: readonly { label: string; value: string }[];
  ctaLabel: string;
  ctaHref: string;
  featureHeading: string;
  featureIntroduction: string;
  features: readonly (TextItem & { points: readonly string[] })[];
  workflowHeading: string;
  workflowIntroduction: string;
  workflow: readonly TextItem[];
  electronicInvoicing: string;
  scopeHeading: string;
  scopeIntroduction: string;
  scope: readonly TextItem[];
  questions: readonly { question: string; answer: string }[];
  nextHeading: string;
  nextDescription: string;
  related: { href: "/essentiel" | "/pro"; label: string };
};

export function ProductOfferPage({ content }: { content: ProductOfferContent }) {
  return (
    <div id="top" className={"landing marketing-site " + styles.page}>
      <a className="marketing-skip-link" href="#main-content">Aller au contenu</a>
      <LandingHeader />
      <main id="main-content" tabIndex={-1}>
        <section className={styles.hero} aria-labelledby="offer-title">
          <div className="marketing-container">
            <nav className={styles.breadcrumb} aria-label="Fil d’Ariane">
              <ol>
                <li><Link href="/">Accueil</Link></li>
                <li aria-hidden="true">/</li>
                <li><span aria-current="page">{content.name}</span></li>
              </ol>
            </nav>
            <div className={styles.heroGrid}>
              <div>
                <p className="marketing-eyebrow">{content.eyebrow}</p>
                <h1 id="offer-title" className={styles.title}>{content.title}</h1>
                <p className={styles.introduction}>{content.introduction}</p>
                <div className={styles.actions}>
                  <a href={content.ctaHref} className="marketing-button marketing-button-primary">
                    {content.ctaLabel}<ArrowUpRight size={17} aria-hidden="true" />
                  </a>
                  <a href="#offer-features" className={styles.textLink}>Découvrir les usages<ArrowUpRight size={16} aria-hidden="true" /></a>
                </div>
              </div>
              <aside className={styles.priceCard} aria-label={"L’offre " + content.name}>
                <p className={styles.planName}>Felexia {content.name}</p>
                <p className={styles.price}>{content.price}{content.priceUnit ? <span>{content.priceUnit}</span> : null}</p>
                <p className={styles.priceDetail}>{content.priceDetail}</p>
                <dl className={styles.facts}>
                  {content.facts.map((fact) => <div key={fact.label}><dt>{fact.label}</dt><dd>{fact.value}</dd></div>)}
                </dl>
                <p className={styles.priceNote}>{content.priceNote}</p>
                <Link href="/pricing" className={styles.textLink}>Comparer les offres<ArrowUpRight size={15} aria-hidden="true" /></Link>
              </aside>
            </div>
          </div>
        </section>

        <section id="offer-features" className={styles.section} aria-labelledby="offer-features-title">
          <div className="marketing-container">
            <div className={styles.sectionHeading}>
              <p className="marketing-eyebrow">Des usages concrets</p>
              <h2 id="offer-features-title">{content.featureHeading}</h2>
              <p>{content.featureIntroduction}</p>
            </div>
            <div className={styles.featureGrid}>
              {content.features.map((feature, index) => (
                <article className={styles.feature} key={feature.title}>
                  <span className={styles.number} aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
                  <h3>{feature.title}</h3>
                  <p>{feature.description}</p>
                  <ul>{feature.points.map((point) => <li key={point}><Check size={15} aria-hidden="true" /><span>{point}</span></li>)}</ul>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className={styles.section + " " + styles.workflowSection} aria-labelledby="offer-workflow-title">
          <div className="marketing-container">
            <div className={styles.sectionHeading}>
              <p className="marketing-eyebrow">Dans votre entreprise</p>
              <h2 id="offer-workflow-title">{content.workflowHeading}</h2>
              <p>{content.workflowIntroduction}</p>
            </div>
            <ol className={styles.workflow}>
              {content.workflow.map((step, index) => (
                <li key={step.title}>
                  <span className={styles.stepNumber} aria-hidden="true">{index + 1}</span>
                  <h3>{step.title}</h3>
                  <p>{step.description}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className={styles.section} aria-labelledby="offer-scope-title">
          <div className="marketing-container">
            <div className={styles.electronicNote}>
              <FileCheck2 size={25} aria-hidden="true" />
              <div><h2>La facturation électronique est incluse</h2><p>{content.electronicInvoicing}</p></div>
            </div>
            <div className={styles.scopeGrid}>
              <div className={styles.sectionHeading}>
                <p className="marketing-eyebrow">Choisir en connaissance de cause</p>
                <h2 id="offer-scope-title">{content.scopeHeading}</h2>
                <p>{content.scopeIntroduction}</p>
                <Link href={content.related.href} className={styles.textLink}>{content.related.label}<ArrowUpRight size={16} aria-hidden="true" /></Link>
              </div>
              <div className={styles.scopeItems}>
                {content.scope.map((item) => <article key={item.title}><h3>{item.title}</h3><p>{item.description}</p></article>)}
              </div>
            </div>
          </div>
        </section>

        <section className={styles.section + " " + styles.faqSection} aria-labelledby="offer-faq-title">
          <div className="marketing-container">
            <div className={styles.faqGrid}>
              <div className={styles.sectionHeading}><p className="marketing-eyebrow">Avant de commencer</p><h2 id="offer-faq-title">Vos questions sur {content.name}</h2></div>
              <div className={styles.questions}>
                {content.questions.map((item) => (
                  <details key={item.question}>
                    <summary>{item.question}<Plus size={18} aria-hidden="true" /></summary>
                    <p>{item.answer}</p>
                  </details>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className={styles.nextSection} aria-labelledby="offer-next-title">
          <div className="marketing-container">
            <div className={styles.nextPanel}>
              <div><h2 id="offer-next-title">{content.nextHeading}</h2><p>{content.nextDescription}</p></div>
              <a href={content.ctaHref} className="marketing-button marketing-button-primary">{content.ctaLabel}<ArrowUpRight size={17} aria-hidden="true" /></a>
            </div>
          </div>
        </section>
      </main>
      <LandingFooter />
    </div>
  );
}
