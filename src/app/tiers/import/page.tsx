import Link from "next/link";
import { requireActiveWorkspace } from "@/lib/auth";
import { PageHeader } from "@/components/erp/page-header";
import { ThirdPartyImportForm } from "@/components/tiers/third-party-import-form";

export default async function ThirdPartyImportPage() {
  await requireActiveWorkspace({ modules: ["ventes", "achats"], level: "write" });
  return (
    <div className="space-y-6">
      <PageHeader title="Importer des clients" description="CSV, Excel .xlsx ou .xls. Contrôle de l’ICE, de l’IF, du RC, de l’e-mail, du téléphone et des doublons. Seules les lignes valides sont ajoutées à votre entreprise." />
      <ThirdPartyImportForm />
      <Link href="/tiers" className="text-sm font-medium text-[var(--primary)] hover:underline">Retour aux tiers</Link>
    </div>
  );
}
