import Link from "next/link";
import { requireActiveWorkspace } from "@/lib/auth";
import { PageHeader } from "@/components/erp/page-header";
import { ThirdPartyImportForm } from "@/components/tiers/third-party-import-form";

export default async function ThirdPartyImportPage() {
  await requireActiveWorkspace({ modules: ["ventes", "achats"], level: "write" });
  return (
    <div className="space-y-6">
      <PageHeader title="Importer des clients" description="Aperçu du fichier, contrôle de l’ICE et des doublons, puis confirmation. Les contacts sont ajoutés seulement à votre entreprise." />
      <ThirdPartyImportForm />
      <Link href="/tiers" className="text-sm font-medium text-[var(--primary)] hover:underline">Retour aux tiers</Link>
    </div>
  );
}
