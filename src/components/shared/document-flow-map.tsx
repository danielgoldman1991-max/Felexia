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
          ? "border-indigo-200 bg-indigo-50 text-indigo-700 shadow-sm"
          : "border-slate-200 bg-white text-slate-700",
        step.href && !step.isCurrent ? "hover:border-slate-300 hover:bg-slate-50" : "",
      ].join(" ")}
    >
      {renderIcon(step.type)}
      <span className="min-w-0">
        <span className="block text-[11px] font-medium uppercase tracking-wide text-slate-500">{step.label}</span>
        <span className="block truncate text-sm font-semibold">{step.number}</span>
        {step.status ? <span className="block truncate text-[11px] text-slate-500">{step.status}</span> : null}
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
    <section className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
        <span className="text-xs text-slate-500">Traçabilité</span>
      </div>
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {visibleSteps.map((step, index) => (
          <div key={`${step.type ?? "document"}-${step.href ?? step.number}-${index}`} className="flex shrink-0 items-center gap-2">
            <StepPill step={step} />
            {index < visibleSteps.length - 1 ? <ArrowRight className="h-4 w-4 shrink-0 text-slate-400" /> : null}
          </div>
        ))}
      </div>
    </section>
  );
}
