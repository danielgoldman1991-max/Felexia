import Link from "next/link";
import type { ReactNode } from "react";
import { AlertCircle, ArrowLeft, CheckCircle2, Settings2 } from "lucide-react";
import { PageHeader } from "@/components/erp/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { EinvoiceAccess, EinvoiceEventView, EinvoiceIssue, EinvoiceLanguage, EinvoiceListItem, EinvoiceMode } from "@/lib/e-invoicing/view-types";
import { einvoiceDate, einvoiceHref, einvoiceStateLabel, einvoiceText as t } from "./presentation";

const base = "/facturation/electronique";

export function EinvoiceFrame({ lang, path, query = {}, canAdmin = false, title, description, children }: { lang: EinvoiceLanguage; path: string; query?: Record<string, string | undefined>; canAdmin?: boolean; title?: string; description?: string; children: ReactNode }) {
  return <div lang={lang} dir={lang === "ar" ? "rtl" : "ltr"} className="min-w-0 space-y-5">
    <PageHeader title={title || t(lang, "title")} description={description ?? t(lang, "moduleDescription")} actions={<div className="flex flex-wrap items-center gap-2"><Button variant="secondary" asChild><Link href={einvoiceHref(path, lang === "ar" ? "fr" : "ar", query)} lang={lang === "ar" ? "fr" : "ar"}>{lang === "ar" ? "Français" : "العربية"}</Link></Button>{canAdmin && path === base ? <Button variant="secondary" asChild><Link href={einvoiceHref(`${base}/configuration`, lang)}><Settings2 className="h-4 w-4" />{t(lang, "configuration")}</Link></Button> : null}</div>} />
    <nav aria-label={t(lang, "title")} className="flex flex-wrap gap-2 border-b border-[var(--border)] pb-3">
      <Link href={einvoiceHref(base, lang)} aria-current={path === base ? "page" : undefined} className="rounded-lg px-3 py-2 text-sm font-medium text-[var(--primary)] hover:bg-[var(--primary-soft)]">{t(lang, "documents")}</Link>
      {canAdmin ? <><Link href={einvoiceHref(`${base}/configuration`, lang)} aria-current={path.endsWith("/configuration") ? "page" : undefined} className="rounded-lg px-3 py-2 text-sm font-medium hover:bg-[var(--surface-soft)]">{t(lang, "configuration")}</Link><Link href={einvoiceHref(`${base}/supervision`, lang)} aria-current={path.endsWith("/supervision") ? "page" : undefined} className="rounded-lg px-3 py-2 text-sm font-medium hover:bg-[var(--surface-soft)]">{t(lang, "supervision")}</Link></> : null}
    </nav>
    {children}
  </div>;
}

export function EinvoiceAvailability({ view, lang }: { view: EinvoiceAccess; lang: EinvoiceLanguage }) {
  const requestedState = view.activationState;
  const state = !view.migrationReady ? "deployment_required" : requestedState === "active" && !view.enabled ? "activation_required" : requestedState ?? (!view.enabled ? "activation_required" : !view.canWrite ? "role_readonly" : "active");
  const active = view.enabled && state === "active";
  const message = active ? t(lang, "serviceAvailable") : state === "deployment_required" ? t(lang, "deploymentRequired") : state === "activation_required" ? t(lang, view.canAdmin ? "activationRequired" : "activationAdministrator") : state === "subscription_readonly" ? t(lang, "subscriptionReadonly") : t(lang, "roleReadonly");
  return <div role="status" data-service-state={active ? "active" : state} className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--border)] p-4 text-sm leading-6 ${active ? "bg-[var(--success-soft)]" : "bg-[var(--card)]"}`}>
    <div className="flex min-w-0 items-start gap-2">{active ? <CheckCircle2 aria-hidden="true" className="mt-1 h-4 w-4 shrink-0 text-[var(--success)]" /> : <AlertCircle aria-hidden="true" className="mt-1 h-4 w-4 shrink-0 text-[var(--muted)]" />}<div>{active ? <p className="font-semibold">{t(lang, "serviceActive")}</p> : null}<p className="text-[var(--muted)]">{message}</p></div></div>
    {state === "activation_required" && view.canAdmin ? <Button variant="secondary" asChild><Link href={`${einvoiceHref(`${base}/configuration`, lang)}#einvoice-activation`}>{t(lang, "activateModule")}</Link></Button> : null}
  </div>;
}

export function EinvoiceFeedback({ lang, notice, error }: { lang: EinvoiceLanguage; notice?: string; error?: string }) {
  if (!notice && !error) return null;
  const errorCode = (error || "").toLowerCase();
  const incomplete = notice === "preparation_incomplete" || errorCode.includes("preparation_incomplete");
  const message = incomplete ? t(lang, "preparationIncomplete") : error ? /source.*chang|stale|fingerprint/.test(errorCode) ? t(lang, "sourceChanged") : /validat|invalid|incomplete/.test(errorCode) ? t(lang, "validationFailed") : /subscr|readonly|read_only|forbidden|permission/.test(errorCode) ? t(lang, "readOnly") : t(lang, "actionError") : notice === "generated" ? t(lang, "generatedDocuments") : notice === "issued" ? t(lang, "issuedAndArchived") : notice === "settings_saved" ? t(lang, "settingsSaved") : t(lang, "actionNotice");
  const problem = Boolean(error) || incomplete;
  return <p role={problem ? "alert" : "status"} className={`flex items-start gap-2 rounded-xl border p-4 text-sm leading-6 ${incomplete ? "border-[var(--border)] bg-[var(--warning-soft)]" : error ? "border-[var(--danger)] bg-[var(--danger-soft)]" : "border-[var(--border)] bg-[var(--success-soft)]"}`}>{problem ? <AlertCircle aria-hidden="true" className="mt-1 h-4 w-4 shrink-0" /> : <CheckCircle2 aria-hidden="true" className="mt-1 h-4 w-4 shrink-0" />}{message}</p>;
}

export function EinvoiceLoadError({ lang, path }: { lang: EinvoiceLanguage; path: string }) {
  return <EinvoiceFrame lang={lang} path={path}><p role="alert" className="rounded-xl border border-[var(--border)] p-5 text-sm">{t(lang, "loadError")}</p><Button variant="secondary" asChild><Link href={einvoiceHref(base, lang)}><ArrowLeft className="h-4 w-4" />{t(lang, "back")}</Link></Button></EinvoiceFrame>;
}

export function EinvoiceStateBadge({ state, mode, lang }: { state: string; mode: EinvoiceMode; lang: EinvoiceLanguage }) {
  const tone = ["rejected", "failed", "blocked"].includes(state) ? "danger" : ["validated", "issued", "ready", "ready_to_submit", "completed", "succeeded", "accepted"].includes(state) ? "success" : "neutral";
  return <Badge tone={mode === "simulation" ? "warning" : tone}>{mode === "simulation" ? `${t(lang, "simulation")} · ` : ""}{einvoiceStateLabel(state, lang)}</Badge>;
}

export function EinvoiceHiddenFields({ source, lang, versionId }: { source?: EinvoiceListItem | null; lang: EinvoiceLanguage; versionId?: string | null }) {
  return <><input type="hidden" name="lang" value={lang} />{source ? <><input type="hidden" name="sourceKind" value={source.sourceKind} /><input type="hidden" name="sourceId" value={source.sourceId} /><input type="hidden" name="documentId" value={source.documentId || ""} /><input type="hidden" name="versionId" value={versionId || source.latestVersionId || ""} /></> : null}</>;
}

export function EinvoiceIssueList({ issues, lang }: { issues: EinvoiceIssue[]; lang: EinvoiceLanguage }) {
  const partyLabel = (field?: string) => field?.startsWith("seller.") ? (lang === "ar" ? "المُصدر: " : "Émetteur : ") : field?.startsWith("buyer.") ? (lang === "ar" ? "العميل: " : "Client : ") : "";
  return <div className="space-y-3">{issues.length ? <ul className="space-y-2">{issues.map((issue, index) => <li key={`${issue.code}-${index}`} className="flex items-start gap-2 rounded-lg border border-[var(--border)] p-3 text-sm leading-6"><Badge tone={issue.severity === "error" ? "danger" : "warning"}>{issue.severity === "error" ? "!" : "·"}</Badge><span dir="auto">{partyLabel(issue.field)}{lang === "ar" && issue.messageAr ? issue.messageAr : issue.message}</span></li>)}</ul> : <p className="rounded-lg border border-[var(--border)] p-3 text-sm">{t(lang, "noIssues")}</p>}</div>;
}

export function EinvoiceHistory({ events, lang }: { events: EinvoiceEventView[]; lang: EinvoiceLanguage }) {
  return events.length ? <ol className="space-y-3">{events.map((event) => <li key={event.id} className="rounded-lg border border-[var(--border)] p-3"><div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-medium" dir="auto">{event.mode === "simulation" ? `${t(lang, "simulation")} · ` : ""}{lang === "ar" && event.labelAr ? event.labelAr : event.label}</p><time className="text-xs text-[var(--muted)]" dateTime={event.createdAt}>{einvoiceDate(event.createdAt, lang)}</time></div>{event.detail ? <p className="mt-2 break-words text-sm text-[var(--muted)]" dir="auto">{lang === "ar" && event.detailAr ? event.detailAr : event.detail}</p> : null}</li>)}</ol> : <p className="text-sm text-[var(--muted)]">{t(lang, "noHistory")}</p>;
}
