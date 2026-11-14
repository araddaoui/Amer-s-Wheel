import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Play, Volume2, VolumeX } from 'lucide-react';
import { BetLimits, CelebrationOutcome } from '../types/game';
import { roundCurrency } from '../services/probabilityEngine';
import { soundService } from '../services/soundService';

interface MatchupTeam {
  code: string;
  name: string;
  color: string;
  offenseRating: number; // ~104..116
}

interface BasketballMatchup {
  id: string;
  away: MatchupTeam;
  home: MatchupTeam;
  spreadHome: number; // e.g., -4.5
  totalLine: number; // e.g., 216.5
  moneylineHome: number;
  moneylineAway: number;
  spreadOdds: number;
  totalOdds: number;
}

type BetPickKey =
  | 'ML_HOME'
  | 'ML_AWAY'
  | 'SPREAD_HOME'
  | 'SPREAD_AWAY'
  | 'TOTAL_OVER'
  | 'TOTAL_UNDER';

interface PlayEvent {
  id: string;
  quarter: number;
  clock: string;
  teamCode: string;
  teamColor: string;
  points: 2 | 3;
  text: string;
}

interface BasketballResult {
  id: string;
  timestamp: number;
  matchupLabel: string;
  pickLabel: string;
  wager: number;
  payout: number;
  netResult: number;
  finalScore: string;
}

interface BasketballBettingGameProps {
  balance: number;
  limits: BetLimits;
  isMuted: boolean;
  onToggleMute: () => void;
  onBackToLobby: () => void;
  onDebitWager: (amount: number) => void;
  onSettleOutcome: (
    payout: number,
    netResult: number,
    multiplier: number,
    summary: string,
    auditType: 'BASKETBALL_BET',
    celebration: CelebrationOutcome
  ) => void;
}

const MATCHUPS: BasketballMatchup[] = [
  {
    id: 'm1',
    away: { code: 'BOS', name: 'Boston Stags', color: '#059669', offenseRating: 111 },
    home: { code: 'LAL', name: 'Los Angeles Royals', color: '#D97706', offenseRating: 113 },
    spreadHome: -3.5,
    totalLine: 218.5,
    moneylineHome: 1.72,
    moneylineAway: 2.15,
    spreadOdds: 1.91,
    totalOdds: 1.91,
  },
  {
    id: 'm2',
    away: { code: 'MIA', name: 'Miami Tide', color: '#E11D48', offenseRating: 106 },
    home: { code: 'NYK', name: 'New York Towers', color: '#2563EB', offenseRating: 110 },
    spreadHome: -5.5,
    totalLine: 209.5,
    moneylineHome: 1.58,
    moneylineAway: 2.42,
    spreadOdds: 1.91,
    totalOdds: 1.91,
  },
  {
    id: 'm3',
    away: { code: 'DEN', name: 'Denver Peaks', color: '#0891B2', offenseRating: 112 },
    home: { code: 'GSW', name: 'Bay Splash', color: '#4F46E5', offenseRating: 112 },
    spreadHome: -1.5,
    totalLine: 224.5,
    moneylineHome: 1.88,
    moneylineAway: 1.95,
    spreadOdds: 1.91,
    totalOdds: 1.91,
  },
];

export const BasketballBettingGame: React.FC<BasketballBettingGameProps> = ({
  balance,
  limits,
  isMuted,
  onToggleMute,
  onBackToLobby,
  onDebitWager,
  onSettleOutcome,
}) => {
  const [matchupIdx, setMatchupIdx] = useState<number>(0);
  const [pick, setPick] = useState<BetPickKey>('ML_HOME');
  const [wager, setWager] = useState<number>(() => Math.min(25, Math.max(limits.minBet, 25)));

  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [quarter, setQuarter] = useState<number>(1);
  const [awayScore, setAwayScore] = useState<number>(0);
  const [homeScore, setHomeScore] = useState<number>(0);
  const [gameClock, setGameClock] = useState<string>('12:00');
  const [feed, setFeed] = useState<PlayEvent[]>([]);
  const [lastShotTeam, setLastShotTeam] = useState<'HOME' | 'AWAY' | null>(null);
  const [lastShotPoints, setLastShotPoints] = useState<2 | 3>(2);
  const [lastResult, setLastResult] = useState<BasketballResult | null>(null);
  const [recentGames, setRecentGames] = useState<BasketballResult[]>([]);

  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
    };
  }, []);

  const matchup = MATCHUPS[matchupIdx];

  const getPickInfo = (key: BetPickKey): { label: string; odds: number } => {
    switch (key) {
      case 'ML_HOME':
        return { label: `${matchup.home.code} Moneyline`, odds: matchup.moneylineHome };
      case 'ML_AWAY':
        return { label: `${matchup.away.code} Moneyline`, odds: matchup.moneylineAway };
      case 'SPREAD_HOME':
        return { label: `${matchup.home.code} ${matchup.spreadHome}`, odds: matchup.spreadOdds };
      case 'SPREAD_AWAY':
        return {
          label: `${matchup.away.code} +${Math.abs(matchup.spreadHome)}`,
          odds: matchup.spreadOdds,
        };
      case 'TOTAL_OVER':
        return { label: `Over ${matchup.totalLine}`, odds: matchup.totalOdds };
      case 'TOTAL_UNDER':
        return { label: `Under ${matchup.totalLine}`, odds: matchup.totalOdds };
    }
  };

  const activePick = getPickInfo(pick);

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

  const isCurrentlyCovering = (aScore: number, hScore: number): boolean => {
    switch (pick) {
      case 'ML_HOME':
        return hScore > aScore;
      case 'ML_AWAY':
        return aScore > hScore;
      case 'SPREAD_HOME':
        return hScore + matchup.spreadHome > aScore;
      case 'SPREAD_AWAY':
        return aScore + Math.abs(matchup.spreadHome) > hScore;
      case 'TOTAL_OVER':
        return aScore + hScore > matchup.totalLine;
      case 'TOTAL_UNDER':
        return aScore + hScore < matchup.totalLine;
    }
  };

  const handleTipOff = () => {
    if (isPlaying || betError) return;

    const normalizedWager = roundCurrency(wager);
    onDebitWager(normalizedWager);
    setLastResult(null);
    setAwayScore(0);
    setHomeScore(0);
    setQuarter(1);
    setGameClock('12:00');
    setFeed([]);
    setIsPlaying(true);

    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (!prefersReducedMotion) {
      soundService.playBasketballWhistle();
    }

    // Simulate 32 rapid scoring possessions across 4 quarters
    const totalTicks = 32;
    let tick = 0;
    let curAway = 0;
    let curHome = 0;

    // Slight pace calibration around each matchup's totalLine
    const homeEdgeProb =
      matchup.home.offenseRating /
      (matchup.home.offenseRating + matchup.away.offenseRating);
    const highPace = matchup.totalLine / 216;

    const runTick = () => {
      tick++;
      const currentQ = Math.min(4, Math.ceil((tick / totalTicks) * 4));
      const ticksInQ = totalTicks / 4;
      const tickWithinQ = (tick - 1) % ticksInQ;
      const minsLeft = Math.max(
        0,
        Math.round(12 - ((tickWithinQ + 1) / ticksInQ) * 12)
      );
      const clockStr =
        tick === totalTicks
          ? '0:00'
          : `${minsLeft}:${String((59 - tick * 7) % 60).padStart(2, '0')}`;

      // Each tick represents ~1.5 mins of action; each side may score 0, 2, 3, or 5 pts
      const awayBurst =
        Math.random() < 0.78 * highPace
          ? Math.random() < 0.34
            ? 3
            : 2
          : 0;
      const homeBurst =
        Math.random() < 0.78 * highPace * (homeEdgeProb / 0.5)
          ? Math.random() < 0.35
            ? 3
            : 2
          : 0;

      // Add occasional quick run for realistic NBA scoring (95–120 pts per team)
      const awayBonus = Math.random() < 0.55 ? 2 : 0;
      const homeBonus = Math.random() < 0.58 ? 2 : 0;

      const awayPts = awayBurst + awayBonus;
      const homePts = homeBurst + homeBonus;

      curAway += awayPts;
      curHome += homePts;

      // Break tie cleanly on final buzzer
      if (tick === totalTicks && curAway === curHome) {
        if (Math.random() < homeEdgeProb) {
          curHome += 2;
        } else {
          curAway += 2;
        }
      }

      setQuarter(currentQ);
      setGameClock(clockStr);
      setAwayScore(curAway);
      setHomeScore(curHome);

      const scoredTeam = homePts >= awayPts ? matchup.home : matchup.away;
      const scoredSide: 'HOME' | 'AWAY' = homePts >= awayPts ? 'HOME' : 'AWAY';
      const pts: 2 | 3 = homePts === 3 || awayPts === 3 ? 3 : 2;
      setLastShotTeam(scoredSide);
      setLastShotPoints(pts);

      if (!prefersReducedMotion && (awayPts > 0 || homePts > 0)) {
        soundService.playBasketSwish(pts === 3);
      }

      const playDescriptions =
        pts === 3
          ? ['drills a deep three-pointer!', 'cashes a corner triple!', 'hits from downtown!']
          : ['finishes a driving layup!', 'sinks a pull-up jumper!', 'throws down a fast-break dunk!'];

      setFeed((prev) => [
        {
          id: `play-${tick}`,
          quarter: currentQ,
          clock: clockStr,
          teamCode: scoredTeam.code,
          teamColor: scoredTeam.color,
          points: pts,
          text: `${scoredTeam.code} ${playDescriptions[tick % playDescriptions.length]}`,
        },
        ...prev,
      ].slice(0, 8));

      if (tick >= totalTicks) {
        if (timerRef.current) {
          window.clearInterval(timerRef.current);
          timerRef.current = null;
        }
        setIsPlaying(false);

        const won = isCurrentlyCovering(curAway, curHome);
        const appliedMult = won ? activePick.odds : 0;
        const payout = roundCurrency(normalizedWager * appliedMult);
        const netResult = roundCurrency(payout - normalizedWager);
        const finalScore = `${matchup.away.code} ${curAway} – ${matchup.home.code} ${curHome}`;

        const res: BasketballResult = {
          id: `bball-${Date.now()}`,
          timestamp: Date.now(),
          matchupLabel: `${matchup.away.code} @ ${matchup.home.code}`,
          pickLabel: activePick.label,
          wager: normalizedWager,
          payout,
          netResult,
          finalScore,
        };
        setLastResult(res);
        setRecentGames((prev) => [res, ...prev].slice(0, 10));

        const summary = `CourtSide Hoops: Bet $${normalizedWager.toFixed(2)} on ${activePick.label} (${finalScore}) → Payout $${payout.toFixed(2)}`;
        onSettleOutcome(payout, netResult, appliedMult, summary, 'BASKETBALL_BET', {
          multiplier: appliedMult,
          payout,
          netResult,
          label: won ? activePick.label : finalScore,
        });
      }
    };

    timerRef.current = window.setInterval(runTick, prefersReducedMotion ? 25 : 210);
  };

  const coveringNow = isCurrentlyCovering(awayScore, homeScore);

  return (
    <div className="flex flex-col gap-8">
      {/* Header Row */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={onBackToLobby}
            disabled={isPlaying}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-300 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg transition-colors disabled:opacity-50 cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            All Games
          </button>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-100 tracking-tight">
              CourtSide Hoops
            </h1>
            <p className="text-xs text-slate-400 font-mono tabular-nums">
              Pro Matchup Simulation · Moneyline, Spread & Totals · Shared Wallet
            </p>
          </div>
        </div>

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

      {/* Matchup Selector Tabs */}
      <div className="flex flex-wrap items-center gap-2">
        {MATCHUPS.map((m, idx) => (
          <button
            key={m.id}
            type="button"
            disabled={isPlaying}
            onClick={() => {
              setMatchupIdx(idx);
              setAwayScore(0);
              setHomeScore(0);
              setFeed([]);
              setLastResult(null);
            }}
            className={`px-4 py-2 text-xs font-semibold rounded-lg border transition-colors cursor-pointer disabled:opacity-50 ${
              matchupIdx === idx
                ? 'bg-slate-800 border-amber-500/50 text-slate-100'
                : 'bg-[#111827] border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            {m.away.name} @ {m.home.name}
          </button>
        ))}
      </div>

      {/* Main Court + Bet Slip */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <div className="lg:col-span-8 flex flex-col gap-6">
          {/* Arena Scoreboard & Hardwood Visualizer */}
          <div className="bg-[#111827] border border-slate-800 rounded-2xl p-6 flex flex-col gap-5">
            {/* Scoreboard */}
            <div className="grid grid-cols-3 items-center gap-4 bg-[#0B1120] border border-slate-800 rounded-xl p-5">
              <div>
                <p className="text-xs font-mono text-slate-400">AWAY</p>
                <div className="flex items-center gap-2 mt-1">
                  <span
                    className="w-3 h-3 rounded-sm"
                    style={{ backgroundColor: matchup.away.color }}
                  />
                  <span className="text-base sm:text-lg font-bold text-slate-100">
                    {matchup.away.name}
                  </span>
                </div>
                <p className="mt-2 text-3xl sm:text-4xl font-mono font-bold tabular-nums text-slate-100">
                  {awayScore}
                </p>
              </div>

              <div className="text-center">
                <p className="text-xs font-mono font-semibold text-amber-400">
                  {isPlaying ? `Q${quarter} · ${gameClock}` : lastResult ? 'FINAL' : 'TIP-OFF READY'}
                </p>
                <p className="text-xs font-mono tabular-nums text-slate-400 mt-2">
                  Total: {awayScore + homeScore} / {matchup.totalLine}
                </p>
                {(isPlaying || lastResult) && (
                  <p
                    className={`mt-2 text-xs font-semibold ${
                      coveringNow ? 'text-emerald-400' : 'text-rose-400'
                    }`}
                  >
                    {coveringNow ? `Covering: ${activePick.label}` : `Trailing: ${activePick.label}`}
                  </p>
                )}
              </div>

              <div className="text-right">
                <p className="text-xs font-mono text-slate-400">HOME</p>
                <div className="flex items-center justify-end gap-2 mt-1">
                  <span className="text-base sm:text-lg font-bold text-slate-100">
                    {matchup.home.name}
                  </span>
                  <span
                    className="w-3 h-3 rounded-sm"
                    style={{ backgroundColor: matchup.home.color }}
                  />
                </div>
                <p className="mt-2 text-3xl sm:text-4xl font-mono font-bold tabular-nums text-slate-100">
                  {homeScore}
                </p>
              </div>
            </div>

            {/* Hardwood Court SVG Shot Arc Visualizer */}
            <div className="rounded-xl border border-amber-900/40 bg-[#1B140C] p-4">
              <svg viewBox="0 0 600 175" className="w-full h-auto">
                {/* Hardwood Floor */}
                <rect x="8" y="8" width="584" height="159" rx="8" fill="#2A1F13" stroke="#92400E" strokeWidth="2" />
                <line x1="300" y1="8" x2="300" y2="167" stroke="#92400E" strokeWidth="1.5" />
                <circle cx="300" cy="87.5" r="32" fill="none" stroke="#92400E" strokeWidth="1.5" />

                {/* Left Hoop (Away Defends) */}
                <circle cx="34" cy="87.5" r="7" fill="none" stroke="#F59E0B" strokeWidth="2.5" />
                {/* Right Hoop (Home Defends) */}
                <circle cx="566" cy="87.5" r="7" fill="none" stroke="#F59E0B" strokeWidth="2.5" />

                {/* Active Shot Arc */}
                {isPlaying && lastShotTeam && (
                  <path
                    d={
                      lastShotTeam === 'HOME'
                        ? lastShotPoints === 3
                          ? 'M 360 110 Q 195 10 34 87.5'
                          : 'M 480 95 Q 310 22 34 87.5'
                        : lastShotPoints === 3
                        ? 'M 240 110 Q 405 10 566 87.5'
                        : 'M 120 95 Q 290 22 566 87.5'
                    }
                    fill="none"
                    stroke="#FBBF24"
                    strokeWidth="2.5"
                    strokeDasharray="6 4"
                  />
                )}
              </svg>
            </div>

            {/* Play-by-Play Feed */}
            <div className="border-t border-slate-800 pt-4">
              <h3 className="text-xs font-semibold text-slate-400 mb-2">Live Play-by-Play</h3>
              {feed.length === 0 ? (
                <p className="text-xs text-slate-500">
                  Select your market and tip off the game to watch live quarter-by-quarter scoring.
                </p>
              ) : (
                <div className="flex flex-col gap-1.5 text-xs">
                  {feed.slice(0, 5).map((ev) => (
                    <div key={ev.id} className="flex items-center gap-2 font-mono">
                      <span className="text-slate-500">
                        Q{ev.quarter} {ev.clock}
                      </span>
                      <span
                        className="w-2 h-2 rounded-xs shrink-0"
                        style={{ backgroundColor: ev.teamColor }}
                      />
                      <span className="font-sans text-slate-200">{ev.text}</span>
                      <span className="text-amber-400 font-semibold ml-auto">+{ev.points}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Recent Basketball Bets */}
          {recentGames.length > 0 && (
            <div className="bg-[#111827] border border-slate-800 rounded-xl p-5">
              <h3 className="text-sm font-semibold text-slate-100 mb-3">Recent Matchup Tickets</h3>
              <div className="divide-y divide-slate-800/60 text-xs">
                {recentGames.slice(0, 5).map((g) => (
                  <div key={g.id} className="py-2.5 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-slate-300">
                      <span className="font-mono text-slate-400">{g.finalScore}</span>
                      <span className="text-slate-600">·</span>
                      <span>{g.pickLabel}</span>
                    </div>
                    <span
                      className={`font-mono tabular-nums font-semibold ${
                        g.netResult > 0 ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      {g.netResult > 0 ? `+$${g.netResult.toFixed(2)}` : `-$${Math.abs(g.netResult).toFixed(2)}`}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right: Markets & Betting Slip */}
        <div className="lg:col-span-4 bg-[#111827] border border-slate-800 rounded-2xl p-6 flex flex-col gap-5">
          <div className="pb-4 border-b border-slate-800">
            <p className="text-xs font-medium text-slate-400">Shared Balance</p>
            <p className="mt-1 text-2xl font-bold font-mono tabular-nums text-slate-50">
              ${balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <p className="text-xs font-medium text-slate-300">Select Market Line</p>
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  { key: 'ML_AWAY', label: `${matchup.away.code} Win`, odds: matchup.moneylineAway },
                  { key: 'ML_HOME', label: `${matchup.home.code} Win`, odds: matchup.moneylineHome },
                  { key: 'SPREAD_AWAY', label: `${matchup.away.code} +${Math.abs(matchup.spreadHome)}`, odds: matchup.spreadOdds },
                  { key: 'SPREAD_HOME', label: `${matchup.home.code} ${matchup.spreadHome}`, odds: matchup.spreadOdds },
                  { key: 'TOTAL_OVER', label: `Over ${matchup.totalLine}`, odds: matchup.totalOdds },
                  { key: 'TOTAL_UNDER', label: `Under ${matchup.totalLine}`, odds: matchup.totalOdds },
                ] as { key: BetPickKey; label: string; odds: number }[]
              ).map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  disabled={isPlaying}
                  onClick={() => setPick(opt.key)}
                  className={`p-2.5 rounded-lg border text-left transition-colors cursor-pointer disabled:opacity-50 ${
                    pick === opt.key
                      ? 'bg-amber-500/15 border-amber-500/50 text-slate-100'
                      : 'bg-[#0B1120] border-slate-800 text-slate-300 hover:border-slate-700'
                  }`}
                >
                  <p className="text-xs font-semibold">{opt.label}</p>
                  <p className="text-[11px] font-mono text-amber-400 mt-0.5">{opt.odds.toFixed(2)}x</p>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label htmlFor="bball-wager" className="block text-xs font-medium text-slate-300 mb-1.5">
              Wager Amount ($)
            </label>
            <input
              id="bball-wager"
              type="number"
              min={limits.minBet}
              max={limits.maxBet}
              disabled={isPlaying}
              value={Number.isFinite(wager) ? wager : ''}
              onChange={(e) => setWager(parseFloat(e.target.value) || 0)}
              className="w-full px-3.5 py-2.5 bg-[#0B1120] border border-slate-700 rounded-lg font-mono text-base font-semibold text-slate-100 focus:border-amber-500 focus:outline-none"
            />
            <div className="flex flex-wrap gap-2 mt-2.5">
              {[10, 25, 50, 100].map((amt) => (
                <button
                  key={amt}
                  type="button"
                  disabled={isPlaying}
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
            <span>Potential Payout ({activePick.odds.toFixed(2)}x)</span>
            <span className="text-emerald-400 font-semibold">
              ${(Math.max(0, wager) * activePick.odds).toFixed(2)}
            </span>
          </div>

          {betError && <p className="text-xs text-rose-400">{betError}</p>}

          <button
            type="button"
            disabled={isPlaying || betError !== null}
            onClick={handleTipOff}
            className="w-full py-3.5 px-6 rounded-xl font-display font-bold text-sm bg-amber-500 hover:bg-amber-400 disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 flex items-center justify-center gap-2 transition-colors cursor-pointer"
          >
            <Play className="w-4 h-4 fill-current" />
            {isPlaying ? 'Game Live...' : `Tip Off Game ($${(Number.isFinite(wager) ? wager : 0).toFixed(2)})`}
          </button>

          {lastResult && !isPlaying && (
            <div
              className={`p-4 rounded-xl border ${
                lastResult.netResult > 0
                  ? 'bg-emerald-950/35 border-emerald-700/60'
                  : 'bg-slate-900/90 border-slate-700/80'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-xs font-semibold text-slate-100">
                    {lastResult.netResult > 0 ? 'Bet Covered!' : 'Bet Missed'}
                  </p>
                  <p className="text-[11px] font-mono text-slate-400 mt-0.5">
                    {lastResult.finalScore}
                  </p>
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
