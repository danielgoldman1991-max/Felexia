import Image from "next/image";
import type { OrganizationIdentity } from "@/lib/company-identity";

export function PrintOrganizationLogo({
  identity,
}: {
  identity: OrganizationIdentity;
}) {
  const logoSrc = identity.logoUrl;
  const alt = `Logo ${identity.name}`;

  if (!logoSrc) {
    return (
      <div className="print-logo-monogram" aria-hidden="true">
        <span>{identity.name.trim().split(/\s+/).slice(0, 2).map((part) => part.charAt(0)).join("").toUpperCase() || "E"}</span>
      </div>
    );
  }

  return (
    <div className="print-logo">
      <Image
        src={logoSrc}
        alt={alt}
        fill
        className="object-contain object-left"
        loading="eager"
        sizes="128px"
      />
    </div>
  );
}
