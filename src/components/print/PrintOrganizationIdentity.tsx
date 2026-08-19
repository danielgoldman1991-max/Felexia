import type { OrganizationIdentity } from "@/lib/company-identity";
import { PrintOrganizationLogo } from "@/components/shared/print-organization-logo";

type Props = {
  identity: OrganizationIdentity;
  /** Lignes d'information société (ville, ICE, RC/IF...) déjà formatées. */
  infoLines?: string[];
  /** Ligne de contact société (email - tel - site) déjà formatée. */
  contact?: string;
};

export function PrintOrganizationIdentity({ identity, infoLines = [], contact = "" }: Props) {
  return (
    <div className="print-identity">
      <PrintOrganizationLogo identity={identity} />
      <div>
        <p className="print-identity-name">{identity.name || "Mon Entreprise"}</p>
        {infoLines.length > 0 ? (
          <p className="print-identity-info">
            {infoLines.map((line, index) => (
              <span key={index}>
                {line}
                {index < infoLines.length - 1 && <br />}
              </span>
            ))}
          </p>
        ) : (
          <p className="print-identity-info">-</p>
        )}
        {contact ? <p className="print-identity-info">{contact}</p> : null}
      </div>
    </div>
  );
}
