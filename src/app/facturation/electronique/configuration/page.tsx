import Link from "next/link";
import { ExternalLink, Settings2 } from "lucide-react";
import { ModulePage } from "@/components/erp/module-page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { requireActiveWorkspace } from "@/lib/auth";
import { isAdminRole } from "@/lib/auth/roles";
import { getEinvoiceConfiguration } from "@/lib/e-invoicing/service";
import { saveEinvoiceSettingsAction, checkRegulatorySourcesAction, reviewRegulatoryChangeAction, recordBackupVerificationAction } from "@/lib/e-invoicing/actions";
import type { EinvoiceConfigurationView } from "@/lib/e-invoicing/view-types";
import { EinvoiceAvailability, EinvoiceFeedback, EinvoiceFrame, EinvoiceHiddenFields, EinvoiceIssueList, EinvoiceLoadError } from "@/components/e-invoicing/shared";
import { EinvoiceSubmit } from "@/components/e-invoicing/submit-button";
import { einvoiceDate, einvoiceLanguage, einvoiceText as t, safeEinvoiceExternalUrl, type EinvoiceTextKey } from "@/components/e-invoicing/presentation";

export const dynamic = "force-dynamic";
export const maxDuration = 60;
const path = "/facturation/electronique/configuration";
const fieldClass = "mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2.5 text-sm";
const units: [string, EinvoiceTextKey][] = [["C62", "unitC62"], ["HUR", "unitHUR"], ["DAY", "unitDAY"], ["MON", "unitMON"], ["KGM", "unitKGM"], ["LTR", "unitLTR"], ["MTR", "unitMTR"]];

export default async function EinvoiceConfigurationPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const params = await searchParams;
  let lang = einvoiceLanguage(params.lang);
  const workspace = await requireActiveWorkspace();
  if (!isAdminRole(workspace.role)) return <ModulePage><EinvoiceFrame lang={lang} path={path}><p role="alert">{t(lang, "adminOnly")}</p></EinvoiceFrame></ModulePage>;
  let view: EinvoiceConfigurationView;
  try { view = await getEinvoiceConfiguration(); }
  catch { return <ModulePage><EinvoiceLoadError lang={lang} path={path} /></ModulePage>; }
  lang = einvoiceLanguage(params.lang === "fr" || params.lang === "ar" ? params.lang : view.settings.preferredLanguage);
  const canManage = view.canAdmin && view.canWrite && view.migrationReady;
  const canConfigure = canManage && view.settings.rolloutEnabled !== false;
  const organizationEnabled = view.settings.organizationEnabled ?? view.enabled;

  return <ModulePage><EinvoiceFrame lang={lang} path={path} query={params} canAdmin={view.canAdmin} title={t(lang, "configuration")} description={t(lang, "settingsDescription")}>
    <EinvoiceFeedback lang={lang} notice={params.notice} error={params.error} />
    <EinvoiceAvailability view={view} lang={lang} />

    <Card><CardHeader><h2 className="font-semibold">{t(lang, "issuer")}</h2></CardHeader><CardContent className="space-y-4">
      <p dir="auto" className="text-sm font-medium">{view.issuerName}</p>
      <EinvoiceIssueList issues={view.issuerIssues} lang={lang} />
      <Button variant="secondary" asChild><Link href="/parametres/entreprise">{t(lang, "companySettings")}</Link></Button>
    </CardContent></Card>

    <Card><CardHeader><h2 id="einvoice-activation" className="scroll-mt-24 font-semibold">{t(lang, "activationSettings")}</h2><p className="mt-2 text-sm leading-6 text-[var(--muted)]">{t(lang, "activationDescription")}</p></CardHeader><CardContent>
      <form action={saveEinvoiceSettingsAction} className="space-y-5">
        <EinvoiceHiddenFields lang={lang} /><input type="hidden" name="expectedRevision" value={view.settings.revision ?? 0} />
        <fieldset disabled={!canConfigure} className="space-y-5 disabled:opacity-65">
          <legend className="sr-only">{t(lang, "activationSettings")}</legend>
          {organizationEnabled ? <label className="flex items-start gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] p-4 text-sm font-medium"><input type="checkbox" name="enabled" defaultChecked className="mt-1" /><span>{t(lang, "organizationEnabled")}</span></label> : <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] p-4 text-sm font-medium"><input type="hidden" name="enabled" value="on" /><p>{t(lang, "organizationEnabled")}</p></div>}
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm">{t(lang, "language")}<select name="preferredLanguage" defaultValue={view.settings.preferredLanguage} className={fieldClass}><option value="fr">Français</option><option value="ar">العربية</option></select></label>
            <label className="text-sm">{t(lang, "defaultBuyerType")}<select name="buyerType" defaultValue={view.settings.buyerType || "business"} className={fieldClass}><option value="business">{t(lang, "business")}</option><option value="consumer">{t(lang, "consumer")}</option><option value="export">{t(lang, "export")}</option></select></label>
            <label className="text-sm">{t(lang, "defaultUnitCode")}<select name="defaultUnitCode" defaultValue={view.settings.defaultUnitCode || ""} className={fieldClass}><option value="">{t(lang, "selectOnEachDocument")}</option>{units.map(([value, label]) => <option key={value} value={value}>{t(lang, label)} · {value}</option>)}</select></label>
          </div>
          <div className="space-y-3">
            <label className="flex items-center gap-2 text-sm"><input name="requireSellerRc" type="checkbox" defaultChecked={view.settings.requireSellerRc ?? false} />{t(lang, "requireRc")}</label>
            <label className="flex items-center gap-2 text-sm"><input name="alertsEnabled" type="checkbox" defaultChecked={view.settings.alertsEnabled} />{t(lang, "alerts")}</label>
          </div>

          <details className="rounded-xl border border-[var(--border)]">
            <summary className="cursor-pointer px-4 py-3 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-[var(--primary)]"><span className="ms-2 inline-flex items-center gap-2"><Settings2 aria-hidden="true" className="h-4 w-4" />{t(lang, "connectionsAdvanced")}</span></summary>
            <div className="space-y-4 border-t border-[var(--border)] p-4 text-sm">
              <label className="block max-w-lg">{t(lang, "externalConnections")}<select name="connectorMode" defaultValue={view.settings.connectorMode} className={fieldClass}><option value="disabled">{t(lang, "disabled")}</option><option value="simulation">{t(lang, "simulation")}</option></select></label>
              <p className="leading-6 text-[var(--muted)]">{t(lang, "simulationDescription")}</p>
              <dl className="space-y-4 rounded-lg bg-[var(--surface-soft)] p-4">
                <div><dt className="font-medium">{t(lang, "dgiConnection")}</dt><dd className="mt-1 leading-6 text-[var(--muted)]">{t(lang, "dgiNotConfigured")}</dd></div>
                <div><dt className="font-medium">{t(lang, "signatureStatus")}</dt><dd className="mt-1 leading-6 text-[var(--muted)]">{t(lang, "signatureNotConfigured")}</dd></div>
              </dl>
              <p className="leading-6 text-[var(--muted)]">{t(lang, "formatInfo")}</p>
            </div>
          </details>

          <EinvoiceSubmit lang={lang} disabled={!canConfigure}>{t(lang, organizationEnabled ? "save" : "activateModule")}</EinvoiceSubmit>
        </fieldset>
      </form>
    </CardContent></Card>

    <details className="rounded-xl border border-[var(--border)] bg-[var(--card)]">
      <summary className="cursor-pointer px-5 py-4 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-[var(--primary)]">{t(lang, "regulatoryAndBackup")}</summary>
      <div className="space-y-5 border-t border-[var(--border)] p-4 sm:p-5">
        <Card><CardHeader><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="font-semibold">{t(lang, "sources")}</h2>{canManage ? <form action={checkRegulatorySourcesAction}><EinvoiceHiddenFields lang={lang} /><EinvoiceSubmit lang={lang} variant="secondary">{t(lang, "checkSources")}</EinvoiceSubmit></form> : null}</div></CardHeader><CardContent className="space-y-3">
          {view.regulatorySources.map((source) => { const url = safeEinvoiceExternalUrl(source.url); return <div key={source.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[var(--border)] p-3"><div>{url ? <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-sm font-medium text-[var(--primary)]"><span dir="auto">{source.title}</span><ExternalLink className="h-3 w-3" /></a> : <p className="text-sm" dir="auto">{source.title}</p>}<p className="mt-1 text-xs text-[var(--muted)]">{source.checkedAt ? einvoiceDate(source.checkedAt, lang) : t(lang, "never")}</p></div><Badge tone={source.classification === "official" ? "info" : "warning"}>{t(lang, source.classification)}</Badge></div>; })}
        </CardContent></Card>

        <Card><CardHeader><h2 className="font-semibold">{t(lang, "changes")}</h2></CardHeader><CardContent className="space-y-4">
          <p className="text-sm leading-6 text-[var(--muted)]">{t(lang, "reviewInfo")}</p>
          {view.regulatoryChanges.length ? view.regulatoryChanges.map((change) => <div key={change.id} className="space-y-3 rounded-xl border border-[var(--border)] p-4"><p className="font-medium" dir="auto">{change.title}</p><p className="text-sm leading-6" dir="auto">{change.summary}</p><p className="text-xs text-[var(--muted)]">{einvoiceDate(change.observedAt, lang)}</p>{canManage && change.reviewStatus === "pending" ? <form action={reviewRegulatoryChangeAction} className="space-y-3"><EinvoiceHiddenFields lang={lang} /><input type="hidden" name="changeId" value={change.id} /><label className="block text-sm">{t(lang, "notes")}<textarea name="notes" required minLength={10} maxLength={2000} rows={2} className={fieldClass} /></label><select name="decision" aria-label={t(lang, "reviewed")} className={fieldClass}><option value="approved">{t(lang, "approve")}</option><option value="rejected">{t(lang, "reject")}</option></select><EinvoiceSubmit lang={lang} variant="secondary">{t(lang, "reviewed")}</EinvoiceSubmit></form> : <Badge tone={change.reviewStatus === "pending" ? "warning" : "neutral"}>{change.reviewStatus === "pending" ? (lang === "ar" ? "في انتظار المراجعة" : "En attente de revue") : change.reviewStatus === "rejected" ? (lang === "ar" ? "مستبعدة بعد المراجعة" : "Écartée après revue") : t(lang, "reviewed")}</Badge>}</div>) : <p className="text-sm text-[var(--muted)]">{t(lang, "noChanges")}</p>}
        </CardContent></Card>

        <Card><CardHeader><h2 className="font-semibold">{t(lang, "backup")}</h2></CardHeader><CardContent className="space-y-4">
          <p className="text-sm leading-6 text-[var(--muted)]">{t(lang, "backupInfo")}</p>
          {view.lastBackupVerification ? <div className="rounded-lg border border-[var(--border)] p-3 text-sm"><p>{einvoiceDate(view.lastBackupVerification.verifiedAt, lang)} · <bdi>{view.lastBackupVerification.reference}</bdi></p>{view.lastBackupVerification.notes ? <p className="mt-2 whitespace-pre-wrap" dir="auto">{view.lastBackupVerification.notes}</p> : null}</div> : <p className="text-sm text-[var(--muted)]">{t(lang, "noBackup")}</p>}
          {canManage ? <form action={recordBackupVerificationAction} className="space-y-3"><EinvoiceHiddenFields lang={lang} /><div className="grid gap-3 sm:grid-cols-2"><label className="text-sm">{t(lang, "verifiedAt")}<input name="verifiedAt" type="date" required max={new Date().toISOString().slice(0, 10)} className={fieldClass} /></label><label className="text-sm">{t(lang, "reference")}<input name="backupReference" required maxLength={500} className={fieldClass} /></label></div><label className="block text-sm">{t(lang, "notes")}<textarea name="notes" required minLength={5} maxLength={2000} rows={2} className={fieldClass} /></label><label className="flex items-start gap-2 text-sm"><input name="attested" type="checkbox" required className="mt-1" />{t(lang, "backupAttestation")}</label><EinvoiceSubmit lang={lang} variant="secondary">{t(lang, "recordBackup")}</EinvoiceSubmit></form> : null}
        </CardContent></Card>
      </div>
    </details>
  </EinvoiceFrame></ModulePage>;
}
