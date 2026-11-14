import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  AuditLogEntry,
  BetLimits,
  CelebrationOutcome,
  ConfigHistoryEntry,
  GameConfig,
  PlayerState,
  SpinRecord,
  WheelSegment,
} from './types/game';
import { calculateProbabilities, roundCurrency } from './services/probabilityEngine';
import { executeSpin, SpinExecutionResult } from './services/gameEngine';
import {
  createInitialStats,
  loadAuditLog,
  loadConfig,
  loadConfigHistory,
  loadPlayerState,
  saveAuditLog,
  saveConfig,
  saveConfigHistory,
  savePlayerState,
} from './services/storageService';
import { soundService } from './services/soundService';
import { MainLobby } from './components/MainLobby';
import { PlayerDashboard } from './components/PlayerDashboard';
import { HorseBettingGame } from './components/HorseBettingGame';
import { BasketballBettingGame } from './components/BasketballBettingGame';
import { OperatorDashboard } from './components/OperatorDashboard';
import { OutcomeCelebration } from './components/OutcomeCelebration';

type ActiveRoute = 'lobby' | 'wheel' | 'horses' | 'basketball' | 'operator';
type PlayerSubTab = 'odds' | 'history' | 'stats';

export default function App() {
  const [config, setConfig] = useState<GameConfig>(() => loadConfig());
  const [player, setPlayer] = useState<PlayerState>(() =>
    loadPlayerState(loadConfig().limits.defaultBalance)
  );
  const [auditLog, setAuditLog] = useState<AuditLogEntry[]>(() => loadAuditLog());
  const [configHistory, setConfigHistory] = useState<ConfigHistoryEntry[]>(() =>
    loadConfigHistory()
  );

  const [activeRoute, setActiveRoute] = useState<ActiveRoute>('lobby');
  const [playerSubTab, setPlayerSubTab] = useState<PlayerSubTab>('odds');
  const [operatorAuthenticated, setOperatorAuthenticated] = useState<boolean>(false);

  const [betAmount, setBetAmount] = useState<number>(() =>
    Math.min(10, Math.max(config.limits.minBet, 10))
  );
  const [wheelRotation, setWheelRotation] = useState<number>(0);
  const [isSpinning, setIsSpinning] = useState<boolean>(false);
  const [pendingSpin, setPendingSpin] = useState<SpinExecutionResult | null>(null);
  const [lastSpin, setLastSpin] = useState<SpinRecord | null>(() => player.history[0] ?? null);
  const [winningSegmentId, setWinningSegmentId] = useState<string | null>(null);
  const [celebrationOutcome, setCelebrationOutcome] = useState<CelebrationOutcome | null>(null);
  const [outcomeTriggerKey, setOutcomeTriggerKey] = useState<number>(0);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const spinInFlightRef = useRef(false);

  // Sync persistence
  useEffect(() => {
    saveConfig(config);
  }, [config]);

  useEffect(() => {
    savePlayerState(player);
  }, [player]);

  useEffect(() => {
    saveAuditLog(auditLog);
  }, [auditLog]);

  useEffect(() => {
    saveConfigHistory(configHistory);
  }, [configHistory]);

  const liveCalculation = useMemo(
    () => calculateProbabilities(config.segments, config.limits),
    [config]
  );

  const appendAudit = useCallback((entry: AuditLogEntry) => {
    setAuditLog((prev) => [entry, ...prev].slice(0, 500));
  }, []);

  const navigateTo = useCallback(
    (route: ActiveRoute) => {
      if (isSpinning) return;
      setActiveRoute(route);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    [isSpinning]
  );

  const handleToggleMute = () => {
    const next = !isMuted;
    setIsMuted(next);
    soundService.setMuted(next);
  };

  // --- Amer's Wheel Handlers ---
  const handleSpin = async () => {
    if (isSpinning || spinInFlightRef.current) return;
    spinInFlightRef.current = true;
    try {
      const result = await executeSpin(betAmount, player, config, wheelRotation);
      setWinningSegmentId(null);
      setPendingSpin(result);
      setWheelRotation(result.targetWheelRotation);
      setIsSpinning(true);
    } catch {
      // Validation message is shown inline in BettingPanel
    } finally {
      spinInFlightRef.current = false;
    }
  };

  const handleSpinComplete = useCallback(() => {
    setIsSpinning(false);
    if (!pendingSpin) return;

    const { updatedPlayer, spinRecord, auditEntry, winningSegment } = pendingSpin;
    setPlayer(updatedPlayer);
    setLastSpin(spinRecord);
    setWinningSegmentId(winningSegment.id);
    setCelebrationOutcome({
      multiplier: spinRecord.multiplier,
      payout: spinRecord.payout,
      netResult: spinRecord.netResult,
      label: spinRecord.segmentLabel,
    });
    setOutcomeTriggerKey((prev) => prev + 1);
    appendAudit(auditEntry);
    soundService.playOutcome(winningSegment.multiplier);
    setPendingSpin(null);
  }, [pendingSpin, appendAudit]);

  // --- Shared Sports & Arcade Settlement Handlers (Horse Racing & Basketball) ---
  // Wagers are debited and payouts credited atomically at settlement time, so
  // abandoning or reloading mid-game leaves the wallet untouched.
  const handleSettleSideGameOutcome = useCallback(
    (
      payout: number,
      netResult: number,
      multiplier: number,
      summary: string,
      auditType: 'HORSE_RACE' | 'BASKETBALL_BET',
      celebration: CelebrationOutcome
    ) => {
      setPlayer((prev) => {
        const nextBalance = roundCurrency(prev.balance + netResult);
        appendAudit({
          id: `aud-${Date.now()}`,
          timestamp: Date.now(),
          type: auditType,
          actor: 'PLAYER',
          summary,
          amountDelta: netResult,
          balanceAfter: nextBalance,
        });
        return {
          ...prev,
          balance: nextBalance,
        };
      });
      setCelebrationOutcome(celebration);
      setOutcomeTriggerKey((prev) => prev + 1);
      soundService.playOutcome(multiplier);
    },
    [appendAudit]
  );

  // --- Shared Wallet Handlers ---
  const handleTopUp = (amount: number) => {
    if (isSpinning) return;
    const nextBalance = roundCurrency(player.balance + amount);
    setPlayer((prev) => ({
      ...prev,
      balance: nextBalance,
    }));
    appendAudit({
      id: `aud-${Date.now()}`,
      timestamp: Date.now(),
      type: 'DEPOSIT',
      actor: 'PLAYER',
      summary: `Virtual credit top-up of $${amount.toFixed(2)}`,
      amountDelta: amount,
      balanceAfter: nextBalance,
    });
  };

  const handleResetBalance = () => {
    if (isSpinning) return;
    const target = config.limits.defaultBalance;
    const delta = roundCurrency(target - player.balance);
    setPlayer((prev) => ({
      ...prev,
      balance: target,
    }));
    appendAudit({
      id: `aud-${Date.now()}`,
      timestamp: Date.now(),
      type: 'BALANCE_RESET',
      actor: 'PLAYER',
      summary: `Player balance reset to default $${target.toFixed(2)}`,
      amountDelta: delta,
      balanceAfter: target,
    });
  };

  const handleUpdateClientSeed = (seed: string) => {
    setPlayer((prev) => ({
      ...prev,
      clientSeed: seed,
    }));
  };

  const handleClearHistory = () => {
    if (isSpinning) return;
    setPlayer((prev) => ({
      ...prev,
      history: [],
      stats: createInitialStats(),
    }));
    setLastSpin(null);
    setWinningSegmentId(null);
  };

  const handleOperatorAuth = (pin: string): boolean => {
    if (pin === config.operatorPin) {
      setOperatorAuthenticated(true);
      appendAudit({
        id: `aud-${Date.now()}`,
        timestamp: Date.now(),
        type: 'OPERATOR_AUTH',
        actor: 'OPERATOR',
        summary: 'Operator Console unlocked',
      });
      return true;
    }
    return false;
  };

  const handleOperatorLock = () => {
    setOperatorAuthenticated(false);
    appendAudit({
      id: `aud-${Date.now()}`,
      timestamp: Date.now(),
      type: 'OPERATOR_AUTH',
      actor: 'OPERATOR',
      summary: 'Operator Console locked',
    });
  };

  const handlePublishConfig = (
    nextSegments: WheelSegment[],
    nextLimits: BetLimits,
    nextPin: string,
    summary: string
  ) => {
    const prevCalc = calculateProbabilities(config.segments, config.limits);
    const nextCalc = calculateProbabilities(nextSegments, nextLimits);

    const historyEntry: ConfigHistoryEntry = {
      id: `cfg-${Date.now()}`,
      timestamp: Date.now(),
      summary,
      previousRtpPercent: prevCalc.rtpPercent,
      newRtpPercent: nextCalc.rtpPercent,
      previousHouseEdgePercent: prevCalc.houseEdgePercent,
      newHouseEdgePercent: nextCalc.houseEdgePercent,
      previousSegmentsCount: config.segments.length,
      newSegmentsCount: nextSegments.length,
      segmentsSnapshot: nextSegments.map((s) => ({ ...s })),
      limitsSnapshot: { ...nextLimits },
    };

    setConfigHistory((prev) => [historyEntry, ...prev].slice(0, 100));

    const nextConfig: GameConfig = {
      segments: nextSegments.map((s) => ({ ...s })),
      limits: { ...nextLimits },
      operatorPin: nextPin,
      updatedAt: Date.now(),
    };
    setConfig(nextConfig);

    setBetAmount((prevBet) =>
      Math.min(nextLimits.maxBet, Math.max(nextLimits.minBet, prevBet))
    );

    appendAudit({
      id: `aud-${Date.now()}`,
      timestamp: Date.now(),
      type: 'CONFIG_CHANGE',
      actor: 'OPERATOR',
      summary,
      details: {
        previousRtp: prevCalc.rtpPercent,
        newRtp: nextCalc.rtpPercent,
        previousEdge: prevCalc.houseEdgePercent,
        newEdge: nextCalc.houseEdgePercent,
      },
    });
  };

  return (
    <div className="min-h-screen bg-[#0B1120] text-slate-100 flex flex-col">
      {/* 3-Zone Top Bar Contract */}
      <header className="border-b border-slate-800/90 bg-[#0B1120]/95 backdrop-blur-sm sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-8">
          {/* Zone 1: Single-line Brand Wordmark */}
          <button
            type="button"
            onClick={() => navigateTo('lobby')}
            className="text-lg font-display font-bold tracking-tight text-slate-100 whitespace-nowrap shrink-0 cursor-pointer"
          >
            Amer&apos;s Wheel
          </button>

          {/* Zone 2: 5 Clean Single-line Navigation Links */}
          <nav className="hidden md:flex items-center gap-7 text-sm font-medium">
            <button
              type="button"
              onClick={() => navigateTo('lobby')}
              className={`py-1 border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeRoute === 'lobby'
                  ? 'border-amber-400 text-slate-100'
                  : 'border-transparent text-slate-400 hover:text-slate-100'
              }`}
            >
              All Games
            </button>
            <button
              type="button"
              onClick={() => navigateTo('wheel')}
              className={`py-1 border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeRoute === 'wheel'
                  ? 'border-amber-400 text-slate-100'
                  : 'border-transparent text-slate-400 hover:text-slate-100'
              }`}
            >
              Amer&apos;s Wheel
            </button>
            <button
              type="button"
              onClick={() => navigateTo('horses')}
              className={`py-1 border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeRoute === 'horses'
                  ? 'border-amber-400 text-slate-100'
                  : 'border-transparent text-slate-400 hover:text-slate-100'
              }`}
            >
              Horse Racing
            </button>
            <button
              type="button"
              onClick={() => navigateTo('basketball')}
              className={`py-1 border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeRoute === 'basketball'
                  ? 'border-amber-400 text-slate-100'
                  : 'border-transparent text-slate-400 hover:text-slate-100'
              }`}
            >
              Basketball
            </button>
            <button
              type="button"
              onClick={() => navigateTo('operator')}
              className={`py-1 border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeRoute === 'operator'
                  ? 'border-amber-400 text-amber-400'
                  : 'border-transparent text-slate-400 hover:text-slate-100'
              }`}
            >
              Operator Console
            </button>
          </nav>

          {/* Zone 3: Single Primary Action */}
          <div className="flex items-center gap-3 shrink-0">
            {activeRoute === 'lobby' ? (
              <button
                type="button"
                onClick={() => navigateTo('wheel')}
                className="px-4 py-2 text-xs font-semibold bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                Play Amer&apos;s Wheel
              </button>
            ) : (
              <button
                type="button"
                onClick={() => navigateTo('lobby')}
                className="px-4 py-2 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-100 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                All Games
              </button>
            )}
          </div>
        </div>

        {/* Mobile Quick Switcher */}
        <div className="flex md:hidden border-t border-slate-800/80 px-4 py-2 items-center gap-4 overflow-x-auto text-xs font-medium">
          {(
            [
              { id: 'lobby', label: 'All Games' },
              { id: 'wheel', label: "Amer's Wheel" },
              { id: 'horses', label: 'Horse Racing' },
              { id: 'basketball', label: 'Basketball' },
              { id: 'operator', label: 'Operator' },
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => navigateTo(item.id)}
              className={`whitespace-nowrap shrink-0 ${
                activeRoute === item.id ? 'text-amber-400 font-semibold' : 'text-slate-400'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </header>

      {/* Full-Screen Win / Loss Outcome Celebration & Inverse Drain Overlay */}
      <OutcomeCelebration outcome={celebrationOutcome} triggerKey={outcomeTriggerKey} />

      {/* Main Content Container with Smooth Route Transitions */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeRoute}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
          >
            {activeRoute === 'lobby' && (
              <MainLobby
                balance={player.balance}
                limits={config.limits}
                wheelCalc={liveCalculation}
                recentAudit={auditLog}
                onSelectGame={(route) => navigateTo(route)}
                onTopUp={handleTopUp}
                onResetBalance={handleResetBalance}
              />
            )}

            {activeRoute === 'wheel' && (
              <PlayerDashboard
                config={config}
                calculation={liveCalculation}
                player={player}
                betAmount={betAmount}
                onBetChange={setBetAmount}
                wheelRotation={wheelRotation}
                isSpinning={isSpinning}
                winningSegmentId={winningSegmentId}
                lastSpin={lastSpin}
                outcomeTriggerKey={outcomeTriggerKey}
                isMuted={isMuted}
                onToggleMute={handleToggleMute}
                onSpin={handleSpin}
                onSpinComplete={handleSpinComplete}
                onTopUp={handleTopUp}
                onResetBalance={handleResetBalance}
                onUpdateClientSeed={handleUpdateClientSeed}
                onClearHistory={handleClearHistory}
                onBackToLobby={() => navigateTo('lobby')}
                activeSubTab={playerSubTab}
                onSubTabChange={setPlayerSubTab}
              />
            )}

            {activeRoute === 'horses' && (
              <HorseBettingGame
                balance={player.balance}
                limits={config.limits}
                isMuted={isMuted}
                onToggleMute={handleToggleMute}
                onBackToLobby={() => navigateTo('lobby')}
                onSettleOutcome={handleSettleSideGameOutcome}
              />
            )}

            {activeRoute === 'basketball' && (
              <BasketballBettingGame
                balance={player.balance}
                limits={config.limits}
                isMuted={isMuted}
                onToggleMute={handleToggleMute}
                onBackToLobby={() => navigateTo('lobby')}
                onSettleOutcome={handleSettleSideGameOutcome}
              />
            )}

            {activeRoute === 'operator' && (
              <OperatorDashboard
                config={config}
                player={player}
                auditEntries={auditLog}
                configHistory={configHistory}
                isAuthenticated={operatorAuthenticated}
                onAuthenticate={handleOperatorAuth}
                onLock={handleOperatorLock}
                onPublishConfig={handlePublishConfig}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Clean Minimal Footer */}
      <footer className="border-t border-slate-800/80 py-5 mt-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-wrap items-center justify-between gap-4 text-xs text-slate-500">
          <span>Amer&apos;s Wheel — Multi-Game Configurable Probability &amp; Sports Lounge</span>
          <span className="font-mono tabular-nums">
            Virtual Credits Only · Verifiable SHA-256 CSPRNG
          </span>
        </div>
      </footer>
    </div>
  );
}
