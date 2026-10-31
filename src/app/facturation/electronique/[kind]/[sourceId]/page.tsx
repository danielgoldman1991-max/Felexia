import Link from "next/link";
import { randomUUID } from "node:crypto";
import { notFound } from "next/navigation";
import { Download, ExternalLink, FileText } from "lucide-react";
import { ModulePage } from "@/components/erp/module-page";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getEinvoiceDetail } from "@/lib/e-invoicing/service";
import { validateEinvoiceAction, issueEinvoiceAction, readyEinvoiceAction, simulateEinvoiceAction, checkEinvoiceIntegrityAction } from "@/lib/e-invoicing/actions";
import type { EinvoiceDetailView } from "@/lib/e-invoicing/view-types";
import { EinvoicePreparationForm } from "@/components/e-invoicing/preparation-form";
import { EinvoiceSubmit } from "@/components/e-invoicing/submit-button";
import { EinvoiceOperationForm } from "@/components/e-invoicing/operation-form";
import { EinvoiceAvailability, EinvoiceFeedback, EinvoiceFrame, EinvoiceHiddenFields, EinvoiceHistory, EinvoiceIssueList, EinvoiceLoadError, EinvoiceStateBadge } from "@/components/e-invoicing/shared";
import { einvoiceDate, einvoiceDetailPath, einvoiceHref, einvoiceLanguage, einvoiceMoney, einvoiceSourcePath, einvoiceStateLabel, einvoiceText as t } from "@/components/e-invoicing/presentation";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export default async function EinvoiceDetailPage({ params, searchParams }: { params: Promise<{ kind: string; sourceId: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const [{ kind, sourceId }, query] = await Promise.all([params, searchParams]);
  if (!["factures", "avoirs"].includes(kind) || !/^[0-9a-f-]{36}$/i.test(sourceId)) notFound();
  const sourceKind = kind === "factures" ? "invoice" : "credit_note";
  let lang = einvoiceLanguage(query.lang);
  const path = einvoiceDetailPath(sourceKind, sourceId);
  let view: EinvoiceDetailView;
  try { view = await getEinvoiceDetail(sourceKind, sourceId); }
  catch { return <ModulePage><EinvoiceLoadError lang={lang} path={path} /></ModulePage>; }
  lang = einvoiceLanguage(query.lang === "fr" || query.lang === "ar" ? query.lang : view.preferredLanguage);
  if (!view.source) {
    if (!view.migrationReady) return <ModulePage><EinvoiceFrame lang={lang} path={path} canAdmin={view.canAdmin}><EinvoiceAvailability view={view} lang={lang} /></EinvoiceFrame></ModulePage>;
    notFound();
  }
  const source = view.source;
  const canAct = view.enabled && view.migrationReady && view.canWrite;
  const actions = [
    [view.capabilities.canValidate, validateEinvoiceAction, "check"], [view.capabilities.canIssue, issueEinvoiceAction, "issue"], [view.capabilities.canMarkReady, readyEinvoiceAction, "markReady"],
    [view.capabilities.canCheckIntegrity, checkEinvoiceIntegrityAction, "integrity"],
  ] as const;
  return <ModulePage><EinvoiceFrame lang={lang} path={path} query={query} canAdmin={view.canAdmin} title={`${t(lang, source.sourceKind)} ${source.number}`}>
    <EinvoiceFeedback lang={lang} notice={query.notice} error={query.error} /><EinvoiceAvailability view={view} lang={lang} />
    <Card><CardContent className="space-y-4 p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-semibold" dir="auto">{source.buyerName}</p><p className="mt-1 text-sm text-[var(--muted)]">{einvoiceDate(source.issueDate, lang)} · <bdi>{einvoiceMoney(source.totalTtc, source.currency)}</bdi></p></div><EinvoiceStateBadge state={source.status} mode={source.mode} lang={lang} /></div><p className="text-sm text-[var(--muted)]">{t(lang, "sourceState")} : {einvoiceStateLabel(source.sourceStatus, lang)}</p><div className="flex flex-wrap gap-2"><Button variant="secondary" asChild><Link href={einvoiceSourcePath(source.sourceKind, source.sourceId)}><ExternalLink className="h-4 w-4" />{t(lang, "source")}</Link></Button>{canAct ? actions.map(([allowed, action, label]) => { if (!allowed) return null; const content = <><EinvoiceHiddenFields source={source} lang={lang} /><EinvoiceSubmit lang={lang} variant="secondary">{t(lang, label)}</EinvoiceSubmit></>; return label === "issue" ? <EinvoiceOperationForm key={label} action={action} confirmation={t(lang, "confirmIssue")}>{content}</EinvoiceOperationForm> : <form key={label} action={action}>{content}</form>; }) : null}</div></CardContent></Card>
    {canAct && view.canAdmin && view.capabilities.canSimulate ? <Card><CardContent className="p-5"><form action={simulateEinvoiceAction} className="flex flex-wrap items-end gap-4">
      <EinvoiceHiddenFields source={source} lang={lang} /><input type="hidden" name="idempotencyKey" value={randomUUID()} />
      <label className="grid min-w-0 flex-1 gap-2 text-sm font-medium"><span>{t(lang, "simulationScenario")}</span><select name="scenario" defaultValue="accept" className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5" aria-describedby="einvoice-simulation-hint">
        <option value="accept">{t(lang, "simulationAccept")}</option><option value="reject">{t(lang, "simulationReject")}</option><option value="timeout">{t(lang, "simulationTimeout")}</option><option value="unavailable">{t(lang, "simulationUnavailable")}</option>
      </select></label><EinvoiceSubmit lang={lang} variant="secondary">{t(lang, "simulate")}</EinvoiceSubmit>
      <p id="einvoice-simulation-hint" className="w-full text-sm text-[var(--muted)]">{t(lang, "simulationHint")}</p>
    </form></CardContent></Card> : null}
    <Card><CardHeader><h2 className="font-semibold">{t(lang, "validation")}</h2></CardHeader><CardContent><EinvoiceIssueList issues={view.issues} lang={lang} /></CardContent></Card>
    {canAct && view.capabilities.canPrepare ? <Card><CardHeader><h2 className="font-semibold">{t(lang, "prepare")}</h2></CardHeader><CardContent><EinvoicePreparationForm key={source.latestVersionId || source.sourceId} source={source} buyerType={view.buyerType} lines={view.lines} lang={lang} idempotencyKey={randomUUID()} /></CardContent></Card> : null}
    <Card><CardHeader><h2 className="font-semibold">{t(lang, "versions")}</h2></CardHeader><CardContent className="space-y-3">{view.versions.length ? view.versions.map((version) => {
      const download = (format: "pdf" | "xml", inline = false) => `${path}/download?${new URLSearchParams({ format, version: version.id, lang, ...(inline ? { inline: "1" } : {}) })}`;
      return <div key={version.id} className="space-y-3 rounded-xl border border-[var(--border)] p-4"><div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-semibold">{t(lang, "version")} {version.sequence} · {einvoiceDate(version.createdAt, lang)}</p><Badge tone={version.integrity === "failed" ? "danger" : version.integrity === "verified" ? "success" : "neutral"}>{t(lang, version.integrity)}</Badge></div><p className="text-sm">{einvoiceStateLabel(version.status, lang)}</p><details className="text-xs text-[var(--muted)]"><summary className="cursor-pointer">{t(lang, "hash")}</summary><code className="mt-2 block break-all" dir="ltr">{version.snapshotHash}</code></details><div className="flex flex-wrap gap-2">{version.pdfAvailable ? <Button variant="secondary" asChild><a href={download("pdf", true)} target="_blank" rel="noopener noreferrer"><FileText className="h-4 w-4" />{t(lang, "preview")}</a></Button> : null}{version.xmlAvailable ? <Button variant="secondary" asChild><a href={download("xml")}><Download className="h-4 w-4" />{t(lang, "xml")}</a></Button> : null}</div></div>;
    }) : <p className="text-sm text-[var(--muted)]">{t(lang, "noVersions")}</p>}</CardContent></Card>
    <Card><CardHeader><h2 className="font-semibold">{t(lang, "history")}</h2></CardHeader><CardContent><EinvoiceHistory events={view.events} lang={lang} /></CardContent></Card>
    <Button variant="secondary" asChild><Link href={einvoiceHref("/facturation/electronique", lang)}>{t(lang, "back")}</Link></Button>
  </EinvoiceFrame></ModulePage>;
}
