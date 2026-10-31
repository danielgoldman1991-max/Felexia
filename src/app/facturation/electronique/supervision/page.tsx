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
  const canProcess = view.enabled && view.migrationReady && view.canAdmin && view.canWrite && view.connectorMode === "simulation";
  const metrics = [
    [lang === "ar" ? "المستندات المُنشأة" : "Documents générés", view.diagnostics?.generated],
    [t(lang, "issuedDocuments"), view.diagnostics?.issued],
    [t(lang, "integrityFailures"), view.summary.integrityFailures],
    [t(lang, "duplicateSources"), view.summary.duplicateAccountingSources],
  ] as const;
  return <ModulePage><EinvoiceFrame lang={lang} path={path} query={params} canAdmin={view.canAdmin} title={t(lang, "supervision")}>
    <EinvoiceFeedback lang={lang} notice={params.notice} error={params.error} /><EinvoiceAvailability view={view} lang={lang} />
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{metrics.map(([label, count]) => <Card key={label}><CardContent className="p-4"><p className="text-sm text-[var(--muted)]">{label}</p><p className="mt-2 text-2xl font-semibold">{count ?? "—"}</p></CardContent></Card>)}</div>
    {view.diagnostics ? <Card><CardHeader><h2 className="font-semibold">{lang === "ar" ? "خدمة المستندات" : "Service documentaire"}</h2></CardHeader><CardContent><dl className="grid gap-5 text-sm sm:grid-cols-2 lg:grid-cols-3">{([
      [lang === "ar" ? "التحقق من المستندات" : "Vérification des documents", view.diagnostics.validatorAvailable ? (lang === "ar" ? "متاحة" : "Disponible") : (lang === "ar" ? "تحتاج إلى تدخل" : "À vérifier")],
      [lang === "ar" ? "أخطاء تنسيق المستندات" : "Erreurs de format", view.diagnostics.xmlFailures],
      [lang === "ar" ? "مدة آخر إنشاء" : "Dernière génération", view.diagnostics.latestPreparationMs == null ? "—" : `${view.diagnostics.latestPreparationMs} ms`],
      [lang === "ar" ? "آخر فحص للنسخة الاحتياطية" : "Dernier contrôle de sauvegarde", einvoiceDate(view.diagnostics.backupAttestedAt, lang)],
    ] as const).map(([label, value]) => <div key={label}><dt className="text-xs text-[var(--muted)]">{label}</dt><dd className="mt-1 font-semibold">{value}</dd></div>)}</dl></CardContent></Card> : null}
    <Card><CardHeader><h2 className="font-semibold">{t(lang, "accounting")}</h2></CardHeader><CardContent className="space-y-3"><p className="text-sm leading-6 text-[var(--muted)]">{lang === "ar" ? "تابعوا الروابط بين المستندات والقيود في يوميات المقاولة." : "Retrouvez le lien entre vos documents et les écritures de vos journaux."}</p><dl className="grid gap-3 sm:grid-cols-3">{([['linkedEntries', view.summary.linkedAccountingEntries], ['unpostedSources', view.summary.sourcesWithoutAccounting], ['duplicateSources', view.summary.duplicateAccountingSources]] as const).map(([key, count]) => <div key={key}><dt className="text-xs text-[var(--muted)]">{t(lang, key)}</dt><dd className="mt-1 font-semibold">{count ?? "—"}</dd></div>)}</dl></CardContent></Card>
    <Card><CardHeader><h2 className="font-semibold">{t(lang, "history")}</h2></CardHeader><CardContent><EinvoiceHistory events={view.events.filter(event => event.mode !== "simulation")} lang={lang} /></CardContent></Card>
    {view.jobs.length || view.connectorMode === "simulation" ? <Card><CardContent className="p-5"><details><summary className="cursor-pointer font-semibold">{lang === "ar" ? "المراقبة المتقدمة وتجارب المحاكاة" : "Suivi avancé et essais de simulation"}</summary><div className="mt-5 space-y-5"><p className="text-sm leading-6 text-[var(--muted)]">{t(lang, "simulationHint")}</p><div className="grid gap-3 sm:grid-cols-3">{([['queuePending', view.summary.pending], ['queueFailed', view.summary.failed], ['queueBlocked', view.summary.blocked]] as const).map(([key, value]) => <div key={key} className="rounded-lg border border-[var(--border)] p-3"><p className="text-sm text-[var(--muted)]">{t(lang, key)}</p><p className="mt-1 font-semibold">{value}</p></div>)}</div><p className="text-sm">{t(lang, "lastProcessing")} : {einvoiceDate(view.lastProcessingAt, lang)}</p>{canProcess ? <form action={processEinvoiceJobsAction}><EinvoiceHiddenFields lang={lang} /><EinvoiceSubmit lang={lang} variant="secondary">{t(lang, "process")}</EinvoiceSubmit></form> : null}{view.jobs.length ? <Table><thead><tr><Th>{t(lang, "number")}</Th><Th>{t(lang, "status")}</Th><Th>{t(lang, "attempts")}</Th><Th>{t(lang, "nextAttempt")}</Th><Th>{t(lang, "lastError")}</Th></tr></thead><tbody>{view.jobs.map(job => <tr key={job.id}><Td><bdi>{job.number}</bdi></Td><Td><EinvoiceStateBadge state={job.state} mode="simulation" lang={lang} /></Td><Td>{job.attempts}</Td><Td>{einvoiceDate(job.nextAttemptAt, lang)}</Td><Td><span className="block max-w-sm whitespace-normal break-words" dir="auto">{job.lastError || "—"}</span></Td></tr>)}</tbody></Table> : <p className="text-sm text-[var(--muted)]">{t(lang, "noJobs")}</p>}<EinvoiceHistory events={view.events.filter(event => event.mode === "simulation")} lang={lang} /></div></details></CardContent></Card> : null}
  </EinvoiceFrame></ModulePage>;
}
