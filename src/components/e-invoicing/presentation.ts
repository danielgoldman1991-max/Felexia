import type { EinvoiceLanguage, EinvoiceSourceKind } from "@/lib/e-invoicing/view-types";

const fr = {
  title: "Facturation électronique Maroc", documents: "Documents", configuration: "Configuration", supervision: "Supervision",
  preparatory: "UBL 2.1 générique préparatoire. La connexion officielle DGI et la signature électronique qualifiée sont indisponibles. Une simulation n’est pas une transmission officielle.",
  unavailable: "La préparation électronique n’est pas encore activée pour cet espace. Les archives disponibles restent consultables.",
  migration: "La mise à jour du module doit être activée par votre administrateur. Vos factures existantes restent disponibles.",
  readOnly: "Consultation : vous pouvez lire et télécharger les versions disponibles. Les nouvelles opérations nécessitent un rôle autorisé et un abonnement actif.",
  loadError: "Impossible de charger cet écran. Réessayez dans un instant ou contactez l’assistance.",
  total: "Documents", prepared: "Préparés", attention: "À corriger", ready: "Prêts", search: "Rechercher", searchPlaceholder: "Numéro ou client",
  allStates: "Tous les états", allKinds: "Factures et avoirs", invoice: "Facture", credit_note: "Avoir", source: "Pièce d’origine",
  number: "Numéro", date: "Date", buyer: "Client", amount: "TTC", status: "État électronique", issues: "Points à vérifier", open: "Ouvrir",
  empty: "Aucun document à afficher", emptyDescription: "Créez et validez une facture de vente, puis préparez-la ici. Vous pouvez aussi rechercher une facture ou un avoir existant.",
  sales: "Mes factures de vente", previous: "Précédente", next: "Suivante", page: "Page", results: "résultat(s)",
  sourceState: "État de la pièce", prepare: "Préparer une version", check: "Contrôler la version", issue: "Émettre la version", markReady: "Marquer prête",
  simulate: "Lancer une simulation interne", integrity: "Vérifier l’intégrité", validation: "Contrôles locaux", noIssues: "Aucun point signalé dans le dernier contrôle disponible.",
  notChecked: "Un contrôle local vérifie les données et le format technique ; il ne constitue pas une certification DGI.",
  buyerType: "Nature du client", choose: "Choisir", business: "Entreprise", consumer: "Particulier", export: "Client à l’étranger",
  preparationInfo: "La préparation utilise cette pièce existante, son numéro et ses montants. Complétez les informations techniques ci-dessous ; les montants ne sont pas modifiés.",
  zeroTax: "Pour chaque taux de TVA à 0 %, choisissez explicitement le traitement applicable et indiquez son motif.",
  description: "Désignation", quantity: "Quantité", unit: "Code unité", taxRate: "Taux TVA", taxCategory: "Traitement TVA", exemption: "Motif du taux zéro / exonération / hors champ",
  unitC62: "Unité", unitHUR: "Heure", unitDAY: "Jour", unitMON: "Mois", unitKGM: "Kilogramme", unitLTR: "Litre", unitMTR: "Mètre",
  taxS: "TVA au taux indiqué", taxZ: "Taux zéro", taxE: "Exonération", taxO: "Hors champ",
  submitPreparation: "Enregistrer la préparation", pending: "Traitement…", versions: "Versions et documents", version: "Version", noVersions: "Aucune version préparée pour cette pièce.",
  preview: "Aperçu PDF", xml: "Télécharger XML", hash: "Empreinte de l’instantané", verified: "Intégrité vérifiée", failed: "Intégrité à vérifier", unchecked: "Non vérifiée",
  history: "Historique", noHistory: "Aucune opération enregistrée.", simulation: "Simulation interne", disabled: "Désactivé", connector: "Connecteur", officialUnavailable: "Connexion officielle DGI indisponible",
  settingsDescription: "Réglages de préparation et suivi des sources. Les secrets et certificats ne sont jamais saisis dans cet écran.",
  issuer: "Émetteur", companySettings: "Paramètres de mon entreprise", mode: "Mode du connecteur", language: "Langue par défaut", alerts: "Activer les alertes du module", save: "Enregistrer",
  sources: "Sources réglementaires", checkSources: "Vérifier les sources", official: "Source officielle", announced: "Annoncé", unconfirmed: "Non confirmé", never: "Jamais vérifié",
  changes: "Évolutions à examiner", noChanges: "Aucune évolution à examiner.", reviewInfo: "Une validation humaine consigne l’analyse. Aucune règle réglementaire n’est appliquée automatiquement en production.",
  notes: "Motif ou note de contrôle", approve: "Valider l’analyse", reject: "Écarter", reviewed: "Analyse enregistrée", backup: "Suivi des contrôles de sauvegarde",
  backupInfo: "Enregistrez uniquement un contrôle de restauration réellement effectué, avec sa référence. Cette déclaration ne réalise aucune sauvegarde ni restauration.",
  reference: "Référence de preuve", verifiedAt: "Date du contrôle", recordBackup: "Consigner le contrôle", backupAttestation: "Je confirme que ce contrôle a été effectué et que sa preuve est disponible.",
  noBackup: "Aucun contrôle de restauration consigné dans ce module.", queue: "File de traitement", queuePending: "En attente", queueFailed: "En échec", queueBlocked: "Bloqués", integrityFailures: "Alertes d’intégrité",
  process: "Traiter les tâches internes", lastProcessing: "Dernier traitement", attempts: "Tentatives", nextAttempt: "Prochaine tentative", lastError: "Dernière erreur", noJobs: "Aucune tâche dans la file.",
  actionNotice: "Demande traitée. Consultez le statut et l’historique du document.", actionError: "L’opération n’a pas pu être confirmée. Vérifiez les informations puis actualisez avant de réessayer.",
  sourceChanged: "La pièce a changé depuis sa préparation. Actualisez et préparez une nouvelle version avant de poursuivre.", validationFailed: "Des informations doivent être corrigées avant de poursuivre. Consultez les contrôles locaux.",
  adminOnly: "Cet écran est réservé à l’administrateur de l’entreprise.", back: "Retour aux documents",
  organizationEnabled: "Activer la préparation pour mon entreprise", rolloutPending: "L’activation de ce module nécessite l’intervention de l’équipe Felexia. Les archives disponibles restent consultables.", requireRc: "Exiger le RC dans le contrôle local", defaultBuyerType: "Nature de client par défaut",
  accounting: "Liens comptables", linkedEntries: "Écritures liées", unpostedSources: "Pièces sans écriture", duplicateSources: "Sources comptables dupliquées", accountingInfo: "Le module réutilise les journaux existants. Il ne crée ni paiement ni écriture comptable supplémentaire.",
  confirmIssue: "Émettre cette version ? Ses données seront figées. Vérifiez les contrôles locaux avant de confirmer.",
  simulationScenario: "Scénario de simulation", simulationAccept: "Acceptation interne", simulationReject: "Rejet interne", simulationTimeout: "Délai dépassé", simulationUnavailable: "Service indisponible", simulationHint: "Test interne uniquement : aucune transmission à la DGI. Le résultat reste identifié comme une simulation.",
} as const;

const ar: Record<keyof typeof fr, string> = {
  title: "الفوترة الإلكترونية بالمغرب", documents: "المستندات", configuration: "الإعدادات", supervision: "المراقبة",
  preparatory: "صيغة UBL 2.1 عامة وتحضيرية. الربط الرسمي بالمديرية العامة للضرائب والتوقيع الإلكتروني المؤهل غير متاحين. المحاكاة ليست إرسالاً رسمياً.",
  unavailable: "إعداد الفواتير الإلكترونية غير مفعّل بعد لهذا الحساب. تبقى النسخ المؤرشفة المتاحة قابلة للعرض.",
  migration: "يجب على المسؤول تفعيل تحديث الوحدة. تبقى فواتيركم الحالية متاحة.",
  readOnly: "للقراءة: يمكنكم عرض وتنزيل النسخ المتاحة. تتطلب العمليات الجديدة صلاحية مناسبة واشتراكاً سارياً.",
  loadError: "تعذر تحميل هذه الصفحة. يرجى المحاولة لاحقاً أو الاتصال بالدعم.",
  total: "المستندات", prepared: "المُعدّة", attention: "تحتاج إلى تصحيح", ready: "الجاهزة", search: "بحث", searchPlaceholder: "الرقم أو العميل",
  allStates: "جميع الحالات", allKinds: "الفواتير والإشعارات الدائنة", invoice: "فاتورة", credit_note: "إشعار دائن", source: "المستند الأصلي",
  number: "الرقم", date: "التاريخ", buyer: "العميل", amount: "المبلغ شامل الضريبة", status: "الحالة الإلكترونية", issues: "نقاط للمراجعة", open: "فتح",
  empty: "لا توجد مستندات للعرض", emptyDescription: "أنشئوا فاتورة بيع واعتمدوها ثم أعدّوها هنا. يمكن أيضاً البحث عن فاتورة أو إشعار دائن موجود.",
  sales: "فواتير البيع", previous: "السابق", next: "التالي", page: "الصفحة", results: "نتيجة", sourceState: "حالة المستند", prepare: "إعداد نسخة", check: "فحص النسخة", issue: "إصدار النسخة", markReady: "تحديد كجاهزة",
  simulate: "بدء محاكاة داخلية", integrity: "فحص السلامة", validation: "الفحوص المحلية", noIssues: "لا توجد نقاط مسجلة في آخر فحص متاح.",
  notChecked: "يتحقق الفحص المحلي من البيانات والصيغة التقنية، ولا يمثل شهادة من المديرية العامة للضرائب.",
  buyerType: "نوع العميل", choose: "اختيار", business: "مقاولة", consumer: "فرد", export: "عميل بالخارج",
  preparationInfo: "يستخدم الإعداد المستند الحالي ورقمه ومبالغه. أكملوا المعلومات التقنية أدناه دون تغيير المبالغ.",
  zeroTax: "لكل نسبة ضريبة 0 %، اختاروا المعالجة المناسبة صراحةً ووضحوا سببها.",
  description: "البيان", quantity: "الكمية", unit: "رمز الوحدة", taxRate: "نسبة الضريبة", taxCategory: "معالجة الضريبة", exemption: "سبب النسبة الصفرية أو الإعفاء أو الخروج عن النطاق",
  unitC62: "وحدة", unitHUR: "ساعة", unitDAY: "يوم", unitMON: "شهر", unitKGM: "كيلوغرام", unitLTR: "لتر", unitMTR: "متر",
  taxS: "ضريبة بالنسبة المحددة", taxZ: "نسبة صفر", taxE: "إعفاء", taxO: "خارج النطاق", submitPreparation: "حفظ الإعداد", pending: "جارٍ المعالجة…",
  versions: "النسخ والمستندات", version: "النسخة", noVersions: "لم تُعدّ أي نسخة لهذا المستند.", preview: "عرض PDF", xml: "تنزيل XML", hash: "بصمة النسخة الثابتة", verified: "تم التحقق من السلامة", failed: "تحتاج السلامة إلى فحص", unchecked: "غير مفحوصة",
  history: "السجل", noHistory: "لا توجد عمليات مسجلة.", simulation: "محاكاة داخلية", disabled: "معطّل", connector: "الموصل", officialUnavailable: "الربط الرسمي بالمديرية العامة للضرائب غير متاح",
  settingsDescription: "إعدادات التحضير ومتابعة المصادر. لا تُدخل الأسرار أو الشهادات في هذه الصفحة.", issuer: "المُصدر", companySettings: "إعدادات المقاولة", mode: "وضع الموصل", language: "اللغة الافتراضية", alerts: "تفعيل تنبيهات الوحدة", save: "حفظ",
  sources: "المصادر التنظيمية", checkSources: "فحص المصادر", official: "مصدر رسمي", announced: "معلن", unconfirmed: "غير مؤكد", never: "لم يُفحص بعد", changes: "تطورات للمراجعة", noChanges: "لا توجد تطورات للمراجعة.",
  reviewInfo: "توثق المراجعة البشرية التحليل. لا تُطبق أي قاعدة تنظيمية تلقائياً في الإنتاج.", notes: "سبب أو ملاحظة الفحص", approve: "اعتماد التحليل", reject: "استبعاد", reviewed: "تم تسجيل التحليل", backup: "متابعة فحوص النسخ الاحتياطية",
  backupInfo: "سجلوا فقط فحص استعادة تم فعلاً مع مرجع الدليل. هذا التصريح لا ينفذ أي نسخ احتياطي أو استعادة.", reference: "مرجع الدليل", verifiedAt: "تاريخ الفحص", recordBackup: "تسجيل الفحص", backupAttestation: "أؤكد إجراء هذا الفحص وتوفر دليله.", noBackup: "لم يُسجل أي فحص استعادة في هذه الوحدة.",
  queue: "قائمة المعالجة", queuePending: "قيد الانتظار", queueFailed: "فاشلة", queueBlocked: "متوقفة", integrityFailures: "تنبيهات السلامة", process: "معالجة المهام الداخلية", lastProcessing: "آخر معالجة", attempts: "المحاولات", nextAttempt: "المحاولة التالية", lastError: "آخر خطأ", noJobs: "لا توجد مهام في القائمة.",
  actionNotice: "تمت معالجة الطلب. راجعوا حالة المستند وسجله.", actionError: "تعذر تأكيد العملية. راجعوا المعلومات ثم حدّثوا الصفحة قبل إعادة المحاولة.", sourceChanged: "تغير المستند منذ إعداده. حدّثوا الصفحة وأعدّوا نسخة جديدة قبل المتابعة.", validationFailed: "يجب تصحيح بعض المعلومات قبل المتابعة. راجعوا الفحوص المحلية.", adminOnly: "هذه الصفحة مخصصة لمسؤول المقاولة.", back: "العودة إلى المستندات",
  organizationEnabled: "تفعيل إعداد الفواتير لمقاولتي", rolloutPending: "يتطلب تفعيل هذه الوحدة تدخل فريق Felexia. تبقى النسخ المؤرشفة المتاحة قابلة للعرض.", requireRc: "اشتراط السجل التجاري في الفحص المحلي", defaultBuyerType: "نوع العميل الافتراضي",
  accounting: "الروابط المحاسبية", linkedEntries: "القيود المرتبطة", unpostedSources: "مستندات دون قيد", duplicateSources: "مصادر محاسبية مكررة", accountingInfo: "تستخدم الوحدة الدفاتر الحالية ولا تنشئ أي أداء أو قيد محاسبي إضافي.",
  confirmIssue: "هل تريدون إصدار هذه النسخة؟ ستصبح بياناتها ثابتة. راجعوا الفحوص المحلية قبل التأكيد.",
  simulationScenario: "سيناريو المحاكاة", simulationAccept: "قبول داخلي", simulationReject: "رفض داخلي", simulationTimeout: "انتهاء المهلة", simulationUnavailable: "الخدمة غير متاحة", simulationHint: "اختبار داخلي فقط دون أي إرسال إلى المديرية العامة للضرائب. تبقى النتيجة موسومة كمحاكاة.",
};

export type EinvoiceTextKey = keyof typeof fr;
export const einvoiceText = (lang: EinvoiceLanguage, key: EinvoiceTextKey) => (lang === "ar" ? ar : fr)[key];
export const einvoiceLanguage = (value: unknown): EinvoiceLanguage => value === "ar" ? "ar" : "fr";
export const einvoiceRouteKind = (kind: EinvoiceSourceKind) => kind === "invoice" ? "factures" : "avoirs";
export const einvoiceDetailPath = (kind: EinvoiceSourceKind, sourceId: string) => `/facturation/electronique/${einvoiceRouteKind(kind)}/${encodeURIComponent(sourceId)}`;
export const einvoiceSourcePath = (kind: EinvoiceSourceKind, sourceId: string) => `/facturation/${einvoiceRouteKind(kind)}/${encodeURIComponent(sourceId)}`;

/** Display canonical two-decimal amounts without a floating-point conversion. */
export function einvoiceMoney(amount: string, currency: string): string {
  const match = /^(-?)(\d+)(?:\.(\d{1,2}))?$/.exec(amount.trim());
  if (!match) return `— ${currency}`;
  const integer = match[2].replace(/^0+(?=\d)/, "").replace(/\B(?=(\d{3})+(?!\d))/g, "\u202f");
  return `${match[1]}${integer},${(match[3] || "").padEnd(2, "0")} ${currency}`;
}

export function einvoicePositiveRate(value: string): boolean {
  return /^\d+(?:\.\d+)?$/.test(value) && /[1-9]/.test(value);
}

export function einvoiceHref(path: string, lang: EinvoiceLanguage, values: Record<string, string | undefined> = {}) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) if (value !== undefined && key !== "lang") query.set(key, value);
  query.set("lang", lang);
  return `${path}?${query}`;
}

export function einvoiceDate(value: string | null | undefined, lang: EinvoiceLanguage) {
  if (!value || !Number.isFinite(Date.parse(value))) return "—";
  return new Intl.DateTimeFormat(lang === "ar" ? "ar-MA" : "fr-MA", { dateStyle: "medium", ...(value.includes("T") ? { timeStyle: "medium" as const } : {}), timeZone: "Africa/Casablanca" }).format(new Date(value));
}

export function safeEinvoiceExternalUrl(value: string) {
  try { const url = new URL(value); return url.protocol === "https:" ? url.href : null; } catch { return null; }
}

export function einvoiceStateLabel(state: string, lang: EinvoiceLanguage) {
  const labels: Record<string, [string, string]> = {
    applied: ["Affecté", "مُخصّص"], partially_applied: ["Partiellement affecté", "مُخصّص جزئياً"],
    succeeded: ["Terminée", "مكتملة"], running: ["En cours", "قيد المعالجة"], retry_wait: ["Reprise programmée", "إعادة المحاولة مبرمجة"], not_submitted: ["Aucun traitement", "دون معالجة"], transmitted: ["Traitée en interne", "معالجة داخلياً"], ready_to_submit: ["Prête", "جاهزة"],
    unprepared: ["À préparer", "للإعداد"], draft: ["Brouillon électronique", "مسودة إلكترونية"], prepared: ["Préparée", "مُعدّة"], validated: ["Validée localement", "مفحوصة محلياً"], issued: ["Émise en interne", "مُصدرة داخلياً"], ready: ["Prête", "جاهزة"],
    pending: ["En attente interne", "قيد الانتظار داخلياً"], queued: ["En file interne", "في القائمة الداخلية"], submitted: ["Traitée en interne", "معالجة داخلياً"], accepted: ["Acceptée en interne", "مقبولة داخلياً"], rejected: ["Rejetée en interne", "مرفوضة داخلياً"], unknown: ["Statut inconnu", "حالة غير معروفة"],
    completed: ["Terminée", "مكتملة"], failed: ["Échec", "فشل"], processing: ["En cours", "قيد المعالجة"], blocked: ["Bloquée", "متوقفة"], cancelled: ["Annulée", "ملغاة"], sent: ["Marquée envoyée", "محددة كمرسلة"], paid: ["Réglée", "مسددة"], partially_paid: ["Partiellement réglée", "مسددة جزئياً"], overdue: ["Échue", "متأخرة"],
  };
  return (labels[state] ?? labels.unknown)[lang === "ar" ? 1 : 0];
}
