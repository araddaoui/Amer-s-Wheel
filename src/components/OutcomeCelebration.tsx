import React, { useMemo } from 'react';
import { CelebrationOutcome } from '../types/game';

interface OutcomeCelebrationProps {
  outcome: CelebrationOutcome | null;
  triggerKey: number;
}

interface ParticleSpec {
  id: number;
  leftPercent: number;
  delaySec: number;
  durationSec: number;
  driftX: number;
  spinDeg: number;
  scale: number;
  symbol: string;
}

export const OutcomeCelebration: React.FC<OutcomeCelebrationProps> = ({
  outcome,
  triggerKey,
}) => {
  const isWin = outcome ? outcome.multiplier > 1 : false;
  const isLoss = outcome ? outcome.multiplier < 1 : false;
  const isJackpot = outcome ? outcome.multiplier >= 10 : false;

  const particles = useMemo<ParticleSpec[]>(() => {
    if (!outcome || triggerKey === 0) return [];
    if (!isWin && !isLoss) return [];

    const count = isJackpot ? 52 : isWin ? 34 : 26;
    const winSymbols = ['$', '$$', '$', 'CASH', '$'];
    const lossSymbols = ['-$', '$', '-$', '0x'];

    return Array.from({ length: count }, (_, idx) => {
      const baseLeft = ((idx + 0.5) / count) * 96 + 2;
      const jitter = ((idx * 37) % 11) - 5;
      return {
        id: idx,
        leftPercent: Math.max(2, Math.min(96, baseLeft + jitter)),
        delaySec: ((idx * 13) % 10) * 0.065,
        durationSec: isWin ? 1.85 + ((idx * 7) % 9) * 0.14 : 1.55 + ((idx * 5) % 8) * 0.12,
        driftX: ((idx * 29) % 120) - 60,
        spinDeg: isWin ? ((idx * 53) % 360) - 180 : ((idx * 31) % 140) - 70,
        scale: isJackpot ? 1.1 + (idx % 4) * 0.18 : 0.85 + (idx % 4) * 0.14,
        symbol: isWin
          ? winSymbols[idx % winSymbols.length]
          : lossSymbols[idx % lossSymbols.length],
      };
    });
  }, [outcome, triggerKey, isWin, isLoss, isJackpot]);

  if (!outcome || triggerKey === 0 || (!isWin && !isLoss)) {
    return null;
  }

  return (
    <div
      key={triggerKey}
      aria-hidden="true"
      className="fixed inset-0 pointer-events-none z-50 overflow-hidden"
    >
      {/* Full-Screen Illumination / Inverse Loss Vignette */}
      {isWin ? (
        <div
          className="absolute inset-0 animate-screen-win"
          style={{
            background: isJackpot
              ? 'radial-gradient(circle at 38% 45%, rgba(251, 191, 36, 0.45) 0%, rgba(16, 185, 129, 0.28) 45%, rgba(245, 158, 11, 0.14) 100%)'
              : 'radial-gradient(circle at 38% 45%, rgba(16, 185, 129, 0.36) 0%, rgba(251, 191, 36, 0.22) 50%, rgba(16, 185, 129, 0.08) 100%)',
          }}
        />
      ) : (
        <div
          className="absolute inset-0 animate-screen-loss"
          style={{
            background:
              'radial-gradient(circle at 38% 45%, rgba(225, 29, 72, 0.32) 0%, rgba(15, 23, 42, 0.55) 60%, rgba(2, 6, 23, 0.72) 100%)',
          }}
        />
      )}

      {/* Dollar / Cash Symbols Floating Up on Win OR Draining Down on Loss */}
      {particles.map((pt) => (
        <div
          key={pt.id}
          className={`absolute font-mono font-extrabold select-none ${
            isWin ? 'bottom-0 animate-cash-up' : 'top-0 animate-cash-down'
          }`}
          style={
            {
              left: `${pt.leftPercent}%`,
              fontSize: pt.symbol === 'CASH' ? '15px' : `${Math.round(24 * pt.scale)}px`,
              color: isWin
                ? pt.id % 3 === 0
                  ? '#FBBF24'
                  : '#34D399'
                : pt.id % 2 === 0
                ? '#FB7185'
                : '#E11D48',
              textShadow: isWin
                ? '0 2px 14px rgba(16, 185, 129, 0.55)'
                : '0 2px 10px rgba(225, 29, 72, 0.45)',
              '--drift-x': `${pt.driftX}px`,
              '--spin-deg': `${pt.spinDeg}deg`,
              '--dur': `${pt.durationSec}s`,
              '--delay': `${pt.delaySec}s`,
            } as React.CSSProperties
          }
        >
          {pt.symbol === 'CASH' ? (
            <span className="inline-flex items-center justify-center px-2 py-0.5 rounded border border-emerald-300/70 bg-emerald-500/25 text-emerald-200 tracking-wider">
              $
            </span>
          ) : (
            pt.symbol
          )}
        </div>
      ))}
    </div>
  );
};
