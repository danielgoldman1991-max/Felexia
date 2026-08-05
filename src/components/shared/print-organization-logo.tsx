import Image from "next/image";
import { APP_BRAND } from "@/lib/brand";
import type { OrganizationIdentity } from "@/lib/company-identity";

export function PrintOrganizationLogo({
  identity,
}: {
  identity: OrganizationIdentity;
}) {
  const logoSrc = identity.logoUrl || APP_BRAND.logo;
  const alt = identity.logoUrl ? `Logo ${identity.name}` : APP_BRAND.logoAlt;

  if (!logoSrc) {
    return (
      <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-slate-50">
        <span className="text-2xl font-bold text-[#2d2490]">{identity.name.charAt(0)}</span>
      </div>
    );
  }

  return (
    <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-white">
      <Image
        src={logoSrc}
        alt={alt}
        fill
        className="object-contain p-1"
        loading="eager"
        sizes="80px"
      />
    </div>
  );
}
