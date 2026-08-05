import { Building2, Database, FileText, FolderCheck, LineChart } from "lucide-react";

const items = [
  {
    icon: Building2,
    title: "Création d'entreprise",
    detail: "en quelques minutes",
  },
  {
    icon: FileText,
    title: "Documents commerciaux",
    detail: "avec logo et ICE",
  },
  {
    icon: LineChart,
    title: "Suivi ventes, achats, stock",
    detail: "et trésorerie en temps réel",
  },
  {
    icon: FolderCheck,
    title: "Comptabilité structurée",
    detail: "et prête à l'emploi",
  },
  {
    icon: Database,
    title: "Données centralisées",
    detail: "et sécurisées",
  },
];

export function LandingProofStrip() {
  return (
    <section className="relative -mt-6 pb-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid gap-4 rounded-[28px] border border-slate-200 bg-white p-5 shadow-xl shadow-blue-950/5 sm:grid-cols-2 lg:grid-cols-5">
          {items.map((item) => (
            <div key={item.title} className="flex items-start gap-3.5">
              <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50">
                <item.icon className="h-5 w-5 text-[#0B63F6]" />
              </span>
              <div>
                <p className="text-sm font-bold leading-snug text-[#061B3F]">{item.title}</p>
                <p className="mt-1 text-sm leading-snug text-slate-500">{item.detail}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
