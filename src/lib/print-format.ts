import type { OrganizationIdentity } from "@/lib/company-identity";
import { getPaymentMethodLabel } from "@/lib/payment-terms";

const printNumberFormatter = new Intl.NumberFormat("fr-MA", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Numeric amounts inside a table whose caption already identifies its currency. */
export function formatDocumentNumber(value: number | null | undefined) {
  return printNumberFormatter.format(value ?? 0);
}

/** The document's recorded currency, rather than the application's MAD default. */
export function formatDocumentMoney(value: number | null | undefined, currency: string | null | undefined = "MAD") {
  const code = currency?.trim().toUpperCase() || "MAD";
  try {
    return new Intl.NumberFormat("fr-MA", {
      style: "currency",
      currency: code,
      currencyDisplay: "code",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value ?? 0);
  } catch {
    return `${formatDocumentNumber(value)} ${code}`;
  }
}

export function documentIdentityInfoLines(identity: OrganizationIdentity): string[] {
  return [
    identity.address,
    [identity.city, identity.country].filter(Boolean).join(", "),
    [identity.ice ? `ICE : ${identity.ice}` : null, identity.rc ? `RC : ${identity.rc}` : null].filter(Boolean).join(" · "),
    [identity.ifNumber ? `IF : ${identity.ifNumber}` : null, identity.patente ? `TP : ${identity.patente}` : null, identity.cnss ? `CNSS : ${identity.cnss}` : null].filter(Boolean).join(" · "),
  ].filter((line): line is string => Boolean(line));
}

export function documentIdentityContact(identity: OrganizationIdentity): string {
  return [identity.email, identity.phone, identity.website].filter(Boolean).join(" · ");
}

/** Legacy payment codes remain unchanged in storage; printed labels are French. */
export function documentPaymentMethodLabel(value: string | null | undefined): string {
  const code = value?.trim();
  if (!code) return "";
  const legacyAliases: Record<string, string> = { transfer: "bank_transfer", cheque: "check" };
  return getPaymentMethodLabel(legacyAliases[code.toLowerCase()] || code);
}

type SourceTaxLine = {
  tax_rate: number;
  tax_amount: number;
  tax_rate_name?: string | null;
};

/** Groups stored tax amounts. Does not recompute tax from a rate or base. */
export function documentTaxSummary(lines: SourceTaxLine[], currency: string) {
  const groups = new Map<string, number>();
  for (const line of lines) {
    const label = line.tax_rate_name || `TVA ${new Intl.NumberFormat("fr-MA").format(line.tax_rate)} %`;
    groups.set(label, (groups.get(label) ?? 0) + line.tax_amount);
  }
  return [...groups].map(([label, amount]) => ({ label, value: formatDocumentMoney(amount, currency) }));
}
