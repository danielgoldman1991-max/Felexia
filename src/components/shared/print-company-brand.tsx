import type { OrganizationIdentity } from "@/lib/company-identity";
import { PrintOrganizationLogo } from "./print-organization-logo";

export function PrintCompanyBrand({ identity }: { identity: OrganizationIdentity }) {
  return (
    <div className="flex items-start gap-4">
      <PrintOrganizationLogo identity={identity} />
      <div>
        <p className="text-lg font-bold text-[#2d2490]">{identity.name || "Mon Entreprise"}</p>
        <div className="mt-1 space-y-0.5 text-xs leading-5 text-slate-500">
          {identity.address ? <p>{identity.address}</p> : null}
          {identity.city || identity.country ? <p>{[identity.city, identity.country].filter(Boolean).join(", ")}</p> : null}
          {identity.email || identity.phone ? <p>{[identity.email, identity.phone].filter(Boolean).join(" - ")}</p> : null}
        </div>
      </div>
    </div>
  );
}
