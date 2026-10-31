"use client";

import { useState } from "react";
import type { EinvoiceBuyerType, EinvoiceLanguage, EinvoiceListItem, EinvoicePreparationLine, EinvoiceTaxCategory } from "@/lib/e-invoicing/view-types";
import { prepareEinvoiceAction } from "@/lib/e-invoicing/actions";
import { EinvoiceSubmit } from "./submit-button";
import { einvoicePositiveRate, einvoiceText as t, type EinvoiceTextKey } from "./presentation";

const units: [string, EinvoiceTextKey][] = [["C62", "unitC62"], ["HUR", "unitHUR"], ["DAY", "unitDAY"], ["MON", "unitMON"], ["KGM", "unitKGM"], ["LTR", "unitLTR"], ["MTR", "unitMTR"]];
const categories: [EinvoiceTaxCategory, EinvoiceTextKey][] = [["S", "taxS"], ["Z", "taxZ"], ["E", "taxE"], ["O", "taxO"]];
const fieldClass = "mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm";

export function EinvoicePreparationForm({ source, buyerType, lines, lang, idempotencyKey }: { source: Pick<EinvoiceListItem, "sourceKind" | "sourceId" | "documentId" | "latestVersionId">; buyerType: EinvoiceBuyerType | null; lines: EinvoicePreparationLine[]; lang: EinvoiceLanguage; idempotencyKey: string }) {
  const [requestKey] = useState(idempotencyKey);
  const [metadata, setMetadata] = useState(() => lines.map((line) => ({ sourceLineId: line.sourceLineId, unitCode: line.unitCode || "", taxCategory: einvoicePositiveRate(line.taxRate) ? "S" : line.taxCategory && line.taxCategory !== "S" ? line.taxCategory : "", exemptionReason: line.exemptionReason || "" })));
  const update = (index: number, key: "unitCode" | "taxCategory" | "exemptionReason", value: string) => setMetadata((current) => current.map((line, i) => i === index ? { ...line, [key]: value } : line));
  return <form action={prepareEinvoiceAction} className="space-y-4">
    <input type="hidden" name="lang" value={lang} /><input type="hidden" name="sourceKind" value={source.sourceKind} /><input type="hidden" name="sourceId" value={source.sourceId} /><input type="hidden" name="documentId" value={source.documentId || ""} /><input type="hidden" name="versionId" value={source.latestVersionId || ""} /><input type="hidden" name="lineMetadata" value={JSON.stringify(metadata)} />
    <input type="hidden" name="idempotencyKey" value={requestKey} />
    <p className="text-sm leading-6 text-[var(--muted)]">{t(lang, "preparationInfo")}</p>
    <label className="block max-w-sm text-sm font-medium">{t(lang, "buyerType")}<select name="buyerType" defaultValue={buyerType || ""} required className={fieldClass}><option value="">{t(lang, "choose")}</option><option value="business">{t(lang, "business")}</option><option value="consumer">{t(lang, "consumer")}</option><option value="export">{t(lang, "export")}</option></select></label>
    {lines.some(line => !einvoicePositiveRate(line.taxRate)) ? <p className="rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] p-3 text-sm leading-6">{t(lang, "zeroTax")}</p> : null}
    {lines.map((line, index) => <fieldset key={line.sourceLineId} className="min-w-0 rounded-xl border border-[var(--border)] p-4"><legend className="max-w-full px-2 text-sm font-semibold"><span dir="auto">{index + 1}. {line.description}</span></legend><p className="mb-3 text-xs text-[var(--muted)]">{t(lang, "quantity")} : <bdi>{line.quantity}</bdi> · {t(lang, "taxRate")} : <bdi>{line.taxRate} %</bdi></p><div className="grid gap-3 sm:grid-cols-2">
      <label className="text-sm">{t(lang, "unit")}<select required value={metadata[index].unitCode} onChange={(event) => update(index, "unitCode", event.target.value)} className={fieldClass}><option value="">{t(lang, "choose")}</option>{line.unitCode && !units.some(([value]) => value === line.unitCode) ? <option value={line.unitCode}>{line.unitCode}</option> : null}{units.map(([value, key]) => <option key={value} value={value}>{t(lang, key)} · {value}</option>)}</select></label>
      <label className="text-sm">{t(lang, "taxCategory")}<select required disabled={einvoicePositiveRate(line.taxRate)} value={metadata[index].taxCategory} onChange={(event) => update(index, "taxCategory", event.target.value)} className={`${fieldClass} disabled:bg-[var(--surface-soft)]`}><option value="">{t(lang, "choose")}</option>{categories.filter(([value]) => einvoicePositiveRate(line.taxRate) ? value === "S" : value !== "S").map(([value, key]) => <option key={value} value={value}>{t(lang, key)}</option>)}</select></label>
      {["Z", "E", "O"].includes(metadata[index].taxCategory) ? <label className="text-sm sm:col-span-2">{t(lang, "exemption")}<input required maxLength={500} value={metadata[index].exemptionReason} onChange={(event) => update(index, "exemptionReason", event.target.value)} className={fieldClass} /></label> : null}
    </div></fieldset>)}
    <EinvoiceSubmit lang={lang}>{t(lang, "submitPreparation")}</EinvoiceSubmit>
  </form>;
}
