import React, { useState } from 'react';
import { FlaskConical, Play } from 'lucide-react';
import { ProbabilityCalculation, SimulationResult, WheelSegment } from '../types/game';
import { runMonteCarloSimulation } from '../services/simulationService';

interface SimulationPanelProps {
  segments: WheelSegment[];
  calculation: ProbabilityCalculation;
}

const SAMPLE_PRESETS = [1000, 10000, 100000, 250000];

export const SimulationPanel: React.FC<SimulationPanelProps> = ({
  segments,
  calculation,
}) => {
  const [numSpins, setNumSpins] = useState<number>(10000);
  const [betPerSpin, setBetPerSpin] = useState<number>(10);
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleRun = () => {
    setError(null);
    if (!calculation.isValid) {
      setError('Resolve configuration errors before running a simulation.');
      return;
    }
    if (!Number.isFinite(betPerSpin) || betPerSpin <= 0) {
      setError('Bet per spin must be greater than $0.');
      return;
    }
    try {
      const sim = runMonteCarloSimulation(segments, numSpins, betPerSpin);
      setResult(sim);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Simulation failed.');
    }
  };

  // Convergence SVG geometry
  const width = 720;
  const height = 220;
  const padX = 50;
  const padY = 24;
  const plotW = width - padX * 2;
  const plotH = height - padY * 2;

  let minRtp = calculation.rtpPercent - 5;
  let maxRtp = calculation.rtpPercent + 5;
  if (result && result.series.length > 1) {
    const vals = result.series.map((p) => p.empiricalRtpPercent);
    minRtp = Math.min(...vals, calculation.rtpPercent) - 1.5;
    maxRtp = Math.max(...vals, calculation.rtpPercent) + 1.5;
  }
  const rtpRange = Math.max(2, maxRtp - minRtp);

  const toX = (idx: number, total: number) =>
    total <= 1 ? padX : padX + (idx / (total - 1)) * plotW;
  const toY = (val: number) =>
    padY + plotH - ((val - minRtp) / rtpRange) * plotH;

  return (
    <div className="flex flex-col gap-6">
      {/* Controls Bar */}
      <div className="bg-[#111827] border border-slate-800 rounded-xl p-6">
        <div className="flex flex-wrap items-start justify-between gap-4 mb-5">
          <div>
            <div className="flex items-center gap-2">
              <FlaskConical className="w-4 h-4 text-amber-400" />
              <h3 className="text-lg font-semibold text-slate-100">
                Monte Carlo Simulation Laboratory
              </h3>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Stress-test the current segment configuration over thousands of independent spins to
              verify convergence toward theoretical RTP ({calculation.rtpPercent.toFixed(2)}%) and
              house edge ({calculation.houseEdgePercent.toFixed(2)}%).
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
          <div className="md:col-span-5">
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Simulation Sample Size (Spins)
            </label>
            <div className="flex items-center gap-1.5">
              {SAMPLE_PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setNumSpins(preset)}
                  className={`flex-1 py-2 px-2 text-xs font-mono font-medium rounded-lg border transition-colors whitespace-nowrap cursor-pointer ${
                    numSpins === preset
                      ? 'bg-amber-500/15 border-amber-500/50 text-amber-300'
                      : 'bg-[#0B1120] border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {preset >= 1000 ? `${preset / 1000}k` : preset}
                </button>
              ))}
            </div>
          </div>

          <div className="md:col-span-4">
            <label
              htmlFor="sim-bet-input"
              className="block text-xs font-medium text-slate-300 mb-1.5"
            >
              Simulated Wager per Spin ($)
            </label>
            <input
              id="sim-bet-input"
              type="number"
              min="0.1"
              step="1"
              value={betPerSpin}
              onChange={(e) => setBetPerSpin(parseFloat(e.target.value) || 0)}
              className="w-full px-3.5 py-2 bg-[#0B1120] border border-slate-700 rounded-lg font-mono text-sm text-slate-100 focus:border-amber-500 focus:outline-none"
            />
          </div>

          <div className="md:col-span-3">
            <button
              type="button"
              onClick={handleRun}
              disabled={!calculation.isValid}
              className="w-full py-2.5 px-4 bg-amber-500 hover:bg-amber-400 disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 font-semibold text-xs rounded-lg flex items-center justify-center gap-2 transition-colors whitespace-nowrap cursor-pointer"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              Run {numSpins.toLocaleString()} Spins
            </button>
          </div>
        </div>

        {error && (
          <p className="mt-3 text-xs text-rose-400 font-medium">{error}</p>
        )}
      </div>

      {/* Results View */}
      {result ? (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-[#111827] border border-slate-800 rounded-xl p-5">
              <p className="text-xs font-medium text-slate-400">Empirical vs Theoretical RTP</p>
              <p className="mt-1.5 text-2xl font-bold font-mono tabular-nums text-slate-100">
                {result.empiricalRtpPercent.toFixed(2)}%
              </p>
              <p className="mt-1 text-xs font-mono tabular-nums text-slate-400">
                Theory: {result.theoreticalRtpPercent.toFixed(2)}% (
                {result.rtpDeviationPercent >= 0 ? '+' : ''}
                {result.rtpDeviationPercent.toFixed(2)}%)
              </p>
            </div>

            <div className="bg-[#111827] border border-slate-800 rounded-xl p-5">
              <p className="text-xs font-medium text-slate-400">Empirical House Edge</p>
              <p className="mt-1.5 text-2xl font-bold font-mono tabular-nums text-amber-400">
                {result.empiricalHouseEdgePercent.toFixed(2)}%
              </p>
              <p className="mt-1 text-xs font-mono tabular-nums text-slate-400">
                Target Edge: {result.theoreticalHouseEdgePercent.toFixed(2)}%
              </p>
            </div>

            <div className="bg-[#111827] border border-slate-800 rounded-xl p-5">
              <p className="text-xs font-medium text-slate-400">Operator Net Revenue</p>
              <p
                className={`mt-1.5 text-2xl font-bold font-mono tabular-nums ${
                  result.operatorNetRevenue >= 0 ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                ${result.operatorNetRevenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
              <p className="mt-1 text-xs font-mono tabular-nums text-slate-400">
                Expected: ${result.expectedOperatorRevenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>

            <div className="bg-[#111827] border border-slate-800 rounded-xl p-5">
              <p className="text-xs font-medium text-slate-400">Total Handle & Runtime</p>
              <p className="mt-1.5 text-2xl font-bold font-mono tabular-nums text-slate-100">
                ${result.totalWagered.toLocaleString()}
              </p>
              <p className="mt-1 text-xs font-mono tabular-nums text-slate-400">
                Win Rate {result.winRatePercent}% · {result.durationMs}ms
              </p>
            </div>
          </div>

          {/* Convergence Chart */}
          <div className="bg-[#111827] border border-slate-800 rounded-xl p-6">
            <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
              <div>
                <h4 className="text-base font-semibold text-slate-100">
                  RTP Convergence Curve
                </h4>
                <p className="text-xs text-slate-400 mt-0.5">
                  Cumulative empirical RTP over {result.numSpins.toLocaleString()} simulated spins vs theoretical expectation.
                </p>
              </div>
              <div className="flex items-center gap-4 text-xs text-slate-400">
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-0.5 bg-emerald-400 inline-block" /> Empirical RTP
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-0.5 bg-amber-400 border-b border-dashed border-amber-400 inline-block" /> Theoretical RTP ({result.theoreticalRtpPercent.toFixed(2)}%)
                </span>
              </div>
            </div>

            <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto overflow-visible">
              {/* Theoretical Target Line */}
              <line
                x1={padX}
                y1={toY(result.theoreticalRtpPercent)}
                x2={width - padX}
                y2={toY(result.theoreticalRtpPercent)}
                stroke="#F59E0B"
                strokeWidth="1.5"
                strokeDasharray="5 4"
              />
              <text
                x={padX - 8}
                y={toY(result.theoreticalRtpPercent)}
                fill="#F59E0B"
                fontSize="10"
                fontFamily="JetBrains Mono, monospace"
                textAnchor="end"
                dominantBaseline="central"
              >
                {result.theoreticalRtpPercent.toFixed(1)}%
              </text>

              <text
                x={padX - 8}
                y={padY}
                fill="#64748B"
                fontSize="10"
                fontFamily="JetBrains Mono, monospace"
                textAnchor="end"
                dominantBaseline="central"
              >
                {maxRtp.toFixed(1)}%
              </text>
              <text
                x={padX - 8}
                y={height - padY}
                fill="#64748B"
                fontSize="10"
                fontFamily="JetBrains Mono, monospace"
                textAnchor="end"
                dominantBaseline="central"
              >
                {minRtp.toFixed(1)}%
              </text>

              <polyline
                fill="none"
                stroke="#10B981"
                strokeWidth="2.25"
                points={result.series
                  .map(
                    (pt, idx) =>
                      `${toX(idx, result.series.length).toFixed(1)},${toY(pt.empiricalRtpPercent).toFixed(1)}`
                  )
                  .join(' ')}
              />
            </svg>
          </div>

          {/* Segment Hit Distribution Variance Table */}
          <div className="bg-[#111827] border border-slate-800 rounded-xl p-6">
            <h4 className="text-base font-semibold text-slate-100 mb-1">
              Segment Frequency & Payout Variance
            </h4>
            <p className="text-xs text-slate-400 mb-4">
              Comparison between theoretical weights and Monte Carlo observed hits.
            </p>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400">
                    <th className="py-2.5 pr-4">Segment</th>
                    <th className="py-2.5 px-3 text-right">Multiplier</th>
                    <th className="py-2.5 px-3 text-right">Expected Hits</th>
                    <th className="py-2.5 px-3 text-right">Actual Hits</th>
                    <th className="py-2.5 px-3 text-right">Theory %</th>
                    <th className="py-2.5 px-3 text-right">Actual %</th>
                    <th className="py-2.5 px-3 text-right">Variance</th>
                    <th className="py-2.5 pl-3 text-right">Total Payout</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {result.segmentStats.map((seg) => (
                    <tr key={seg.id} className="hover:bg-slate-800/30">
                      <td className="py-3 pr-4">
                        <div className="flex items-center gap-2">
                          <span
                            className="w-2.5 h-2.5 rounded-sm shrink-0"
                            style={{ backgroundColor: seg.color }}
                          />
                          <span className="font-medium text-slate-100">{seg.label}</span>
                        </div>
                      </td>
                      <td className="py-3 px-3 text-right font-mono tabular-nums text-amber-400 font-semibold">
                        {seg.multiplier}x
                      </td>
                      <td className="py-3 px-3 text-right font-mono tabular-nums text-slate-400">
                        {seg.expectedHits.toLocaleString()}
                      </td>
                      <td className="py-3 px-3 text-right font-mono tabular-nums text-slate-100 font-medium">
                        {seg.actualHits.toLocaleString()}
                      </td>
                      <td className="py-3 px-3 text-right font-mono tabular-nums text-slate-400">
                        {seg.theoreticalProbPercent.toFixed(2)}%
                      </td>
                      <td className="py-3 px-3 text-right font-mono tabular-nums text-slate-200">
                        {seg.actualProbPercent.toFixed(2)}%
                      </td>
                      <td
                        className={`py-3 px-3 text-right font-mono tabular-nums ${
                          Math.abs(seg.variancePercent) < 0.35
                            ? 'text-emerald-400'
                            : 'text-amber-300'
                        }`}
                      >
                        {seg.variancePercent >= 0 ? '+' : ''}
                        {seg.variancePercent.toFixed(2)}%
                      </td>
                      <td className="py-3 pl-3 text-right font-mono tabular-nums text-slate-200">
                        ${seg.totalPayout.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        <div className="bg-[#111827] border border-dashed border-slate-800 rounded-xl p-12 text-center">
          <p className="text-sm font-medium text-slate-300">
            Ready to simulate {numSpins.toLocaleString()} spins
          </p>
          <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
            Click &ldquo;Run {numSpins.toLocaleString()} Spins&rdquo; above to measure empirical RTP,
            operator revenue variance, and per-segment hit convergence.
          </p>
        </div>
      )}
    </div>
  );
};
