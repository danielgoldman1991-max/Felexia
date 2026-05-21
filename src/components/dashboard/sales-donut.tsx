type DonutItem = {
  label: string;
  value: number;
  amount: string;
  color: string;
};

function segment(value: number, offset: number) {
  const radius = 62;
  const circumference = 2 * Math.PI * radius;
  return {
    strokeDasharray: `${(value / 100) * circumference} ${circumference}`,
    strokeDashoffset: `${-(offset / 100) * circumference}`,
  };
}

export function SalesDonut({ data, total }: { data: DonutItem[]; total: number }) {
  if (data.length === 0) {
    return (
      <section className="premium-card rounded-[var(--radius-lg)] p-5">
        <div className="mb-5">
          <h2 className="text-base font-semibold text-[var(--foreground)]">Repartition des ventes</h2>
          <p className="text-sm text-[var(--muted)]">Par famille de revenus.</p>
        </div>
        <div className="flex h-64 flex-col items-center justify-center gap-3 text-[var(--muted)]">
          <p className="text-sm">Aucune vente a repartir pour le moment.</p>
        </div>
      </section>
    );
  }

  const segments = data.reduce<Array<{ item: DonutItem; offset: number }>>(
    (acc, item) => {
      const previousOffset = acc.reduce((sum, s) => sum + s.item.value, 0);
      return [...acc, { item, offset: previousOffset }];
    },
    [],
  );

  const totalFormatted = new Intl.NumberFormat("fr-MA", { minimumFractionDigits: 0 }).format(total);

  return (
    <section className="premium-card rounded-[var(--radius-lg)] p-5">
      <div className="mb-5">
        <h2 className="text-base font-semibold text-[var(--foreground)]">Repartition des ventes</h2>
        <p className="text-sm text-[var(--muted)]">Par famille de revenus.</p>
      </div>
      <div className="flex flex-col items-center gap-5">
        <div className="relative h-48 w-48">
          <svg viewBox="0 0 160 160" className="h-full w-full -rotate-90">
            <circle cx="80" cy="80" r="62" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="18" />
            {segments.map(({ item, offset }) => (
              <circle key={item.label} cx="80" cy="80" r="62" fill="none" stroke={item.color} strokeWidth="18" strokeLinecap="round" {...segment(item.value, offset)} />
            ))}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
            <span className="text-xl font-semibold text-[var(--foreground)]">{totalFormatted}</span>
            <span className="text-xs font-medium text-[var(--muted)]">DH</span>
          </div>
        </div>
        <div className="w-full space-y-3">
          {data.map((item) => (
            <div key={item.label} className="flex items-center justify-between gap-3 text-sm">
              <span className="flex items-center gap-2 text-[var(--muted)]"><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />{item.label}</span>
              <span className="font-semibold text-[var(--foreground)]">{item.value}%</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
