import type { Metadata } from "next";
import Link from "next/link";
import {
  LegalCallout,
  LegalDataList,
  LegalDataRow,
  LegalList,
  LegalPageLayout,
  LegalParagraph,
  LegalSection,
} from "@/components/legal/LegalPageLayout";
import { LEGAL_CONFIG } from "@/lib/legal/legal-config";

export const metadata: Metadata = {
  title: "Mentions légales | FelexiaERP",
  description:
    "Informations légales relatives à l'édition et à l'exploitation de FelexiaERP par Felexia Conseils.",
  alternates: { canonical: "/mentions-legales" },
};

const toc = [
  { id: "editeur", title: "Éditeur du site" },
  { id: "publication", title: "Responsable de publication" },
  { id: "hebergement", title: "Hébergement" },
  { id: "propriete", title: "Propriété intellectuelle" },
  { id: "responsabilite", title: "Responsabilité" },
  { id: "droit", title: "Droit applicable" },
  { id: "contact", title: "Contact" },
];

export default function MentionsLegalesPage() {
  return (
    <LegalPageLayout
      title="Mentions légales"
      intro={
        <LegalParagraph>
          Le site {LEGAL_CONFIG.website} et le service {LEGAL_CONFIG.productName} sont édités et
          exploités par {LEGAL_CONFIG.companyName}. {LEGAL_CONFIG.productName} est un produit
          faisant partie intégrante de {LEGAL_CONFIG.companyName} et ne constitue pas une entité
          juridique distincte.
        </LegalParagraph>
      }
      toc={toc}
    >
      <LegalSection id="editeur" title="1. Éditeur du site">
        <LegalDataList>
          <LegalDataRow label="Raison sociale" value={LEGAL_CONFIG.companyName} />
          <LegalDataRow label="Produit / service" value={LEGAL_CONFIG.productName} />
          <LegalDataRow label="Forme juridique" value={LEGAL_CONFIG.legalForm} />
          <LegalDataRow label="Capital social" value={LEGAL_CONFIG.capital} />
          <LegalDataRow label="Siège social" value={LEGAL_CONFIG.address} />
          <LegalDataRow label="Ville" value={LEGAL_CONFIG.city} />
          <LegalDataRow label="Pays" value={LEGAL_CONFIG.country} />
          <LegalDataRow label="Registre de commerce (RC)" value={LEGAL_CONFIG.rc} />
          <LegalDataRow label="Identifiant Commun de l'Entreprise (ICE)" value={LEGAL_CONFIG.ice} />
          <LegalDataRow label="Identifiant Fiscal (IF)" value={LEGAL_CONFIG.ifNumber} />
          <LegalDataRow label="N° CNSS" value={LEGAL_CONFIG.cnss} />
          <LegalDataRow label="Email" value={LEGAL_CONFIG.legalEmail} />
          <LegalDataRow label="Site" value={LEGAL_CONFIG.website} />
        </LegalDataList>
        <LegalCallout tone="warning">
          Les mentions relatives à la forme juridique, au capital, au siège social et aux numéros
          d&apos;identification (RC, ICE, IF, CNSS) ne sont pas affichées tant qu&apos;elles
          n&apos;ont pas été renseignées dans la configuration du service.
        </LegalCallout>
      </LegalSection>

      <LegalSection id="publication" title="2. Responsable de publication">
        <LegalParagraph>
          La direction de publication est assurée par la direction de {LEGAL_CONFIG.companyName}.
        </LegalParagraph>
      </LegalSection>

      <LegalSection id="hebergement" title="3. Hébergement">
        <LegalParagraph>
          Le service web {LEGAL_CONFIG.productName} est actuellement hébergé sur l&apos;infrastructure{" "}
          {LEGAL_CONFIG.hosting.platform}.
        </LegalParagraph>
        <LegalParagraph>
          Les services de base de données et d&apos;authentification du service reposent notamment
          sur {LEGAL_CONFIG.hosting.dataServices}.
        </LegalParagraph>
        <LegalParagraph>
          Le site et le service ne sont pas hébergés exclusivement par un seul prestataire : les
          données applicatives sont traitées sur l&apos;infrastructure {LEGAL_CONFIG.hosting.dataServices},
          distincte de l&apos;hébergement du site web.
        </LegalParagraph>
      </LegalSection>

      <LegalSection id="propriete" title="4. Propriété intellectuelle">
        <LegalParagraph>
          La marque {LEGAL_CONFIG.productName}, le logo, l&apos;interface, le code, les textes, les
          éléments graphiques et la documentation du service sont la propriété de{" "}
          {LEGAL_CONFIG.companyName} ou de leurs titulaires respectifs.
        </LegalParagraph>
        <LegalList
          items={[
            <>Toute reproduction non autorisée du service, de son interface ou de ses contenus ;</>,
            <>L&apos;extraction massive de données du service ;</>,
            <>La réutilisation commerciale du service, de ses contenus ou de sa documentation sans accord préalable écrit.</>,
          ]}
        />
      </LegalSection>

      <LegalSection id="responsabilite" title="5. Responsabilité">
        <LegalParagraph>
          {LEGAL_CONFIG.productName} est un outil de gestion destiné aux entreprises et aux
          professionnels.
        </LegalParagraph>
        <LegalParagraph>
          Les informations comptables, fiscales, sociales et administratives générées par le
          service doivent être vérifiées par l&apos;utilisateur et, lorsque nécessaire, par un
          professionnel compétent.
        </LegalParagraph>
        <LegalParagraph>
          {LEGAL_CONFIG.productName} ne remplace pas un expert-comptable, un conseiller fiscal ou
          un conseiller juridique.
        </LegalParagraph>
      </LegalSection>

      <LegalSection id="droit" title="6. Droit applicable">
        <LegalParagraph>
          Les présentes mentions légales et l&apos;utilisation du service sont soumises au droit
          marocain.
        </LegalParagraph>
      </LegalSection>

      <LegalSection id="contact" title="7. Contact">
        <LegalParagraph>
          Pour toute question relative aux présentes mentions légales, vous pouvez contacter{" "}
          {LEGAL_CONFIG.companyName} :
        </LegalParagraph>
        <LegalDataList>
          <LegalDataRow label="Email" value={LEGAL_CONFIG.legalEmail} />
        </LegalDataList>
        <LegalParagraph>
          <Link href="/" className="font-medium text-[#1456B8] hover:underline">
            Retour à l&apos;accueil
          </Link>
        </LegalParagraph>
      </LegalSection>
    </LegalPageLayout>
  );
}
