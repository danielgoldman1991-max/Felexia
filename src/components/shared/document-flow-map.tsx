"use client";

import Link from "next/link";
import { ArrowRight, BookOpenCheck, FileText, Receipt, RotateCcw, ShoppingCart, Truck } from "lucide-react";
import type { DocumentFlowStep } from "@/lib/document-flow-types";

type DocumentFlowMapProps = {
  title?: string;
  steps: DocumentFlowStep[];
};

function iconForType(type?: string) {
  switch (type) {
    case "order":
    case "supplier_order":
      return ShoppingCart;
    case "delivery_note":
    case "supplier_receipt":
      return Truck;
    case "return_note":
    case "credit_note":
      return RotateCcw;
    case "customer_invoice":
    case "supplier_invoice":
      return Receipt;
    case "accounting_entry":
      return BookOpenCheck;
    default:
      return FileText;
  }
}

function renderIcon(type?: string) {
  const className = "h-4 w-4 shrink-0";
  switch (iconForType(type)) {
    case ShoppingCart:
      return <ShoppingCart className={className} />;
    case Truck:
      return <Truck className={className} />;
    case RotateCcw:
      return <RotateCcw className={className} />;
    case Receipt:
      return <Receipt className={className} />;
    case BookOpenCheck:
      return <BookOpenCheck className={className} />;
    default:
      return <FileText className={className} />;
  }
}

function StepPill({ step }: { step: DocumentFlowStep }) {
  const content = (
    <span
      className={[
        "inline-flex min-w-[132px] items-center gap-2 rounded-xl border px-3 py-2 text-left transition",
        step.isCurrent
          ? "border-[#D6B56D]/30 bg-[#D6B56D]/12 text-[#D6B56D] shadow-sm"
          : "border-white/10 bg-white/[0.04] text-[var(--foreground)]/80",
        step.href && !step.isCurrent ? "hover:border-white/18 hover:bg-white/[0.07]" : "",
      ].join(" ")}
    >
      {renderIcon(step.type)}
      <span className="min-w-0">
        <span className="block text-[11px] font-medium uppercase tracking-[0.14em] text-[var(--muted)]">{step.label}</span>
        <span className="block truncate text-sm font-semibold">{step.number}</span>
        {step.status ? <span className="block truncate text-[11px] text-[var(--muted)]">{step.status}</span> : null}
      </span>
    </span>
  );

  if (step.href && !step.isCurrent) {
    return <Link href={step.href}>{content}</Link>;
  }

  return content;
}

export function DocumentFlowMap({ title = "Flux documentaire", steps }: DocumentFlowMapProps) {
  const visibleSteps = steps.filter((step) => step.number);
  if (visibleSteps.length === 0) return null;

  return (
    <section className="premium-card rounded-[var(--radius-lg)] p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-white">{title}</h2>
        <span className="text-xs text-[var(--muted)]">Traçabilité</span>
      </div>
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {visibleSteps.map((step, index) => (
          <div key={`${step.type ?? "document"}-${step.href ?? step.number}-${index}`} className="flex shrink-0 items-center gap-2">
            <StepPill step={step} />
            {index < visibleSteps.length - 1 ? <ArrowRight className="h-4 w-4 shrink-0 text-[#D6B56D]/50" /> : null}
          </div>
        ))}
      </div>
    </section>
  );
}
