"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, ExternalLink, Filter, Info, RefreshCw, Search, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { DgiVatValidationIssue, DgiVatSeverity } from "@/lib/tax/dgi-vat-types";
import { buildDgiVatCorrectionLink, appendReturnTo } from "@/lib/tax/dgi-vat-correction-links";

function severityTone(severity: DgiVatSeverity) {
  if (severity === "blocking") return "danger" as const;
  if (severity === "warning") return "warning" as const;
  return "info" as const;
}

function severityLabel(severity: DgiVatSeverity) {
  if (severity === "blocking") return "Bloquant";
  if (severity === "warning") return "Warning";
  return "Info";
}

function severityIcon(severity: DgiVatSeverity) {
  if (severity === "blocking") return <XCircle className="h-4 w-4 text-red-500" />;
  if (severity === "warning") return <AlertTriangle className="h-4 w-4 text-amber-500" />;
  return <Info className="h-4 w-4 text-blue-500" />;
}

function sourceGroup(source?: string | null) {
  if (!source) return "autre";
  if (["customer", "sales", "customer_invoice", "customer_payment", "sales_document"].includes(source)) return "ventes";
  if (["supplier", "purchase", "supplier_invoice", "supplier_payment", "purchase_document"].includes(source)) return "achats";
  if (["accounting", "accounting_entry"].includes(source)) return "comptabilite";
  if (["tax_rate"].includes(source)) return "tva";
  if (["organization"].includes(source)) return "organisation";
  return "autre";
}

export function DgiExportValidationPanel({
  issues,
  returnTo,
}: {
  issues: DgiVatValidationIssue[];
  returnTo?: string;
}) {
  const [search, setSearch] = useState("");
  const [severityFilter, setSeverityFilter] = useState<DgiVatSeverity | "all">("all");
  const [groupFilter, setGroupFilter] = useState<string>("all");

  const blocking = issues.filter((i) => i.severity === "blocking").length;
  const warnings = issues.filter((i) => i.severity === "warning").length;
  const infos = issues.filter((i) => i.severity === "info").length;

  const filtered = useMemo(() => {
    return issues.filter((issue) => {
      if (severityFilter !== "all" && issue.severity !== severityFilter) return false;
      if (groupFilter !== "all" && sourceGroup(issue.source) !== groupFilter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const haystack = [
          issue.code,
          issue.message,
          issue.documentNumber,
          issue.thirdPartyName,
          issue.suggestedFix,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [issues, severityFilter, groupFilter, search]);

  const groupCounts = useMemo(() => {
    const counts: Record<string, number> = { all: issues.length };
    for (const issue of issues) {
      const g = sourceGroup(issue.source);
      counts[g] = (counts[g] ?? 0) + 1;
    }
    return counts;
  }, [issues]);

  const severityCounts = {
    all: issues.length,
    blocking,
    warning: warnings,
    info: infos,
  };

  const recontrôlerUrl = returnTo
    ? returnTo
    : "/comptabilite/tva/exports";

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold text-[var(--foreground)]">Contrôles de cohérence</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Pré-contrôles fiscaux avant génération du XML préparatoire.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {blocking > 0 && (
              <Badge tone="danger">{blocking} bloquant{blocking > 1 ? "s" : ""}</Badge>
            )}
            {warnings > 0 && (
              <Badge tone="warning">{warnings} warning{warnings > 1 ? "s" : ""}</Badge>
            )}
            {infos > 0 && (
              <Badge tone="info">{infos} info</Badge>
            )}
            {blocking === 0 && warnings === 0 && infos === 0 && (
              <Badge tone="success">Contrôlé</Badge>
            )}
          </div>
        </div>

        {/* Filters */}
        {issues.length > 0 && (
          <div className="mt-4 flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative flex-1 min-w-[180px]">
                <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted)]" />
                <Input
                  placeholder="Rechercher code, pièce, tiers..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Link
                href={recontrôlerUrl}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-[var(--radius-md)] border border-[var(--border)] bg-white px-4 text-sm font-medium text-[var(--secondary)] shadow-[var(--shadow-sm)] transition-all hover:border-[#c8d0e1] hover:bg-[var(--surface-soft)]"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Relancer les contrôles
              </Link>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Filter className="h-3.5 w-3.5 text-[var(--muted)]" />
              {(["all", "blocking", "warning", "info"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setSeverityFilter(s)}
                  className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                    severityFilter === s
                      ? s === "blocking"
                        ? "bg-red-100 text-red-700"
                        : s === "warning"
                          ? "bg-amber-100 text-amber-700"
                          : s === "info"
                            ? "bg-blue-100 text-blue-700"
                            : "bg-slate-100 text-slate-700"
                      : "bg-transparent text-[var(--muted)] hover:bg-slate-50"
                  }`}
                >
                  {s === "all" ? "Toutes" : severityLabel(s)} ({severityCounts[s]})
                </button>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {(["all", "ventes", "achats", "comptabilite", "tva", "organisation", "autre"] as const).map((g) => {
                const count = groupCounts[g] ?? 0;
                if (count === 0 && g !== "all") return null;
                const labels: Record<string, string> = {
                  all: "Tous",
                  ventes: "Ventes",
                  achats: "Achats",
                  comptabilite: "Comptabilité",
                  tva: "TVA",
                  organisation: "Organisation",
                  autre: "Autre",
                };
                return (
                  <button
                    key={g}
                    onClick={() => setGroupFilter(g)}
                    className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                      groupFilter === g
                        ? "bg-slate-100 text-slate-700"
                        : "bg-transparent text-[var(--muted)] hover:bg-slate-50"
                    }`}
                  >
                    {labels[g]} ({count})
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </CardHeader>

      <CardContent className="space-y-3">
        {filtered.length === 0 && issues.length === 0 ? (
          <div className="flex items-start gap-3 rounded-[var(--radius-md)] border border-emerald-100 bg-emerald-50 p-4 text-sm text-emerald-900">
            <CheckCircle2 className="mt-0.5 h-4 w-4" />
            Aucun contrôle bloquant détecté sur la période.
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-[var(--radius-md)] border border-slate-100 bg-slate-50 p-4 text-sm text-[var(--muted)]">
            Aucune anomalie ne correspond aux filtres actifs.
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((issue) => (
              <ValidationIssueRow key={`${issue.code}-${issue.sourceId ?? ""}-${issue.documentNumber ?? ""}`} issue={issue} returnTo={returnTo} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ValidationIssueRow({ issue, returnTo }: { issue: DgiVatValidationIssue; returnTo?: string }) {
  const { href, label } = buildDgiVatCorrectionLink(issue);
  const linkHref = returnTo && href ? appendReturnTo(href, returnTo) : href;

  return (
    <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-white p-4">
      {/* Header row: icon + severity + code + document number + action */}
      <div className="flex flex-wrap items-start gap-2">
        {severityIcon(issue.severity)}
        <Badge tone={severityTone(issue.severity)}>
          {severityLabel(issue.severity)}
        </Badge>
        <span className="mt-0.5 font-mono text-xs text-[var(--muted)]">{issue.code}</span>

        {issue.documentNumber ? (
          linkHref ? (
            <Link
              href={linkHref}
              className="mt-0.5 inline-flex items-center gap-1 text-xs font-medium text-[var(--primary)] hover:underline"
            >
              {issue.documentNumber}
              <ExternalLink className="h-3 w-3" />
            </Link>
          ) : (
            <span className="mt-0.5 text-xs text-[var(--muted)]">{issue.documentNumber}</span>
          )
        ) : null}
      </div>

      {/* Message */}
      <p className="mt-2 text-sm font-medium text-[var(--foreground)]">{issue.message}</p>

      {/* Context: third party */}
      {issue.thirdPartyName ? (
        <p className="mt-1 text-xs text-[var(--muted)]">
          Tiers : <span className="font-medium text-[var(--foreground)]">{issue.thirdPartyName}</span>
        </p>
      ) : null}

      {/* Suggested fix */}
      {issue.suggestedFix ? (
        <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
          <span className="font-medium">Correction suggérée :</span> {issue.suggestedFix}
        </p>
      ) : null}

      {/* Action buttons */}
      {linkHref && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Link
            href={linkHref}
            className="inline-flex h-9 items-center justify-center gap-2 rounded-[var(--radius-md)] border border-[var(--border)] bg-white px-3 text-sm font-medium text-[var(--secondary)] shadow-[var(--shadow-sm)] transition-all hover:border-[#c8d0e1] hover:bg-[var(--surface-soft)]"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            {label}
          </Link>
          {issue.thirdPartyId && issue.source !== "customer" && issue.source !== "supplier" && (
            <Link
              href={appendReturnTo(`/tiers/${issue.thirdPartyId}/edit`, returnTo ?? "") ?? `/tiers/${issue.thirdPartyId}/edit`}
              className="inline-flex h-9 items-center justify-center gap-2 rounded-[var(--radius-md)] px-3 text-sm font-medium text-[var(--muted)] transition-all hover:bg-[var(--primary-soft)] hover:text-[var(--secondary)]"
            >
              Corriger le tiers
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
