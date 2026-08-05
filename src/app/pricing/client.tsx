"use client";

import { useState } from "react";
import Link from "next/link";
import { ModuleSelector, PriceSummary } from "@/components/pricing/module-selector";
import type { ModuleInfo } from "@/lib/saas";

export function PricingClient({ modules }: { modules: ModuleInfo[] }) {
  const freeModuleKeys = modules
    .filter((m) => Number(m.monthly_price) === 0)
    .map((m) => m.module_key);

  const [selectedKeys, setSelectedKeys] = useState<string[]>([...freeModuleKeys]);
  const [billingInterval, setBillingInterval] = useState<"monthly" | "yearly">("monthly");

  return (
    <section className="mx-auto max-w-5xl px-6 pb-24">
      <div className="grid gap-10 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <h2 className="mb-4 text-xl font-bold">Modules disponibles</h2>
          <ModuleSelector
            modules={modules}
            selectedKeys={selectedKeys}
            onChange={setSelectedKeys}
          />
        </div>
        <div>
          <PriceSummary
            modules={modules}
            selectedKeys={selectedKeys}
            billingInterval={billingInterval}
            onBillingChange={setBillingInterval}
            onConfirmLabel="Commencer l'essai Essentiel"
          />
          <p className="mt-3 text-center text-xs text-[var(--muted)]">
            Essai Essentiel inclus. Sans engagement. Sans carte bancaire.
          </p>
          <div className="mt-4 text-center">
            <Link
              href="/onboarding"
              className="text-sm font-medium text-[var(--primary)] hover:underline underline-offset-2"
            >
              Créer un compte →
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
