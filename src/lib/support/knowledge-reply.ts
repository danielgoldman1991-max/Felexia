import { LEGAL_CONFIG } from "@/lib/legal/legal-config";
import { getPlanDefinition } from "@/lib/subscriptions/plans";
import { DEFAULT_TRIAL_DAYS, DEFAULT_TRIAL_DURATION_LABEL } from "@/lib/subscriptions/trial-config";
import { SUPPORT_KNOWLEDGE_ARTICLES, type SupportKnowledgeArticle } from "./knowledge";
import { normalizeSupportQuery, searchSupportKnowledge } from "./knowledge-search";

type Language = "fr" | "en" | "ar";
type Message = { role: "user" | "assistant"; content: string };
export type KnowledgeSupportReply = {
  reply: string;
  sources: { id: string; title: string; href: string }[];
  suggestions: string[];
  mode: "knowledge";
};

const essential = getPlanDefinition("essentiel");
const pro = getPlanDefinition("premium");
const contact = LEGAL_CONFIG.legalEmail.trim() || "contact@felexia.pro";
const monthly = essential.monthlyPrice.toLocaleString("fr-FR");
const yearly = essential.yearlyPrice.toLocaleString("fr-FR");

// Brief, manually verified translations. Untranslated details are explicitly offered as a French guide.
const answers: Record<Language, Record<string, string>> = {
  fr: {
    overview: "Felexia rassemble la gestion de votre entreprise dans un même espace : ventes, achats, clients, fournisseurs, factures, règlements et trésorerie. ESSENTIEL couvre votre quotidien ; PRO ajoute les fonctions de l’ERP étendu, sur devis. Quel est votre besoin principal ?",
    essential: `**ESSENTIEL** réunit vos ventes, achats, clients et fournisseurs, factures et avoirs, règlements, banque/caisse, trésorerie et journaux. Les factures PDF avec votre logo et la facturation électronique PDF/XML avec archivage sont incluses.\n\nVous pouvez travailler jusqu’à **${essential.limits.users} utilisateurs**, pour ${essential.limits.organizations} entreprise et ${essential.limits.commercialDocumentsPerMonth} documents commerciaux par mois.`,
    "essential-pricing": `ESSENTIEL coûte **${monthly} HT MAD /mois** ou **${yearly} HT MAD /an**, hors taxes et sans remise annuelle. Vous pouvez commencer par **${DEFAULT_TRIAL_DURATION_LABEL} d’essai gratuit, sans carte bancaire**.\n\nPRO est proposé uniquement sur devis, sans prix fixe public.`,
    pro: `**PRO est uniquement sur devis.** Il reprend ESSENTIEL et ajoute le cycle commercial avancé, les commandes et réceptions fournisseurs, le stock et les emplacements, la comptabilité étendue, les prévisions et rapprochements, ainsi que les RH préparatoires. Jusqu’à **${pro.limits.users} utilisateurs**.\n\nPour une proposition adaptée, contactez **${contact}** en précisant votre activité et les fonctions recherchées.`,
    "choose-plan": `**ESSENTIEL** convient pour gérer les ventes, achats, factures, règlements et trésorerie d’une équipe jusqu’à ${essential.limits.users} utilisateurs.\n\nÉtudiez **PRO, sur devis**, si vous avez besoin de stock, devis/commandes/livraisons, comptabilité avancée, prévisions ou RH, ou d’une équipe plus grande, jusqu’à ${pro.limits.users} utilisateurs. Quel usage souhaitez-vous couvrir en priorité ?`,
    trial: `L’essai gratuit concerne **ESSENTIEL pendant ${DEFAULT_TRIAL_DURATION_LABEL}**, sans carte bancaire. Créez votre compte administrateur, puis votre espace entreprise. L’inscription par email ou Google est proposée. PRO nécessite une demande de devis ; aucun essai PRO automatique n’est garanti.`,
    onboarding: "Pour commencer :\n\n1. Cliquez sur Démarrer gratuitement et créez votre compte, par email ou Google.\n2. Renseignez votre entreprise et vérifiez ses informations.\n3. Ajoutez votre logo, vos clients/fournisseurs et vos articles.\n4. Préparez votre première facture.\n\nJe peux vous expliquer ces étapes, mais je ne crée pas le compte à votre place.",
    login: "Pour vous connecter, utilisez votre méthode habituelle : email/mot de passe ou Google. Si vous avez oublié votre mot de passe, ouvrez le lien **Mot de passe oublié**, puis consultez votre email et les indésirables.\n\nNe partagez jamais votre mot de passe ni le lien de récupération dans cette discussion.",
    "electronic-invoicing": "Oui, la **facturation électronique est incluse dans ESSENTIEL et PRO** : génération PDF/XML à partir des factures et avoirs validés, puis émission et archivage de la version retenue.\n\nLa connexion officielle DGI et la signature qualifiée ne sont pas activées. La gestion de l’entreprise reste le rôle principal d’ESSENTIEL.",
    "activate-electronic-invoicing": "Votre administrateur peut l’activer depuis **Ventes → Facturation électronique → Configuration** :\n\n1. Complétez les informations de l’entreprise.\n2. Choisissez une facture ou un avoir client validé.\n3. Générez puis vérifiez les fichiers PDF/XML.\n4. Émettez et archivez la version retenue.\n\nIl faut un essai ou abonnement valide et les droits appropriés ; je ne peux pas activer ou émettre un document à votre place.",
    "dgi-signature": "Felexia permet de préparer des **PDF/XML, émettre et archiver** les documents électroniques. En revanche, la **connexion officielle DGI et la signature qualifiée ne sont pas activées**. Un XML généré ne prouve pas son acceptation fiscale. Pour votre obligation précise, faites valider le traitement avec votre conseil.",
    contact: `Cliquez sur **Felexia Team** pour parler à notre équipe sur **WhatsApp : +212 614 505 090**. Vous pouvez aussi écrire à **${contact}**. Pour PRO, précisez votre activité et les fonctions souhaitées.`,
    "support-scope": `Je peux vous aider sur Felexia : offres, fonctionnalités, inscription et étapes usuelles. Je ne consulte pas votre compte privé et ne réalise aucune opération dans l’ERP. Pour une demande particulière, notre équipe est joignable à **${contact}**.`,
    "privacy-security": "L’assistant de visiteurs ne consulte pas vos données d’entreprise. Évitez de partager des mots de passe, codes de connexion, cartes bancaires ou documents confidentiels. Les détails sur les prestataires, l’hébergement et vos droits figurent dans la politique de confidentialité. Aucun hébergement exclusivement au Maroc ni sécurité absolue ne sont garantis.",
    "invoice-email": "Téléchargez la facture depuis **Imprimer / PDF**, puis joignez le PDF à votre propre email au client. **Marquer comme envoyée** met à jour le suivi, mais n’envoie aucun email. Je ne peux pas envoyer une facture ou un message à votre place.",
    "sales-invoices": "Pour créer une facture :\n\n1. Ouvrez Ventes → Factures clients et choisissez Nouvelle facture.\n2. Sélectionnez le client et saisissez les lignes, quantités, prix et TVA.\n3. Vérifiez les informations, montants et échéance avant Valider.\n4. Retrouvez le PDF, les règlements et le solde sur la fiche.\n\nUn brouillon est modifiable selon vos droits. Après validation, une correction peut nécessiter un avoir.",
    "troubleshooting": "Indiquez le nom de la page, l’action tentée et le message affiché, sans données privées. Vous pouvez aussi vérifier votre connexion, actualiser puis vous reconnecter. Un bouton peut être indisponible selon le rôle, l’abonnement ou l’état du document. Quel message voyez-vous exactement ?",
    "unfinished-features": "Certains écrans restent à finaliser : Agenda, procédure d’Inventaire, rapports avancés, certaines fonctions GED/Outils et plusieurs traitements RH. Les tableaux de bord et exports dédiés disponibles sont distincts de ces fonctions. Pour une fonction précise, notre équipe peut confirmer le périmètre ; je ne peux pas annoncer de date de livraison.",
  },
  en: {
    overview: "Felexia brings your business management together: sales, purchases, customers, suppliers, invoices, payments and cash management. ESSENTIEL covers everyday operations; PRO adds the broader ERP features and is available by quotation. What would you like to manage first?",
    essential: `**ESSENTIEL** includes sales and purchase invoices, credit notes, customers and suppliers, payments, bank/cash accounts, cash movements and journals. Branded invoice PDFs and electronic PDF/XML generation and archiving are included.\n\nIt covers **${essential.limits.users} users**, ${essential.limits.organizations} company, ${essential.limits.commercialDocumentsPerMonth} commercial documents per month and ${essential.limits.storageMb / 1024} GB of storage.`,
    "essential-pricing": `ESSENTIEL costs **${monthly} HT MAD per month** or **${yearly} HT MAD per year**, excluding tax, with no annual discount. The free ESSENTIEL trial lasts **${DEFAULT_TRIAL_DAYS} days, with no bank card required**.\n\nPRO is **quotation only**, with no fixed public price.`,
    pro: `**PRO is available by quotation only.** It includes ESSENTIEL plus the extended sales cycle, supplier orders and receipts, stock and locations, advanced accounting, reconciliation and forecasts, and preparatory HR features. It supports up to **${pro.limits.users} users**.\n\nFor a proposal, contact **${contact}** with your business activity and the features you need.`,
    "choose-plan": `Choose **ESSENTIEL** for everyday sales, purchases, invoices, payments and cash management, for up to ${essential.limits.users} users.\n\nConsider **PRO, by quotation**, for stock, quotations/orders/deliveries, advanced accounting, forecasting or HR, or a larger team of up to ${pro.limits.users} users. Which workflow matters most to you?`,
    trial: `The free trial covers **ESSENTIEL for ${DEFAULT_TRIAL_DAYS} days**, with no bank card required. Create an administrator account, then your company workspace; email and Google sign-up are offered. PRO requires a quotation, and an automatic PRO trial is not promised.`,
    onboarding: "To get started:\n\n1. Choose Start for free and create an account with email or Google.\n2. Enter and verify your company details.\n3. Add your logo, customers/suppliers and products.\n4. Prepare your first invoice.\n\nI can explain the steps, but cannot create an account for you.",
    login: "Use your usual sign-in method: email/password or Google. If you forgot your password, use **Forgot password**, then check your inbox and spam folder. Never share a password or recovery link in this chat. I cannot reset an account or verify its existence.",
    "customers-suppliers": "ESSENTIEL and PRO let you keep customer and supplier records, contacts and addresses together and follow their transactions. Check the selected party before preparing an invoice or payment. Editing depends on your role and a valid subscription or trial.",
    products: "The catalogue contains products and services with their units and invoicing details. Invoices may also use free-text lines. Check quantities, prices before tax, discounts and VAT before validation. Stockable products and services have different stock effects; extended stock features belong to PRO.",
    "sales-invoices": "To create a sales invoice:\n\n1. Open Sales → Customer invoices and choose a new invoice.\n2. Select the customer and enter quantities, prices and VAT.\n3. Check the totals, company details and due date before validating.\n4. Use the invoice page for its PDF, payments and outstanding balance.\n\nDrafts can be edited with the appropriate rights. A validated invoice may need a credit note for a correction.",
    "pdf-branding": "Add your logo, contact details and company identifiers in company settings. Open an invoice and choose **Print / PDF**, then save the PDF through your browser. Electronic documents that have already been issued use their archived version. Never invent a company identifier.",
    "invoice-email": "Download the invoice through **Print / PDF**, then attach it to your own email to the customer. **Mark as sent only updates the invoice status; it does not send an email.** I cannot email a document on your behalf.",
    "customer-payments": "Record the received payment from the invoice or customer payments area, checking the date, amount and bank/cash account. Allocations link payments to invoices and update their outstanding balances. This is a bookkeeping record, not a bank transfer. I cannot view or confirm your real payments.",
    "credit-notes": "A credit note can correct a validated customer invoice when its status and your rights allow it. Check the lines, amount and allocation to the original invoice. A financial refund is a separate operation; I cannot initiate it. Ask your accountant to validate the treatment for a real accounting or tax correction.",
    purchases: "Use Purchases → Supplier invoices to select the supplier and enter their invoice lines, references, dates and amounts. ESSENTIEL includes direct entry, supplier payments and credit notes. PRO adds purchase orders and receipts. Recording an invoice does not automatically pay the supplier.",
    "supplier-payments": "Record supplier payments in Purchases → Payments, checking the supplier, account, date, amount and invoice allocations. The payment page provides tracking and a payment document. This records an operation in Felexia; it does not execute a bank transfer.",
    "commercial-cycle": "PRO includes leads, quotations, customer orders, delivery notes and returns, with related documents followed in one workspace. Deliveries and returns for stockable products can affect stock. A quotation you create for your customer is different from a Felexia PRO subscription quotation.",
    "supplier-orders-receipts": "PRO lets you prepare supplier orders and record goods receipts. Received quantities for stockable items create the corresponding stock movements. Orders, receipts and supplier invoices remain separate stages; check quantities and locations before validating.",
    stock: "PRO includes stockable products, locations, stock entries, exits, adjustments and movements, including delivery/return and receipt effects. The **Inventory submenu is still a reserved screen**, so a complete physical inventory workflow is not promised. Our team can confirm your exact requirement.",
    treasury: "ESSENTIEL and PRO track bank and cash accounts, incoming and outgoing payments, movements and management balances. PRO adds reconciliation and forecasts. Balances depend on the operations recorded; automatic connections to every bank and real bank transfers are not promised.",
    "reconciliation-forecast": "PRO offers reconciliation of bank-statement lines with cash movements, and forecasts based on recorded information and assumptions. Forecasts do not guarantee a future balance. Check dates, amounts, accounts and existing operations before reconciling. I cannot read statements or perform reconciliation for you.",
    accounting: "ESSENTIEL provides sales, purchase, bank and cash journals and related entries. PRO adds the chart of accounts, general ledger, trial balance and broader accounting screens. Access depends on your role. These tools support preparation and tracking; an accountant should validate the accounts.",
    vat: "Invoice totals show amounts before tax, VAT and the total including tax using configured rates. PRO provides preparatory VAT declarations and relevant XML/CSV exports. An export is not an official filing or acceptance by the tax administration. Your accountant should validate the real declaration.",
    "electronic-invoicing": "**Electronic invoicing is included in ESSENTIEL and PRO**: generate PDF/XML from validated customer invoices and credit notes, then issue and archive the selected version. **The official DGI connection and qualified electronic signature are not activated.** Business management remains ESSENTIEL’s main purpose.",
    "activate-electronic-invoicing": "Your administrator can activate it in **Sales → Electronic invoicing → Configuration**:\n\n1. Complete the company information.\n2. Select a validated customer invoice or credit note.\n3. Generate and check the PDF/XML files.\n4. Issue and archive the selected version.\n\nA valid trial/subscription and appropriate rights are required. I cannot activate the module or issue an invoice for you.",
    "dgi-signature": "Felexia supports **PDF/XML preparation, document issuance and archiving**. However, **the official DGI connection and qualified signature are not activated**. A generated XML file does not prove fiscal acceptance or regulatory certification. Ask your professional adviser to confirm your specific obligations.",
    "documents-exports": "Felexia includes a document library with permitted uploads/downloads, commercial-document PDFs, CSV exports on relevant lists and dedicated journal/account exports. Storage depends on the plan. Some dedicated GED/tools pages are still reserved; a universal import or an operational FEC/DGI export is not promised.",
    hr: "PRO includes employee record creation/editing, contract lists and contract creation. Several other HR screens are still read-only views without complete workflows, including leave, attendance and expenses. Complete contract details, certificate generation and automated onboarding/offboarding are not promised. Please confirm a precise HR requirement with our team.",
    payroll: "PRO payroll, CNSS/AMO and income-tax features are **preparatory**. They do not guarantee a finalized payroll, the applicable legal rates, or an official social/tax filing. Some consolidation and HR processes remain unfinished. A qualified professional should validate actual payroll and declarations.",
    "users-permissions": `Administrators manage company settings, invitations, users and subscriptions. Operators handle permitted commercial operations and consult cash/journals; viewers have read-only access. ESSENTIEL supports ${essential.limits.users} users and PRO ${pro.limits.users}. I cannot invite someone or change their role. Never share an invitation link in the chat.`,
    numbering: "Administrators can use Settings → Numbering to view counters by document family and period, preview the next number and request a correction with a reason and confirmation. Previously used minimums and numbering history are protected. Presentation settings do not renumber old invoices.",
    subscription: "An administrator manages the plan and billing in Settings → Subscription. ESSENTIEL offers monthly or annual subscription; PRO requires a quotation. After expiry, the workspace becomes read-only and renewal is needed for new changes. I cannot inspect your subscription or promise a refund, cancellation or extension.",
    limits: `The public plans cover ${essential.limits.organizations} company each. ESSENTIEL: ${essential.limits.users} users, ${essential.limits.commercialDocumentsPerMonth} commercial documents per month and ${essential.limits.storageMb / 1024} GB storage. PRO: ${pro.limits.users} users, no monthly commercial-document cap and ${pro.limits.storageMb / 1024} GB storage. For multiple companies or a special requirement, contact our team for confirmation.`,
    mobile: "Felexia runs in a browser on desktop, tablet and phone, with a responsive interface. An Internet connection is required. No native Android/iOS app or complete offline mode is currently promised, and you do not need to install a desktop application to open the site.",
    "privacy-security": "The visitor assistant cannot access your company data. Do not send passwords, login codes, bank-card details or confidential documents. The privacy policy explains providers, hosting and your rights. Hosting exclusively in Morocco and absolute security are not guaranteed.",
    troubleshooting: "Please tell me the page name, the action you tried and the exact error message, without private data. You can also check your Internet connection, refresh and sign in again. A missing action may depend on your role, subscription or document status. What message do you see?",
    "unfinished-features": "Some areas are still reserved or unfinished: Agenda, the physical inventory workflow, advanced reports, certain document/tools screens and several HR processes. Existing dashboards and dedicated exports are separate from those features. Our team can confirm a specific workflow; no delivery date is promised here.",
    integrations: "A general public API or WhatsApp, e-commerce or bank connector is not promised unless our team confirms it. Stripe is used for subscriptions, and Google sign-in is offered. For migration, custom development or a connector, explain the general requirement so our team can check feasibility and prepare a quotation.",
    contact: `Click **Felexia Team** to speak with our team on **WhatsApp: +212 614 505 090**. You can also email **${contact}**. For PRO, describe your business and required features.`,
    "support-scope": `I can help with Felexia’s plans, features, sign-up and usual steps. I cannot access a private account or carry out ERP operations. For a specific request, contact **${contact}**.`,
    "legacy-offers": "The current public offers are ESSENTIEL and PRO. Business is not available for new public purchase. Premium may appear in historical references; the complete edition is now presented as PRO, by quotation. Existing subscriptions are retained. Our team must check any individual historical contract.",
    legal: `FelexiaERP is published by ${LEGAL_CONFIG.companyName} in Morocco. Legal notices, the privacy policy and terms are linked in the footer. The displayed ESSENTIEL price applies at subscription; PRO terms are set in the accepted quotation. Missing legal identifiers or addresses must never be invented.`,
  },
  ar: {
    overview: "Felexia يجمع تسيير المقاولة في مكان واحد: المبيعات والمشتريات والزبناء والموردين والفواتير والأداءات والخزينة. ESSENTIEL مخصص للتدبير اليومي، وPRO يضيف وظائف ERP أوسع حسب عرض سعر. شنو هو الاحتياج الأساسي ديالك؟",
    essential: `**ESSENTIEL** يشمل فواتير البيع والشراء والإشعارات الدائنة، الزبناء والموردين، الأداءات، الحسابات البنكية والصندوق والخزينة والدفاتر. الفواتير PDF بشعار المقاولة والفوترة الإلكترونية PDF/XML مع الأرشفة مشمولة.\n\nالحدود: **${essential.limits.users} مستخدمين**، ${essential.limits.organizations} مقاولة، ${essential.limits.commercialDocumentsPerMonth} وثيقة تجارية في الشهر و${essential.limits.storageMb / 1024} GB للتخزين.`,
    "essential-pricing": `ثمن ESSENTIEL هو **${monthly} HT MAD في الشهر** أو **${yearly} HT MAD في السنة**، بالدرهم وغير شامل للضريبة، بلا تخفيض سنوي. التجربة المجانية ديال ESSENTIEL مدتها **${DEFAULT_TRIAL_DAYS} يومًا بلا بطاقة بنكية**.\n\nأما PRO فهو **حسب عرض سعر فقط**، بلا ثمن عمومي ثابت.`,
    pro: `**PRO حسب عرض سعر فقط.** كيشمل ESSENTIEL ويضيف الدورة التجارية المتقدمة، طلبات واستلام الموردين، المخزون والمواقع، المحاسبة الموسعة، المطابقة والتوقعات ووظائف الموارد البشرية التحضيرية. حتى **${pro.limits.users} مستخدماً**.\n\nلطلب اقتراح مناسب، تواصل مع **${contact}** ووضح النشاط والوظائف المطلوبة.`,
    "choose-plan": `**ESSENTIEL** مناسب للمبيعات والمشتريات والفواتير والأداءات والخزينة اليومية، حتى ${essential.limits.users} مستخدمين.\n\nاختار دراسة **PRO حسب عرض سعر** إذا محتاج المخزون، عروض الأسعار والطلبات والتسليم، المحاسبة المتقدمة أو الموارد البشرية، أو فريق أكبر حتى ${pro.limits.users} مستخدماً. شنو المسار اللي باغي تغطي أولاً؟`,
    trial: `التجربة المجانية كتخص **ESSENTIEL لمدة ${DEFAULT_TRIAL_DAYS} يومًا، بلا بطاقة بنكية**. أنشئ حساب المسؤول ثم فضاء المقاولة. التسجيل متاح بالإيميل أو Google. PRO كيحتاج طلب عرض سعر؛ تجربة PRO تلقائية ماشي مضمونة.`,
    onboarding: "باش تبدأ:\n\n1. اختار البدء مجاناً وأنشئ الحساب بالإيميل أو Google.\n2. دخل معلومات المقاولة وتحقق منها.\n3. زيد الشعار والزبناء والموردين والمنتجات.\n4. حضّر أول فاتورة.\n\nنقدر نشرح الخطوات، ولكن ما نقدرش ننشئ الحساب بالنيابة عليك.",
    login: "دخل بالطريقة المعتادة: الإيميل وكلمة السر أو Google. إذا نسيتي كلمة السر، استعمل **Mot de passe oublié**، وشوف البريد الوارد والرسائل غير المرغوب فيها. ما تشاركش كلمة السر ولا رابط الاسترجاع هنا. ما نقدرش نغيّر كلمة السر أو نأكد وجود حساب.",
    "customers-suppliers": "ESSENTIEL وPRO كيجمعو بيانات الزبناء والموردين، جهات الاتصال والعناوين والعمليات المرتبطة بهم. تحقق من الطرف المختار قبل الفاتورة أو الأداء. التعديل كيحتاج الصلاحيات المناسبة وتجربة أو اشتراك صالح.",
    products: "الكتالوج كيجمع المنتجات والخدمات ووحداتها ومعلومات الفوترة. يمكن كذلك إدخال أسطر حرة في الفاتورة. تحقق من الكمية والثمن قبل الضريبة والتخفيض وTVA قبل المصادقة. وظائف المخزون الموسعة كتخص PRO، والخدمة ما عندهاش نفس أثر منتج مخزني.",
    "sales-invoices": "باش تنشئ فاتورة بيع:\n\n1. افتح المبيعات ← فواتير الزبناء واختار فاتورة جديدة.\n2. حدد الزبون والأسطر والكميات والأثمنة وTVA.\n3. تحقق من المجموع ومعلومات المقاولة والأجل قبل المصادقة.\n4. من صفحة الفاتورة تلقى PDF والأداءات والباقي.\n\nالمسودة قابلة للتعديل حسب الصلاحيات. تصحيح فاتورة مصادق عليها يقدر يحتاج إشعاراً دائناً.",
    "pdf-branding": "زيد شعار المقاولة ومعلوماتها ومعرفاتها من الإعدادات. افتح الفاتورة واختار **Imprimer / PDF** ثم احفظ PDF من المتصفح. الوثائق الإلكترونية الصادرة كتستعمل نسختها المؤرشفة. خاص المعرفات القانونية تكون صحيحة، وما يمكنش اختراعها.",
    "invoice-email": "حمّل الفاتورة من **Imprimer / PDF** ثم أرفق PDF برسالة من بريدك للزبون. **Marquer comme envoyée كيبدل حالة التتبع فقط وما كيصيفط حتى إيميل.** ما نقدرش نصيفط وثيقة بالنيابة عليك.",
    "customer-payments": "سجل الأداء المستلم من صفحة الفاتورة أو الأداءات، بعد التحقق من التاريخ والمبلغ والحساب البنكي أو الصندوق. ربط الأداء بالفاتورة كيحدّث الباقي. هاد التسجيل تدبيري، وماشي تحويل بنكي حقيقي. ما نقدرش نشوف أو نأكد الأداءات ديالك.",
    "credit-notes": "الإشعار الدائن كيساعد على تصحيح فاتورة زبون مصادق عليها إذا الحالة والصلاحيات كتسمح. تحقق من الأسطر والمبلغ والربط بالفاتورة الأصلية. إرجاع المال عملية منفصلة وما نقدرش ننفذها. خلي المستشار ديالك يراجع المعالجة المحاسبية أو الضريبية الفعلية.",
    purchases: "من المشتريات ← فواتير الموردين، اختار المورد ودخل الأسطر والمراجع والتواريخ والمبالغ. ESSENTIEL كيشمل الإدخال المباشر وأداءات الموردين والإشعارات الدائنة، وPRO كيزيد الطلبات والاستلام. تسجيل الفاتورة ما كيخلصش المورد تلقائياً.",
    "supplier-payments": "سجل أداء المورد من المشتريات ← الأداءات، وتحقق من المورد والحساب والتاريخ والمبلغ والفواتير المرتبطة. صفحة الأداء كتتيح التتبع والوثيقة المبررة. هادي عملية تسجيل في Felexia وماشي تنفيذ تحويل بنكي.",
    "commercial-cycle": "PRO كيشمل الزبناء المحتملين وعروض الأسعار وطلبات الزبناء وسندات التسليم والإرجاع. تسليم وإرجاع المنتجات المخزنية يقدر يأثر على المخزون. عرض سعر كتوجده لزبونك مختلف عن عرض اشتراك Felexia PRO اللي كتطلبه من الفريق.",
    "supplier-orders-receipts": "PRO كيتيح إعداد طلبات الموردين وتسجيل استلام البضائع. كميات المنتجات المخزنية المستلمة كتولد حركات المخزون المرتبطة بها. الطلب والاستلام وفاتورة المورد مراحل منفصلة؛ تحقق من الكميات والمواقع قبل المصادقة.",
    stock: "PRO كيشمل المنتجات المخزنية والمواقع والدخول والخروج والتعديلات وحركات المخزون، مع أثر التسليم والإرجاع والاستلام. **القائمة الخاصة بالجرد ما زالت شاشة محجوزة**؛ مسار جرد فعلي متكامل ماشي وظيفة مكتملة حالياً. الفريق يقدر يأكد الحاجة الدقيقة ديالك.",
    treasury: "ESSENTIEL وPRO كيتبعو الحسابات البنكية والصندوق، المقبوضات والمدفوعات والحركات والأرصدة التدبيرية. PRO كيزيد المطابقة والتوقعات. الأرصدة كتتبع العمليات المسجلة؛ الربط الآلي بجميع البنوك والتحويلات البنكية الحقيقية ماشي خدمات موعود بها.",
    "reconciliation-forecast": "PRO كيتيح مطابقة أسطر الكشف البنكي مع حركات الخزينة، وتوقعات مبنية على المعطيات والفرضيات المتاحة. التوقع ما كيضمنش رصيداً مستقبلياً. تحقق من التواريخ والمبالغ والحسابات والعمليات السابقة. ما نقدرش نقرأ كشوفك أو ننفذ المطابقة بالنيابة عليك.",
    accounting: "ESSENTIEL كيتيح دفاتر المبيعات والمشتريات والبنك والصندوق والقيود المرتبطة بها. PRO كيزيد المخطط المحاسبي ودفتر الأستاذ وميزان المراجعة والشاشات الموسعة. الوصول مرتبط بالصلاحيات. هادي أدوات للتحضير والتتبع، والمحاسب خاصه يراجع الحسابات الفعلية.",
    vat: "الفواتير كتبين HT وTVA وTTC حسب النسب المعدّة. PRO كيتيح التحضير والتتبع لتصاريح TVA وتصدير XML/CSV المناسب. التصدير ماشي إيداع رسمي أو قبول من إدارة الضرائب. خاص المستشار يتحقق من التصريح الفعلي.",
    "electronic-invoicing": "**الفوترة الإلكترونية مشمولة في ESSENTIEL وPRO**: توليد PDF/XML من فواتير الزبناء والإشعارات الدائنة المصادق عليها، ثم إصدار النسخة المختارة وأرشفتها. **الربط الرسمي مع DGI والتوقيع المؤهل ما زالوا غير مفعّلين.** تسيير المقاولة كيبقى الدور الأساسي ديال ESSENTIEL.",
    "activate-electronic-invoicing": "المسؤول يقدر يفعّلها من **المبيعات ← الفوترة الإلكترونية ← الإعدادات**:\n\n1. كمّل معلومات المقاولة.\n2. اختار فاتورة أو إشعاراً دائناً مصادقاً عليه.\n3. ولّد ملفات PDF/XML وتحقق منها.\n4. أصدر النسخة المختارة وأرشفها.\n\nخاص تجربة أو اشتراك صالح وصلاحيات مناسبة. ما نقدرش نفعّل الوظيفة أو نصدر فاتورة بالنيابة عليك.",
    "dgi-signature": "Felexia كيدعم **تحضير PDF/XML وإصدار الوثائق وأرشفتها**. ولكن **الربط الرسمي مع DGI والتوقيع المؤهل غير مفعّلين**. توليد XML ما كيثبتش القبول الضريبي أو شهادة المطابقة القانونية. خاص المستشار ديالك يأكد الالتزامات الخاصة بوضعيتك.",
    "documents-exports": "Felexia كيضم مكتبة وثائق مع رفع وتحميل حسب الصلاحيات، وPDF للوثائق التجارية، وCSV لبعض اللوائح وتصدير مخصص للدفاتر والحسابات. التخزين حسب العرض. بعض شاشات الوثائق والأدوات ما زالت محجوزة؛ ما كاينش وعد باستيراد شامل أو تصدير FEC/DGI مكتمل.",
    hr: "PRO كيشمل إنشاء وتعديل ملفات الأجراء ولوائح وإنشاء العقود. عدة شاشات RH ما زالت للعرض بدون جميع المسارات والنماذج، ومنها العطل والحضور والمصاريف. تفاصيل العقود الكاملة وتوليد الشهادات ومسارات الإدماج والمغادرة الآلية ماشي مكتملة. تأكد من الحاجة الدقيقة مع الفريق.",
    payroll: "وظائف الأجور وCNSS/AMO وIR في PRO **تحضيرية**. ما كتضمنش أجرة نهائية أو صحة النسب القانونية لحالتك أو تصريحاً رسمياً مودعاً. بعض مسارات RH وتجميع الأجور ما زالت تحتاج الإتمام. خاص مهني مختص يراجع الأجور والتصاريح الفعلية.",
    "users-permissions": `المسؤول كيدبر إعدادات المقاولة والدعوات والمستخدمين والاشتراك. المشغل كيخدم العمليات التجارية المسموح بها ويطلع على الخزينة والدفاتر؛ القارئ عنده الاطلاع فقط. ESSENTIEL حتى ${essential.limits.users} مستخدمين، وPRO حتى ${pro.limits.users}. ما نقدرش ندعو شخصاً أو نبدّل صلاحيته. ما تشاركش رابط الدعوة هنا.`,
    numbering: "المسؤول يقدر من الإعدادات ← الترقيم يشوف العدادات حسب عائلة الوثيقة والفترة، يعاين الرقم القادم ويطلب التصحيح بسبب وتأكيد. الحدود المستعملة سابقاً وتاريخ الأرقام محميون. تغيير مظهر الترقيم ما كيبدّلش أرقام الفواتير القديمة.",
    subscription: "المسؤول كيدبر العرض والفوترة من الإعدادات ← الاشتراك. ESSENTIEL شهري أو سنوي، وPRO حسب عرض سعر. بعد نهاية الصلاحية كيولي الفضاء للاطلاع، والتجديد ضروري للتغييرات الجديدة. ما نقدرش نشوف اشتراكك أو نضمن إلغاءه أو تمديده أو إرجاع المال.",
    limits: `كل عرض عمومي كيغطي ${essential.limits.organizations} مقاولة. ESSENTIEL: ${essential.limits.users} مستخدمين، ${essential.limits.commercialDocumentsPerMonth} وثيقة تجارية في الشهر و${essential.limits.storageMb / 1024} GB للتخزين. PRO: ${pro.limits.users} مستخدماً، بلا سقف شهري للوثائق التجارية و${pro.limits.storageMb / 1024} GB للتخزين. لعدة مقاولات أو حاجة خاصة، تواصل مع الفريق للتأكيد.`,
    mobile: "Felexia كيخدم في المتصفح على الحاسوب والتابلت والهاتف بواجهة متجاوبة. الاتصال بالإنترنت ضروري. تطبيق Android/iOS أصلي أو استعمال كامل بلا إنترنت ماشي خدمات معلنة حالياً، وما محتاجش تثبت برنامج حاسوب باش تفتح الموقع.",
    "privacy-security": "مساعد الزوار ما كيوصلش لبيانات المقاولة ديالك. ما تصيفطش كلمات السر أو رموز الدخول أو بيانات البطاقة البنكية أو الوثائق السرية. سياسة الخصوصية كتشرح مقدمي الخدمات والاستضافة والحقوق. الاستضافة حصرياً في المغرب والأمان المطلق ماشي ضمانات معلنة.",
    troubleshooting: "قول ليا اسم الصفحة والعملية اللي حاولتي والرسالة اللي ظهرت، بلا بيانات خاصة. تحقق كذلك من الإنترنت، حدّث الصفحة وعاود الدخول إذا لزم. غياب زر يقدر يكون مرتبطاً بالصلاحية أو الاشتراك أو حالة الوثيقة. شنو هي الرسالة بالضبط؟",
    "unfinished-features": "بعض المسارات ما زالت محجوزة أو غير مكتملة: الأجندة، الجرد الفعلي، التقارير المتقدمة، بعض شاشات الوثائق والأدوات وعدة عمليات RH. لوحات المؤشرات والتصدير المخصص الموجودين وظائف مختلفة. الفريق يقدر يأكد مساراً دقيقاً، وما نقدرش نعطي موعد تسليم غير معلن.",
    integrations: "API عمومية شاملة أو ربط WhatsApp والتجارة الإلكترونية والبنوك ماشي خدمات مضمونة إلا إذا أكدها الفريق. Stripe مستعمل للاشتراك وتسجيل الدخول Google متاح. للهجرة أو تطوير خاص أو ربط نظام، وضّح الحاجة باش الفريق يدرس الإمكانية وعرض السعر.",
    contact: `اضغط على **Felexia Team** باش تتواصل مع الفريق على **WhatsApp: +212 614 505 090**. تقدر كذلك تكتب إلى **${contact}**. لطلب PRO، وضح النشاط والوظائف اللي محتاج.`,
    "support-scope": `نقدر نعاونك في عروض Felexia والوظائف والتسجيل والخطوات المعتادة. ما كنوصلش لحساب خاص وما كننفذ حتى عملية داخل ERP. لطلب خاص تواصل مع **${contact}**.`,
    "legacy-offers": "العروض العمومية الحالية هي ESSENTIEL وPRO. Business ماشي متاح للشراء العمومي الجديد. اسم Premium يقدر يبان في مراجع قديمة؛ النسخة الموسعة كتقدم دابا باسم PRO حسب عرض سعر. الاشتراكات القديمة محفوظة، والفريق خاصه يراجع أي عقد خاص.",
    legal: `FelexiaERP منتج ديال ${LEGAL_CONFIG.companyName} في المغرب. المعلومات القانونية والخصوصية والشروط موجودة أسفل الموقع. ثمن ESSENTIEL المعلن كيتطبق وقت الاشتراك، وشروط PRO في عرض السعر المقبول. ما يمكنش اختراع معرف قانوني أو عنوان ناقص.`,
  },
};

function explicitLanguage(value: string): Language | null {
  const text = normalizeSupportQuery(value);
  if (/\b(?:en anglais|in english|english)\b/.test(text)) return "en";
  if (/\b(?:en francais|in french|francais|french)\b/.test(text)) return "fr";
  if (/(?:بالعربي|العربيه|العربية|عربي|دارجه|دارجة)|\b(?:in arabic|en arabe|arabic|darija)\b/.test(text)) return "ar";
  return null;
}

function inferLanguage(value: string): Language | null {
  if (/[\u0600-\u06ff]/.test(value)) return "ar";
  const text = normalizeSupportQuery(value);
  if (/\b(?:bonjour|bonsoir|salut|quel|quelle|comment|combien|prix|merci|je|peux|pourquoi|essai|gratuit|gratuite|bancaire|demande|faut|sans|commencer|demarrer)\b/.test(text)) return "fr";
  if (/\b(?:hello|hi|what|how|can|could|does|which|price|pricing|please|thanks|thank you|tell me|i want|i need|trial|without|start|bank card)\b/.test(text)) return "en";
  return null;
}

function conversationLanguage(messages: Message[]): Language {
  const users = messages.filter(message => message.role === "user").slice(-6);
  for (const message of [...users].reverse()) {
    const explicit = explicitLanguage(message.content);
    if (explicit) return explicit;
    const language = inferLanguage(message.content);
    if (language) return language;
  }
  return "fr";
}

function isLanguageRequest(value: string): boolean {
  const text = normalizeSupportQuery(value);
  return /^(?:can|could|would) you (?:please )?(?:answer|respond|reply|speak)(?: to me)?(?: in)? (?:english|french|arabic|darija)(?: please)?$/.test(text)
    || /^(?:(?:reponds|repondez|parle|parlez)(?: moi)?(?: en)? |en )?(?:anglais|francais|arabe|darija)(?: stp| svp| sil vous plait)?$/.test(text)
    || /^(?:جاوبني |اجبني |جاوب |رد علي )?(?:بالعربيه|بالعربي|العربيه|عربي|بالدارجه)(?: من فضلك| عافاك)?$/.test(text)
    || /^(?:english|french|arabic)(?: please)?$/.test(text);
}

function selectArticles(messages: Message[]): SupportKnowledgeArticle[] {
  const users = messages.filter(message => message.role === "user");
  const last = users.at(-1)?.content ?? "";
  let query = last;
  if (isLanguageRequest(last)) query = [...users.slice(0, -1)].reverse().find(message => !isLanguageRequest(message.content))?.content ?? "Felexia";
  const text = normalizeSupportQuery(query);
  const hasPro = /\b(?:pro|premium)\b/.test(text);
  const hasEssential = /\b(?:essentiel|essential)\b/.test(text);
  const priceQuestion = /\b(?:prix|tarif|cout|coute|combien|price|pricing|cost|how much|taman|ch7al|chhal|bchhal)\b|بشحال|شحال|ثمن|سعر/.test(text);
  const comparison = /\b(?:difference|comparer|comparaison|compare|versus|vs|apporte|choisir|choose|which plan)\b|الفرق|نختار/.test(text);
  const cardQuestion = /\b(?:bank card|credit card|debit card|carte bancaire|carte de credit|carte de debit)\b|بطاقه/.test(text);
  const startingOrTrial = /\b(?:essai|trial|try|free|gratuit|gratuite|start|begin|signup|sign up|register|inscrire|inscription|commencer|demarrer|sans|without)\b|تجربه|نجرب|نبدا|بلا/.test(text);
  let preferred: string | null = null;
  if (/\b(?:joindre|contacter|contact|humain|human|conseiller|equipe|team)\b|تواصل|نهضر|انسان/.test(text) && !/\b(?:langue|language|english|french|arabic)\b/.test(text)) preferred = "contact";
  else if (/\b(?:dgi|conformite|conforme|certification|certifie|signature|compliance|certified)\b|مطابق|توقيع/.test(text)) preferred = "dgi-signature";
  else if (cardQuestion && startingOrTrial) preferred = "trial";
  else if (hasPro && priceQuestion) preferred = "pro";
  else if (comparison && (hasPro || hasEssential)) preferred = "choose-plan";
  else if (hasPro && !hasEssential && text.split(" ").length <= 5) preferred = "pro";
  else if (priceQuestion && !/\b(?:unitaire|produit|article|ligne|quantity|unit|product|item)\b|منتوج|سلعه|سلعة/.test(text)) {
    const refersBack = /\b(?:son|sa|leur|celui|celle|its|it|that|this|et|and)\b|ديالو|ديالها|الثمن/.test(text);
    const previous = [...users.slice(0, -1)].reverse().find(message => !isLanguageRequest(message.content))?.content ?? "";
    preferred = !hasEssential && refersBack && /\b(?:pro|premium)\b/i.test(previous) && !/\b(?:essentiel|essential)\b/i.test(previous) ? "pro" : "essential-pricing";
  }
  let articles = searchSupportKnowledge(query, 3);
  if (preferred) {
    const primary = SUPPORT_KNOWLEDGE_ARTICLES.find(article => article.id === preferred);
    if (primary) articles = [primary, ...articles.filter(article => article.id !== preferred)];
  }
  // A clear new topic wins. Older text is used only when the current turn carries no topic.
  const generic = articles[0]?.id === "support-scope" || articles[0]?.id === "contact" && articles.length === 2;
  if (!preferred && generic && /^(?:et|and|what about|pour|why|comment|how|واش|و)?\s*(?:ça|ca|cela|it|that|this|lui|elle|هما|هادي)?[\s?!.,]*$/iu.test(query)) {
    const previous = [...users.slice(0, -1)].reverse().find(message => !isLanguageRequest(message.content));
    if (previous) articles = searchSupportKnowledge(previous.content, 3);
  }
  return articles.slice(0, 3);
}

function suggestionsFor(language: Language, primary: string): string[] {
  if (language === "en") return primary === "contact" ? ["How do I start the free trial?", "Compare ESSENTIEL and PRO"] : ["Compare ESSENTIEL and PRO", "How do I get started?", "Speak to the Felexia team"];
  if (language === "ar") return primary === "contact" ? ["كيفاش نبدأ التجربة المجانية؟", "شنو الفرق بين ESSENTIEL وPRO؟"] : ["شنو الفرق بين ESSENTIEL وPRO؟", "كيفاش نبدأ؟", "بغيت نتواصل مع فريق Felexia"];
  return primary === "contact" ? ["Comment commencer l’essai gratuit ?", "Comparer ESSENTIEL et PRO"] : ["Comparer ESSENTIEL et PRO", "Comment démarrer ?", "Parler à l’équipe Felexia"];
}

/** Useful public help without a model call; never uses prior assistant text as a product source. */
export function knowledgeSupportReply(messages: Message[]): KnowledgeSupportReply {
  const users = messages.filter(message => message.role === "user");
  const last = users.at(-1)?.content ?? "";
  const language = conversationLanguage(messages);
  const normalized = normalizeSupportQuery(last);
  if (!normalized || /^(?:bonjour|bonsoir|salut|hello|hi|hey|salam|سلام|السلام عليكم|مرحبا)$/.test(normalized)) {
    const reply = language === "en" ? "Hello! I’m the Felexia virtual assistant. I can help you choose a plan, understand the features or get started. What would you like to know?" : language === "ar" ? "مرحباً! أنا مساعد Felexia الافتراضي. نقدر نعاونك تختار العرض، تفهم الوظائف أو تبدأ الاستعمال. شنو بغيتي تعرف؟" : "Bonjour ! Je suis l’assistant virtuel Felexia. Je peux vous aider à choisir votre offre, comprendre une fonctionnalité ou démarrer. Que souhaitez-vous savoir ?";
    return { reply, sources: [], suggestions: suggestionsFor(language, "overview"), mode: "knowledge" };
  }
  const articles = selectArticles(messages);
  const primary = articles[0] ?? SUPPORT_KNOWLEDGE_ARTICLES.find(article => article.id === "support-scope")!;
  const translated = answers[language][primary.id];
  const reply = translated ?? (language === "fr" ? primary.content : language === "en" ? `This precise detail is currently available in Felexia’s verified French guide:\n\n${primary.content}\n\nFor help with your specific case, contact ${contact}.` : `هذا التفصيل متاح حالياً في دليل Felexia المراجع بالفرنسية:\n\n${primary.content}\n\nللمساعدة في حالتك، تواصل مع ${contact}.`);
  const sourceArticles = primary.id === "choose-plan" ? [primary, ...SUPPORT_KNOWLEDGE_ARTICLES.filter(article => ["essential", "pro"].includes(article.id))] : ["pro", "trial"].includes(primary.id) ? [primary] : [primary, ...articles.slice(1, 2)];
  return {
    reply: reply.slice(0, 5_800),
    sources: sourceArticles.map(({ id, title, href }) => ({ id, title, href })),
    suggestions: suggestionsFor(language, primary.id),
    mode: "knowledge",
  };
}
