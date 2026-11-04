import Link from "next/link";
import { ModulePage } from "@/components/erp/module-page";
import { PageHeader } from "@/components/erp/page-header";

const reports = [
  { href: "/comptabilite/balance", label: "Balance" },
  { href: "/comptabilite/grand-livre", label: "Grand livre" },
  { href: "/comptabilite/etats", label: "Bilan et CPC" },
  { href: "/comptabilite/liasse", label: "Liasse de gestion" },
  { href: "/comptabilite/tva", label: "TVA" },
  { href: "/tresorerie", label: "Trésorerie" },
  { href: "/tresorerie/previsions", label: "Prévisions" },
  { href: "/vente", label: "Ventes" },
  { href: "/achats", label: "Achats" },
];

export default function ReportsPage() {
  return (
    <ModulePage>
      <PageHeader title="Rapports" description="Accès aux états déjà produits dans chaque module. Il n'y a pas de suite analytique supplémentaire." />
      <ul className="grid gap-3 sm:grid-cols-2">
        {reports.map((report) => (
          <li key={report.href}><Link className="block rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--card)] px-4 py-3 font-medium text-[var(--primary)] hover:underline" href={report.href}>{report.label}</Link></li>
        ))}
      </ul>
    </ModulePage>
  );
}
