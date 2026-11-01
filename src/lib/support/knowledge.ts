import { LEGAL_CONFIG } from "@/lib/legal/legal-config";
import { getPlanDefinition } from "@/lib/subscriptions/plans";
import { DEFAULT_TRIAL_DURATION_LABEL } from "@/lib/subscriptions/trial-config";

/** Public product information only. Never add tenant, account, payment or QA records here. */
export type SupportKnowledgeArticle = {
  id: string;
  title: string;
  keywords: string[];
  content: string;
  href: string;
};

export const SUPPORT_KNOWLEDGE_VERSION = "2026-11-01.2";
export const SUPPORT_KNOWLEDGE_UPDATED_AT = "2026-11-01";

const essential = getPlanDefinition("essentiel");
const pro = getPlanDefinition("premium");
const price = (amount: number) => amount.toLocaleString("fr-FR");
const contact = LEGAL_CONFIG.legalEmail.trim() || "contact@felexia.pro";

/**
 * Curated against the public site and implemented canonical screens.
 * Commercial feature flags are deliberately not treated as proof of a finished workflow.
 * Historical PRO prices never enter this public corpus.
 */
export const SUPPORT_KNOWLEDGE_ARTICLES: SupportKnowledgeArticle[] = [
  {
    id: "overview", title: "Felexia, votre gestion d’entreprise au Maroc",
    keywords: ["felexia", "erp", "gestion entreprise", "pme", "logiciel", "business management", "company", "المقاولة", "الشركة", "تسيير", "شنو", "chno", "chnou"],
    content: "FelexiaERP est un service de gestion d’entreprise en ligne, édité par Felexia Conseils et pensé pour les PME marocaines. ESSENTIEL rassemble les ventes, les achats, les clients, les fournisseurs, la facturation, les règlements, la trésorerie et les journaux. PRO ouvre le périmètre ERP étendu. La facturation électronique est une fonctionnalité incluse, pas une offre qui remplace ESSENTIEL. Le service fonctionne dans un navigateur sur ordinateur, tablette et téléphone.",
    href: "/#essentiel",
  },
  {
    id: "essential", title: "Que comprend l’offre ESSENTIEL ?",
    keywords: ["essentiel", "essential", "offre", "pack", "ventes", "achats", "gestion quotidienne", "basic", "الأساسي", "اساسي"],
    content: `ESSENTIEL est l’offre de gestion quotidienne : espace entreprise, clients et fournisseurs, factures de vente et d’achat, avoirs, règlements clients et fournisseurs, comptes bancaires et caisses, mouvements de trésorerie, journaux et factures PDF avec votre logo. La génération PDF/XML, l’émission et l’archivage électroniques sont aussi inclus. Limites : ${essential.limits.organizations} entreprise, jusqu’à ${essential.limits.users} utilisateurs, ${essential.limits.commercialDocumentsPerMonth} documents commerciaux par mois et ${essential.limits.storageMb / 1024} Go de stockage. Le cycle commercial avancé, le stock, la comptabilité avancée et les RH relèvent de PRO.`,
    href: "/#essentiel",
  },
  {
    id: "essential-pricing", title: "Prix ESSENTIEL, mensuel et annuel",
    keywords: ["prix", "tarif", "combien", "coût", "cout", "mad", "dirham", "mensuel", "annuel", "price", "pricing", "cost", "monthly", "yearly", "how much", "ثمن", "سعر", "بشحال", "taman", "ch7al", "chhal", "bchhal", "flous"],
    content: `ESSENTIEL est proposé à ${price(essential.monthlyPrice)} MAD par mois ou ${price(essential.yearlyPrice)} MAD par an. La facturation annuelle correspond à douze mensualités, sans remise. L’essai gratuit dure ${DEFAULT_TRIAL_DURATION_LABEL}, sans carte bancaire. PRO est uniquement sur devis : aucun prix fixe PRO public ni souscription PRO directe. Les tarifs applicables sont ceux affichés sur le site au moment de la souscription. Ne pas inventer de remise, régime de TVA du prix, moyen de paiement ou tarif négocié.`,
    href: "/pricing",
  },
  {
    id: "pro", title: "PRO, l’ERP complet sur devis",
    keywords: ["pro", "premium", "erp complet", "sur devis", "quote", "quotation", "advanced", "complete", "احترافي", "عرض السعر", "كامل"],
    content: `PRO comprend ESSENTIEL et le périmètre ERP étendu : prospects, devis, commandes, livraisons et retours clients ; commandes et réceptions fournisseurs ; stock, emplacements et mouvements ; plan comptable, grand livre et balance ; préparation TVA ; rapprochement et prévisions de trésorerie ; dossiers du personnel et préparation RH/paie. Jusqu’à ${pro.limits.users} utilisateurs et ${pro.limits.storageMb / 1024} Go de stockage, pour ${pro.limits.organizations} entreprise. Les documents commerciaux n’ont pas de plafond mensuel annoncé dans PRO. PRO est exclusivement sur devis : demander une proposition à ${contact} ou avec le bouton Demander un devis. Aucun montant mensuel/annuel PRO n’est public. Certaines sous-fonctions restent préparatoires ou à finaliser ; ne pas promettre que tous les sous-menus sont aboutis.`,
    href: "/#pro",
  },
  {
    id: "legacy-offers", title: "Offres publiques et anciens abonnements",
    keywords: ["business", "ancien", "ancienne offre", "ancien abonnement", "premium", "legacy", "old plan", "previous plan", "abonnement historique", "عرض قديم"],
    content: "Les deux offres actuellement proposées aux nouveaux visiteurs sont ESSENTIEL et PRO. Business n’est plus une offre publique achetable. Le nom Premium peut apparaître dans un ancien abonnement ou une référence historique ; la version complète est maintenant présentée sous le nom PRO, sur devis. Les abonnements existants sont conservés : ne pas annoncer une rétrogradation, un nouveau tarif ou une migration imposée. Pour une question concernant un contrat historique précis, l’équipe doit vérifier la situation dans le canal approprié ; le chatbot public ne voit pas le contrat.",
    href: "/pricing",
  },
  {
    id: "choose-plan", title: "Choisir entre ESSENTIEL et PRO",
    keywords: ["comparer", "comparaison", "différence", "difference", "choisir", "besoin", "conseil", "compare", "choose", "which plan", "شنو الفرق", "اختار", "نختار"],
    content: "Choisissez ESSENTIEL si votre besoin principal est de gérer les ventes, achats, factures, règlements et trésorerie d’une petite équipe. Étudiez PRO si vous avez besoin de devis/commandes/livraisons, de stock multi-emplacements, de comptabilité avancée, de rapprochement ou prévisions, de RH, ou d’une équipe plus grande. Poser une question courte sur l’activité, la taille d’équipe ou les fonctions nécessaires aide à orienter. Les données de l’espace entreprise sont conservées lors de l’activation de PRO ; il ne faut pas promettre une activation automatique ou immédiate sans validation de l’équipe.",
    href: "/pricing",
  },
  {
    id: "trial", title: "Essai gratuit et inscription",
    keywords: ["essai", "gratuit", "tester", "test", "carte bancaire", "trial", "free", "register", "signup", "inscription", "تجربة", "مجانا", "نجرب", "njereb", "njarab"],
    content: `L’essai standard porte sur ESSENTIEL pendant ${DEFAULT_TRIAL_DURATION_LABEL}, sans carte bancaire. Cliquez sur Démarrer gratuitement ou ouvrez la page d’inscription, créez votre compte administrateur puis votre espace entreprise. Une inscription par email ou Google est proposée. Le choix PRO conduit à une demande de devis ; il n’existe pas d’essai PRO public automatiquement garanti. Ne pas promettre d’extension d’essai : demander à l’équipe si une exception est nécessaire.`,
    href: "/login?mode=register",
  },
  {
    id: "onboarding", title: "Démarrer et configurer votre entreprise",
    keywords: ["démarrer", "demarrer", "configuration", "paramétrer", "parametrer", "onboarding", "ice", "raison sociale", "setup", "start", "company search", "نبدا", "nbda", "شركة"],
    content: "Après inscription, renseignez l’identité de votre entreprise et les informations nécessaires à votre activité. La recherche d’entreprise peut aider à retrouver une société à partir de son ICE ou de sa raison sociale ; vérifiez toujours les résultats et complétez les champs manquants. Configurez votre logo et vos coordonnées, créez vos clients/fournisseurs et articles, puis préparez une première facture. L’assistant public peut expliquer les étapes mais ne crée pas de compte ou d’entreprise à votre place.",
    href: "/login?mode=register",
  },
  {
    id: "login", title: "Connexion et récupération du mot de passe",
    keywords: ["connexion", "connecter", "login", "google", "mot de passe", "password", "oublié", "oublie", "reset", "access", "دخول", "نسيت", "كلمة السر", "ندخل", "ndkhel"],
    content: "Connectez-vous depuis /login avec la méthode utilisée à l’inscription : email/mot de passe ou Google. En cas de mot de passe oublié, utilisez la page dédiée pour recevoir un lien de récupération, puis consultez aussi les courriers indésirables. Si Google échoue, réessayez la méthode de connexion habituelle ou contactez l’équipe. Ne communiquez jamais votre mot de passe, code de connexion ou lien de récupération dans le chat. L’assistant ne peut pas réinitialiser un mot de passe ou confirmer l’existence d’un compte.",
    href: "/mot-de-passe-oublie",
  },
  {
    id: "customers-suppliers", title: "Clients, fournisseurs et coordonnées",
    keywords: ["client", "clients", "fournisseur", "fournisseurs", "tiers", "contact", "adresse", "customer", "supplier", "vendor", "زبون", "زبناء", "مورد", "fournissor"],
    content: "ESSENTIEL et PRO permettent de centraliser les fiches clients et fournisseurs, leurs coordonnées, contacts et adresses, puis de retrouver les opérations associées. Vérifiez le tiers choisi et ses informations avant une facture ou un règlement. Les créations et modifications dépendent du rôle de l’utilisateur et d’un essai/abonnement valide. L’archivage d’une fiche et sa restauration sont distincts d’une suppression définitive.",
    href: "/clients",
  },
  {
    id: "products", title: "Articles, produits, services et TVA des lignes",
    keywords: ["article", "produit", "service", "catalogue", "unité", "unite", "prix unitaire", "product", "item", "unit", "منتوج", "سلعة", "خدمة"],
    content: "Le catalogue regroupe les articles, produits et services, avec leurs unités et informations utiles à la facturation. Une ligne de facture peut aussi être une ligne libre. Vérifiez quantité, prix HT, remise et taux de TVA avant validation. Un article stockable et une prestation de service n’ont pas le même impact de stock ; les fonctions de stock étendues sont dans PRO. L’assistant ne choisit pas un taux fiscal à votre place.",
    href: "/articles",
  },
  {
    id: "sales-invoices", title: "Factures clients : créer, valider et suivre vos ventes",
    keywords: ["facture", "factures", "facture client", "factures clients", "vente", "facturation", "brouillon", "valider", "invoice", "billing", "sales", "فاتورة", "فواتير", "بيع", "factora"],
    content: "Dans Ventes → Factures clients (/facturation/factures), créez une facture, choisissez le client puis saisissez vos lignes, quantités, prix, remises et TVA. Contrôlez les montants, l’échéance et les informations de l’entreprise avant Valider. Le brouillon peut être modifié selon les droits ; les actions disponibles changent après validation. La fiche permet de consulter le PDF, les règlements et le reste à payer. Pour corriger une opération validée, examinez les possibilités d’avoir plutôt que de promettre la modification du document émis. Utilisez les routes canoniques /facturation/factures.",
    href: "/facturation/factures",
  },
  {
    id: "pdf-branding", title: "PDF, logo et personnalisation des factures",
    keywords: ["pdf", "imprimer", "impression", "logo", "personnaliser", "télécharger", "telecharger", "print", "download", "branding", "طبع", "تحميل", "شعار"],
    content: "Ajoutez le logo, les coordonnées et les identifiants de votre entreprise dans les paramètres. Les impressions des documents reprennent les informations de l’entreprise et les données du document. Depuis la fiche de facture, utilisez Imprimer / PDF puis l’enregistrement PDF de votre navigateur. Les factures/avoirs électroniques déjà émis servent leur version archivée. L’ICE doit être celui de votre entreprise ; aucun identifiant légal ne doit être inventé par l’assistant.",
    href: "/parametres/entreprise",
  },
  {
    id: "invoice-email", title: "Envoyer une facture et comprendre « Marquer comme envoyée »",
    keywords: ["email", "envoyer", "envoyée", "mail", "transmettre", "send", "sent", "رسالة", "صيفط", "sift", "nsift"],
    content: "Pour transmettre une facture, téléchargez son PDF depuis Imprimer / PDF, puis joignez-le à un email adressé au client. Le bouton Marquer comme envoyée met à jour le suivi de la facture ; ce bouton n’envoie pas d’email. Le chatbot public ne peut pas envoyer de facture, d’email ou de message à votre place. Un lien mailto ouvre un brouillon dans votre messagerie, sans garantir son envoi.",
    href: "/facturation/factures",
  },
  {
    id: "customer-payments", title: "Encaissements, paiements et affectation aux factures",
    keywords: ["règlement", "reglement", "encaissement", "paiement", "payer", "solde", "affectation", "payment", "paid", "collect", "outstanding", "خلص", "خلاص", "دفعة", "khlass"],
    content: "Enregistrez un règlement reçu dans la fiche facture ou les règlements clients, en vérifiant le compte bancaire/caisse, la date, le montant et la facture concernée. Les affectations relient le paiement aux factures et mettent à jour leur solde. Les montants à encaisser et paiements partiels se consultent dans les fiches. Ces enregistrements de gestion ne réalisent pas un transfert bancaire réel. L’assistant ne peut ni effectuer ni confirmer un paiement ou voir le solde de votre entreprise.",
    href: "/facturation/paiements",
  },
  {
    id: "credit-notes", title: "Avoir client et correction d’une facture",
    keywords: ["avoir", "avoirs", "annuler", "correction", "remboursement", "credit note", "refund", "cancel", "إشعار دائن", "تصحيح", "نلغي"],
    content: "Un avoir client permet de traiter une correction commerciale après une facture validée, selon son état et vos droits. La fiche de facture propose Créer avoir lorsqu’elle est éligible. Vérifiez les lignes, le montant et les affectations ; un avoir disponible et un avoir affecté à une facture sont distincts. Un remboursement financier éventuel est une opération séparée : l’assistant ne peut pas le déclencher. Pour une erreur comptable/fiscale réelle, faites valider le traitement approprié par votre conseil.",
    href: "/facturation/avoirs",
  },
  {
    id: "purchases", title: "Achats, factures et avoirs fournisseurs",
    keywords: ["achat", "achats", "facture fournisseur", "dette", "purchase", "purchasing", "supplier invoice", "مشتريات", "شراء", "chra"],
    content: "Dans Achats → Factures fournisseurs, choisissez le fournisseur et saisissez les lignes de sa facture, ses références, dates et montants. ESSENTIEL permet la saisie directe et le suivi des paiements et avoirs fournisseurs. PRO ajoute les commandes et réceptions liées au cycle d’achat. Vérifiez la facture source et les montants à payer avant validation ; l’enregistrement d’une facture fournisseur ne paie pas automatiquement le fournisseur.",
    href: "/achats/factures",
  },
  {
    id: "supplier-payments", title: "Régler et suivre les fournisseurs",
    keywords: ["paiement fournisseur", "règlement fournisseur", "reglement fournisseur", "supplier payment", "vendor payment", "payer fournisseur", "خلاص المورد"],
    content: "Les paiements fournisseurs sont enregistrés dans Achats → Paiements. Vérifiez le fournisseur, le compte bancaire/caisse, le montant, la date et les affectations aux factures. La fiche de paiement et son justificatif permettent de suivre le règlement. Saisir un paiement dans Felexia est une opération de gestion ; cela ne constitue pas un virement bancaire exécuté par le service ou par le chatbot.",
    href: "/achats/paiements",
  },
  {
    id: "commercial-cycle", title: "PRO : prospects, devis, commandes et livraisons",
    keywords: ["devis", "prospect", "commande", "livraison", "retour", "crm", "pipeline", "quote", "estimate", "order", "delivery", "return", "طلب", "توصيل", "عرض"],
    content: "PRO étend le cycle commercial avec prospects, devis, commandes clients, bons de livraison et retours. Les documents liés se suivent dans le même espace. Les livraisons et retours des articles stockables peuvent affecter le stock ; vérifiez les quantités et l’état du document avant toute opération. Un devis commercial créé par votre entreprise pour son client est différent d’un devis d’abonnement Felexia PRO demandé à l’équipe.",
    href: "/vente/devis",
  },
  {
    id: "supplier-orders-receipts", title: "PRO : commandes et réceptions fournisseurs",
    keywords: ["réception", "reception", "bon réception", "commande fournisseur", "marchandise", "receipt", "purchase order", "goods", "استلام", "بضاعة"],
    content: "PRO permet de préparer des commandes fournisseurs et d’enregistrer les réceptions de marchandises. Les quantités réceptionnées d’articles stockables alimentent les mouvements de stock selon le document. Le suivi permet de distinguer commande, réception et facture fournisseur, qui sont trois étapes distinctes. Vérifiez les quantités et les emplacements ; une facture peut être préparée depuis une réception éligible.",
    href: "/achats/receptions",
  },
  {
    id: "stock", title: "PRO : stock, dépôts et mouvements",
    keywords: ["stock", "dépôt", "depot", "entrepôt", "entrepot", "emplacement", "entrée", "sortie", "transfert", "warehouse", "inventory movement", "مخزون", "مستودع", "ستوك", "stok"],
    content: "Les fonctions de stock de PRO comprennent les articles stockables, emplacements, entrées, sorties, ajustements et mouvements, ainsi que les impacts des livraisons/retours et réceptions. Les transferts permettent de suivre des mouvements entre emplacements. Le sous-menu Inventaire reste un écran réservé et ne constitue pas encore une procédure d’inventaire physique complète. Ne pas promettre cette dernière fonction ; préciser le besoin de l’utilisateur et confirmer le périmètre avec l’équipe.",
    href: "/stock",
  },
  {
    id: "treasury", title: "Trésorerie, banque et caisse",
    keywords: ["trésorerie", "tresorerie", "banque", "caisse", "compte", "mouvement", "cash", "bank", "treasury", "cashflow", "cash flow", "بنك", "صندوق", "خزينة", "flous"],
    content: "ESSENTIEL et PRO permettent de suivre les comptes bancaires et caisses, encaissements, paiements, mouvements et soldes de gestion. Les soldes reflètent les données enregistrées dans l’espace entreprise. PRO ajoute le rapprochement bancaire et les prévisions. Il ne faut pas annoncer une connexion automatique à toutes les banques, un paiement bancaire ou une synchronisation temps réel non confirmée.",
    href: "/tresorerie",
  },
  {
    id: "reconciliation-forecast", title: "PRO : rapprochement bancaire et prévisions",
    keywords: ["rapprochement", "relevé", "releve", "prévision", "prevision", "scénario", "scenario", "reconciliation", "statement", "forecast", "forecasting", "توقع", "كشف"],
    content: "PRO propose le rapprochement des lignes de relevé avec les mouvements de trésorerie et des prévisions à partir des données et hypothèses disponibles. Les scénarios de prévision ne garantissent pas un solde futur. Avant un rapprochement, contrôlez le compte, les dates, les montants et les opérations existantes. L’assistant public ne consulte pas vos relevés et ne déclenche aucun rapprochement.",
    href: "/tresorerie/rapprochement",
  },
  {
    id: "accounting", title: "Journaux et comptabilité générale",
    keywords: ["comptabilité", "comptabilite", "journal", "journaux", "écriture", "ecriture", "grand livre", "balance", "plan comptable", "accounting", "ledger", "bookkeeping", "محاسبة", "دفتر"],
    content: "ESSENTIEL donne accès aux journaux de vente, d’achat, de banque et de caisse et aux écritures liées aux opérations. PRO ajoute le plan comptable, les comptes, le grand livre, la balance et les écrans de comptabilité étendue. Les autorisations dépendent du rôle de l’utilisateur ; un opérateur commercial n’a pas les droits de saisie comptable de l’administrateur. Le logiciel aide à préparer et suivre la comptabilité ; il ne remplace pas la validation d’un expert-comptable.",
    href: "/comptabilite",
  },
  {
    id: "vat", title: "TVA, déclarations et exports préparatoires",
    keywords: ["tva", "taxe", "déclaration", "declaration", "fiscal", "vat", "tax", "taxation", "ضريبة", "ضريبي", "تصريح"],
    content: "Les factures détaillent les montants HT, TVA et TTC selon les taux configurés. PRO comprend la préparation et le suivi des déclarations TVA et des sorties XML/CSV lorsque les informations requises sont renseignées. Ces fonctions sont préparatoires : un export n’est pas une déclaration officiellement déposée ou acceptée. Aucun dépôt DGI, certification fiscale ou taux applicable à votre situation ne doit être garanti par le chatbot. Faites valider votre déclaration par votre conseil avant dépôt officiel.",
    href: "/comptabilite/tva",
  },
  {
    id: "electronic-invoicing", title: "Facturation électronique incluse : PDF/XML, émission et archivage",
    keywords: ["facturation électronique", "facturation electronique", "facture électronique", "facture electronique", "xml", "ubl", "einvoice", "e-invoicing", "electronic invoice", "الفاتورة الإلكترونية", "فوترة الكترونية", "فاتورة الكترونية"],
    content: "La facturation électronique est incluse dans ESSENTIEL et PRO : à partir des factures et avoirs clients validés, préparer les documents PDF/XML, vérifier les informations, puis émettre et archiver la version retenue. L’émission documentaire fige la version et ses fichiers ; les PDF et XML peuvent être téléchargés séparément. Cela ne transforme pas ESSENTIEL en offre limitée à la facturation : la gestion d’entreprise reste sa fonction principale. La connexion officielle DGI et la signature qualifiée ne sont pas activées ; le XML UBL générique n’est pas une preuve d’acceptation fiscale ou d’homologation.",
    href: "/#facturation-electronique",
  },
  {
    id: "activate-electronic-invoicing", title: "Activer et utiliser les documents électroniques",
    keywords: ["activer", "activation", "module électronique", "configuration électronique", "activate", "enable einvoice", "تفعيل الفاتورة", "نشغل"],
    content: "L’administrateur de l’entreprise active la fonctionnalité dans Ventes → Facturation électronique → Configuration et complète les informations nécessaires. Un essai ou abonnement valide et les droits appropriés sont nécessaires pour préparer ou émettre de nouveaux documents. Commencez par une facture ou un avoir client validé, générez ses fichiers, vérifiez-les, puis choisissez l’émission et l’archivage. Le chatbot ne peut ni activer la fonctionnalité ni émettre une facture. Les archives déjà émises restent distinctes des données de travail.",
    href: "/facturation/electronique/configuration",
  },
  {
    id: "dgi-signature", title: "DGI, conformité et signature électronique : périmètre réel",
    keywords: ["dgi", "certifié", "certifie", "certification", "homologué", "homologue", "conforme", "conformité", "conformite", "signature", "qualifiée", "officiel", "compliance", "certified", "legal", "ضرائب", "المديرية", "توقيع", "مطابق", "اعتماد"],
    content: "Felexia prend en charge un parcours documentaire de facturation électronique : PDF, XML structuré, émission et archivage. Il ne faut pas le présenter comme une connexion officielle DGI, une signature qualifiée ou une certification de conformité réglementaire déjà obtenue : ces capacités officielles ne sont pas activées. Un fichier XML généré ne prouve pas son acceptation par l’administration. Les obligations fiscales et sociales réelles doivent être vérifiées avec les autorités ou le conseil de l’entreprise. Le chatbot ne peut pas fournir une garantie juridique ou fiscale individuelle.",
    href: "/#resources",
  },
  {
    id: "documents-exports", title: "Documents, fichiers et exports disponibles",
    keywords: ["document", "documents", "ged", "pièce jointe", "piece jointe", "fichier", "csv", "excel", "export", "import", "attachment", "file", "download", "ملف", "وثيقة", "تصدير", "استيراد"],
    content: "Felexia propose une bibliothèque documentaire avec import/téléchargement de fichiers selon les droits, des impressions PDF de documents commerciaux, des exports CSV selon les listes, ainsi que des exports dédiés de journaux et du plan comptable. Les quotas de stockage dépendent de l’offre. Il ne faut pas annoncer un import universel automatisé de toutes les données ou un export FEC/DGI opérationnel à partir des seules cartes de la page centrale d’exports. Certains sous-menus GED Archives/Modèles/Pièces jointes et Outils restent réservés ; le parcours d’archives des factures électroniques est une fonction distincte et disponible.",
    href: "/documents",
  },
  {
    id: "hr", title: "PRO : dossiers du personnel et fonctions RH",
    keywords: ["rh", "ressources humaines", "salarié", "salarie", "employé", "employe", "contrat", "congé", "conge", "absence", "personnel", "employee", "human resources", "leave", "contract", "موظف", "أجير", "اجير", "عطلة", "كونجي"],
    content: "PRO comprend le module RH avec création/modification des fiches salariés, liste et création de contrats, ainsi que plusieurs consultations RH. Le détail de contrat n’est pas encore une fiche complète. Congés, absences, présences, avances, prêts, discipline, évaluations, notes de frais, documents et paramètres comportent encore des écrans de consultation sans tous les formulaires de traitement. Ne pas promettre une approbation complète des congés, une pointeuse, un générateur d’attestations ou un onboarding/offboarding automatisé. Pour un besoin RH précis, faites confirmer le parcours par l’équipe avant engagement.",
    href: "/rh",
  },
  {
    id: "payroll", title: "Paie, CNSS/AMO et IR : fonctions préparatoires",
    keywords: ["paie", "salaire", "bulletin", "cnss", "amo", "ir", "cotisation", "payroll", "salary", "payslip", "أجر", "اجر", "راتب", "سالير", "أجرة"],
    content: "La paie de PRO est préparatoire : périodes, calculs et bulletins selon les informations et paramètres disponibles. CNSS/AMO et IR ont également un périmètre préparatoire. Cela ne garantit ni le barème réglementaire applicable, ni une paie finalisée, ni une déclaration sociale/fiscale déposée. Des traitements RH et la consolidation transactionnelle de la paie restent à finaliser. Faites valider salaires, paramètres et déclarations par un professionnel ; le chatbot ne calcule pas une paie officielle à partir de données personnelles dans la conversation.",
    href: "/rh/paie",
  },
  {
    id: "users-permissions", title: "Équipe, invitations et rôles",
    keywords: ["utilisateur", "équipe", "equipe", "invitation", "inviter", "rôle", "role", "droit", "permission", "administrateur", "opérateur", "operateur", "lecteur", "user", "team", "admin", "operator", "viewer", "مستخدم", "صلاحية", "فريق"],
    content: `L’administrateur gère l’entreprise, les invitations, les utilisateurs et l’abonnement. L’opérateur traite les tiers et opérations commerciales autorisées, consulte trésorerie/journaux, mais ne gère pas l’administration de l’entreprise ou la saisie comptable. Le lecteur consulte sans mutations. Les droits effectifs dépendent du rôle, de l’entreprise et de l’abonnement. Le quota public est de ${essential.limits.users} utilisateurs dans ESSENTIEL et ${pro.limits.users} dans PRO. Une invitation s’utilise depuis le lien reçu ; ne pas transférer ce lien dans le chat. L’assistant public ne peut pas inviter une personne ni changer un rôle.`,
    href: "/parametres/utilisateurs",
  },
  {
    id: "numbering", title: "Numérotation et références des documents",
    keywords: ["numérotation", "numerotation", "numéro", "numero", "compteur", "référence", "reference", "numbering", "counter", "sequence", "ترقيم", "رقم"],
    content: "L’écran Paramètres → Numérotation permet à l’administrateur de consulter les compteurs par famille et période, voir l’aperçu du prochain numéro et demander une correction avec motif et confirmation. Les minimums déjà utilisés et l’historique des numéros sont protégés ; modifier un paramètre de présentation ne renumérote pas les factures historiques. Ne pas promettre de remettre tous les compteurs à zéro ou de réutiliser un ancien numéro.",
    href: "/parametres/numerotation",
  },
  {
    id: "subscription", title: "Abonnement, facturation et fin d’essai",
    keywords: ["abonnement", "renouveler", "renouvellement", "échéance", "echeance", "expiré", "expire", "résilier", "resilier", "annuler abonnement", "stripe", "subscription", "renew", "expired", "cancel subscription", "اشتراك", "تجديد", "انتهى"],
    content: "L’administrateur gère l’offre et la facturation depuis Paramètres → Abonnement. ESSENTIEL propose la souscription mensuelle ou annuelle ; PRO nécessite un devis et une prise en charge par l’équipe. Les paiements en ligne utilisent Stripe lorsque le parcours est disponible. Après échéance d’essai ou d’abonnement, l’espace passe en consultation et les créations/modifications nécessitent un renouvellement ; l’assistant ne doit pas promettre la suppression immédiate des données. Consultez l’état et les dates dans l’espace connecté. Toute résiliation, modification ou demande de remboursement doit être vérifiée selon le contrat et les conditions applicables, sans garantie inventée par le chatbot.",
    href: "/parametres/abonnement",
  },
  {
    id: "limits", title: "Quotas, stockage et nombre d’entreprises",
    keywords: ["limite", "quota", "stockage", "go", "nombre", "documents par mois", "multi société", "multi societe", "storage", "limit", "multiple companies", "quota", "سعة", "مساحة", "حد"],
    content: `Les offres publiques affichent ${essential.limits.organizations} entreprise par abonnement. ESSENTIEL : ${essential.limits.users} utilisateurs, ${essential.limits.commercialDocumentsPerMonth} documents commerciaux par mois et ${essential.limits.storageMb / 1024} Go de stockage. PRO : ${pro.limits.users} utilisateurs, documents commerciaux sans plafond mensuel et ${pro.limits.storageMb / 1024} Go de stockage. Cela ne signifie pas un stockage ou un nombre d’utilisateurs illimités. Les usages et limites se consultent dans l’abonnement. Pour plusieurs sociétés ou un dépassement spécifique, demandez une proposition à l’équipe ; aucune mutualisation ou option supplémentaire ne doit être inventée.`,
    href: "/pricing",
  },
  {
    id: "mobile", title: "Navigateur, mobile et accès au service",
    keywords: ["mobile", "téléphone", "telephone", "tablette", "ordinateur", "application", "installer", "hors ligne", "offline", "browser", "app", "android", "iphone", "internet", "هاتف", "تطبيق", "تيليفون"],
    content: "Felexia est accessible dans un navigateur sur ordinateur, tablette et téléphone. L’interface s’adapte aux petits écrans. Une connexion Internet est nécessaire au service en ligne ; aucune application native Android/iOS ou utilisation complète hors ligne n’est annoncée. Aucune installation de logiciel de bureau n’est nécessaire pour ouvrir le site. Une page qui ne se charge pas peut nécessiter une actualisation, une reconnexion ou une vérification du réseau.",
    href: "/login",
  },
  {
    id: "privacy-security", title: "Confidentialité, hébergement et données",
    keywords: ["sécurité", "securite", "confidentialité", "confidentialite", "données", "donnees", "hébergement", "hebergement", "rgpd", "cndp", "sauvegarde", "security", "privacy", "data", "hosting", "backup", "أمان", "خصوصية", "بيانات"],
    content: "Felexia Conseils édite le service. L’infrastructure déclarée utilise Vercel pour le web, Supabase pour la base et l’authentification et Stripe pour le paiement ; Google intervient si vous choisissez sa connexion. Les données peuvent être traitées hors du Maroc : ne pas promettre un hébergement exclusivement au Maroc ou une sécurité absolue. Les accès métier sont limités par entreprise et rôle. La politique de confidentialité décrit les données et droits. Ne partagez pas de mot de passe, document d’identité, coordonnées de carte, dossier RH ou données client sensibles dans le chat public. L’assistant de visiteurs n’accède pas à votre espace privé. Aucune garantie chiffrée de disponibilité, sauvegarde ou délai de restauration ne doit être inventée.",
    href: "/confidentialite",
  },
  {
    id: "troubleshooting", title: "Dépanner une page ou un bouton indisponible",
    keywords: ["erreur", "bug", "problème", "probleme", "bloqué", "bloque", "impossible", "marche pas", "500", "403", "404", "error", "issue", "broken", "not working", "مشكل", "خطأ", "ماخدامش", "makhdamch"],
    content: "En cas de problème, demandez le nom de la page, l’action tentée et le message exact, sans identifiant privé ni données métier. Vérifiez la connexion Internet, actualisez puis reconnectez-vous si nécessaire. Un bouton absent peut venir du rôle lecteur/opérateur, d’un abonnement expiré, d’une fonction PRO ou de l’état non modifiable du document. Un sous-menu réservé n’est pas un échec de votre compte. Si le problème continue, proposez le contact humain ; ne prétendez pas avoir consulté des logs, corrigé le compte ou ouvert un ticket sans action réellement disponible.",
    href: "/#contact",
  },
  {
    id: "unfinished-features", title: "Fonctions réservées et périmètre à confirmer",
    keywords: ["inventaire", "agenda", "rapport", "rapports", "analytique", "audit log", "outils", "attestation", "onboarding rh", "offboarding", "inventory", "calendar", "reporting", "roadmap", "planning", "bientôt", "bientot", "جرد", "تقارير", "رزنامة", "شهادة"],
    content: "Certains sous-menus de l’ERP étendu sont encore réservés ou descriptifs : Agenda et ses tâches/rappels, procédure d’Inventaire, Rapports avancés, certains écrans GED/Outils et la page centrale d’exports comptables. Les indicateurs de tableau de bord, journaux et exports dédiés réellement disponibles sont distincts d’une suite de rapports avancés finalisée. Plusieurs fonctions RH sont encore des consultations ; les attestations et checklists RH ne constituent pas un workflow complet. Aucune date de livraison ne doit être inventée. Demandez à l’équipe de confirmer une fonction précise avant engagement.",
    href: "/#contact",
  },
  {
    id: "integrations", title: "Intégrations, API et demandes spécifiques",
    keywords: ["intégration", "integration", "api", "connecteur", "webhook", "ecommerce", "e-commerce", "shopify", "woocommerce", "whatsapp", "personnalisation", "sur mesure", "migration", "connect", "custom", "تكامل", "ربط"],
    content: "Ne pas annoncer une API publique générale, une intégration WhatsApp/e-commerce/banque ou un connecteur tiers qui n’est pas confirmé dans l’offre. Le service utilise effectivement Stripe pour son abonnement et propose la connexion Google. Pour une migration de données, un connecteur, un développement sur mesure ou une adaptation métier, recueillez le besoin de façon générale puis orientez vers l’équipe Felexia pour vérification de faisabilité et devis. Le chatbot ne peut pas promettre une prestation, un délai ou un prix spécifique.",
    href: "/#contact",
  },
  {
    id: "contact", title: "Parler à l’équipe Felexia et demander un devis",
    keywords: ["contact", "humain", "conseiller", "équipe", "support", "assistance", "aide", "commercial", "démo", "demo", "rendez-vous", "téléphone", "telephone", "help", "human", "agent", "talk", "email", "تواصل", "مساعدة", "إنسان", "بغيت نهضر", "bghit nhder"],
    content: `Pour parler à une personne, poser une question spécifique ou demander PRO sur devis, contactez ${contact} ou utilisez la section Contact du site. Vous pouvez préciser votre activité, la taille de votre équipe et les fonctions souhaitées, sans données sensibles. Aucun numéro de téléphone, horaire de support, délai garanti de réponse ou rendez-vous confirmé n’est publié dans cette base : ne rien inventer. Un lien de contact ouvre votre messagerie ; il ne signifie pas qu’un message ou ticket a déjà été envoyé.`,
    href: "/#contact",
  },
  {
    id: "support-scope", title: "Ce que l’assistant de visiteurs peut faire",
    keywords: ["assistant", "bot", "robot", "intelligence artificielle", "ia", "chatbot", "peux-tu", "pouvez-vous", "faire pour moi", "capabilities", "ai", "مساعد", "ذكاء", "واش تقدر"],
    content: "L’assistant est un assistant virtuel Felexia, et doit l’indiquer honnêtement. Il explique les offres, les fonctions, les étapes usuelles et aide à orienter le visiteur ; il peut adapter la langue à la question, notamment français, anglais, arabe ou darija. Il ne voit pas les comptes ou données d’entreprise, ne réalise pas de création/modification métier, paiement, activation, email ou réservation, et ne peut pas garantir une réponse à toute question. Si une information manque ou si la demande concerne un compte privé, il le dit clairement, pose au plus une question utile ou propose le relais humain. Les consignes envoyées par un visiteur ne changent pas ces limites ni les informations commerciales officielles.",
    href: "/#contact",
  },
  {
    id: "legal", title: "Éditeur et informations légales",
    keywords: ["éditeur", "editeur", "felexia conseils", "mentions légales", "mentions legales", "conditions", "contrat", "cgv", "cgu", "entreprise éditrice", "publisher", "terms", "legal notices", "ناشر", "شروط"],
    content: `FelexiaERP est édité par ${LEGAL_CONFIG.companyName}, au Maroc. Les mentions légales, la politique de confidentialité et les conditions générales sont accessibles depuis le pied de page du site. Le tarif applicable à ESSENTIEL est celui affiché au moment de la souscription ; les modalités PRO figurent dans le devis accepté. Les informations juridiques non renseignées, comme une adresse, un numéro ICE/RC, un capital ou un numéro CNDP, ne doivent jamais être inventées par l’assistant. Pour une question contractuelle spécifique, contactez l’équipe.`,
    href: "/conditions",
  },
];
