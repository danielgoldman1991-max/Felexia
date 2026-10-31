import { ModulePage } from "@/components/erp/module-page";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Table, Td, Th } from "@/components/ui/table";
import { requireActiveWorkspace } from "@/lib/auth";
import { isAdminRole } from "@/lib/auth/roles";
import { getEinvoiceSupervision } from "@/lib/e-invoicing/service";
import { processEinvoiceJobsAction } from "@/lib/e-invoicing/actions";
import type { EinvoiceSupervisionView } from "@/lib/e-invoicing/view-types";
import { EinvoiceSubmit } from "@/components/e-invoicing/submit-button";
import { EinvoiceAvailability, EinvoiceFeedback, EinvoiceFrame, EinvoiceHiddenFields, EinvoiceHistory, EinvoiceLoadError, EinvoiceStateBadge } from "@/components/e-invoicing/shared";
import { einvoiceDate, einvoiceLanguage, einvoiceText as t } from "@/components/e-invoicing/presentation";

export const dynamic = "force-dynamic";
const path = "/facturation/electronique/supervision";

export default async function EinvoiceSupervisionPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const params = await searchParams;
  let lang = einvoiceLanguage(params.lang);
  const workspace = await requireActiveWorkspace();
  if (!isAdminRole(workspace.role)) return <ModulePage><EinvoiceFrame lang={lang} path={path}><p role="alert">{t(lang, "adminOnly")}</p></EinvoiceFrame></ModulePage>;
  let view: EinvoiceSupervisionView;
  try { view = await getEinvoiceSupervision(); }
  catch { return <ModulePage><EinvoiceLoadError lang={lang} path={path} /></ModulePage>; }
  lang = einvoiceLanguage(params.lang === "fr" || params.lang === "ar" ? params.lang : view.preferredLanguage);
  const canProcess = view.enabled && view.migrationReady && view.canAdmin && view.canWrite;
  return <ModulePage><EinvoiceFrame lang={lang} path={path} query={params} canAdmin={view.canAdmin} title={t(lang, "supervision")}>
    <EinvoiceFeedback lang={lang} notice={params.notice} error={params.error} /><EinvoiceAvailability view={view} lang={lang} />
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{([['queuePending', view.summary.pending], ['queueFailed', view.summary.failed], ['queueBlocked', view.summary.blocked], ['integrityFailures', view.summary.integrityFailures]] as const).map(([key, count]) => <Card key={key}><CardContent className="p-4"><p className="text-sm text-[var(--muted)]">{t(lang, key)}</p><p className="mt-2 text-2xl font-semibold">{count}</p></CardContent></Card>)}</div>
    {view.diagnostics ? <Card><CardHeader><h2 className="font-semibold">{lang === "ar" ? "تشخيص الخدمات والوثائق" : "Diagnostic des services et documents"}</h2></CardHeader><CardContent><dl className="grid gap-5 text-sm sm:grid-cols-2 lg:grid-cols-3">{([
      [lang === "ar" ? "نسخ مولدة بنجاح" : "Versions générées avec succès", view.diagnostics.generated],
      [lang === "ar" ? "وثائق مفحوصة" : "Documents validés", view.diagnostics.validated],
      [lang === "ar" ? "أخطاء XML/XSD" : "Échecs XML/XSD", view.diagnostics.xmlFailures],
      [lang === "ar" ? "محاولات تكرار مرفوضة" : "Tentatives de doublon refusées", view.diagnostics.duplicateAttempts],
      [lang === "ar" ? "مدة آخر إعداد" : "Durée de la dernière préparation", view.diagnostics.latestPreparationMs == null ? "—" : `${view.diagnostics.latestPreparationMs} ms`],
      [lang === "ar" ? "محرك التحقق المحلي" : "Validateur local", view.diagnostics.validatorAvailable ? (lang === "ar" ? "متاح" : "Disponible") : (lang === "ar" ? "غير متاح" : "Indisponible")],
      [lang === "ar" ? "آخر تصريح بمراجعة النسخة الاحتياطية" : "Dernière attestation de sauvegarde", einvoiceDate(view.diagnostics.backupAttestedAt, lang)],
      [lang === "ar" ? "محاولات قراءة المصادر المتعذرة" : "Lectures de sources indisponibles", view.diagnostics.sourceChecksFailed],
      [lang === "ar" ? "خدمة التوقيع الإلكتروني" : "Service de signature", lang === "ar" ? "غير مُعدّ" : "Non configuré"],
    ] as const).map(([label, value]) => <div key={label}><dt className="text-xs text-[var(--muted)]">{label}</dt><dd className="mt-1 font-semibold">{value}</dd></div>)}</dl><p className="mt-5 text-xs leading-5 text-[var(--muted)]">{lang === "ar" ? "المدة مقاسة داخل الخادم. تصريح النسخة الاحتياطية بشري ولا يثبت استعادة سحابية آلية. لا توجد خدمة توقيع أو إرسال ضريبي رسمي." : "Durée mesurée côté serveur. L’attestation de sauvegarde est humaine et ne prouve pas une restauration cloud automatique. Aucun service de signature ni transmission fiscale officielle n’est actif."}</p></CardContent></Card> : null}
    <Card><CardHeader><h2 className="font-semibold">{t(lang, "connector")}</h2></CardHeader><CardContent className="space-y-2 text-sm"><p>{t(lang, "mode")} : {t(lang, view.connectorMode === "simulation" ? "simulation" : "disabled")}</p><p className="text-[var(--muted)]">{t(lang, "officialUnavailable")}</p><p>{t(lang, "lastProcessing")} : {einvoiceDate(view.lastProcessingAt, lang)}</p></CardContent></Card>
    <Card><CardHeader><h2 className="font-semibold">{t(lang, "accounting")}</h2></CardHeader><CardContent className="space-y-3"><p className="text-sm leading-6 text-[var(--muted)]">{t(lang, "accountingInfo")}</p><dl className="grid gap-3 sm:grid-cols-3">{([['linkedEntries', view.summary.linkedAccountingEntries], ['unpostedSources', view.summary.sourcesWithoutAccounting], ['duplicateSources', view.summary.duplicateAccountingSources]] as const).map(([key, count]) => <div key={key}><dt className="text-xs text-[var(--muted)]">{t(lang, key)}</dt><dd className="mt-1 font-semibold">{count ?? "—"}</dd></div>)}</dl></CardContent></Card>
    <Card><CardHeader><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="font-semibold">{t(lang, "queue")}</h2>{canProcess ? <form action={processEinvoiceJobsAction}><EinvoiceHiddenFields lang={lang} /><EinvoiceSubmit lang={lang} variant="secondary">{t(lang, "process")}</EinvoiceSubmit></form> : null}</div></CardHeader><CardContent className="p-0">{view.jobs.length ? <Table><thead><tr><Th>{t(lang, "number")}</Th><Th>{t(lang, "status")}</Th><Th>{t(lang, "attempts")}</Th><Th>{t(lang, "nextAttempt")}</Th><Th>{t(lang, "lastError")}</Th></tr></thead><tbody>{view.jobs.map((job) => <tr key={job.id}><Td><bdi>{job.number}</bdi></Td><Td><EinvoiceStateBadge state={job.state} mode={job.mode} lang={lang} /></Td><Td>{job.attempts}</Td><Td>{einvoiceDate(job.nextAttemptAt, lang)}</Td><Td><span className="block max-w-sm whitespace-normal break-words" dir="auto">{job.lastError || "—"}</span></Td></tr>)}</tbody></Table> : <p className="p-5 text-sm text-[var(--muted)]">{t(lang, "noJobs")}</p>}</CardContent></Card>
    <Card><CardHeader><h2 className="font-semibold">{t(lang, "history")}</h2></CardHeader><CardContent><EinvoiceHistory events={view.events} lang={lang} /></CardContent></Card>
  </EinvoiceFrame></ModulePage>;
}
