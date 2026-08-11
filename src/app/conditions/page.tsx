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
import { LEGAL_CONFIG, legalValue } from "@/lib/legal/legal-config";
import { DEFAULT_TRIAL_DURATION_LABEL } from "@/lib/subscriptions/trial-config";

export const metadata: Metadata = {
  title: "Conditions générales | FelexiaERP",
  description:
    "Conditions générales d'utilisation du service FelexiaERP, édité par Felexia Conseils.",
  alternates: { canonical: "/conditions" },
};

const toc = [
  { id: "objet", title: "1. Objet" },
  { id: "identification", title: "2. Identification" },
  { id: "acces", title: "3. Accès au service" },
  { id: "organisation", title: "4. Organisation et administrateur" },
  { id: "fonctionnalites", title: "5. Fonctionnalités" },
  { id: "abonnement", title: "6. Abonnement" },
  { id: "essai", title: "7. Essai gratuit" },
  { id: "paiement", title: "8. Paiement" },
  { id: "resiliation", title: "9. Résiliation" },
  { id: "responsabilites", title: "10. Responsabilités de l'utilisateur" },
  { id: "donnees", title: "11. Données saisies" },
  { id: "disponibilite", title: "12. Disponibilité" },
  { id: "sauvegarde", title: "13. Sauvegarde" },
  { id: "comptabilite", title: "14. Comptabilité et fiscalité" },
  { id: "propriete", title: "15. Propriété intellectuelle" },
  { id: "suspension", title: "16. Suspension" },
  { id: "evolution", title: "17. Évolution du service" },
  { id: "donnees-personnelles", title: "18. Protection des données" },
  { id: "droit", title: "19. Droit applicable" },
  { id: "contact", title: "20. Contact" },
];

export default function ConditionsPage() {
  const essaiLabel = legalValue(DEFAULT_TRIAL_DURATION_LABEL) ?? "d'une durée limitée";

  return (
    <LegalPageLayout
      title="Conditions générales d'utilisation et de service"
      intro={
        <LegalParagraph>
          Les présentes conditions générales d&apos;utilisation et de service régissent
          l&apos;accès au site {LEGAL_CONFIG.website} et l&apos;utilisation du service{" "}
          {LEGAL_CONFIG.productName}, édité par {LEGAL_CONFIG.companyName}. {LEGAL_CONFIG.productName}{" "}
          est un produit faisant partie intégrante de {LEGAL_CONFIG.companyName}.
        </LegalParagraph>
      }
      toc={toc}
    >
      <LegalSection id="objet" title="1. Objet">
        <LegalParagraph>
          {LEGAL_CONFIG.productName} est une solution SaaS de gestion destinée aux entreprises et
          aux professionnels : ventes, achats, stock, trésorerie, comptabilité, documents et
          gestion des utilisateurs.
        </LegalParagraph>
      </LegalSection>

      <LegalSection id="identification" title="2. Identification">
        <LegalDataList>
          <LegalDataRow label="Produit / service" value={LEGAL_CONFIG.productName} />
          <LegalDataRow label="Éditeur" value={LEGAL_CONFIG.companyName} />
          <LegalDataRow label="Site" value={LEGAL_CONFIG.website} />
          <LegalDataRow label="Contact" value={LEGAL_CONFIG.legalEmail} />
        </LegalDataList>
      </LegalSection>

      <LegalSection id="acces" title="3. Accès au service">
        <LegalList
          items={[
            <>La création d&apos;un compte est nécessaire pour accéder au service,</>,
            <>L&apos;utilisateur est responsable de la confidentialité de ses identifiants,</>,
            <>La connexion via Google peut être proposée comme méthode d&apos;authentification,</>,
            <>L&apos;utilisateur s&apos;engage à ne pas partager abusivement ses accès,</>,
            <>L&apos;utilisateur s&apos;engage à fournir des informations exactes lors de la création de son compte.</>,
          ]}
        />
      </LegalSection>

      <LegalSection id="organisation" title="4. Organisation et administrateur">
        <LegalParagraph>
          L&apos;administrateur de l&apos;organisation configure l&apos;entreprise, invite les
          utilisateurs, attribue les droits d&apos;accès et reste responsable des informations
          saisies au sein de son organisation.
        </LegalParagraph>
      </LegalSection>

      <LegalSection id="fonctionnalites" title="5. Fonctionnalités">
        <LegalParagraph>
          {LEGAL_CONFIG.productName} peut inclure, selon les modules activés : ventes, facturation,
          achats, stock, trésorerie, comptabilité, documents, gestion des utilisateurs et d&apos;autres
          modules.
        </LegalParagraph>
        <LegalCallout tone="warning">
          Les fonctionnalités du service peuvent évoluer. {LEGAL_CONFIG.companyName} ne garantit
          pas que chaque fonctionnalité restera disponible de manière inchangée pendant toute la
          durée de l&apos;abonnement.
        </LegalCallout>
      </LegalSection>

      <LegalSection id="abonnement" title="6. Abonnement">
        <LegalParagraph>
          {LEGAL_CONFIG.productName} commercialise actuellement une seule offre publique :{" "}
          <strong>Essentiel</strong>.
        </LegalParagraph>
        <LegalList
          items={[
            <>Le tarif applicable est celui affiché sur le site {LEGAL_CONFIG.productName} au moment de la souscription,</>,
            <>L&apos;abonnement peut être proposé en formule mensuelle ou annuelle selon l&apos;offre en vigueur,</>,
            <>L&apos;abonnement est renouvelé selon la formule choisie,</>,
            <>La facturation est effectuée par l&apos;éditeur ou son prestataire de paiement,</>,
            <>Les taxes applicables peuvent s&apos;ajouter au tarif selon la réglementation en vigueur,</>,
            <>La résiliation est possible dans les conditions décrites ci-dessous.</>,
          ]}
        />
      </LegalSection>

      <LegalSection id="essai" title="7. Essai gratuit">
        <LegalParagraph>
          Les nouvelles organisations peuvent bénéficier d&apos;un essai gratuit de l&apos;offre{" "}
          <strong>Essentiel</strong>, {essaiLabel}, sans carte bancaire.
        </LegalParagraph>
        <LegalParagraph>
          À l&apos;issue de l&apos;essai, l&apos;accès au service peut être suspendu tant qu&apos;un
          abonnement payant n&apos;est pas souscrit.
        </LegalParagraph>
      </LegalSection>

      <LegalSection id="paiement" title="8. Paiement">
        <LegalParagraph>
          Les paiements en ligne peuvent être traités par {LEGAL_CONFIG.hosting.paymentProvider} ou
          tout autre prestataire de paiement indiqué lors de la souscription.
        </LegalParagraph>
      </LegalSection>

      <LegalSection id="resiliation" title="9. Résiliation">
        <LegalList
          items={[
            <>L&apos;utilisateur peut résilier son abonnement dans les conditions prévues par l&apos;offre souscrite,</>,
            <>La résiliation prend effet selon la période déjà payée,</>,
            <>Les données sont conservées selon les obligations légales applicables,</>,
            <>L&apos;utilisateur est invité à exporter les données qu&apos;il souhaite conserver avant la clôture du compte lorsque l&apos;export est disponible.</>,
          ]}
        />
        <LegalCallout tone="warning">
          Les remboursements ne sont pas automatiques. Toute demande de remboursement est examinée
          par {LEGAL_CONFIG.companyName} selon les modalités de l&apos;offre souscrite.
        </LegalCallout>
      </LegalSection>

      <LegalSection id="responsabilites" title="10. Responsabilités de l'utilisateur">
        <LegalParagraph>
          L&apos;utilisateur garantit notamment :
        </LegalParagraph>
        <LegalList
          items={[
            <>L&apos;exactitude des données saisies dans le service,</>,
            <>La légalité des données saisies,</>,
            <>Qu&apos;il dispose des droits nécessaires sur les données de ses clients, employés et fournisseurs,</>,
            <>Un usage professionnel et licite du service.</>,
          ]}
        />
      </LegalSection>

      <LegalSection id="donnees" title="11. Données saisies">
        <LegalParagraph>
          Les données métier saisies dans le service restent la propriété de l&apos;organisation
          utilisatrice.
        </LegalParagraph>
        <LegalParagraph>
          {LEGAL_CONFIG.companyName} dispose uniquement des droits nécessaires à l&apos;hébergement
          et au traitement des données permettant de fournir le service.
        </LegalParagraph>
      </LegalSection>

      <LegalSection id="disponibilite" title="12. Disponibilité">
        <LegalParagraph>
          {LEGAL_CONFIG.companyName} met en œuvre des moyens raisonnables pour assurer la
          disponibilité du service. Des opérations de maintenance peuvent entraîner des
          interruptions temporaires.
        </LegalParagraph>
        <LegalCallout tone="warning">
          Le service n&apos;est pas garanti à 100 % de disponibilité, et aucune pénalité de
          disponibilité n&apos;est prévue par les présentes conditions.
        </LegalCallout>
      </LegalSection>

      <LegalSection id="sauvegarde" title="13. Sauvegarde">
        <LegalParagraph>
          Des sauvegardes techniques sont mises en œuvre selon l&apos;infrastructure utilisée.
        </LegalParagraph>
        <LegalCallout tone="warning">
          L&apos;utilisateur est invité à exporter les documents critiques lorsqu&apos;il l&apos;estime
          nécessaire, notamment en cas de clôture ou de migration.
        </LegalCallout>
      </LegalSection>

      <LegalSection id="comptabilite" title="14. Comptabilité et fiscalité">
        <LegalParagraph>
          {LEGAL_CONFIG.productName} constitue un outil d&apos;aide à la gestion.
        </LegalParagraph>
        <LegalParagraph>
          Les fonctions de comptabilité, de TVA, de paie, de fiscalité, de déclarations et
          d&apos;exports peuvent avoir un caractère préparatoire.
        </LegalParagraph>
        <LegalParagraph>
          L&apos;utilisateur reste responsable de la vérification et de la validation des données
          avec ses conseils professionnels. {LEGAL_CONFIG.productName} ne remplace ni un
          expert-comptable, ni un conseiller fiscal, ni un conseiller juridique.
        </LegalParagraph>
      </LegalSection>

      <LegalSection id="propriete" title="15. Propriété intellectuelle">
        <LegalParagraph>
          {LEGAL_CONFIG.productName}, son code, son interface, sa marque, son logo et sa
          documentation sont la propriété de {LEGAL_CONFIG.companyName} ou de leurs titulaires
          respectifs.
        </LegalParagraph>
      </LegalSection>

      <LegalSection id="suspension" title="16. Suspension">
        <LegalParagraph>
          {LEGAL_CONFIG.companyName} peut suspendre l&apos;accès au service en cas de :
        </LegalParagraph>
        <LegalList
          items={[
            <>Fraude ou usage illicite du service,</>,
            <>Violation grave des présentes conditions,</>,
            <>Défaut de paiement selon les modalités de l&apos;abonnement.</>,
          ]}
        />
      </LegalSection>

      <LegalSection id="evolution" title="17. Évolution du service">
        <LegalParagraph>
          {LEGAL_CONFIG.companyName} peut ajouter, modifier, améliorer ou supprimer certaines
          fonctionnalités du service, avec une information appropriée lorsque cela affecte
          substantiellement le service.
        </LegalParagraph>
      </LegalSection>

      <LegalSection id="donnees-personnelles" title="18. Protection des données">
        <LegalParagraph>
          Le traitement des données personnelles dans le cadre du service est décrit dans la{" "}
          <Link href="/confidentialite" className="font-medium text-[#1456B8] hover:underline">
            politique de confidentialité
          </Link>
          .
        </LegalParagraph>
      </LegalSection>

      <LegalSection id="droit" title="19. Droit applicable">
        <LegalParagraph>
          Les présentes conditions générales sont soumises au droit marocain.
        </LegalParagraph>
      </LegalSection>

      <LegalSection id="contact" title="20. Contact">
        <LegalDataList>
          <LegalDataRow label="Email" value={LEGAL_CONFIG.legalEmail} />
        </LegalDataList>
        <LegalParagraph>
          <Link href="/mentions-legales" className="font-medium text-[#1456B8] hover:underline">
            Voir les mentions légales
          </Link>{" "}
          ·{" "}
          <Link href="/confidentialite" className="font-medium text-[#1456B8] hover:underline">
            Politique de confidentialité
          </Link>
        </LegalParagraph>
      </LegalSection>
    </LegalPageLayout>
  );
}
