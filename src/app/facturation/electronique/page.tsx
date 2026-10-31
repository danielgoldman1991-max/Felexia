import Link from "next/link";
import { ArrowUpRight, FileText } from "lucide-react";
import { ModulePage } from "@/components/erp/module-page";
import { EmptyState } from "@/components/erp/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, Td, Th } from "@/components/ui/table";
import { getEinvoiceDashboard } from "@/lib/e-invoicing/service";
import type { EinvoiceDashboardView, EinvoiceSourceKind } from "@/lib/e-invoicing/view-types";
import { positivePage } from "@/lib/listing";
import { EinvoiceAvailability, EinvoiceFeedback, EinvoiceFrame, EinvoiceLoadError, EinvoiceStateBadge } from "@/components/e-invoicing/shared";
import { einvoiceDate, einvoiceDetailPath, einvoiceHref, einvoiceLanguage, einvoiceMoney, einvoiceText as t } from "@/components/e-invoicing/presentation";

export const dynamic = "force-dynamic";
const path = "/facturation/electronique";

export default async function EinvoiceDashboardPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const params = await searchParams;
  let lang = einvoiceLanguage(params.lang);
  let view: EinvoiceDashboardView;
  try { view = await getEinvoiceDashboard({ query: params.q, status: params.status, sourceKind: ["invoice", "credit_note"].includes(params.kind || "") ? params.kind as EinvoiceSourceKind : undefined, page: positivePage(params.page) }); }
  catch { return <ModulePage><EinvoiceLoadError lang={lang} path={path} /></ModulePage>; }
  lang = einvoiceLanguage(params.lang === "fr" || params.lang === "ar" ? params.lang : view.preferredLanguage);
  return <ModulePage><EinvoiceFrame lang={lang} path={path} query={params} canAdmin={view.canAdmin}>
    <EinvoiceFeedback lang={lang} notice={params.notice} error={params.error} />
    <EinvoiceAvailability view={view} lang={lang} />
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{([['total', view.summary.total], ['prepared', view.summary.prepared], ['attention', view.summary.attention], ['ready', view.summary.ready]] as const).map(([key, count]) => <Card key={key}><CardContent className="p-4"><p className="text-sm text-[var(--muted)]">{t(lang, key)}</p><p className="mt-2 text-2xl font-semibold tabular-nums">{count}</p></CardContent></Card>)}</div>
    <form method="get" className="flex flex-wrap gap-3 rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
      <input type="hidden" name="lang" value={lang} /><input name="q" defaultValue={params.q || ""} placeholder={t(lang, "searchPlaceholder")} aria-label={t(lang, "search")} className="min-w-40 flex-1 rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm" />
      <select name="kind" defaultValue={params.kind || ""} aria-label={t(lang, "allKinds")} className="max-w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm"><option value="">{t(lang, "allKinds")}</option><option value="invoice">{t(lang, "invoice")}</option><option value="credit_note">{t(lang, "credit_note")}</option></select>
      <select name="status" defaultValue={params.status || ""} aria-label={t(lang, "status")} className="max-w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm"><option value="">{t(lang, "allStates")}</option><option value="unprepared">{lang === "ar" ? "للإعداد" : "À préparer"}</option><option value="prepared">{t(lang, "prepared")}</option><option value="ready">{t(lang, "ready")}</option><option value="rejected">{t(lang, "attention")}</option></select><Button type="submit" variant="secondary">{t(lang, "search")}</Button>
    </form>
    {view.rows.length ? <Card><CardContent className="p-0"><Table><thead><tr><Th>{t(lang, "number")}</Th><Th>{t(lang, "date")}</Th><Th>{t(lang, "buyer")}</Th><Th>{t(lang, "amount")}</Th><Th>{t(lang, "status")}</Th><Th>{t(lang, "issues")}</Th><Th>{t(lang, "open")}</Th></tr></thead><tbody>{view.rows.map((row) => <tr key={`${row.sourceKind}:${row.sourceId}`}><Td><Link href={einvoiceHref(einvoiceDetailPath(row.sourceKind, row.sourceId), lang)} className="font-semibold text-[var(--primary)]"><bdi>{row.number}</bdi></Link><p className="mt-1 text-xs text-[var(--muted)]">{t(lang, row.sourceKind)}</p></Td><Td>{einvoiceDate(row.issueDate, lang)}</Td><Td><bdi>{row.buyerName}</bdi></Td><Td><bdi>{einvoiceMoney(row.totalTtc, row.currency)}</bdi></Td><Td><EinvoiceStateBadge state={row.status} mode={row.mode} lang={lang} /></Td><Td>{row.issueCount || "—"}</Td><Td><Button variant="ghost" asChild><Link href={einvoiceHref(einvoiceDetailPath(row.sourceKind, row.sourceId), lang)} aria-label={`${t(lang, "open")} ${row.number}`}><ArrowUpRight className="h-4 w-4" /></Link></Button></Td></tr>)}</tbody></Table></CardContent></Card> : <EmptyState title={t(lang, "empty")} description={t(lang, "emptyDescription")} icon={<FileText className="h-6 w-6" />} action={<Button variant="secondary" asChild><Link href="/facturation/factures">{t(lang, "sales")}</Link></Button>} />}
    <nav aria-label={t(lang, "page")} className="flex flex-wrap items-center justify-between gap-3 text-sm"><p>{view.total} {t(lang, "results")} · {t(lang, "page")} {view.page} / {view.totalPages}</p><div className="flex gap-2">{view.page > 1 ? <Button variant="secondary" asChild><Link href={einvoiceHref(path, lang, { ...params, page: String(view.page - 1) })}>{t(lang, "previous")}</Link></Button> : null}{view.page < view.totalPages ? <Button variant="secondary" asChild><Link href={einvoiceHref(path, lang, { ...params, page: String(view.page + 1) })}>{t(lang, "next")}</Link></Button> : null}</div></nav>
  </EinvoiceFrame></ModulePage>;
}
