import React from 'react';
import { PlayerStats, ProbabilityCalculation, SpinRecord } from '../types/game';

interface StatisticsPanelProps {
  stats: PlayerStats;
  history: SpinRecord[];
  calculation: ProbabilityCalculation;
}

export const StatisticsPanel: React.FC<StatisticsPanelProps> = ({
  stats,
  history,
  calculation,
}) => {
  const actualRtp =
    stats.totalWagered > 0 ? (stats.totalPayout / stats.totalWagered) * 100 : 0;
  const winRate =
    stats.totalSpins > 0 ? (stats.winsCount / stats.totalSpins) * 100 : 0;

  // Build chronological cumulative P&L series (up to latest 100 spins)
  const chronological = [...history].reverse();
  let runningNet = 0;
  let runningExpectedNet = 0;
  const points = chronological.map((spin, index) => {
    runningNet += spin.netResult;
    runningExpectedNet += -spin.betAmount * (spin.theoreticalHouseEdgePercent / 100);
    return {
      idx: index + 1,
      actual: runningNet,
      expected: runningExpectedNet,
    };
  });

  // Chart geometry
  const width = 680;
  const height = 210;
  const padX = 44;
  const padY = 20;
  const plotW = width - padX * 2;
  const plotH = height - padY * 2;

  const allY = points.length > 0 ? [0, ...points.map((p) => p.actual), ...points.map((p) => p.expected)] : [-10, 10];
  const minY = Math.min(...allY);
  const maxY = Math.max(...allY);
  const rangeY = Math.max(10, maxY - minY);

  const toSvgX = (i: number) =>
    points.length <= 1 ? padX : padX + (i / (points.length - 1)) * plotW;
  const toSvgY = (val: number) =>
    padY + plotH - ((val - minY) / rangeY) * plotH;

  const zeroY = toSvgY(0);

  const actualPolyline = points
    .map((p, i) => `${toSvgX(i).toFixed(1)},${toSvgY(p.actual).toFixed(1)}`)
    .join(' ');
  const expectedPolyline = points
    .map((p, i) => `${toSvgX(i).toFixed(1)},${toSvgY(p.expected).toFixed(1)}`)
    .join(' ');

  // Observed outcome frequencies vs theoretical
  const hitCountsByLabel = new Map<string, number>();
  history.forEach((s) => {
    hitCountsByLabel.set(s.segmentId, (hitCountsByLabel.get(s.segmentId) ?? 0) + 1);
  });

  return (
    <div className="flex flex-col gap-6">
      {/* KPI Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#111827] border border-slate-800 rounded-xl p-5">
          <p className="text-xs font-medium text-slate-400">Total Spins & Wagered</p>
          <p className="mt-1.5 text-2xl font-bold font-mono tabular-nums text-slate-100">
            {stats.totalSpins.toLocaleString()}
          </p>
          <p className="mt-1 text-xs font-mono tabular-nums text-slate-400">
            ${stats.totalWagered.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} wagered
          </p>
        </div>

        <div className="bg-[#111827] border border-slate-800 rounded-xl p-5">
          <p className="text-xs font-medium text-slate-400">Cumulative Net P&L</p>
          <p
            className={`mt-1.5 text-2xl font-bold font-mono tabular-nums ${
              stats.netProfit > 0
                ? 'text-emerald-400'
                : stats.netProfit < 0
                ? 'text-rose-400'
                : 'text-slate-100'
            }`}
          >
            {stats.netProfit > 0
              ? `+$${stats.netProfit.toFixed(2)}`
              : stats.netProfit < 0
              ? `-$${Math.abs(stats.netProfit).toFixed(2)}`
              : '$0.00'}
          </p>
          <p className="mt-1 text-xs font-mono tabular-nums text-slate-400">
            Payouts: ${stats.totalPayout.toFixed(2)}
          </p>
        </div>

        <div className="bg-[#111827] border border-slate-800 rounded-xl p-5">
          <p className="text-xs font-medium text-slate-400">Observed vs Theoretical RTP</p>
          <p className="mt-1.5 text-2xl font-bold font-mono tabular-nums text-slate-100">
            {stats.totalSpins > 0 ? `${actualRtp.toFixed(2)}%` : '—'}
          </p>
          <p className="mt-1 text-xs font-mono tabular-nums text-slate-400">
            Target RTP: {calculation.rtpPercent.toFixed(2)}%
          </p>
        </div>

        <div className="bg-[#111827] border border-slate-800 rounded-xl p-5">
          <p className="text-xs font-medium text-slate-400">Win Rate & Peak Hit</p>
          <p className="mt-1.5 text-2xl font-bold font-mono tabular-nums text-amber-400">
            {stats.totalSpins > 0 ? `${winRate.toFixed(1)}%` : '—'}
          </p>
          <p className="mt-1 text-xs font-mono tabular-nums text-slate-400">
            Best: {stats.biggestMultiplier}x (+${stats.biggestWin.toFixed(2)})
          </p>
        </div>
      </div>

      {/* Trajectory Chart + Outcome Frequency */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 bg-[#111827] border border-slate-800 rounded-xl p-6">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
            <div>
              <h3 className="text-base font-semibold text-slate-100">
                Cumulative Net Result vs Expected Drift
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Actual player net P&L compared to mathematical expectation (−Bet × House Edge).
              </p>
            </div>
            <div className="flex items-center gap-4 text-xs text-slate-400">
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-0.5 bg-amber-400 inline-block" /> Actual P&L
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-0.5 bg-slate-500 border-b border-dashed border-slate-400 inline-block" /> Expected EV
              </span>
            </div>
          </div>

          {points.length >= 2 ? (
            <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto overflow-visible">
              {/* Zero line */}
              <line
                x1={padX}
                y1={zeroY}
                x2={width - padX}
                y2={zeroY}
                stroke="#334155"
                strokeWidth="1"
              />
              <text
                x={padX - 6}
                y={zeroY}
                fill="#64748B"
                fontSize="10"
                fontFamily="JetBrains Mono, monospace"
                textAnchor="end"
                dominantBaseline="central"
              >
                $0
              </text>

              {/* Max & Min labels */}
              <text
                x={padX - 6}
                y={padY}
                fill="#64748B"
                fontSize="10"
                fontFamily="JetBrains Mono, monospace"
                textAnchor="end"
                dominantBaseline="central"
              >
                ${maxY.toFixed(0)}
              </text>
              <text
                x={padX - 6}
                y={height - padY}
                fill="#64748B"
                fontSize="10"
                fontFamily="JetBrains Mono, monospace"
                textAnchor="end"
                dominantBaseline="central"
              >
                ${minY.toFixed(0)}
              </text>

              {/* Expected EV drift */}
              <polyline
                fill="none"
                stroke="#64748B"
                strokeWidth="1.5"
                strokeDasharray="4 4"
                points={expectedPolyline}
              />

              {/* Actual Net P&L */}
              <polyline
                fill="none"
                stroke="#F59E0B"
                strokeWidth="2.25"
                points={actualPolyline}
              />
            </svg>
          ) : (
            <div className="h-[190px] flex items-center justify-center border border-dashed border-slate-800 rounded-lg text-xs text-slate-500">
              Complete at least 2 spins to plot your cumulative P&L curve.
            </div>
          )}
        </div>

        {/* Observed vs Theoretical Outcome Table */}
        <div className="lg:col-span-5 bg-[#111827] border border-slate-800 rounded-xl p-6">
          <h3 className="text-base font-semibold text-slate-100 mb-1">
            Observed Hit Frequency
          </h3>
          <p className="text-xs text-slate-400 mb-4">
            Empirical hit rates across your {stats.totalSpins} recorded spins.
          </p>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400">
                  <th className="py-2 pr-2">Segment</th>
                  <th className="py-2 px-2 text-right">Hits</th>
                  <th className="py-2 px-2 text-right">Actual</th>
                  <th className="py-2 pl-2 text-right">Theory</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {calculation.segments.map((seg) => {
                  const hits = hitCountsByLabel.get(seg.id) ?? 0;
                  const actualPct =
                    stats.totalSpins > 0 ? (hits / stats.totalSpins) * 100 : 0;
                  return (
                    <tr key={seg.id}>
                      <td className="py-2.5 pr-2">
                        <div className="flex items-center gap-2">
                          <span
                            className="w-2.5 h-2.5 rounded-sm shrink-0"
                            style={{ backgroundColor: seg.color }}
                          />
                          <span className="text-slate-200 font-medium">{seg.label}</span>
                        </div>
                      </td>
                      <td className="py-2.5 px-2 text-right font-mono tabular-nums text-slate-300">
                        {hits}
                      </td>
                      <td className="py-2.5 px-2 text-right font-mono tabular-nums text-slate-200">
                        {actualPct.toFixed(1)}%
                      </td>
                      <td className="py-2.5 pl-2 text-right font-mono tabular-nums text-slate-400">
                        {seg.probabilityPercent.toFixed(1)}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
