"use client";

import { useState, useActionState, startTransition } from "react";
import { ModuleSelector, PriceSummary } from "@/components/pricing/module-selector";
import type { ModuleInfo } from "@/lib/saas";
import { startTrialAction } from "@/lib/actions/start-trial";

export function OnboardingModulesClient({
  modules,
  organizationId,
}: {
  modules: ModuleInfo[];
  organizationId: string;
}) {
  const freeModuleKeys = modules
    .filter((m) => Number(m.monthly_price) === 0)
    .map((m) => m.module_key);

  const [selectedKeys, setSelectedKeys] = useState<string[]>([...freeModuleKeys]);
  const [billingInterval, setBillingInterval] = useState<"monthly" | "yearly">("monthly");
  const [state, formAction, isActionPending] = useActionState(startTrialAction, null);

  function handleConfirm() {
    const formData = new FormData();
    formData.set("organizationId", organizationId);
    formData.set("selectedModules", JSON.stringify(selectedKeys));
    formData.set("billingInterval", billingInterval);
    startTransition(() => {
      formAction(formData);
    });
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
      <div>
        <ModuleSelector
          modules={modules}
          selectedKeys={selectedKeys}
          onChange={setSelectedKeys}
          variant="light"
        />
      </div>
      <div className="lg:sticky lg:top-8 lg:self-start">
        <PriceSummary
          modules={modules}
          selectedKeys={selectedKeys}
          billingInterval={billingInterval}
          onBillingChange={setBillingInterval}
          onConfirm={handleConfirm}
          loading={isActionPending}
          onConfirmLabel="Démarrer l'essai Essentiel"
          variant="light"
        />
        <p className="mt-3 text-center text-xs text-slate-400">
          Essai Essentiel inclus. Sans engagement.
        </p>
        {state?.error && (
          <p className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-center text-sm text-red-800">
            {state.error}
          </p>
        )}
      </div>
    </div>
  );
}
