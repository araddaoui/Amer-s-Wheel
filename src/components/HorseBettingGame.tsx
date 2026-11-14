import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Flag, Play, RefreshCw, Trophy, Volume2, VolumeX } from 'lucide-react';
import { BetLimits, CelebrationOutcome } from '../types/game';
import { roundCurrency, roundTo } from '../services/probabilityEngine';
import { soundService } from '../services/soundService';

interface HorseContender {
  id: string;
  lane: number;
  name: string;
  jockey: string;
  silkColor: string;
  weight: number;
  winProbPercent: number;
  winMultiplier: number;
  placeMultiplier: number;
  form: string;
}

interface HorseRaceResult {
  id: string;
  timestamp: number;
  betType: 'WIN' | 'PLACE';
  selectedHorseName: string;
  selectedHorseLane: number;
  wager: number;
  multiplier: number;
  payout: number;
  netResult: number;
  orderOfFinish: { lane: number; name: string; silkColor: string }[];
}

interface HorseBettingGameProps {
  balance: number;
  limits: BetLimits;
  isMuted: boolean;
  onToggleMute: () => void;
  onBackToLobby: () => void;
  onSettleOutcome: (
    payout: number,
    netResult: number,
    multiplier: number,
    summary: string,
    auditType: 'HORSE_RACE',
    celebration: CelebrationOutcome
  ) => void;
}

const HORSE_POOL = [
  { name: 'Midnight Sovereign', jockey: 'M. Vance', silkColor: '#2563EB', baseWeight: 42, form: '1-2-1' },
  { name: 'Golden Arrow', jockey: 'L. Ortiz', silkColor: '#D97706', baseWeight: 28, form: '2-1-3' },
  { name: 'Emerald Blitz', jockey: 'R. Moore', silkColor: '#059669', baseWeight: 16, form: '3-2-4' },
  { name: 'Crimson Comet', jockey: 'J. Rosario', silkColor: '#E11D48', baseWeight: 9, form: '4-1-5' },
  { name: 'Velvet Longshot', jockey: 'F. Prat', silkColor: '#7C3AED', baseWeight: 5, form: '5-4-2' },
];

function generateRaceCard(seedOffset = 0): HorseContender[] {
  const houseRtp = 0.95; // 5% track takeout
  const rawWeights = HORSE_POOL.map((h, i) => {
    const variance = 0.8 + ((Math.sin(seedOffset * 7 + i * 3) + 1) * 0.25);
    return Math.max(4, Math.round(h.baseWeight * variance));
  });
  const totalWeight = rawWeights.reduce((a, b) => a + b, 0);

  return HORSE_POOL.map((h, idx) => {
    const w = rawWeights[idx];
    const prob = w / totalWeight;
    const winMultiplier = roundTo(Math.max(1.3, houseRtp / prob), 2);
    const placeMultiplier = roundTo(Math.max(1.15, 1 + (winMultiplier - 1) * 0.42), 2);
    return {
      id: `horse-${idx + 1}`,
      lane: idx + 1,
      name: h.name,
      jockey: h.jockey,
      silkColor: h.silkColor,
      weight: w,
      winProbPercent: roundTo(prob * 100, 1),
      winMultiplier,
      placeMultiplier,
      form: h.form,
    };
  });
}

function sampleWeightedOrder(horses: HorseContender[]): HorseContender[] {
  const pool = [...horses];
  const order: HorseContender[] = [];
  while (pool.length > 0) {
    const totalW = pool.reduce((s, h) => s + h.weight, 0);
    let r = Math.random() * totalW;
    let pickedIdx = pool.length - 1;
    for (let i = 0; i < pool.length; i++) {
      r -= pool[i].weight;
      if (r <= 0) {
        pickedIdx = i;
        break;
      }
    }
    order.push(pool[pickedIdx]);
    pool.splice(pickedIdx, 1);
  }
  return order;
}

export const HorseBettingGame: React.FC<HorseBettingGameProps> = ({
  balance,
  limits,
  isMuted,
  onToggleMute,
  onBackToLobby,
  onSettleOutcome,
}) => {
  const [raceSeed, setRaceSeed] = useState<number>(1);
  const horses = useMemo(() => generateRaceCard(raceSeed), [raceSeed]);

  const [selectedHorseId, setSelectedHorseId] = useState<string>('horse-1');
  const [betType, setBetType] = useState<'WIN' | 'PLACE'>('WIN');
  const [wager, setWager] = useState<number>(() => Math.min(25, Math.max(limits.minBet, 25)));
  const [isRacing, setIsRacing] = useState<boolean>(false);
  const [positions, setPositions] = useState<Record<string, number>>(() =>
    Object.fromEntries(horses.map((h) => [h.id, 0]))
  );
  const [raceProgress, setRaceProgress] = useState<number>(0);
  const [recentRaces, setRecentRaces] = useState<HorseRaceResult[]>([]);
  const [lastResult, setLastResult] = useState<HorseRaceResult | null>(null);

  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const selectedHorse = horses.find((h) => h.id === selectedHorseId) ?? horses[0];
  const activeMultiplier =
    betType === 'WIN' ? selectedHorse.winMultiplier : selectedHorse.placeMultiplier;

  const betError =
    !Number.isFinite(wager) || wager <= 0
      ? 'Enter a valid wager.'
      : wager < limits.minBet
      ? `Min bet is $${limits.minBet.toFixed(2)}.`
      : wager > limits.maxBet
      ? `Max bet is $${limits.maxBet.toFixed(2)}.`
      : wager > balance
      ? 'Insufficient balance.'
      : null;

  const handleStartRace = () => {
    if (isRacing || betError) return;

    const normalizedWager = roundCurrency(wager);
    setLastResult(null);
    setIsRacing(true);
    setRaceProgress(0);

    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (!prefersReducedMotion) {
      soundService.playRaceBell();
    }

    // Determine exact weighted finish order
    const finishOrder = sampleWeightedOrder(horses);
    const rankMap = new Map<string, number>();
    finishOrder.forEach((h, idx) => rankMap.set(h.id, idx));

    // Pre-generate smooth organic stride curves with mid-race surges
    const strideParams = new Map<
      string,
      { targetFinish: number; phase: number; amp: number; kickPower: number }
    >();
    horses.forEach((h) => {
      const rank = rankMap.get(h.id) ?? 4;
      const targetFinish = 100 - rank * (1.8 + Math.random() * 1.4);
      strideParams.set(h.id, {
        targetFinish,
        phase: Math.random() * Math.PI * 2,
        amp: 2.8 + Math.random() * 2.5,
        kickPower: rank === 0 ? 1.15 : 0.9 + Math.random() * 0.25,
      });
    });

    const duration = prefersReducedMotion ? 450 : 6200;
    const startTime = performance.now();
    let lastHoofTick = 0;

    const step = (now: number) => {
      const elapsed = now - startTime;
      const t = Math.min(1, elapsed / duration);
      setRaceProgress(t);

      if (!prefersReducedMotion && elapsed - lastHoofTick > 220 && t < 0.96) {
        lastHoofTick = elapsed;
        soundService.playHoofbeat();
      }

      const nextPos: Record<string, number> = {};
      horses.forEach((h) => {
        const param = strideParams.get(h.id)!;
        // Blend early surge wave that smoothly converges to exact rank finish at t=1
        const envelope = Math.sin(t * Math.PI);
        const surge = Math.sin(t * 9 + param.phase) * param.amp * envelope;
        const baseCurve = Math.pow(t, 0.92 / param.kickPower);
        const rawPct = baseCurve * param.targetFinish + surge;
        nextPos[h.id] = Math.max(0, Math.min(100, t >= 1 ? param.targetFinish : rawPct));
      });
      setPositions(nextPos);

      if (t < 1) {
        rafRef.current = requestAnimationFrame(step);
      } else {
        rafRef.current = null;
        setIsRacing(false);

        const winner = finishOrder[0];
        const second = finishOrder[1];
        const didWin =
          betType === 'WIN'
            ? winner.id === selectedHorse.id
            : winner.id === selectedHorse.id || second.id === selectedHorse.id;

        const appliedMult = didWin ? activeMultiplier : 0;
        const payout = roundCurrency(normalizedWager * appliedMult);
        const netResult = roundCurrency(payout - normalizedWager);

        const raceRes: HorseRaceResult = {
          id: `race-${Date.now()}`,
          timestamp: Date.now(),
          betType,
          selectedHorseName: selectedHorse.name,
          selectedHorseLane: selectedHorse.lane,
          wager: normalizedWager,
          multiplier: appliedMult,
          payout,
          netResult,
          orderOfFinish: finishOrder.slice(0, 3).map((h) => ({
            lane: h.lane,
            name: h.name,
            silkColor: h.silkColor,
          })),
        };

        setLastResult(raceRes);
        setRecentRaces((prev) => [raceRes, ...prev].slice(0, 12));

        const summary = `Turf Derby (${betType}): Bet $${normalizedWager.toFixed(2)} on #${selectedHorse.lane} ${selectedHorse.name} → Winner #${winner.lane} ${winner.name} → Payout $${payout.toFixed(2)}`;
        onSettleOutcome(payout, netResult, appliedMult, summary, 'HORSE_RACE', {
          multiplier: appliedMult,
          payout,
          netResult,
          label: didWin ? `${selectedHorse.name} (${betType})` : `Winner: ${winner.name}`,
        });
      }
    };

    rafRef.current = requestAnimationFrame(step);
  };

  // Current live running order sorted by distance
  const liveOrder = [...horses].sort(
    (a, b) => (positions[b.id] ?? 0) - (positions[a.id] ?? 0)
  );

  return (
    <div className="flex flex-col gap-8">
      {/* Header Row */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={onBackToLobby}
            disabled={isRacing}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-300 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg transition-colors disabled:opacity-50 cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            All Games
          </button>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-100 tracking-tight">
              Royal Turf Derby
            </h1>
            <p className="text-xs text-slate-400 font-mono tabular-nums">
              5 Furlong Turf Sprint · 95.00% Track RTP · Shared Wallet
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            disabled={isRacing}
            onClick={() => {
              setRaceSeed((s) => s + 1);
              setPositions(Object.fromEntries(horses.map((h) => [h.id, 0])));
              setLastResult(null);
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-300 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg transition-colors disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            New Race Card
          </button>
          <button
            type="button"
            onClick={onToggleMute}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-300 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg transition-colors cursor-pointer"
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

      {/* Main Arena: Turf Track + Betting Slip */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left: Live Race Track + Contender Selector */}
        <div className="lg:col-span-8 flex flex-col gap-6">
          {/* Animated Turf Track */}
          <div className="bg-[#111827] border border-slate-800 rounded-2xl p-6">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <div className="flex items-center gap-2 text-xs font-mono tabular-nums text-slate-300">
                <Flag className="w-3.5 h-3.5 text-emerald-400" />
                <span>
                  {isRacing
                    ? `Race In Progress · ${(raceProgress * 5).toFixed(1)} / 5.0 Furlongs`
                    : lastResult
                    ? `Official Winner: #${lastResult.orderOfFinish[0].lane} ${lastResult.orderOfFinish[0].name}`
                    : 'Horses Loaded at Starting Gate'}
                </span>
              </div>

              {(isRacing || lastResult) && (
                <div className="flex items-center gap-3 text-xs font-mono tabular-nums text-slate-400">
                  <span>Leader: #{liveOrder[0].lane} {liveOrder[0].name}</span>
                </div>
              )}
            </div>

            {/* 5-Lane Turf Surface */}
            <div className="relative rounded-xl border border-emerald-900/60 bg-gradient-to-r from-[#07261A] via-[#0B3524] to-[#07261A] p-4 overflow-hidden">
              {/* Furlong vertical lines */}
              {[25, 50, 75].map((pct) => (
                <div
                  key={pct}
                  className="absolute top-0 bottom-0 border-l border-dashed border-emerald-500/20 pointer-events-none"
                  style={{ left: `${pct}%` }}
                />
              ))}
              {/* Checkered Finish Wire */}
              <div
                className="absolute top-0 bottom-0 w-1.5 bg-amber-400/75 pointer-events-none"
                style={{ right: '42px' }}
              />

              <div className="flex flex-col gap-3 relative z-10">
                {horses.map((horse) => {
                  const pct = positions[horse.id] ?? 0;
                  const isPicked = horse.id === selectedHorse.id;
                  return (
                    <div
                      key={horse.id}
                      className={`relative h-11 rounded-lg border flex items-center px-3 transition-colors ${
                        isPicked
                          ? 'border-amber-500/60 bg-slate-950/55'
                          : 'border-emerald-800/40 bg-slate-950/30'
                      }`}
                    >
                      <span className="text-[11px] font-mono text-slate-400 w-36 truncate shrink-0 z-10">
                        #{horse.lane} {horse.name}
                      </span>

                      <div className="relative flex-1 h-full flex items-center mr-10">
                        <div
                          className="absolute top-1/2 -translate-y-1/2 flex items-center gap-1.5"
                          style={{
                            left: `calc(${pct}% - ${pct * 0.28}px)`,
                          }}
                        >
                          <div
                            className="w-8 h-6 rounded-md border border-slate-950 flex items-center justify-center text-[11px] font-mono font-bold text-white shadow-sm"
                            style={{ backgroundColor: horse.silkColor }}
                          >
                            #{horse.lane}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Contender Selection Grid */}
            <div className="mt-6 overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400">
                    <th className="py-2 pr-3">Gate / Runner</th>
                    <th className="py-2 px-3">Jockey · Form</th>
                    <th className="py-2 px-3 text-right">Implied Prob</th>
                    <th className="py-2 px-3 text-right">Win Odds</th>
                    <th className="py-2 pl-3 text-right">Place (Top 2)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {horses.map((h) => {
                    const active = h.id === selectedHorse.id;
                    return (
                      <tr
                        key={h.id}
                        onClick={() => !isRacing && setSelectedHorseId(h.id)}
                        className={`transition-colors ${
                          isRacing ? 'cursor-default' : 'cursor-pointer hover:bg-slate-800/40'
                        } ${active ? 'bg-amber-500/10' : ''}`}
                      >
                        <td className="py-3 pr-3">
                          <div className="flex items-center gap-2.5">
                            <span
                              className="w-3 h-3 rounded-sm shrink-0"
                              style={{ backgroundColor: h.silkColor }}
                            />
                            <span className="font-semibold text-slate-100">
                              #{h.lane} {h.name}
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-3 text-slate-400 font-mono">
                          {h.jockey} · {h.form}
                        </td>
                        <td className="py-3 px-3 text-right font-mono tabular-nums text-slate-300">
                          {h.winProbPercent.toFixed(1)}%
                        </td>
                        <td className="py-3 px-3 text-right font-mono tabular-nums font-semibold text-amber-400">
                          {h.winMultiplier.toFixed(2)}x
                        </td>
                        <td className="py-3 pl-3 text-right font-mono tabular-nums text-emerald-400 font-semibold">
                          {h.placeMultiplier.toFixed(2)}x
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Recent Race Results */}
          {recentRaces.length > 0 && (
            <div className="bg-[#111827] border border-slate-800 rounded-xl p-5">
              <h3 className="text-sm font-semibold text-slate-100 mb-3">Recent Turf Results</h3>
              <div className="divide-y divide-slate-800/60 text-xs">
                {recentRaces.slice(0, 5).map((r) => (
                  <div key={r.id} className="py-2.5 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-slate-300">
                      <span className="font-mono text-slate-500">
                        {new Date(r.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </span>
                      <span>·</span>
                      <span>
                        {r.betType} #{r.selectedHorseLane} {r.selectedHorseName}
                      </span>
                      <span className="text-slate-500">·</span>
                      <span className="text-slate-400">
                        Podium: {r.orderOfFinish.map((o) => `#${o.lane}`).join(' / ')}
                      </span>
                    </div>
                    <span
                      className={`font-mono tabular-nums font-semibold ${
                        r.netResult > 0 ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      {r.netResult > 0 ? `+$${r.netResult.toFixed(2)}` : `-$${Math.abs(r.netResult).toFixed(2)}`}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right: Betting Slip */}
        <div className="lg:col-span-4 bg-[#111827] border border-slate-800 rounded-2xl p-6 flex flex-col gap-5">
          <div className="pb-4 border-b border-slate-800">
            <p className="text-xs font-medium text-slate-400">Shared Balance</p>
            <p className="mt-1 text-2xl font-bold font-mono tabular-nums text-slate-50">
              ${balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>

          <div>
            <p className="text-xs font-medium text-slate-400 mb-1">Selected Runner</p>
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-2 text-sm font-semibold text-slate-100">
                <span
                  className="w-3 h-3 rounded-sm"
                  style={{ backgroundColor: selectedHorse.silkColor }}
                />
                #{selectedHorse.lane} {selectedHorse.name}
              </span>
              <span className="font-mono text-sm font-bold text-amber-400">
                {activeMultiplier.toFixed(2)}x
              </span>
            </div>
          </div>

          <div>
            <p className="text-xs font-medium text-slate-300 mb-1.5">Bet Market</p>
            <div className="grid grid-cols-2 gap-2 p-1 bg-[#0B1120] border border-slate-800 rounded-lg">
              <button
                type="button"
                disabled={isRacing}
                onClick={() => setBetType('WIN')}
                className={`py-2 px-3 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                  betType === 'WIN'
                    ? 'bg-slate-800 text-slate-100'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Win (1st) · {selectedHorse.winMultiplier.toFixed(2)}x
              </button>
              <button
                type="button"
                disabled={isRacing}
                onClick={() => setBetType('PLACE')}
                className={`py-2 px-3 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                  betType === 'PLACE'
                    ? 'bg-slate-800 text-slate-100'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Place (Top 2) · {selectedHorse.placeMultiplier.toFixed(2)}x
              </button>
            </div>
          </div>

          <div>
            <label htmlFor="horse-wager" className="block text-xs font-medium text-slate-300 mb-1.5">
              Wager Amount ($)
            </label>
            <input
              id="horse-wager"
              type="number"
              min={limits.minBet}
              max={limits.maxBet}
              disabled={isRacing}
              value={Number.isFinite(wager) ? wager : ''}
              onChange={(e) => setWager(parseFloat(e.target.value) || 0)}
              className="w-full px-3.5 py-2.5 bg-[#0B1120] border border-slate-700 rounded-lg font-mono text-base font-semibold text-slate-100 focus:border-amber-500 focus:outline-none"
            />
            <div className="flex flex-wrap gap-2 mt-2.5">
              {[10, 25, 50, 100].map((amt) => (
                <button
                  key={amt}
                  type="button"
                  disabled={isRacing}
                  onClick={() => setWager(amt)}
                  className={`px-3 py-1 text-xs font-mono rounded-md border cursor-pointer ${
                    wager === amt
                      ? 'bg-amber-500/15 border-amber-500/50 text-amber-300'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  ${amt}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between text-xs font-mono tabular-nums text-slate-400 py-2 border-y border-slate-800">
            <span>Potential Payout</span>
            <span className="text-emerald-400 font-semibold">
              ${(Math.max(0, wager) * activeMultiplier).toFixed(2)}
            </span>
          </div>

          {betError && <p className="text-xs text-rose-400">{betError}</p>}

          <button
            type="button"
            disabled={isRacing || betError !== null}
            onClick={handleStartRace}
            className="w-full py-3.5 px-6 rounded-xl font-display font-bold text-sm bg-amber-500 hover:bg-amber-400 disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 flex items-center justify-center gap-2 transition-colors cursor-pointer"
          >
            <Play className="w-4 h-4 fill-current" />
            {isRacing ? 'Race In Progress...' : `Post Bet & Start Race ($${(Number.isFinite(wager) ? wager : 0).toFixed(2)})`}
          </button>

          {lastResult && !isRacing && (
            <div
              className={`p-4 rounded-xl border ${
                lastResult.netResult > 0
                  ? 'bg-emerald-950/35 border-emerald-700/60'
                  : 'bg-slate-900/90 border-slate-700/80'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Trophy
                    className={`w-4 h-4 shrink-0 ${
                      lastResult.netResult > 0 ? 'text-amber-400' : 'text-slate-500'
                    }`}
                  />
                  <div>
                    <p className="text-xs font-semibold text-slate-100">
                      {lastResult.netResult > 0 ? 'Ticket Cashed!' : 'Ticket Lost'}
                    </p>
                    <p className="text-[11px] text-slate-400 font-mono">
                      1st: #{lastResult.orderOfFinish[0].lane} · 2nd: #{lastResult.orderOfFinish[1].lane}
                    </p>
                  </div>
                </div>
                <p
                  className={`text-base font-mono font-bold tabular-nums ${
                    lastResult.netResult > 0 ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  {lastResult.netResult > 0
                    ? `+$${lastResult.netResult.toFixed(2)}`
                    : `-$${Math.abs(lastResult.netResult).toFixed(2)}`}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
