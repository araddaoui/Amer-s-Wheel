import React from 'react';
import { Play, RotateCcw, PlusCircle, ShieldAlert } from 'lucide-react';
import { BetLimits, ProbabilityCalculation, SpinRecord } from '../types/game';
import { calculateExpectedPlayerNet } from '../services/probabilityEngine';

interface BettingPanelProps {
  balance: number;
  betAmount: number;
  onBetChange: (amount: number) => void;
  limits: BetLimits;
  calculation: ProbabilityCalculation;
  isSpinning: boolean;
  validationError: string | null;
  lastSpin: SpinRecord | null;
  onSpin: () => void;
  onTopUp: (amount: number) => void;
  onResetBalance: () => void;
  onInspectProof?: (spin: SpinRecord) => void;
}

export const BettingPanel: React.FC<BettingPanelProps> = ({
  balance,
  betAmount,
  onBetChange,
  limits,
  calculation,
  isSpinning,
  validationError,
  lastSpin,
  onSpin,
  onTopUp,
  onResetBalance,
  onInspectProof,
}) => {
  const quickPresets = [5, 10, 25, 100, 250].filter(
    (amt) => amt >= limits.minBet && amt <= limits.maxBet
  );

  const expectedNet = calculateExpectedPlayerNet(
    Number.isFinite(betAmount) && betAmount > 0 ? betAmount : 0,
    calculation.houseEdge
  );

  const handleHalf = () => {
    const next = Math.max(limits.minBet, Math.floor((betAmount / 2) * 100) / 100);
    onBetChange(next);
  };

  const handleDouble = () => {
    const cap = Math.min(limits.maxBet, balance);
    const next = Math.min(cap, Math.round(betAmount * 2 * 100) / 100);
    onBetChange(Math.max(limits.minBet, next));
  };

  const handleMax = () => {
    const maxAffordable = Math.min(limits.maxBet, Math.floor(balance * 100) / 100);
    onBetChange(Math.max(limits.minBet, maxAffordable));
  };

  const canSpin = !isSpinning && calculation.isValid && validationError === null;

  return (
    <div className="bg-[#111827] border border-slate-800 rounded-xl p-6 flex flex-col gap-6">
      {/* Balance Header */}
      <div className="flex items-start justify-between gap-4 pb-5 border-b border-slate-800/80">
        <div>
          <p className="text-xs font-medium text-slate-400">Available Balance</p>
          <p className="mt-1 text-3xl font-bold font-mono tabular-nums tracking-tight text-slate-50">
            ${balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => onTopUp(500)}
            disabled={isSpinning}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            title="Add $500 virtual credits"
          >
            <PlusCircle className="w-3.5 h-3.5 text-emerald-400" />
            +$500
          </button>
          <button
            type="button"
            onClick={onResetBalance}
            disabled={isSpinning}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-300 bg-slate-900 border border-slate-800 hover:bg-slate-800 disabled:opacity-50 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            title={`Reset balance to $${limits.defaultBalance}`}
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset
          </button>
        </div>
      </div>

      {/* Wager Input */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between text-xs">
          <label htmlFor="wager-input" className="font-medium text-slate-300">
            Wager Amount
          </label>
          <span className="font-mono tabular-nums text-slate-400">
            Limits: ${limits.minBet.toFixed(0)} – ${limits.maxBet.toLocaleString()}
          </span>
        </div>

        <div className="flex items-stretch gap-2">
          <div className="relative flex-1">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-mono text-base">
              $
            </span>
            <input
              id="wager-input"
              type="number"
              min={limits.minBet}
              max={limits.maxBet}
              step="1"
              disabled={isSpinning}
              value={Number.isFinite(betAmount) ? betAmount : ''}
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                onBetChange(Number.isNaN(val) ? 0 : val);
              }}
              className="w-full pl-8 pr-4 py-3 bg-[#0B1120] border border-slate-700 focus:border-amber-500 focus:outline-none rounded-lg font-mono text-lg font-semibold tabular-nums text-slate-100 disabled:opacity-60"
            />
          </div>

          <button
            type="button"
            onClick={handleHalf}
            disabled={isSpinning}
            className="px-3 py-2 text-xs font-mono font-semibold text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors disabled:opacity-50 cursor-pointer"
          >
            1/2
          </button>
          <button
            type="button"
            onClick={handleDouble}
            disabled={isSpinning}
            className="px-3 py-2 text-xs font-mono font-semibold text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors disabled:opacity-50 cursor-pointer"
          >
            2x
          </button>
          <button
            type="button"
            onClick={handleMax}
            disabled={isSpinning}
            className="px-3 py-2 text-xs font-mono font-semibold text-amber-400 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors disabled:opacity-50 cursor-pointer"
          >
            Max
          </button>
        </div>

        {/* Preset Wagers */}
        {quickPresets.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 pt-1">
            {quickPresets.map((preset) => (
              <button
                key={preset}
                type="button"
                disabled={isSpinning}
                onClick={() => onBetChange(preset)}
                className={`px-3 py-1.5 text-xs font-mono font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  betAmount === preset
                    ? 'bg-amber-500/15 text-amber-300 border border-amber-500/40'
                    : 'bg-slate-900 text-slate-400 border border-slate-800 hover:text-slate-200 hover:border-slate-700'
                }`}
              >
                ${preset}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Mathematical Expected Value Disclosure */}
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-xs text-slate-400 font-mono tabular-nums py-2.5 border-y border-slate-800/80">
        <span>RTP: {calculation.rtpPercent.toFixed(2)}%</span>
        <span className="text-slate-600">·</span>
        <span>House Edge: {calculation.houseEdgePercent.toFixed(2)}%</span>
        <span className="text-slate-600">·</span>
        <span>
          Expected Net:{' '}
          <span className={expectedNet < 0 ? 'text-rose-400' : 'text-emerald-400'}>
            {expectedNet < 0 ? `-$${Math.abs(expectedNet).toFixed(2)}` : `$${expectedNet.toFixed(2)}`}
          </span>
        </span>
      </div>

      {/* Validation Warning / Error */}
      {(!calculation.isValid || validationError) && (
        <div className="flex items-start gap-2.5 p-3 rounded-lg bg-rose-950/40 border border-rose-800/60 text-xs text-rose-200">
          <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
          <span>
            {!calculation.isValid
              ? 'Active wheel configuration has mathematical errors. Open the Operator Console to fix weights or house edge.'
              : validationError}
          </span>
        </div>
      )}

      {/* Primary Action: Spin Button */}
      <button
        type="button"
        onClick={onSpin}
        disabled={!canSpin}
        className="w-full py-3.5 px-6 rounded-xl font-display font-bold text-base tracking-wide flex items-center justify-center gap-2.5 transition-all cursor-pointer bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-sm disabled:bg-slate-800 disabled:text-slate-500 disabled:cursor-not-allowed"
      >
        <Play className="w-4 h-4 fill-current" />
        {isSpinning ? 'Spinning Wheel...' : `Spin for $${(Number.isFinite(betAmount) ? betAmount : 0).toFixed(2)}`}
      </button>

      {/* Latest Result Notification */}
      {lastSpin && !isSpinning && (
        <div
          className={`p-4 rounded-xl border transition-opacity ${
            lastSpin.multiplier > 1
              ? 'bg-emerald-950/35 border-emerald-700/50'
              : lastSpin.multiplier === 1
              ? 'bg-blue-950/35 border-blue-700/50'
              : 'bg-slate-900/90 border-slate-700/80'
          }`}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <span
                className="w-3 h-3 rounded-sm shrink-0"
                style={{ backgroundColor: lastSpin.segmentColor }}
              />
              <div>
                <p className="text-sm font-semibold text-slate-100">
                  {lastSpin.multiplier > 1
                    ? `Won on ${lastSpin.segmentLabel}!`
                    : lastSpin.multiplier === 1
                    ? `Break Even — Stake Returned`
                    : `No Win — ${lastSpin.segmentLabel}`}
                </p>
                <p className="text-xs text-slate-400 font-mono tabular-nums mt-0.5">
                  {lastSpin.multiplier}x Multiplier · {lastSpin.probabilityPercent.toFixed(2)}% Odds
                </p>
              </div>
            </div>

            <div className="text-right font-mono tabular-nums">
              <p
                className={`text-lg font-bold ${
                  lastSpin.netResult > 0
                    ? 'text-emerald-400'
                    : lastSpin.netResult === 0
                    ? 'text-blue-300'
                    : 'text-rose-400'
                }`}
              >
                {lastSpin.netResult > 0
                  ? `+$${lastSpin.netResult.toFixed(2)}`
                  : lastSpin.netResult === 0
                  ? '$0.00'
                  : `-$${Math.abs(lastSpin.netResult).toFixed(2)}`}
              </p>
              <p className="text-xs text-slate-400">
                Payout ${lastSpin.payout.toFixed(2)}
              </p>
            </div>
          </div>

          {onInspectProof && (
            <div className="mt-3 pt-2.5 border-t border-slate-800/70 flex items-center justify-between text-xs text-slate-400">
              <span className="font-mono truncate max-w-[210px]">
                Hash: {lastSpin.fairness.serverSeedHash.slice(0, 18)}...
              </span>
              <button
                type="button"
                onClick={() => onInspectProof(lastSpin)}
                className="text-amber-400 hover:text-amber-300 font-medium whitespace-nowrap shrink-0 cursor-pointer"
              >
                Verify Outcome
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
