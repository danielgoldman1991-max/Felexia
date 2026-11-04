"use client";

import { useId } from "react";
import { GuideDownloadButton } from "@/components/guides/GuideDownload";
import { getProductGuide } from "@/lib/content/product-guides";
import styles from "@/components/guides/guide-download.module.css";

export function ProGuideCta() {
  const titleId = useId();
  const guide = getProductGuide("pro");
  if (!guide) return null;
  return (
    <aside className={styles.banner} aria-labelledby={titleId}>
      <div>
        <p className={styles.bannerKicker}>Guide PRO · {guide.pages} pages</p>
        <h2 id={titleId}>Téléchargez le guide PRO</h2>
        <p>Parcourez l’ERP complet avant de demander un devis. C’est gratuit : indiquez votre e-mail, le fichier part tout de suite.</p>
      </div>
      <GuideDownloadButton slug={guide.slug} className={styles.bannerButton}>Télécharger le guide</GuideDownloadButton>
    </aside>
  );
}
