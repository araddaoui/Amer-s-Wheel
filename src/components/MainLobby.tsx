import React, { useState } from 'react';
import { ArrowRight, PlusCircle, RotateCcw, ShieldCheck } from 'lucide-react';
import { AuditLogEntry, BetLimits, ProbabilityCalculation } from '../types/game';

export type GameRoute = 'wheel' | 'horses' | 'basketball' | 'operator';

interface MainLobbyProps {
  balance: number;
  limits: BetLimits;
  wheelCalc: ProbabilityCalculation;
  recentAudit: AuditLogEntry[];
  onSelectGame: (route: GameRoute) => void;
  onTopUp: (amount: number) => void;
  onResetBalance: () => void;
}

interface GameCardSpec {
  id: 'wheel' | 'horses' | 'basketball';
  title: string;
  meta: string;
  description: string;
  imageSrc: string;
  imageAlt: string;
  ctaLabel: string;
  accentGradient: string;
}

export const MainLobby: React.FC<MainLobbyProps> = ({
  balance,
  limits,
  wheelCalc,
  recentAudit,
  onSelectGame,
  onTopUp,
  onResetBalance,
}) => {
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});

  const games: GameCardSpec[] = [
    {
      id: 'wheel',
      title: "Amer's Wheel",
      meta: `Configurable House Edge · ${wheelCalc.rtpPercent.toFixed(2)}% RTP · Up to ${Math.max(...wheelCalc.segments.map((s) => s.multiplier))}x`,
      description:
        'Proportional spinning wheel with Mystery Spin reveal, SHA-256 verifiable RNG, and live probability configuration in the Operator Console.',
      imageSrc: '/src/assets/images/game_card_amers_wheel_1794644917309.jpg',
      imageAlt: "Amer's Wheel luxury studio prize wheel",
      ctaLabel: "Play Amer's Wheel",
      accentGradient: 'from-amber-950/80 via-slate-900 to-slate-950',
    },
    {
      id: 'horses',
      title: 'Royal Turf Derby',
      meta: '5-Lane Turf Sprint · Win & Place Markets · Up to 22x Odds',
      description:
        'Pick your thoroughbred, choose Win or Top-2 Place markets, and watch the animated 5-furlong turf sprint down to the finish wire.',
      imageSrc: '/src/assets/images/game_card_horse_racing_1794644918682.jpg',
      imageAlt: 'Thoroughbred racehorses sprinting on an emerald turf track under floodlights',
      ctaLabel: 'Enter Turf Derby',
      accentGradient: 'from-emerald-950/80 via-slate-900 to-slate-950',
    },
    {
      id: 'basketball',
      title: 'CourtSide Hoops',
      meta: 'Moneyline, Spread & Totals · Live 4-Quarter Sim',
      description:
        'Back the Moneyline, Point Spread, or Over/Under total across featured matchups and follow live play-by-play shot arcs through the buzzer.',
      imageSrc: '/src/assets/images/game_card_basketball_1794644917986.jpg',
      imageAlt: 'Hardwood indoor basketball arena court under dramatic spotlights',
      ctaLabel: 'Tip Off Hoops',
      accentGradient: 'from-blue-950/80 via-slate-900 to-slate-950',
    },
  ];

  const gameEvents = recentAudit.filter((e) =>
    e.type === 'SPIN' || e.type === 'HORSE_RACE' || e.type === 'BASKETBALL_BET'
  );

  return (
    <div className="flex flex-col gap-10">
      {/* Lobby Hero Header & Unified Wallet Strip */}
      <section className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 pb-8 border-b border-slate-800/90">
        <div className="max-w-2xl">
          <h1
            className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-50"
            style={{ textWrap: 'balance' }}
          >
            Amer&apos;s Wheel &amp; Sports Betting Lounge
          </h1>
          <p className="mt-3 text-sm sm:text-base text-slate-400 leading-relaxed">
            Choose a live game below using your unified virtual wallet. Every outcome across
            Amer&apos;s Wheel, Turf Derby, and CourtSide Hoops settles to the same balance and
            verifiable audit ledger.
          </p>
        </div>

        {/* Unified Bankroll Control */}
        <div className="bg-[#111827] border border-slate-800 rounded-xl p-5 flex flex-wrap items-center gap-6 shrink-0">
          <div>
            <p className="text-xs font-medium text-slate-400">Unified Wallet Balance</p>
            <p className="mt-1 text-2xl font-bold font-mono tabular-nums text-slate-50">
              ${balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onTopUp(500)}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
            >
              <PlusCircle className="w-3.5 h-3.5 text-emerald-400" />
              +$500
            </button>
            <button
              type="button"
              onClick={onResetBalance}
              title={`Reset balance to $${limits.defaultBalance}`}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-300 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset
            </button>
          </div>
        </div>
      </section>

      {/* Featured Betting Games Grid */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
        {games.map((game) => {
          const isFailed = failedImages[game.id];
          return (
            <article
              key={game.id}
              onClick={() => onSelectGame(game.id)}
              className="group bg-[#111827] border border-slate-800 hover:border-amber-500/50 rounded-2xl overflow-hidden flex flex-col transition-all duration-200 cursor-pointer"
            >
              {/* 16:9 Game Cover Media with Resilient Fallback */}
              <div className="relative aspect-video w-full overflow-hidden bg-[#0B1120]">
                {!isFailed ? (
                  <img
                    src={game.imageSrc}
                    alt={game.imageAlt}
                    referrerPolicy="no-referrer"
                    onError={() =>
                      setFailedImages((prev) => ({ ...prev, [game.id]: true }))
                    }
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                  />
                ) : (
                  <div
                    className={`w-full h-full bg-gradient-to-br ${game.accentGradient} flex items-center justify-center p-6`}
                  >
                    <span className="font-display text-lg font-bold text-slate-200">
                      {game.title}
                    </span>
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-[#111827] via-transparent to-transparent" />
              </div>

              {/* Card Body — Clean Unboxed Metadata, No Pill Sandwiches */}
              <div className="p-6 pt-3 flex-1 flex flex-col justify-between gap-5">
                <div>
                  <h2 className="text-xl font-bold text-slate-100 group-hover:text-amber-400 transition-colors">
                    {game.title}
                  </h2>
                  <p className="mt-1.5 text-xs font-mono tabular-nums text-slate-400">
                    {game.meta}
                  </p>
                  <p className="mt-3 text-sm text-slate-300 leading-relaxed">
                    {game.description}
                  </p>
                </div>

                <div className="pt-2">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectGame(game.id);
                    }}
                    className="w-full py-2.5 px-4 rounded-xl text-xs font-semibold bg-amber-500 group-hover:bg-amber-400 text-slate-950 flex items-center justify-center gap-2 transition-colors whitespace-nowrap cursor-pointer"
                  >
                    <span>{game.ctaLabel}</span>
                    <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
                  </button>
                </div>
              </div>
            </article>
          );
        })}
      </section>

      {/* Cross-Game Activity & Operator Administration Strip */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-8 bg-[#111827] border border-slate-800 rounded-xl p-6">
          <div className="flex items-center justify-between gap-4 mb-4">
            <div>
              <h3 className="text-base font-semibold text-slate-100">
                Recent Cross-Game Activity
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Latest settled wagers across Amer&apos;s Wheel, Turf Derby, and CourtSide Hoops.
              </p>
            </div>
          </div>

          {gameEvents.length === 0 ? (
            <p className="text-xs text-slate-500 py-4">
              No wagers placed yet. Select any game above to get started.
            </p>
          ) : (
            <div className="divide-y divide-slate-800/60 text-xs">
              {gameEvents.slice(0, 5).map((entry) => (
                <div
                  key={entry.id}
                  className="py-2.5 flex flex-wrap items-center justify-between gap-2"
                >
                  <div className="flex items-center gap-2.5 text-slate-300">
                    <span className="font-mono text-slate-500">
                      {new Date(entry.timestamp).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })}
                    </span>
                    <span className="text-slate-600">·</span>
                    <span>{entry.summary}</span>
                  </div>
                  {entry.amountDelta !== undefined && (
                    <span
                      className={`font-mono tabular-nums font-semibold ${
                        entry.amountDelta > 0
                          ? 'text-emerald-400'
                          : entry.amountDelta < 0
                          ? 'text-rose-400'
                          : 'text-blue-300'
                      }`}
                    >
                      {entry.amountDelta > 0
                        ? `+$${entry.amountDelta.toFixed(2)}`
                        : entry.amountDelta < 0
                        ? `-$${Math.abs(entry.amountDelta).toFixed(2)}`
                        : '$0.00'}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="lg:col-span-4 bg-[#111827] border border-slate-800 rounded-xl p-6 flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-amber-400" />
            <h3 className="text-base font-semibold text-slate-100">
              Platform Administration
            </h3>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            Configure Amer&apos;s Wheel segments, weights, multipliers, target house edge, Monte
            Carlo simulations, and inspect the complete cross-game audit ledger.
          </p>
          <button
            type="button"
            onClick={() => onSelectGame('operator')}
            className="mt-1 py-2.5 px-4 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-100 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
          >
            Open Operator Console
          </button>
        </div>
      </section>
    </div>
  );
};
