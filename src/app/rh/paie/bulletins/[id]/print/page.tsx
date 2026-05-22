import { HrPreparatoryNotice } from "@/components/hr/hr-notice";

export default async function HrPayslipPrintPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <main className="min-h-screen bg-white p-10 text-slate-950">
      <h1 className="text-2xl font-semibold">Bulletin préparatoire</h1>
      <p className="mt-2 text-sm text-slate-600">Référence : {id}</p>
      <div className="mt-8 rounded-xl border border-slate-200 p-6">
        <p>Bulletin préparatoire généré par Felexia.</p>
        <p className="mt-2 text-sm text-slate-600">À valider par l&apos;employeur, le comptable ou le conseiller social avant remise.</p>
      </div>
      <div className="mt-8 text-slate-800">
        <HrPreparatoryNotice />
      </div>
    </main>
  );
}
