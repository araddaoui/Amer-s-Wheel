import {
  AuditLogEntry,
  ComputedSegment,
  GameConfig,
  PlayerState,
  SpinRecord,
} from '../types/game';
import { calculateProbabilities, roundCurrency } from './probabilityEngine';
import { generateFairSpinOutcome } from './randomService';

export interface SpinExecutionResult {
  spinRecord: SpinRecord;
  auditEntry: AuditLogEntry;
  updatedPlayer: PlayerState;
  winningSegment: ComputedSegment;
  targetWheelRotation: number;
}

export function validateBet(
  betAmount: number,
  playerBalance: number,
  config: GameConfig
): string | null {
  if (!Number.isFinite(betAmount) || betAmount <= 0) {
    return 'Enter a valid bet amount greater than $0.';
  }
  if (betAmount < config.limits.minBet) {
    return `Minimum allowed bet is $${config.limits.minBet.toFixed(2)}.`;
  }
  if (betAmount > config.limits.maxBet) {
    return `Maximum allowed bet is $${config.limits.maxBet.toFixed(2)}.`;
  }
  if (betAmount > playerBalance) {
    return 'Insufficient balance for this wager.';
  }
  return null;
}

/**
 * Computes the next monotonically increasing clockwise wheel rotation angle (degrees)
 * so that the 12-o'clock pointer lands cleanly inside the winning segment's proportional arc.
 */
export function computeTargetWheelRotation(
  currentRotation: number,
  winningSegment: ComputedSegment
): number {
  const sweep = winningSegment.sweepAngle;
  // Keep pointer inside [12%, 88%] of the segment arc so it never sits ambiguously on a divider
  const safeMargin = Math.min(sweep * 0.14, 4);
  const usableSweep = Math.max(0.2, sweep - safeMargin * 2);
  const localAngle = winningSegment.startAngle + safeMargin + Math.random() * usableSweep;

  const targetMod = (360 - (localAngle % 360) + 360) % 360;
  const currentMod = ((currentRotation % 360) + 360) % 360;
  const deltaMod = (targetMod - currentMod + 360) % 360;
  const fullSpins = 360 * (9 + Math.floor(Math.random() * 4));

  return currentRotation + fullSpins + deltaMod;
}

export async function executeSpin(
  betAmount: number,
  player: PlayerState,
  config: GameConfig,
  currentWheelRotation: number
): Promise<SpinExecutionResult> {
  const calc = calculateProbabilities(config.segments, config.limits);
  if (!calc.isValid) {
    throw new Error('Wheel configuration has mathematical errors. Resolve them in the Operator Console.');
  }

  const betError = validateBet(betAmount, player.balance, config);
  if (betError) {
    throw new Error(betError);
  }

  const normalizedBet = roundCurrency(betAmount);
  const { winningSegment, fairness } = await generateFairSpinOutcome(
    calc.segments,
    player.clientSeed,
    player.nonce
  );

  const payout = roundCurrency(normalizedBet * winningSegment.multiplier);
  const netResult = roundCurrency(payout - normalizedBet);
  const balanceBefore = roundCurrency(player.balance);
  const balanceAfter = roundCurrency(balanceBefore - normalizedBet + payout);

  const spinId = `spin-${Date.now()}-${player.nonce}`;
  const spinRecord: SpinRecord = {
    id: spinId,
    timestamp: Date.now(),
    betAmount: normalizedBet,
    segmentId: winningSegment.id,
    segmentLabel: winningSegment.label,
    segmentColor: winningSegment.color,
    multiplier: winningSegment.multiplier,
    probabilityPercent: winningSegment.probabilityPercent,
    payout,
    netResult,
    balanceBefore,
    balanceAfter,
    theoreticalRtpPercent: calc.rtpPercent,
    theoreticalHouseEdgePercent: calc.houseEdgePercent,
    fairness,
  };

  const prevStats = player.stats;
  const isWin = winningSegment.multiplier > 1;
  const isBreakEven = winningSegment.multiplier === 1;
  const isLoss = winningSegment.multiplier < 1;

  let nextStreak = prevStats.currentStreak;
  if (isWin) {
    nextStreak = prevStats.currentStreak >= 0 ? prevStats.currentStreak + 1 : 1;
  } else if (isLoss) {
    nextStreak = prevStats.currentStreak <= 0 ? prevStats.currentStreak - 1 : -1;
  }

  const updatedPlayer: PlayerState = {
    ...player,
    balance: balanceAfter,
    nonce: player.nonce + 1,
    stats: {
      totalSpins: prevStats.totalSpins + 1,
      totalWagered: roundCurrency(prevStats.totalWagered + normalizedBet),
      totalPayout: roundCurrency(prevStats.totalPayout + payout),
      netProfit: roundCurrency(prevStats.netProfit + netResult),
      winsCount: prevStats.winsCount + (isWin ? 1 : 0),
      breakEvenCount: prevStats.breakEvenCount + (isBreakEven ? 1 : 0),
      lossesCount: prevStats.lossesCount + (isLoss ? 1 : 0),
      biggestWin: Math.max(prevStats.biggestWin, netResult),
      biggestMultiplier: Math.max(prevStats.biggestMultiplier, winningSegment.multiplier),
      currentStreak: nextStreak,
    },
    history: [spinRecord, ...player.history].slice(0, 250),
  };

  const auditEntry: AuditLogEntry = {
    id: `aud-${Date.now()}-${player.nonce}`,
    timestamp: spinRecord.timestamp,
    type: 'SPIN',
    actor: 'PLAYER',
    summary: `Spin #${player.nonce}: Bet $${normalizedBet.toFixed(2)} → ${winningSegment.label} (${winningSegment.multiplier}x) → Payout $${payout.toFixed(2)}`,
    amountDelta: netResult,
    balanceAfter,
    details: {
      spinId,
      bet: normalizedBet,
      multiplier: winningSegment.multiplier,
      payout,
      theoreticalRtpPercent: calc.rtpPercent,
      serverSeedHash: fairness.serverSeedHash.slice(0, 16) + '...',
    },
  };

  const targetWheelRotation = computeTargetWheelRotation(currentWheelRotation, winningSegment);

  return {
    spinRecord,
    auditEntry,
    updatedPlayer,
    winningSegment,
    targetWheelRotation,
  };
}
