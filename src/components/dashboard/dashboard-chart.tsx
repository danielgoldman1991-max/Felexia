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
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-950">Evolution du chiffre d&apos;affaires</h2>
          <p className="text-sm text-slate-500">Tendance mensuelle des ventes facturees.</p>
        </div>
        <button type="button" className="rounded-full border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50">Par jour</button>
      </div>
      <div className="overflow-hidden rounded-2xl bg-slate-50 p-3">
        <svg viewBox={`0 0 ${width} ${height}`} className="h-72 w-full">
          <defs>
            <linearGradient id="revenueArea" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#2563eb" stopOpacity="0.22" />
              <stop offset="100%" stopColor="#2563eb" stopOpacity="0" />
            </linearGradient>
          </defs>
          {[0, 1, 2, 3].map((line) => (
            <line key={line} x1="0" x2={width} y1={(height / 4) * line + 20} y2={(height / 4) * line + 20} stroke="#e2e8f0" strokeDasharray="4 6" />
          ))}
          <path d={area} fill="url(#revenueArea)" />
          <path d={path} fill="none" stroke="#2563eb" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
          {points.map((point) => (
            <g key={point.label}>
              <circle cx={point.x} cy={point.y} r="5" fill="#fff" stroke="#2563eb" strokeWidth="3" />
              <text x={point.x} y={height - 6} textAnchor="middle" className="fill-slate-500 text-[12px]">{point.label}</text>
            </g>
          ))}
        </svg>
      </div>
    </section>
  );
}
