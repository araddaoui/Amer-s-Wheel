import React, { useState } from 'react';
import { CheckCircle2, RefreshCw, ShieldCheck, XCircle } from 'lucide-react';
import { ProbabilityCalculation, SpinRecord } from '../types/game';
import { verifyFairnessProof } from '../services/randomService';
import { generateSecureHex } from '../services/randomService';

interface ProbabilityPanelProps {
  calculation: ProbabilityCalculation;
  clientSeed: string;
  nonce: number;
  onUpdateClientSeed: (seed: string) => void;
  selectedProofSpin: SpinRecord | null;
  recentSpins: SpinRecord[];
  onSelectProofSpin: (spin: SpinRecord | null) => void;
}

export const ProbabilityPanel: React.FC<ProbabilityPanelProps> = ({
  calculation,
  clientSeed,
  nonce,
  onUpdateClientSeed,
  selectedProofSpin,
  recentSpins,
  onSelectProofSpin,
}) => {
  const [seedInput, setSeedInput] = useState(clientSeed);
  const [verificationResult, setVerificationResult] = useState<{
    spinId: string;
    seedHashMatches: boolean;
    rollMatches: boolean;
    computedSegmentLabel: string;
  } | null>(null);

  const activeSpin = selectedProofSpin ?? recentSpins[0] ?? null;

  const handleRunVerify = async (spin: SpinRecord) => {
    const res = await verifyFairnessProof(spin.fairness, calculation.segments);
    setVerificationResult({
      spinId: spin.id,
      seedHashMatches: res.seedHashMatches,
      rollMatches: res.rollMatches,
      computedSegmentLabel: res.computedSegmentLabel,
    });
  };

  return (
    <div className="flex flex-col gap-8">
      {/* Proportional Spectrum Visualization */}
      <div className="bg-[#111827] border border-slate-800 rounded-xl p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-4 mb-4">
          <div>
            <h3 className="text-lg font-semibold text-slate-100">
              Published Probability Distribution
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Physical wheel arc sizes and payout weights are strictly synchronized.
            </p>
          </div>
          <div className="flex items-center gap-3 text-xs font-mono tabular-nums text-slate-300">
            <span>Total Weight: {calculation.totalWeight}</span>
            <span className="text-slate-600">·</span>
            <span className="text-emerald-400">RTP: {calculation.rtpPercent.toFixed(2)}%</span>
            <span className="text-slate-600">·</span>
            <span className="text-amber-400">House Edge: {calculation.houseEdgePercent.toFixed(2)}%</span>
          </div>
        </div>

        {/* Exact Proportional Stacked Bar */}
        <div className="w-full h-5 rounded-md overflow-hidden flex border border-slate-800 bg-[#0B1120] mb-5">
          {calculation.segments
            .filter((s) => s.weight > 0)
            .map((seg) => (
              <div
                key={seg.id}
                style={{
                  width: `${seg.probabilityPercent}%`,
                  backgroundColor: seg.color,
                }}
                title={`${seg.label}: ${seg.probabilityPercent.toFixed(2)}% (${seg.multiplier}x)`}
                className="h-full border-r border-[#0B1120] last:border-r-0 transition-all duration-300"
              />
            ))}
        </div>

        {/* Paytable Data Grid */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800 text-xs font-medium text-slate-400">
                <th className="py-2.5 pr-4">Outcome</th>
                <th className="py-2.5 px-4 text-right">Weight</th>
                <th className="py-2.5 px-4 text-right">Probability</th>
                <th className="py-2.5 px-4 text-right">Wheel Arc</th>
                <th className="py-2.5 px-4 text-right">Multiplier</th>
                <th className="py-2.5 pl-4 text-right">EV Contribution</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-sm">
              {calculation.segments.map((seg) => (
                <tr key={seg.id} className="hover:bg-slate-800/30 transition-colors">
                  <td className="py-3 pr-4">
                    <div className="flex items-center gap-2.5">
                      <span
                        className="w-3 h-3 rounded-sm shrink-0"
                        style={{ backgroundColor: seg.color }}
                      />
                      <span className="font-medium text-slate-100">{seg.label}</span>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-300">
                    {seg.weight}
                  </td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-200">
                    {seg.probabilityPercent.toFixed(2)}%
                  </td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-400">
                    {seg.sweepAngle.toFixed(1)}°
                  </td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold text-amber-400">
                    {seg.multiplier}x
                  </td>
                  <td className="py-3 pl-4 text-right font-mono tabular-nums text-slate-300">
                    {(seg.expectedContribution * 100).toFixed(2)}%
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-slate-700 text-xs font-mono tabular-nums text-slate-300 bg-slate-900/40">
                <td className="py-3 pr-4 font-sans font-semibold text-slate-200">
                  Theoretical Totals
                </td>
                <td className="py-3 px-4 text-right">{calculation.totalWeight}</td>
                <td className="py-3 px-4 text-right">100.00%</td>
                <td className="py-3 px-4 text-right">360.0°</td>
                <td className="py-3 px-4 text-right text-slate-500">—</td>
                <td className="py-3 pl-4 text-right font-semibold text-emerald-400">
                  {calculation.rtpPercent.toFixed(2)}% RTP
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Cryptographic Provably Fair Verifier */}
      <div className="bg-[#111827] border border-slate-800 rounded-xl p-6 grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <h3 className="text-base font-semibold text-slate-100">
              Client Seed & Randomness Control
            </h3>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed mb-4">
            Every spin combines a hardware CSPRNG server seed (SHA-256 committed) with your
            client seed and spin nonce to derive an unbiased uniform roll over the total wheel weight.
          </p>

          <div className="flex flex-col gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Active Client Seed
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={seedInput}
                  onChange={(e) => setSeedInput(e.target.value)}
                  className="flex-1 px-3 py-2 bg-[#0B1120] border border-slate-700 rounded-lg font-mono text-xs text-slate-100 focus:border-amber-500 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => {
                    const fresh = generateSecureHex(8);
                    setSeedInput(fresh);
                    onUpdateClientSeed(fresh);
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Randomize
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (seedInput.trim()) onUpdateClientSeed(seedInput.trim());
                  }}
                  className="px-3 py-2 text-xs font-medium bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  Save
                </button>
              </div>
            </div>

            <div className="flex items-center gap-4 text-xs font-mono tabular-nums text-slate-400 pt-1">
              <span>Next Spin Nonce: #{nonce}</span>
              <span className="text-slate-600">·</span>
              <span>Active Seed: {clientSeed}</span>
            </div>
          </div>
        </div>

        {/* Spin Outcome Verifier */}
        <div className="border-t lg:border-t-0 lg:border-l border-slate-800 pt-6 lg:pt-0 lg:pl-8">
          <div className="flex items-center justify-between gap-2 mb-3">
            <h4 className="text-sm font-semibold text-slate-100">Verify Recorded Spin</h4>
            {recentSpins.length > 0 && (
              <select
                value={activeSpin?.id ?? ''}
                onChange={(e) => {
                  const found = recentSpins.find((s) => s.id === e.target.value) ?? null;
                  onSelectProofSpin(found);
                  setVerificationResult(null);
                }}
                className="bg-[#0B1120] border border-slate-700 rounded-md px-2.5 py-1 text-xs font-mono text-slate-200 focus:outline-none"
              >
                {recentSpins.slice(0, 25).map((s) => (
                  <option key={s.id} value={s.id}>
                    Spin #{s.fairness.nonce} · {s.segmentLabel} ({s.multiplier}x)
                  </option>
                ))}
              </select>
            )}
          </div>

          {activeSpin ? (
            <div className="flex flex-col gap-2.5 text-xs font-mono">
              <div className="grid grid-cols-[120px_1fr] gap-2 text-slate-400">
                <span>Server Seed:</span>
                <span className="text-slate-200 break-all">{activeSpin.fairness.serverSeed}</span>
                <span>SHA-256 Hash:</span>
                <span className="text-slate-300 break-all">{activeSpin.fairness.serverSeedHash}</span>
                <span>Client / Nonce:</span>
                <span className="text-slate-200">
                  {activeSpin.fairness.clientSeed} · #{activeSpin.fairness.nonce}
                </span>
                <span>Mapped Roll:</span>
                <span className="text-amber-400 tabular-nums">
                  {activeSpin.fairness.rollScaled.toLocaleString()} /{' '}
                  {activeSpin.fairness.totalWeightScaled.toLocaleString()} (
                  {(activeSpin.fairness.normalizedRoll * 100).toFixed(4)}%)
                </span>
              </div>

              <div className="pt-2 flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => handleRunVerify(activeSpin)}
                  className="px-3.5 py-2 text-xs font-sans font-semibold bg-slate-800 hover:bg-slate-700 text-slate-100 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  Run SHA-256 Verification
                </button>

                {verificationResult && verificationResult.spinId === activeSpin.id && (
                  <div className="flex items-center gap-1.5 text-xs font-sans">
                    {verificationResult.seedHashMatches && verificationResult.rollMatches ? (
                      <>
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                        <span className="text-emerald-400 font-medium">
                          Verified Exact Match ({verificationResult.computedSegmentLabel})
                        </span>
                      </>
                    ) : (
                      <>
                        <XCircle className="w-4 h-4 text-rose-400 shrink-0" />
                        <span className="text-rose-400 font-medium">
                          Config Changed Since Spin
                        </span>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <p className="text-xs text-slate-400 py-4">
              Complete at least one spin to inspect and verify its cryptographic SHA-256 proof.
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
