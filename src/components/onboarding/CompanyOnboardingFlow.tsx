"use client";

import { useState } from "react";
import { CompanyConfirmationForm } from "@/components/onboarding/CompanyConfirmationForm";
import { CompanyLookupStep } from "@/components/onboarding/CompanyLookupStep";
import type { CompanyOnboardingPrefill } from "@/lib/company-lookup/types";

type Step = "lookup" | "confirmation";

export function CompanyOnboardingFlow({
  initialEmail,
  initialFirstName,
  initialLastName,
  initialAvatarUrl,
}: {
  initialEmail: string;
  initialFirstName?: string;
  initialLastName?: string;
  initialAvatarUrl?: string | null;
}) {
  const [step, setStep] = useState<Step>("lookup");
  const [prefill, setPrefill] = useState<CompanyOnboardingPrefill | null>(null);

  return step === "lookup" ? (
    <CompanyLookupStep
      onConfirm={(payload) => {
        setPrefill(payload.result);
        setStep("confirmation");
      }}
      onManual={(payload) => {
        setPrefill(payload?.result ?? null);
        setStep("confirmation");
      }}
    />
  ) : (
    <CompanyConfirmationForm
      initialEmail={initialEmail}
      initialFirstName={initialFirstName}
      initialLastName={initialLastName}
      initialAvatarUrl={initialAvatarUrl}
      prefill={prefill}
      onBack={() => setStep("lookup")}
    />
  );
}
