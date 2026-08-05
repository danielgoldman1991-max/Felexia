type ChartPoint = {
  label: string;
  value: number;
};

function pointsFor(data: ChartPoint[], width: number, height: number) {
  const max = Math.max(...data.map((item) => item.value));
  const min = Math.min(...data.map((item) => item.value));
  const spread = Math.max(max - min, 1);
  return data.map((item, index) => {
    const x = (index / Math.max(data.length - 1, 1)) * width;
    const y = height - ((item.value - min) / spread) * (height - 24) - 12;
    return { ...item, x, y };
  });
}

export function DashboardChart({ data }: { data: ChartPoint[] }) {
  const width = 720;
  const height = 260;
  const points = pointsFor(data, width, height);
  const path = points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");
  const area = `${path} L ${width} ${height} L 0 ${height} Z`;

  return (
    <section className="rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--card)] p-5 shadow-[var(--shadow-sm)]">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-[var(--foreground)]">Evolution du chiffre d&apos;affaires</h2>
          <p className="text-sm text-[var(--muted)]">Tendance mensuelle des ventes facturees.</p>
        </div>
        <button type="button" className="rounded-full border border-[var(--border)] bg-[var(--card)] px-3 py-1.5 text-sm font-medium text-[var(--muted)] hover:bg-[var(--surface-soft)]">Par jour</button>
      </div>
      <div className="overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-soft)]/40 p-3">
        <svg viewBox={`0 0 ${width} ${height}`} className="h-72 w-full">
          <defs>
            <linearGradient id="revenueArea" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#38BDF8" stopOpacity="0.26" />
              <stop offset="100%" stopColor="#D6B56D" stopOpacity="0" />
            </linearGradient>
          </defs>
          {[0, 1, 2, 3].map((line) => (
            <line key={line} x1="0" x2={width} y1={(height / 4) * line + 20} y2={(height / 4) * line + 20} stroke="var(--border)" strokeDasharray="4 6" />
          ))}
          <path d={area} fill="url(#revenueArea)" />
          <path d={path} fill="none" stroke="#38BDF8" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
          {points.map((point) => (
            <g key={point.label}>
              <circle cx={point.x} cy={point.y} r="5" fill="var(--card)" stroke="#38BDF8" strokeWidth="3" />
              <text x={point.x} y={height - 6} textAnchor="middle" className="fill-[var(--muted)] text-[12px]">{point.label}</text>
            </g>
          ))}
        </svg>
      </div>
    </section>
  );
}
