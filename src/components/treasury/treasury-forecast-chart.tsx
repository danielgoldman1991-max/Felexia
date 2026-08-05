"use client";

import type { TreasuryForecastDaily } from "@/lib/treasury/treasury-forecast";
import { formatDate } from "@/lib/format";

const WIDTH = 860;
const HEIGHT = 300;
const PAD_LEFT = 56;
const PAD_RIGHT = 16;
const PAD_TOP = 24;
const PAD_BOTTOM = 34;

function scaleRange(values: number[]) {
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const spread = Math.max(max - min, 1);
  return { max, min, spread };
}

export function TreasuryForecastChart({ daily }: { daily: TreasuryForecastDaily[] }) {
  if (daily.length === 0) {
    return (
      <section className="rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--card)] p-5 shadow-[var(--shadow-sm)]">
        <h2 className="text-base font-semibold text-[var(--foreground)]">Evolution du solde previsionnel</h2>
        <p className="text-sm text-[var(--muted)]">Aucune journee sur la periode.</p>
      </section>
    );
  }

  const { max, min, spread } = scaleRange([
    ...daily.map((day) => day.closingBalance),
    ...daily.flatMap((day) => [day.inflows, day.outflows]),
  ]);

  const plotWidth = WIDTH - PAD_LEFT - PAD_RIGHT;
  const plotHeight = HEIGHT - PAD_TOP - PAD_BOTTOM;
  const xFor = (index: number) => PAD_LEFT + (index / Math.max(daily.length - 1, 1)) * plotWidth;
  const yFor = (value: number) => PAD_TOP + ((max - value) / spread) * plotHeight;
  const zeroY = yFor(0);

  const balancePoints = daily.map((day, index) => `${index === 0 ? "M" : "L"} ${xFor(index)} ${yFor(day.closingBalance)}`).join(" ");
  const areaPath = `${balancePoints} L ${xFor(daily.length - 1)} ${zeroY} L ${PAD_LEFT} ${zeroY} Z`;

  const barSlot = plotWidth / Math.max(daily.length, 1);
  const barWidth = Math.min(barSlot * 0.22, 10);

  const showLabels = daily.length <= 31;

  return (
    <section className="rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--card)] p-5 shadow-[var(--shadow-sm)]">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-[var(--foreground)]">Evolution du solde previsionnel</h2>
          <p className="text-sm text-[var(--muted)]">Solde par jour, encaissements (vert) et decaissements (rouge).</p>
        </div>
        <div className="flex items-center gap-4 text-xs text-[var(--muted)]">
          <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[var(--success)]" /> Encaissements</span>
          <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[var(--danger)]" /> Decaissements</span>
          <span className="flex items-center gap-1.5"><span className="h-0.5 w-4 rounded bg-[var(--primary)]" /> Solde previsionnel</span>
        </div>
      </div>
      <div className="overflow-x-auto">
        <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="min-w-[560px] w-full" role="img" aria-label="Courbe du solde previsionnel">
          <defs>
            <linearGradient id="forecastArea" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#1D4ED8" stopOpacity="0.18" />
              <stop offset="100%" stopColor="#1D4ED8" stopOpacity="0" />
            </linearGradient>
          </defs>

          {[0, 1, 2, 3, 4].map((line) => {
            const value = min + (spread / 4) * line;
            const y = yFor(value);
            return (
              <g key={line}>
                <line x1={PAD_LEFT} x2={WIDTH - PAD_RIGHT} y1={y} y2={y} stroke="var(--border)" strokeDasharray="4 6" />
                <text x={PAD_LEFT - 8} y={y + 4} textAnchor="end" className="fill-[var(--muted)] text-[11px]">
                  {Math.round(value).toLocaleString("fr-FR")}
                </text>
              </g>
            );
          })}

          <line x1={PAD_LEFT} x2={WIDTH - PAD_RIGHT} y1={zeroY} y2={zeroY} stroke="var(--border)" strokeWidth="1.5" />

          {daily.map((day, index) => {
            const centerX = xFor(index);
            const inHeight = (day.inflows / spread) * plotHeight;
            const outHeight = (day.outflows / spread) * plotHeight;
            return (
              <g key={day.date}>
                {day.inflows > 0 ? (
                  <rect x={centerX - barWidth - 2} y={zeroY - inHeight} width={barWidth} height={Math.max(inHeight, 1)} rx="2" fill="var(--success)" opacity="0.85" />
                ) : null}
                {day.outflows > 0 ? (
                  <rect x={centerX + 2} y={zeroY} width={barWidth} height={Math.max(outHeight, 1)} rx="2" fill="var(--danger)" opacity="0.85" />
                ) : null}
                {day.isCritical ? <circle cx={centerX} cy={yFor(day.closingBalance)} r="5" fill="var(--danger)" /> : null}
                {showLabels ? (
                  <text x={centerX} y={HEIGHT - 10} textAnchor="middle" className="fill-[var(--muted)] text-[10px]">
                    {formatDate(day.date).split(" ").slice(0, 2).join(" ")}
                  </text>
                ) : null}
              </g>
            );
          })}

          <path d={areaPath} fill="url(#forecastArea)" />
          <path d={balancePoints} fill="none" stroke="var(--primary)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    </section>
  );
}
