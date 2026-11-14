import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Calculator,
  Check,
  Lock,
  Plus,
  RotateCcw,
  Save,
  Trash2,
  Unlock,
} from 'lucide-react';
import {
  AuditLogEntry,
  BetLimits,
  ConfigHistoryEntry,
  GameConfig,
  PlayerState,
  TargetEdgeProposal,
  TargetEdgeStrategy,
  WheelSegment,
} from '../types/game';
import {
  calculateExpectedOperatorRevenue,
  calculateProbabilities,
  DEFAULT_LIMITS,
  DEFAULT_SEGMENTS,
  proposeProbabilitiesForTargetEdge,
} from '../services/probabilityEngine';
import { SimulationPanel } from './SimulationPanel';
import { AuditLog } from './AuditLog';

interface OperatorDashboardProps {
  config: GameConfig;
  player: PlayerState;
  auditEntries: AuditLogEntry[];
  configHistory: ConfigHistoryEntry[];
  isAuthenticated: boolean;
  onAuthenticate: (pin: string) => boolean;
  onLock: () => void;
  onPublishConfig: (
    nextSegments: WheelSegment[],
    nextLimits: BetLimits,
    nextPin: string,
    summary: string
  ) => void;
}

const PALETTE_SWATCHES = [
  '#1E293B',
  '#2563EB',
  '#059669',
  '#D97706',
  '#E11D48',
  '#7C3AED',
  '#0891B2',
  '#4F46E5',
];

const TARGET_EDGE_PRESETS = [3, 5, 8, 10];

export const OperatorDashboard: React.FC<OperatorDashboardProps> = ({
  config,
  player,
  auditEntries,
  configHistory,
  isAuthenticated,
  onAuthenticate,
  onLock,
  onPublishConfig,
}) => {
  const [pinInput, setPinInput] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<
    'config' | 'financials' | 'simulation' | 'audit'
  >('config');

  // Draft editing state (keeps live player wheel safe until operator clicks Publish)
  const [draftSegments, setDraftSegments] = useState<WheelSegment[]>(() =>
    config.segments.map((s) => ({ ...s }))
  );
  const [draftLimits, setDraftLimits] = useState<BetLimits>(() => ({ ...config.limits }));
  const [draftPin, setDraftPin] = useState<string>(config.operatorPin);
  const [wagerVolumeProjection, setWagerVolumeProjection] = useState<number>(10000);

  // Target house edge calculator state
  const [targetEdgeInput, setTargetEdgeInput] = useState<number>(5);
  const [targetStrategy, setTargetStrategy] = useState<TargetEdgeStrategy>('loss-rebalance');
  const [proposal, setProposal] = useState<TargetEdgeProposal | null>(null);
  const [publishFeedback, setPublishFeedback] = useState<string | null>(null);

  useEffect(() => {
    setDraftSegments(config.segments.map((s) => ({ ...s })));
    setDraftLimits({ ...config.limits });
    setDraftPin(config.operatorPin);
  }, [config]);

  const draftCalc = useMemo(
    () => calculateProbabilities(draftSegments, draftLimits),
    [draftSegments, draftLimits]
  );

  const liveCalc = useMemo(
    () => calculateProbabilities(config.segments, config.limits),
    [config]
  );

  const hasUnsavedChanges = useMemo(() => {
    return (
      JSON.stringify(draftSegments) !== JSON.stringify(config.segments) ||
      JSON.stringify(draftLimits) !== JSON.stringify(config.limits) ||
      draftPin !== config.operatorPin
    );
  }, [draftSegments, draftLimits, draftPin, config]);

  // Clear stale proposal when segments are manually edited
  const updateSegments = (updater: (prev: WheelSegment[]) => WheelSegment[]) => {
    setProposal(null);
    setPublishFeedback(null);
    setDraftSegments(updater);
  };

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const ok = onAuthenticate(pinInput.trim());
    if (!ok) {
      setAuthError('Invalid operator passcode. Default demo passcode is 1234.');
    } else {
      setAuthError(null);
      setPinInput('');
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="max-w-md mx-auto my-12 bg-[#111827] border border-slate-800 rounded-2xl p-8">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center">
            <Lock className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-100">Operator Console Access</h2>
            <p className="text-xs text-slate-400">Protected probability & financial administration</p>
          </div>
        </div>

        <form onSubmit={handleLoginSubmit} className="flex flex-col gap-4">
          <div>
            <label htmlFor="operator-pin" className="block text-xs font-medium text-slate-300 mb-1.5">
              Operator Passcode
            </label>
            <input
              id="operator-pin"
              type="password"
              value={pinInput}
              onChange={(e) => setPinInput(e.target.value)}
              placeholder="Enter passcode (default: 1234)"
              autoFocus
              className="w-full px-3.5 py-2.5 bg-[#0B1120] border border-slate-700 focus:border-amber-500 focus:outline-none rounded-lg font-mono text-sm text-slate-100"
            />
          </div>

          {authError && <p className="text-xs text-rose-400">{authError}</p>}

          <div className="flex items-center gap-2.5">
            <button
              type="submit"
              className="flex-1 py-2.5 px-4 bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-xs rounded-lg transition-colors cursor-pointer"
            >
              Unlock Console
            </button>
            <button
              type="button"
              onClick={() => onAuthenticate(config.operatorPin)}
              className="py-2.5 px-3.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-lg transition-colors whitespace-nowrap cursor-pointer"
            >
              Demo Unlock ({config.operatorPin})
            </button>
          </div>
        </form>
      </div>
    );
  }

  const handleAddSegment = () => {
    const idx = draftSegments.length;
    const color = PALETTE_SWATCHES[idx % PALETTE_SWATCHES.length];
    updateSegments((prev) => [
      ...prev,
      {
        id: `seg-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        label: `Tier ${idx + 1}`,
        weight: 5,
        multiplier: 1.5,
        color,
      },
    ]);
  };

  const handleDeleteSegment = (id: string) => {
    if (draftSegments.length <= 2) return;
    updateSegments((prev) => prev.filter((s) => s.id !== id));
  };

  const handleMoveSegment = (index: number, direction: -1 | 1) => {
    const targetIdx = index + direction;
    if (targetIdx < 0 || targetIdx >= draftSegments.length) return;
    updateSegments((prev) => {
      const copy = [...prev];
      const temp = copy[index];
      copy[index] = copy[targetIdx];
      copy[targetIdx] = temp;
      return copy;
    });
  };

  const handleResetDefaults = () => {
    setProposal(null);
    setPublishFeedback(null);
    setDraftSegments(DEFAULT_SEGMENTS.map((s) => ({ ...s })));
    setDraftLimits({ ...DEFAULT_LIMITS });
  };

  const handleCalculateProposal = () => {
    const res = proposeProbabilitiesForTargetEdge(
      draftSegments,
      targetEdgeInput,
      targetStrategy
    );
    setProposal(res);
  };

  const handleApplyProposal = () => {
    if (!proposal || !proposal.feasible) return;
    const weightMap = new Map(proposal.proposedSegments.map((p) => [p.id, p.proposedWeight]));
    setDraftSegments((prev) =>
      prev.map((seg) => ({
        ...seg,
        weight: weightMap.get(seg.id) ?? seg.weight,
      }))
    );
    setProposal(null);
    setPublishFeedback('Proposal applied to draft. Review weights and click Publish Configuration to go live.');
  };

  const handlePublish = () => {
    if (!draftCalc.isValid) return;
    if (draftPin.trim().length < 4) return;

    const summary = `Published ${draftSegments.length} segments (RTP ${draftCalc.rtpPercent.toFixed(2)}%, House Edge ${draftCalc.houseEdgePercent.toFixed(2)}%, Limits $${draftLimits.minBet}–$${draftLimits.maxBet})`;
    onPublishConfig(draftSegments, draftLimits, draftPin.trim(), summary);
    setPublishFeedback('Configuration published live to Player Interface.');
  };

  const handleRestoreSnapshot = (entry: ConfigHistoryEntry) => {
    setDraftSegments(entry.segmentsSnapshot.map((s) => ({ ...s })));
    setDraftLimits({ ...entry.limitsSnapshot });
    setActiveTab('config');
    setPublishFeedback('Snapshot loaded into draft. Click Publish Configuration to make it active.');
  };

  // Live financial reporting metrics from recorded player spins
  const actualTotalWagers = player.stats.totalWagered;
  const actualTotalPayouts = player.stats.totalPayout;
  const actualOperatorProfit = actualTotalWagers - actualTotalPayouts;
  const actualHouseHoldPercent =
    actualTotalWagers > 0 ? (actualOperatorProfit / actualTotalWagers) * 100 : 0;
  const expectedProfitOnLiveWagers = player.history.reduce(
    (acc, s) => acc + s.betAmount * (s.theoreticalHouseEdgePercent / 100),
    0
  );

  const projectedExpectedRevenue = calculateExpectedOperatorRevenue(
    wagerVolumeProjection,
    draftCalc.houseEdge
  );

  return (
    <div className="flex flex-col gap-6">
      {/* Operator Header & Sub-Navigation */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-100 tracking-tight">
            Operator Administration Console
          </h1>
          <p className="text-xs text-slate-400 mt-0.5 font-mono tabular-nums">
            Live RTP: {liveCalc.rtpPercent.toFixed(2)}% · Live House Edge:{' '}
            {liveCalc.houseEdgePercent.toFixed(2)}% · {config.segments.length} Segments
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1 p-1 bg-[#111827] border border-slate-800 rounded-lg">
            {(
              [
                { id: 'config', label: 'Wheel & House Edge' },
                { id: 'financials', label: 'Financial Reports' },
                { id: 'simulation', label: 'Simulation Lab' },
                { id: 'audit', label: 'Audit & History' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  activeTab === tab.id
                    ? 'bg-slate-800 text-slate-100'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={onLock}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-300 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Unlock className="w-3.5 h-3.5 text-amber-400" />
            Lock Console
          </button>
        </div>
      </div>

      {/* Prominent Mathematical KPI Strip (Always visible in Operator Console) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#111827] border border-slate-800 rounded-xl p-5">
          <p className="text-xs font-medium text-slate-400">Draft Theoretical RTP</p>
          <p
            className={`mt-1.5 text-2xl font-bold font-mono tabular-nums ${
              draftCalc.rtp > 1 ? 'text-rose-400' : 'text-emerald-400'
            }`}
          >
            {draftCalc.rtpPercent.toFixed(2)}%
          </p>
          <p className="mt-1 text-xs font-mono tabular-nums text-slate-400">
            Σ [P(i) × Multiplier(i)]
          </p>
        </div>

        <div className="bg-[#111827] border border-slate-800 rounded-xl p-5">
          <p className="text-xs font-medium text-slate-400">Draft House Edge</p>
          <p
            className={`mt-1.5 text-2xl font-bold font-mono tabular-nums ${
              draftCalc.houseEdge < 0
                ? 'text-rose-400'
                : draftCalc.houseEdge === 0
                ? 'text-amber-300'
                : 'text-amber-400'
            }`}
          >
            {draftCalc.houseEdgePercent.toFixed(2)}%
          </p>
          <p className="mt-1 text-xs font-mono tabular-nums text-slate-400">
            1 − RTP ({draftCalc.houseEdge.toFixed(4)})
          </p>
        </div>

        <div className="bg-[#111827] border border-slate-800 rounded-xl p-5">
          <p className="text-xs font-medium text-slate-400">Total Weight & Segments</p>
          <p className="mt-1.5 text-2xl font-bold font-mono tabular-nums text-slate-100">
            {draftCalc.totalWeight}
          </p>
          <p className="mt-1 text-xs font-mono tabular-nums text-slate-400">
            {draftSegments.length} segments configured
          </p>
        </div>

        <div className="bg-[#111827] border border-slate-800 rounded-xl p-5">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-medium text-slate-400">Expected Revenue</p>
            <select
              value={wagerVolumeProjection}
              onChange={(e) => setWagerVolumeProjection(Number(e.target.value))}
              className="bg-[#0B1120] border border-slate-800 rounded px-1.5 py-0.5 text-[11px] font-mono text-slate-300 focus:outline-none"
            >
              <option value={1000}>per $1k</option>
              <option value={10000}>per $10k</option>
              <option value={100000}>per $100k</option>
            </select>
          </div>
          <p
            className={`mt-1.5 text-2xl font-bold font-mono tabular-nums ${
              projectedExpectedRevenue >= 0 ? 'text-emerald-400' : 'text-rose-400'
            }`}
          >
            ${projectedExpectedRevenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <p className="mt-1 text-xs font-mono tabular-nums text-slate-400">
            Total Wagers × House Edge
          </p>
        </div>
      </div>

      {/* Validation Issues Banner */}
      {draftCalc.issues.length > 0 && (
        <div className="flex flex-col gap-2">
          {draftCalc.issues.map((issue) => (
            <div
              key={issue.id}
              className={`flex items-start gap-2.5 p-3.5 rounded-xl border text-xs ${
                issue.severity === 'error'
                  ? 'bg-rose-950/40 border-rose-800/70 text-rose-200'
                  : 'bg-amber-950/30 border-amber-800/60 text-amber-200'
              }`}
            >
              <AlertTriangle
                className={`w-4 h-4 shrink-0 mt-0.5 ${
                  issue.severity === 'error' ? 'text-rose-400' : 'text-amber-400'
                }`}
              />
              <span>{issue.message}</span>
            </div>
          ))}
        </div>
      )}

      {publishFeedback && (
        <div className="flex items-center justify-between gap-3 p-3.5 rounded-xl bg-emerald-950/35 border border-emerald-700/60 text-xs text-emerald-200">
          <span className="flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-400" />
            {publishFeedback}
          </span>
          <button
            type="button"
            onClick={() => setPublishFeedback(null)}
            className="text-emerald-400 hover:text-emerald-300 font-medium cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* TAB 1: WHEEL CONFIGURATION & TARGET HOUSE-EDGE ENGINE */}
      {activeTab === 'config' && (
        <div className="flex flex-col gap-6">
          {/* Segment Configuration Table + Live Proportional Preview */}
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
            {/* Segment Editor */}
            <div className="xl:col-span-8 bg-[#111827] border border-slate-800 rounded-xl p-6 flex flex-col gap-5">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold text-slate-100">
                    Wheel Segments & Weights
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Every edit dynamically recalculates probabilities, RTP, house edge, and slice
                    proportions.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleAddSegment}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-100 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5 text-amber-400" />
                    Add Segment
                  </button>
                  <button
                    type="button"
                    onClick={handleResetDefaults}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Reset Defaults
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400">
                      <th className="py-2 pr-2">Color</th>
                      <th className="py-2 px-2">Outcome Label</th>
                      <th className="py-2 px-2 text-right">Weight</th>
                      <th className="py-2 px-2 text-right">Prob %</th>
                      <th className="py-2 px-2 text-right">Multiplier (x)</th>
                      <th className="py-2 px-2 text-right">EV Contrib</th>
                      <th className="py-2 pl-2 text-right">Order / Del</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {draftSegments.map((seg, idx) => {
                      const comp = draftCalc.segments[idx];
                      return (
                        <tr key={seg.id} className="hover:bg-slate-800/20">
                          <td className="py-2.5 pr-2">
                            <input
                              type="color"
                              value={seg.color}
                              onChange={(e) =>
                                updateSegments((prev) =>
                                  prev.map((s) =>
                                    s.id === seg.id ? { ...s, color: e.target.value } : s
                                  )
                                )
                              }
                              aria-label={`Color for ${seg.label}`}
                              className="w-8 h-8 rounded bg-transparent border border-slate-700 cursor-pointer p-0.5"
                            />
                          </td>
                          <td className="py-2.5 px-2 min-w-[140px]">
                            <input
                              type="text"
                              value={seg.label}
                              onChange={(e) =>
                                updateSegments((prev) =>
                                  prev.map((s) =>
                                    s.id === seg.id ? { ...s, label: e.target.value } : s
                                  )
                                )
                              }
                              className="w-full px-2.5 py-1.5 bg-[#0B1120] border border-slate-700 rounded-md text-xs text-slate-100 focus:border-amber-500 focus:outline-none"
                            />
                          </td>
                          <td className="py-2.5 px-2 w-24">
                            <input
                              type="number"
                              min="0"
                              step="any"
                              value={Number.isFinite(seg.weight) ? seg.weight : ''}
                              onChange={(e) => {
                                const val = parseFloat(e.target.value);
                                updateSegments((prev) =>
                                  prev.map((s) =>
                                    s.id === seg.id
                                      ? { ...s, weight: Number.isNaN(val) ? 0 : val }
                                      : s
                                  )
                                );
                              }}
                              className="w-full px-2.5 py-1.5 bg-[#0B1120] border border-slate-700 rounded-md font-mono text-xs text-right tabular-nums text-slate-100 focus:border-amber-500 focus:outline-none"
                            />
                          </td>
                          <td className="py-2.5 px-2 text-right font-mono tabular-nums text-slate-300 whitespace-nowrap">
                            {comp ? `${comp.probabilityPercent.toFixed(2)}%` : '0.00%'}
                          </td>
                          <td className="py-2.5 px-2 w-24">
                            <input
                              type="number"
                              min="0"
                              step="0.1"
                              value={Number.isFinite(seg.multiplier) ? seg.multiplier : ''}
                              onChange={(e) => {
                                const val = parseFloat(e.target.value);
                                updateSegments((prev) =>
                                  prev.map((s) =>
                                    s.id === seg.id
                                      ? { ...s, multiplier: Number.isNaN(val) ? 0 : val }
                                      : s
                                  )
                                );
                              }}
                              className="w-full px-2.5 py-1.5 bg-[#0B1120] border border-slate-700 rounded-md font-mono text-xs text-right tabular-nums text-amber-400 font-semibold focus:border-amber-500 focus:outline-none"
                            />
                          </td>
                          <td className="py-2.5 px-2 text-right font-mono tabular-nums text-slate-400 whitespace-nowrap">
                            {comp ? `${(comp.expectedContribution * 100).toFixed(2)}%` : '0.00%'}
                          </td>
                          <td className="py-2.5 pl-2 text-right">
                            <div className="inline-flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => handleMoveSegment(idx, -1)}
                                disabled={idx === 0}
                                title="Move Up"
                                className="p-1.5 text-slate-400 hover:text-slate-100 disabled:opacity-30 cursor-pointer"
                              >
                                <ArrowUp className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleMoveSegment(idx, 1)}
                                disabled={idx === draftSegments.length - 1}
                                title="Move Down"
                                className="p-1.5 text-slate-400 hover:text-slate-100 disabled:opacity-30 cursor-pointer"
                              >
                                <ArrowDown className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteSegment(seg.id)}
                                disabled={draftSegments.length <= 2}
                                title="Delete Segment"
                                className="p-1.5 text-slate-400 hover:text-rose-400 disabled:opacity-30 cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Publish Bar */}
              <div className="pt-4 border-t border-slate-800 flex flex-wrap items-center justify-between gap-4">
                <div className="text-xs text-slate-400">
                  {hasUnsavedChanges
                    ? 'You have unpublished draft changes.'
                    : 'Draft matches the currently live wheel configuration.'}
                </div>
                <div className="flex items-center gap-2.5">
                  {hasUnsavedChanges && (
                    <button
                      type="button"
                      onClick={() => {
                        setDraftSegments(config.segments.map((s) => ({ ...s })));
                        setDraftLimits({ ...config.limits });
                        setDraftPin(config.operatorPin);
                        setProposal(null);
                      }}
                      className="px-3.5 py-2 text-xs font-medium text-slate-300 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg transition-colors cursor-pointer"
                    >
                      Discard Draft
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handlePublish}
                    disabled={!draftCalc.isValid || draftPin.trim().length < 4}
                    className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold bg-amber-500 hover:bg-amber-400 disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 rounded-lg transition-colors cursor-pointer"
                  >
                    <Save className="w-3.5 h-3.5" />
                    Publish Configuration
                  </button>
                </div>
              </div>
            </div>

            {/* Live Proportional Wheel Preview & Probability Spectrum */}
            <div className="xl:col-span-4 bg-[#111827] border border-slate-800 rounded-xl p-6 flex flex-col gap-5">
              <div>
                <h3 className="text-base font-semibold text-slate-100">
                  Draft Geometry Preview
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Arc degrees match exact probability ratios.
                </p>
              </div>

              {/* Compact Proportional SVG Wheel */}
              <div className="flex justify-center">
                <svg viewBox="-120 -120 240 240" className="w-52 h-52">
                  <circle cx="0" cy="0" r="112" fill="#0B1120" stroke="#334155" strokeWidth="2" />
                  {draftCalc.segments
                    .filter((s) => s.weight > 0)
                    .map((seg) => {
                      const sweep = seg.endAngle - seg.startAngle;
                      if (sweep >= 359.99) {
                        return <circle key={seg.id} cx="0" cy="0" r="106" fill={seg.color} />;
                      }
                      const r = 106;
                      const a1 = ((seg.startAngle - 90) * Math.PI) / 180;
                      const a2 = ((seg.endAngle - 90) * Math.PI) / 180;
                      const x1 = r * Math.cos(a1);
                      const y1 = r * Math.sin(a1);
                      const x2 = r * Math.cos(a2);
                      const y2 = r * Math.sin(a2);
                      const large = sweep > 180 ? 1 : 0;
                      return (
                        <path
                          key={seg.id}
                          d={`M 0 0 L ${x1.toFixed(2)} ${y1.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${x2.toFixed(2)} ${y2.toFixed(2)} Z`}
                          fill={seg.color}
                          stroke="#0B1120"
                          strokeWidth="1.5"
                        />
                      );
                    })}
                  <circle cx="0" cy="0" r="24" fill="#111827" stroke="#334155" strokeWidth="2" />
                </svg>
              </div>

              {/* Proportional Horizontal Bar */}
              <div>
                <div className="w-full h-3.5 rounded overflow-hidden flex border border-slate-800 bg-[#0B1120]">
                  {draftCalc.segments
                    .filter((s) => s.weight > 0)
                    .map((seg) => (
                      <div
                        key={seg.id}
                        style={{
                          width: `${seg.probabilityPercent}%`,
                          backgroundColor: seg.color,
                        }}
                        className="h-full border-r border-[#0B1120] last:border-r-0"
                      />
                    ))}
                </div>
                <div className="mt-3 flex flex-col gap-1.5">
                  {draftCalc.segments.map((seg) => (
                    <div
                      key={seg.id}
                      className="flex items-center justify-between text-xs font-mono tabular-nums"
                    >
                      <span className="flex items-center gap-2 font-sans text-slate-300 truncate">
                        <span
                          className="w-2.5 h-2.5 rounded-xs shrink-0"
                          style={{ backgroundColor: seg.color }}
                        />
                        {seg.label}
                      </span>
                      <span className="text-slate-400">
                        {seg.multiplier}x · {seg.probabilityPercent.toFixed(1)}% ({seg.sweepAngle.toFixed(1)}°)
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Target House-Edge Probability Calculator + Betting Limits */}
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
            {/* Target House-Edge Calculator */}
            <div className="xl:col-span-8 bg-[#111827] border border-slate-800 rounded-xl p-6 flex flex-col gap-5">
              <div>
                <div className="flex items-center gap-2">
                  <Calculator className="w-4 h-4 text-amber-400" />
                  <h3 className="text-base font-semibold text-slate-100">
                    Target House-Edge Calculator
                  </h3>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  Specify a desired house edge to preview mathematically balanced segment weights.
                  Assumptions and proposed probabilities are always shown before applying.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                <div className="md:col-span-5">
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    Target House Edge (%)
                  </label>
                  <div className="flex items-center gap-1.5">
                    {TARGET_EDGE_PRESETS.map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => {
                          setTargetEdgeInput(preset);
                          setProposal(null);
                        }}
                        className={`px-2.5 py-2 text-xs font-mono rounded-lg border transition-colors cursor-pointer ${
                          targetEdgeInput === preset
                            ? 'bg-amber-500/15 border-amber-500/50 text-amber-300'
                            : 'bg-[#0B1120] border-slate-800 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        {preset}%
                      </button>
                    ))}
                    <input
                      type="number"
                      min="0"
                      max="95"
                      step="0.5"
                      value={targetEdgeInput}
                      onChange={(e) => {
                        setTargetEdgeInput(parseFloat(e.target.value) || 0);
                        setProposal(null);
                      }}
                      className="w-20 px-2.5 py-2 bg-[#0B1120] border border-slate-700 rounded-lg font-mono text-xs text-slate-100 focus:border-amber-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="md:col-span-4">
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    Rebalancing Method
                  </label>
                  <select
                    value={targetStrategy}
                    onChange={(e) => {
                      setTargetStrategy(e.target.value as TargetEdgeStrategy);
                      setProposal(null);
                    }}
                    className="w-full px-3 py-2 bg-[#0B1120] border border-slate-700 rounded-lg text-xs text-slate-200 focus:border-amber-500 focus:outline-none"
                  >
                    <option value="loss-rebalance">Loss-Bucket Rebalance (0x vs Paying)</option>
                    <option value="two-group-blend">Low-vs-High Return Interpolation</option>
                  </select>
                </div>

                <div className="md:col-span-3">
                  <button
                    type="button"
                    onClick={handleCalculateProposal}
                    className="w-full py-2 px-4 bg-slate-800 hover:bg-slate-700 text-slate-100 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap cursor-pointer"
                  >
                    Calculate Proposal
                  </button>
                </div>
              </div>

              {/* Explicit Proposal Preview Before Applying */}
              {proposal && (
                <div className="border border-slate-700 rounded-xl bg-[#0B1120] p-5 flex flex-col gap-4">
                  {!proposal.feasible ? (
                    <div className="text-xs text-rose-300 flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                      <span>{proposal.reason}</span>
                    </div>
                  ) : (
                    <>
                      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800">
                        <div>
                          <h4 className="text-sm font-semibold text-slate-100">
                            Proposed Probability Adjustment (Preview Only)
                          </h4>
                          <p className="text-xs font-mono tabular-nums text-emerald-400 mt-0.5">
                            Target Edge: {proposal.targetHouseEdgePercent.toFixed(2)}% → Achieved:{' '}
                            {proposal.achievedHouseEdgePercent.toFixed(2)}% (RTP{' '}
                            {proposal.achievedRtpPercent.toFixed(2)}%)
                          </p>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setProposal(null)}
                            className="px-3 py-1.5 text-xs font-medium text-slate-400 hover:text-slate-200 cursor-pointer"
                          >
                            Dismiss
                          </button>
                          <button
                            type="button"
                            onClick={handleApplyProposal}
                            className="px-3.5 py-1.5 text-xs font-semibold bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-lg transition-colors cursor-pointer"
                          >
                            Apply Proposal to Draft
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                        <div>
                          <p className="font-semibold text-slate-300 mb-1.5">
                            Mathematical Assumptions
                          </p>
                          <ul className="list-disc list-inside space-y-1 text-slate-400">
                            {proposal.assumptions.map((a, i) => (
                              <li key={i}>{a}</li>
                            ))}
                          </ul>
                        </div>
                        <div>
                          <p className="font-semibold text-slate-300 mb-1.5">
                            Derivation Steps
                          </p>
                          <div className="space-y-1 font-mono text-[11px] text-slate-300">
                            {proposal.formulaSteps.map((step, i) => (
                              <p key={i}>{step}</p>
                            ))}
                          </div>
                        </div>
                      </div>

                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse text-xs">
                          <thead>
                            <tr className="border-b border-slate-800 text-slate-400">
                              <th className="py-2 pr-3">Segment</th>
                              <th className="py-2 px-3 text-right">Multiplier</th>
                              <th className="py-2 px-3 text-right">Current Prob</th>
                              <th className="py-2 px-3 text-right">Proposed Weight</th>
                              <th className="py-2 px-3 text-right">Proposed Prob</th>
                              <th className="py-2 pl-3 text-right">Change</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-800/60 font-mono tabular-nums">
                            {proposal.proposedSegments.map((row) => (
                              <tr key={row.id}>
                                <td className="py-2 pr-3 font-sans text-slate-200 font-medium">
                                  {row.label}
                                </td>
                                <td className="py-2 px-3 text-right text-amber-400">
                                  {row.multiplier}x
                                </td>
                                <td className="py-2 px-3 text-right text-slate-400">
                                  {row.currentProbabilityPercent.toFixed(2)}%
                                </td>
                                <td className="py-2 px-3 text-right text-slate-200">
                                  {row.proposedWeight}
                                </td>
                                <td className="py-2 px-3 text-right text-slate-100 font-semibold">
                                  {row.proposedProbabilityPercent.toFixed(2)}%
                                </td>
                                <td
                                  className={`py-2 pl-3 text-right ${
                                    row.deltaPercent > 0
                                      ? 'text-emerald-400'
                                      : row.deltaPercent < 0
                                      ? 'text-rose-400'
                                      : 'text-slate-500'
                                  }`}
                                >
                                  {row.deltaPercent > 0 ? '+' : ''}
                                  {row.deltaPercent.toFixed(2)}%
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Betting Limits & Security Settings */}
            <div className="xl:col-span-4 bg-[#111827] border border-slate-800 rounded-xl p-6 flex flex-col gap-4">
              <div>
                <h3 className="text-base font-semibold text-slate-100">
                  Betting Limits & Security
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Enforced on every wager in the Player Interface.
                </p>
              </div>

              <div className="flex flex-col gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Minimum Bet ($)
                  </label>
                  <input
                    type="number"
                    min="0.1"
                    step="1"
                    value={draftLimits.minBet}
                    onChange={(e) =>
                      setDraftLimits((prev) => ({
                        ...prev,
                        minBet: parseFloat(e.target.value) || 0,
                      }))
                    }
                    className="w-full px-3 py-2 bg-[#0B1120] border border-slate-700 rounded-lg font-mono text-xs text-slate-100 focus:border-amber-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Maximum Bet ($)
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="10"
                    value={draftLimits.maxBet}
                    onChange={(e) =>
                      setDraftLimits((prev) => ({
                        ...prev,
                        maxBet: parseFloat(e.target.value) || 0,
                      }))
                    }
                    className="w-full px-3 py-2 bg-[#0B1120] border border-slate-700 rounded-lg font-mono text-xs text-slate-100 focus:border-amber-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Default Player Starting Balance ($)
                  </label>
                  <input
                    type="number"
                    min="10"
                    step="50"
                    value={draftLimits.defaultBalance}
                    onChange={(e) =>
                      setDraftLimits((prev) => ({
                        ...prev,
                        defaultBalance: parseFloat(e.target.value) || 0,
                      }))
                    }
                    className="w-full px-3 py-2 bg-[#0B1120] border border-slate-700 rounded-lg font-mono text-xs text-slate-100 focus:border-amber-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Operator Passcode (min 4 chars)
                  </label>
                  <input
                    type="text"
                    value={draftPin}
                    onChange={(e) => setDraftPin(e.target.value)}
                    className="w-full px-3 py-2 bg-[#0B1120] border border-slate-700 rounded-lg font-mono text-xs text-slate-100 focus:border-amber-500 focus:outline-none"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: FINANCIAL & STATISTICAL REPORTING */}
      {activeTab === 'financials' && (
        <div className="flex flex-col gap-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-[#111827] border border-slate-800 rounded-xl p-5">
              <p className="text-xs font-medium text-slate-400">Live Handle (Total Wagers)</p>
              <p className="mt-1.5 text-2xl font-bold font-mono tabular-nums text-slate-100">
                ${actualTotalWagers.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
              <p className="mt-1 text-xs font-mono tabular-nums text-slate-400">
                Across {player.stats.totalSpins} settled spins
              </p>
            </div>

            <div className="bg-[#111827] border border-slate-800 rounded-xl p-5">
              <p className="text-xs font-medium text-slate-400">Total Player Payouts</p>
              <p className="mt-1.5 text-2xl font-bold font-mono tabular-nums text-slate-100">
                ${actualTotalPayouts.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
              <p className="mt-1 text-xs font-mono tabular-nums text-slate-400">
                Actual RTP:{' '}
                {actualTotalWagers > 0
                  ? `${((actualTotalPayouts / actualTotalWagers) * 100).toFixed(2)}%`
                  : '—'}
              </p>
            </div>

            <div className="bg-[#111827] border border-slate-800 rounded-xl p-5">
              <p className="text-xs font-medium text-slate-400">Actual Operator Net Hold</p>
              <p
                className={`mt-1.5 text-2xl font-bold font-mono tabular-nums ${
                  actualOperatorProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {actualOperatorProfit >= 0
                  ? `$${actualOperatorProfit.toFixed(2)}`
                  : `-$${Math.abs(actualOperatorProfit).toFixed(2)}`}
              </p>
              <p className="mt-1 text-xs font-mono tabular-nums text-slate-400">
                Hold %: {actualHouseHoldPercent.toFixed(2)}%
              </p>
            </div>

            <div className="bg-[#111827] border border-slate-800 rounded-xl p-5">
              <p className="text-xs font-medium text-slate-400">Expected Theoretical Revenue</p>
              <p className="mt-1.5 text-2xl font-bold font-mono tabular-nums text-amber-400">
                ${expectedProfitOnLiveWagers.toFixed(2)}
              </p>
              <p className="mt-1 text-xs font-mono tabular-nums text-slate-400">
                Variance:{' '}
                {actualOperatorProfit - expectedProfitOnLiveWagers >= 0 ? '+' : ''}
                ${(actualOperatorProfit - expectedProfitOnLiveWagers).toFixed(2)}
              </p>
            </div>
          </div>

          <div className="bg-[#111827] border border-slate-800 rounded-xl p-6">
            <h3 className="text-base font-semibold text-slate-100 mb-1">
              Live Segment Financial Breakdown
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              Real-money (virtual credit) settlement totals grouped by wheel outcome.
            </p>

            {player.history.length === 0 ? (
              <div className="py-10 text-center border border-dashed border-slate-800 rounded-lg text-xs text-slate-500">
                No player spins settled yet. Play spins in the Player Interface or test in the
                Simulation Lab.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400">
                      <th className="py-2.5 pr-3">Outcome</th>
                      <th className="py-2.5 px-3 text-right">Hits</th>
                      <th className="py-2.5 px-3 text-right">Observed %</th>
                      <th className="py-2.5 px-3 text-right">Wagered on Outcome</th>
                      <th className="py-2.5 pl-3 text-right">Total Paid Out</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-mono tabular-nums">
                    {config.segments.map((seg) => {
                      const matching = player.history.filter((h) => h.segmentId === seg.id);
                      const wagers = matching.reduce((s, h) => s + h.betAmount, 0);
                      const payouts = matching.reduce((s, h) => s + h.payout, 0);
                      const obsPct =
                        player.history.length > 0
                          ? (matching.length / player.history.length) * 100
                          : 0;
                      return (
                        <tr key={seg.id}>
                          <td className="py-2.5 pr-3 font-sans font-medium text-slate-200">
                            <span className="inline-flex items-center gap-2">
                              <span
                                className="w-2.5 h-2.5 rounded-xs"
                                style={{ backgroundColor: seg.color }}
                              />
                              {seg.label} ({seg.multiplier}x)
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-right text-slate-300">
                            {matching.length}
                          </td>
                          <td className="py-2.5 px-3 text-right text-slate-300">
                            {obsPct.toFixed(1)}%
                          </td>
                          <td className="py-2.5 px-3 text-right text-slate-300">
                            ${wagers.toFixed(2)}
                          </td>
                          <td className="py-2.5 pl-3 text-right text-slate-100">
                            ${payouts.toFixed(2)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: MONTE CARLO SIMULATION LABORATORY */}
      {activeTab === 'simulation' && (
        <SimulationPanel segments={draftSegments} calculation={draftCalc} />
      )}

      {/* TAB 4: AUDIT & CONFIG LOGS */}
      {activeTab === 'audit' && (
        <AuditLog
          auditEntries={auditEntries}
          configHistory={configHistory}
          onRestoreSnapshot={handleRestoreSnapshot}
        />
      )}
    </div>
  );
};
