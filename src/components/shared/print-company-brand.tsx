import Image from "next/image";
import type { OrganizationIdentity } from "@/lib/company-identity";

export function PrintCompanyBrand({ identity }: { identity: OrganizationIdentity }) {
  return (
    <div className="flex items-start gap-4">
      {identity.logoUrl ? (
        <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-white">
          <Image src={identity.logoUrl} alt="Logo" fill className="object-contain p-1" priority />
        </div>
      ) : (
        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-slate-50">
          <span className="text-xl font-bold text-[#2d2490]">{identity.name.charAt(0)}</span>
        </div>
      )}
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
