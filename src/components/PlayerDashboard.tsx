import React, { useState } from 'react';
import { ArrowLeft, EyeOff, Eye, Volume2, VolumeX } from 'lucide-react';
import {
  GameConfig,
  PlayerState,
  ProbabilityCalculation,
  SpinRecord,
} from '../types/game';
import { Wheel } from './Wheel';
import { BettingPanel } from './BettingPanel';
import { ProbabilityPanel } from './ProbabilityPanel';
import { SpinHistory } from './SpinHistory';
import { StatisticsPanel } from './StatisticsPanel';
import { validateBet } from '../services/gameEngine';

interface PlayerDashboardProps {
  config: GameConfig;
  calculation: ProbabilityCalculation;
  player: PlayerState;
  betAmount: number;
  onBetChange: (amount: number) => void;
  wheelRotation: number;
  isSpinning: boolean;
  winningSegmentId: string | null;
  lastSpin: SpinRecord | null;
  outcomeTriggerKey: number;
  isMuted: boolean;
  onToggleMute: () => void;
  onSpin: () => void;
  onSpinComplete: () => void;
  onTopUp: (amount: number) => void;
  onResetBalance: () => void;
  onUpdateClientSeed: (seed: string) => void;
  onClearHistory: () => void;
  onBackToLobby: () => void;
  activeSubTab: 'odds' | 'history' | 'stats';
  onSubTabChange: (tab: 'odds' | 'history' | 'stats') => void;
}

export const PlayerDashboard: React.FC<PlayerDashboardProps> = ({
  config,
  calculation,
  player,
  betAmount,
  onBetChange,
  wheelRotation,
  isSpinning,
  winningSegmentId,
  lastSpin,
  outcomeTriggerKey,
  isMuted,
  onToggleMute,
  onSpin,
  onSpinComplete,
  onTopUp,
  onResetBalance,
  onUpdateClientSeed,
  onClearHistory,
  onBackToLobby,
  activeSubTab,
  onSubTabChange,
}) => {
  const [selectedProofSpin, setSelectedProofSpin] = useState<SpinRecord | null>(null);
  const [mysteryMode, setMysteryMode] = useState<boolean>(false);

  const betValidationError = validateBet(betAmount, player.balance, config);

  const handleInspectProof = (spin: SpinRecord) => {
    setSelectedProofSpin(spin);
    onSubTabChange('odds');
    const el = document.getElementById('player-workspace-tabs');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const isWinState =
    !isSpinning && outcomeTriggerKey > 0 && lastSpin !== null && lastSpin.multiplier > 1;
  const isLossState =
    !isSpinning && outcomeTriggerKey > 0 && lastSpin !== null && lastSpin.multiplier < 1;

  return (
    <div className="flex flex-col gap-10">
      {/* Primary Game Arena: Proportional Wheel + Betting Panel */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
        {/* Dominant Visual Anchor: The Wheel */}
        <div
          className={`lg:col-span-7 bg-[#111827] border rounded-2xl p-6 sm:p-8 flex flex-col transition-all duration-500 ${
            isWinState
              ? 'border-emerald-500/60 shadow-[0_0_45px_rgba(16,185,129,0.18)]'
              : isLossState
              ? 'border-rose-700/60 shadow-[0_0_35px_rgba(225,29,72,0.14)]'
              : 'border-slate-800'
          }`}
        >
          <div className="flex flex-wrap items-center justify-between gap-4 mb-2">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onBackToLobby}
                disabled={isSpinning}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-300 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg transition-colors disabled:opacity-50 cursor-pointer shrink-0"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                All Games
              </button>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-slate-100 tracking-tight">
                  Amer&apos;s Wheel
                </h1>
                <p className="text-xs text-slate-400 mt-0.5 font-mono tabular-nums">
                  {calculation.segments.filter((s) => s.weight > 0).length} Active Segments · RTP{' '}
                  {calculation.rtpPercent.toFixed(2)}% · Edge {calculation.houseEdgePercent.toFixed(2)}%
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setMysteryMode((prev) => !prev)}
                disabled={isSpinning}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50 ${
                  mysteryMode
                    ? 'bg-amber-500/15 border-amber-500/50 text-amber-300'
                    : 'bg-slate-900 hover:bg-slate-800 border-slate-800 text-slate-300'
                }`}
                title="Hide slice labels while spinning for a surprise reveal at the stop"
              >
                {mysteryMode ? (
                  <>
                    <EyeOff className="w-3.5 h-3.5 text-amber-400" />
                    Mystery Spin On
                  </>
                ) : (
                  <>
                    <Eye className="w-3.5 h-3.5 text-slate-400" />
                    Mystery Spin
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={onToggleMute}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-300 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                aria-label={isMuted ? 'Unmute wheel audio' : 'Mute wheel audio'}
              >
                {isMuted ? (
                  <>
                    <VolumeX className="w-3.5 h-3.5 text-slate-400" />
                    Muted
                  </>
                ) : (
                  <>
                    <Volume2 className="w-3.5 h-3.5 text-amber-400" />
                    Sound On
                  </>
                )}
              </button>
            </div>
          </div>

          <div className="my-2">
            <Wheel
              segments={calculation.segments}
              rotation={wheelRotation}
              isSpinning={isSpinning}
              winningSegmentId={winningSegmentId}
              mysteryMode={mysteryMode}
              outcomeTriggerKey={outcomeTriggerKey}
              lastOutcomeMultiplier={lastSpin?.multiplier ?? null}
              onSpinComplete={onSpinComplete}
              onQuickSpin={onSpin}
              canQuickSpin={!isSpinning && calculation.isValid && betValidationError === null}
            />
          </div>

          {/* Recent Spin Outcomes Strip (Clean Unboxed Text & Swatches) */}
          <div className="mt-4 pt-4 border-t border-slate-800/80 flex items-center justify-between gap-4">
            <span className="text-xs font-medium text-slate-400 whitespace-nowrap">
              Recent Spins
            </span>
            {player.history.length > 0 ? (
              <div className="flex items-center gap-3 overflow-x-auto py-0.5">
                {player.history.slice(0, 7).map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleInspectProof(item)}
                    className="inline-flex items-center gap-1.5 text-xs font-mono tabular-nums text-slate-300 hover:text-amber-300 whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <span
                      className="w-2 h-2 rounded-xs shrink-0"
                      style={{ backgroundColor: item.segmentColor }}
                    />
                    <span>{item.multiplier}x</span>
                    <span className="text-slate-600">·</span>
                  </button>
                ))}
              </div>
            ) : (
              <span className="text-xs text-slate-500">No spins yet</span>
            )}
          </div>
        </div>

        {/* Right Control Column: Wagering & Result */}
        <div className="lg:col-span-5 flex flex-col gap-5">
          <BettingPanel
            balance={player.balance}
            betAmount={betAmount}
            onBetChange={onBetChange}
            limits={config.limits}
            calculation={calculation}
            isSpinning={isSpinning}
            validationError={betValidationError}
            lastSpin={lastSpin}
            onSpin={onSpin}
            onTopUp={onTopUp}
            onResetBalance={onResetBalance}
            onInspectProof={handleInspectProof}
          />
        </div>
      </section>

      {/* Secondary Player Views: Published Odds, History, Statistics */}
      <section id="player-workspace-tabs" className="flex flex-col gap-5">
        <div className="flex items-center justify-between gap-4 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-1 p-1 bg-[#111827] border border-slate-800 rounded-lg">
            <button
              type="button"
              onClick={() => onSubTabChange('odds')}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeSubTab === 'odds'
                  ? 'bg-slate-800 text-slate-100'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Published Odds & Fairness
            </button>
            <button
              type="button"
              onClick={() => onSubTabChange('history')}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeSubTab === 'history'
                  ? 'bg-slate-800 text-slate-100'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Spin History ({player.history.length})
            </button>
            <button
              type="button"
              onClick={() => onSubTabChange('stats')}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeSubTab === 'stats'
                  ? 'bg-slate-800 text-slate-100'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Player Statistics
            </button>
          </div>
        </div>

        {activeSubTab === 'odds' && (
          <ProbabilityPanel
            calculation={calculation}
            clientSeed={player.clientSeed}
            nonce={player.nonce}
            onUpdateClientSeed={onUpdateClientSeed}
            selectedProofSpin={selectedProofSpin}
            recentSpins={player.history}
            onSelectProofSpin={setSelectedProofSpin}
          />
        )}

        {activeSubTab === 'history' && (
          <SpinHistory
            history={player.history}
            onInspectProof={handleInspectProof}
            onClearHistory={onClearHistory}
          />
        )}

        {activeSubTab === 'stats' && (
          <StatisticsPanel
            stats={player.stats}
            history={player.history}
            calculation={calculation}
          />
        )}
      </section>
    </div>
  );
};
