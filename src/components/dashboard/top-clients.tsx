type Client = {
  name: string;
  amount: number;
  trend: string;
};

export function TopClients({ clients }: { clients: Client[] }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-5">
        <h2 className="text-base font-semibold text-slate-950">Top 5 clients</h2>
        <p className="text-sm text-slate-500">Contribution au chiffre d&apos;affaires.</p>
      </div>
      {clients.length === 0 ? (
        <div className="flex h-40 flex-col items-center justify-center text-slate-400">
          <p className="text-sm">Aucun client facture pour le moment.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {clients.map((client, index) => (
            <div key={client.name} className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-sm font-bold text-slate-700">{index + 1}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-slate-900">{client.name}</p>
                <p className="text-xs text-green-600">{client.trend}</p>
              </div>
              <p className="text-sm font-bold text-slate-950">
                {new Intl.NumberFormat("fr-MA", { minimumFractionDigits: 2 }).format(client.amount)} DH
              </p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}