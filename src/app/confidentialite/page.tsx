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
  LegalSubSection,
} from "@/components/legal/LegalPageLayout";
import { LEGAL_CONFIG } from "@/lib/legal/legal-config";

export const metadata: Metadata = {
  title: "Politique de confidentialité | FelexiaERP",
  description:
    "Politique de protection des données personnelles de FelexiaERP, conforme au cadre légal marocain, notamment la loi n° 09-08.",
  alternates: { canonical: "/confidentialite" },
};

const toc = [
  { id: "responsable", title: "1. Responsable du traitement" },
  { id: "donnees", title: "2. Données collectées" },
  { id: "finalites", title: "3. Finalités" },
  { id: "cadre", title: "4. Base et cadre juridique" },
  { id: "destinataires", title: "5. Destinataires et sous-traitants" },
  { id: "hebergement", title: "6. Hébergement et transferts" },
  { id: "duree", title: "7. Durée de conservation" },
  { id: "droits", title: "8. Droits des personnes" },
  { id: "cookies", title: "9. Cookies" },
  { id: "securite", title: "10. Sécurité" },
  { id: "modifications", title: "11. Modifications" },
];

export default function ConfidentialitePage() {
  return (
    <LegalPageLayout
      title="Politique de confidentialité"
      intro={
        <>
          <LegalParagraph>
            {LEGAL_CONFIG.companyName} attache une importance particulière à la protection des
            données personnelles traitées dans le cadre du service {LEGAL_CONFIG.productName}.
          </LegalParagraph>
          <LegalParagraph>
            La présente politique décrit, de manière transparente, les données collectées, les
            finalités des traitements et les droits dont vous disposez, dans le respect du cadre
            légal applicable, notamment la loi marocaine n° 09-08 relative à la protection des
            personnes physiques à l&apos;égard du traitement des données à caractère personnel.
          </LegalParagraph>
          <LegalCallout>
            Les données personnelles doivent être collectées et traitées de manière loyale,
            légitime et transparente, pour une finalité déterminée et proportionnée.
          </LegalCallout>
        </>
      }
      toc={toc}
    >
      <LegalSection id="responsable" title="1. Responsable du traitement">
        <LegalDataList>
          <LegalDataRow label="Responsable" value={LEGAL_CONFIG.companyName} />
          <LegalDataRow label="Service" value={LEGAL_CONFIG.productName} />
          <LegalDataRow label="Email" value={LEGAL_CONFIG.privacyEmail} />
        </LegalDataList>
        <LegalParagraph>
          Pour toute question relative à la protection de vos données personnelles, vous pouvez
          contacter {LEGAL_CONFIG.companyName} à l&apos;adresse {LEGAL_CONFIG.privacyEmail}.
        </LegalParagraph>
      </LegalSection>

      <LegalSection id="donnees" title="2. Données collectées">
        <LegalSubSection title="Données de compte">
          <LegalList
            items={[
              <>Nom et prénom,</>,
              <>Adresse email,</>,
              <>Numéro de téléphone éventuel,</>,
              <>Photo d&apos;avatar éventuelle.</>,
            ]}
          />
        </LegalSubSection>
        <LegalSubSection title="Données d'organisation">
          <LegalList
            items={[
              <>Raison sociale,</>,
              <>Identifiants d&apos;entreprise (ICE, RC, IF, CNSS) renseignés par l&apos;utilisateur,</>,
              <>Adresse et coordonnées professionnelles.</>,
            ]}
          />
        </LegalSubSection>
        <LegalSubSection title="Données métier">
          <LegalList
            items={[
              <>Clients, fournisseurs et autres tiers,</>,
              <>Articles et produits,</>,
              <>Factures, paiements, achats, stock et trésorerie,</>,
              <>Données comptables,</>,
              <>Documents commerciaux et administratifs,</>,
              <>Données RH lorsque le module correspondant est activé.</>,
            ]}
          />
        </LegalSubSection>
        <LegalSubSection title="Données techniques">
          <LegalList
            items={[
              <>Adresse IP,</>,
              <>Journaux (logs) techniques,</>,
              <>Navigateur et terminal utilisés,</>,
              <>Dates de connexion,</>,
              <>Cookies techniques nécessaires au fonctionnement du service.</>,
            ]}
          />
        </LegalSubSection>
        <LegalSubSection title="Connexion via Google">
          <LegalList
            items={[
              <>Si vous choisissez de vous connecter via Google, certaines informations de votre compte Google peuvent être collectées selon les autorisations accordées : adresse email, nom, prénom et photo de profil.</>,
            ]}
          />
        </LegalSubSection>
        <LegalSubSection title="Paiement">
          <LegalParagraph>
            Les paiements en ligne sont traités par {LEGAL_CONFIG.hosting.paymentProvider}. Les
            données bancaires complètes (notamment le numéro de carte) sont traitées par le
            prestataire de paiement et ne sont pas nécessairement conservées par{" "}
            {LEGAL_CONFIG.productName}.
          </LegalParagraph>
        </LegalSubSection>
      </LegalSection>

      <LegalSection id="finalites" title="3. Finalités des traitements">
        <LegalList
          items={[
            <>Création et gestion du compte utilisateur,</>,
            <>Fourniture du service SaaS et de ses fonctionnalités,</>,
            <>Facturation et gestion de l&apos;abonnement,</>,
            <>Sécurité du service et prévention des abus,</>,
            <>Support et assistance aux utilisateurs,</>,
            <>Statistiques internes et amélioration du produit,</>,
            <>Respect des obligations légales applicables,</>,
            <>Communications liées au fonctionnement du service.</>,
          ]}
        />
      </LegalSection>

      <LegalSection id="cadre" title="4. Base et cadre juridique">
        <LegalParagraph>
          Les traitements sont mis en œuvre conformément au cadre légal applicable, notamment la
          loi marocaine n° 09-08 relative à la protection des personnes physiques à l&apos;égard
          du traitement des données à caractère personnel.
        </LegalParagraph>
      </LegalSection>

      <LegalSection id="destinataires" title="5. Destinataires et sous-traitants">
        <LegalParagraph>
          Certaines données peuvent être traitées par des prestataires techniques strictement
          nécessaires au fonctionnement du service, notamment :
        </LegalParagraph>
        <LegalList
          items={[
            <><strong>{LEGAL_CONFIG.hosting.platform}</strong> pour l&apos;hébergement du site et du service web,</>,
            <><strong>{LEGAL_CONFIG.hosting.dataServices}</strong> pour les bases de données et l&apos;authentification,</>,
            <><strong>{LEGAL_CONFIG.hosting.paymentProvider}</strong> pour le traitement des paiements en ligne,</>,
            <><strong>Google</strong> pour la connexion via Google lorsqu&apos;elle est utilisée.</>,
          ]}
        />
        <LegalParagraph>
          Ces prestataires n&apos;agissent que pour le compte de {LEGAL_CONFIG.companyName} ou pour
          fournir des services strictement nécessaires au fonctionnement de{" "}
          {LEGAL_CONFIG.productName}.
        </LegalParagraph>
      </LegalSection>

      <LegalSection id="hebergement" title="6. Hébergement et transferts">
        <LegalParagraph>
          Les prestataires techniques mentionnés ci-dessus peuvent héberger ou traiter des données
          en dehors du Maroc. {LEGAL_CONFIG.companyName} veille à encadrer ces traitements
          conformément aux exigences applicables.
        </LegalParagraph>
        <LegalCallout tone="warning">
          Les données du service ne sont pas nécessairement hébergées exclusivement au Maroc. Des
          transferts internationaux de données peuvent intervenir chez les prestataires techniques
          du service.
        </LegalCallout>
      </LegalSection>

      <LegalSection id="duree" title="7. Durée de conservation">
        <LegalList
          items={[
            <><strong>Compte actif :</strong> les données sont conservées pendant la durée de la relation contractuelle,</>,
            <><strong>Facturation et comptabilité :</strong> durée requise par les obligations légales applicables,</>,
            <><strong>Journaux techniques :</strong> durée limitée nécessaire à la sécurité du service,</>,
            <><strong>Suppression du compte :</strong> les données sont supprimées ou anonymisées, sous réserve des obligations légales de conservation.</>,
          ]}
        />
      </LegalSection>

      <LegalSection id="droits" title="8. Droits des personnes">
        <LegalParagraph>
          Conformément au droit applicable, vous disposez notamment :
        </LegalParagraph>
        <LegalList
          items={[
            <>Du droit d&apos;accès à vos données personnelles,</>,
            <>Du droit de rectification de vos données,</>,
            <>Du droit d&apos;opposition lorsque le droit applicable le permet,</>,
            <>Des autres droits prévus par le droit applicable.</>,
          ]}
        />
        <LegalParagraph>
          Pour exercer vos droits, contactez {LEGAL_CONFIG.companyName} à l&apos;adresse{" "}
          {LEGAL_CONFIG.privacyEmail}.
        </LegalParagraph>
        <LegalParagraph>
          Vous pouvez également vous adresser à la Commission Nationale de contrôle de la
          protection des Données à Caractère Personnel (CNDP) au Maroc.
        </LegalParagraph>
      </LegalSection>

      <LegalSection id="cookies" title="9. Cookies">
        <LegalList
          items={[
            <>Cookies nécessaires au fonctionnement du service,</>,
            <>Cookies d&apos;authentification et de session,</>,
            <>Cookies de sécurité,</>,
            <>Cookies de préférences.</>,
          ]}
        />
        <LegalParagraph>
          Ces cookies sont utilisés pour le fonctionnement technique du service. Aucun outil de
          mesure d&apos;audience tiers n&apos;est utilisé pour l&apos;instant.
        </LegalParagraph>
      </LegalSection>

      <LegalSection id="securite" title="10. Sécurité">
        <LegalParagraph>
          {LEGAL_CONFIG.companyName} met en œuvre des mesures de sécurité techniques et
          organisationnelles pour protéger les données du service, notamment :
        </LegalParagraph>
        <LegalList
          items={[
            <>Contrôle des accès et gestion des rôles,</>,
            <>Restrictions d&apos;accès aux données au niveau de la base (RLS),</>,
            <>Chiffrement des communications en transit,</>,
            <>Authentification des utilisateurs,</>,
            <>Journalisation des accès,</>,
            <>Sauvegardes selon l&apos;infrastructure utilisée.</>,
          ]}
        />
        <LegalCallout tone="warning">
          Aucun système ne peut garantir une sécurité absolue. {LEGAL_CONFIG.companyName} s&apos;engage
          à déployer des mesures raisonnables et proportionnées, sans promettre une sécurité
          absolue des données.
        </LegalCallout>
      </LegalSection>

      <LegalSection id="modifications" title="11. Modifications de la présente politique">
        <LegalParagraph>
          La présente politique de confidentialité peut être mise à jour à tout moment. La date de
          dernière mise à jour est indiquée ci-dessous.
        </LegalParagraph>
        <LegalDataList>
          <LegalDataRow label="Dernière mise à jour" value={LEGAL_CONFIG.lastUpdated} />
        </LegalDataList>
        <LegalParagraph>
          <Link href="/mentions-legales" className="font-medium text-[#1456B8] hover:underline">
            Voir les mentions légales
          </Link>{" "}
          ·{" "}
          <Link href="/conditions" className="font-medium text-[#1456B8] hover:underline">
            Conditions générales
          </Link>
        </LegalParagraph>
      </LegalSection>
    </LegalPageLayout>
  );
}
