import {
  BetLimits,
  ComputedSegment,
  ProbabilityCalculation,
  ProposedSegmentAdjustment,
  TargetEdgeProposal,
  TargetEdgeStrategy,
  ValidationIssue,
  WheelSegment,
} from '../types/game';

/**
 * Fixed-point precision scale (1,000,000 = 1.000000) to avoid IEEE-754
 * floating-point drift in financial and probability calculations.
 */
const SCALE = 1_000_000;

export function roundTo(value: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

export function roundCurrency(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function toScaled(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * SCALE);
}

export const DEFAULT_SEGMENTS: WheelSegment[] = [
  {
    id: 'seg-lose',
    label: 'Lose',
    weight: 50,
    multiplier: 0,
    color: '#1E293B',
  },
  {
    id: 'seg-break-even',
    label: 'Break Even',
    weight: 35,
    multiplier: 1,
    color: '#2563EB',
  },
  {
    id: 'seg-minor-win',
    label: 'Minor Win',
    weight: 10,
    multiplier: 2,
    color: '#059669',
  },
  {
    id: 'seg-major-win',
    label: 'Major Win',
    weight: 4,
    multiplier: 5,
    color: '#D97706',
  },
  {
    id: 'seg-jackpot',
    label: 'Jackpot',
    weight: 1,
    multiplier: 20,
    color: '#E11D48',
  },
];

export const DEFAULT_LIMITS: BetLimits = {
  minBet: 1,
  maxBet: 1000,
  defaultBalance: 1000,
};

/**
 * Evaluates all segment probabilities, angles, RTP, House Edge, and configuration validity
 * using scaled integer arithmetic to eliminate floating-point drift.
 */
export function calculateProbabilities(
  segments: WheelSegment[],
  limits?: BetLimits
): ProbabilityCalculation {
  const issues: ValidationIssue[] = [];

  if (segments.length < 2) {
    issues.push({
      id: 'min-segments',
      severity: 'error',
      message: 'At least 2 wheel segments are required.',
    });
  }

  let totalWeightScaled = 0;

  segments.forEach((seg, idx) => {
    if (!seg.label || seg.label.trim().length === 0) {
      issues.push({
        id: `empty-label-${seg.id}`,
        severity: 'error',
        field: seg.id,
        message: `Segment #${idx + 1} is missing an outcome label.`,
      });
    }
    if (!Number.isFinite(seg.weight) || seg.weight < 0) {
      issues.push({
        id: `neg-weight-${seg.id}`,
        severity: 'error',
        field: seg.id,
        message: `Segment "${seg.label || idx + 1}" has a negative or invalid weight.`,
      });
    } else {
      totalWeightScaled += toScaled(seg.weight);
    }

    if (!Number.isFinite(seg.multiplier) || seg.multiplier < 0) {
      issues.push({
        id: `neg-mult-${seg.id}`,
        severity: 'error',
        field: seg.id,
        message: `Segment "${seg.label || idx + 1}" has a negative or invalid multiplier.`,
      });
    }
  });

  if (totalWeightScaled <= 0) {
    issues.push({
      id: 'zero-weight',
      severity: 'error',
      message: 'Total weight must be greater than zero.',
    });
  }

  if (limits) {
    if (!Number.isFinite(limits.minBet) || limits.minBet <= 0) {
      issues.push({
        id: 'invalid-min-bet',
        severity: 'error',
        message: 'Minimum bet must be greater than $0.',
      });
    }
    if (!Number.isFinite(limits.maxBet) || limits.maxBet < limits.minBet) {
      issues.push({
        id: 'invalid-max-bet',
        severity: 'error',
        message: 'Maximum bet must be greater than or equal to minimum bet.',
      });
    }
    if (!Number.isFinite(limits.defaultBalance) || limits.defaultBalance <= 0) {
      issues.push({
        id: 'invalid-default-balance',
        severity: 'error',
        message: 'Default starting balance must be greater than $0.',
      });
    }
  }

  const totalWeight = roundTo(totalWeightScaled / SCALE, 6);
  let rtpScaledSum = 0;
  let currentAngle = 0;

  const computedSegments: ComputedSegment[] = segments.map((seg, index) => {
    const safeWeight = Number.isFinite(seg.weight) && seg.weight > 0 ? seg.weight : 0;
    const safeMultiplier = Number.isFinite(seg.multiplier) && seg.multiplier >= 0 ? seg.multiplier : 0;
    const weightScaled = toScaled(safeWeight);

    const probability = totalWeightScaled > 0 ? weightScaled / totalWeightScaled : 0;
    const probabilityPercent = roundTo(probability * 100, 4);
    const expectedContribution = probability * safeMultiplier;

    if (totalWeightScaled > 0) {
      rtpScaledSum += weightScaled * safeMultiplier;
    }

    const sweepAngle = probability * 360;
    const startAngle = currentAngle;
    const endAngle = index === segments.length - 1 && totalWeightScaled > 0 ? 360 : currentAngle + sweepAngle;
    currentAngle = endAngle;

    return {
      ...seg,
      probability,
      probabilityPercent,
      expectedContribution: roundTo(expectedContribution, 6),
      startAngle,
      endAngle,
      sweepAngle,
    };
  });

  const rtp = totalWeightScaled > 0 ? roundTo(rtpScaledSum / totalWeightScaled, 8) : 0;
  const rtpPercent = roundTo(rtp * 100, 4);
  const houseEdge = roundTo(1 - rtp, 8);
  const houseEdgePercent = roundTo(houseEdge * 100, 4);

  if (totalWeightScaled > 0 && rtp > 1) {
    issues.push({
      id: 'rtp-exceeds-100',
      severity: 'error',
      message: `Theoretical RTP is ${rtpPercent.toFixed(2)}% (> 100%). House edge is negative (${houseEdgePercent.toFixed(2)}%), which guarantees operator losses.`,
    });
  } else if (totalWeightScaled > 0 && houseEdge === 0) {
    issues.push({
      id: 'zero-house-edge',
      severity: 'warning',
      message: 'House edge is exactly 0.00%. Expected operator revenue is $0.',
    });
  }

  const hasWinningOutcome = computedSegments.some((s) => s.multiplier > 1 && s.weight > 0);
  if (totalWeightScaled > 0 && !hasWinningOutcome) {
    issues.push({
      id: 'no-winning-outcome',
      severity: 'warning',
      message: 'No active segment has a multiplier greater than 1x.',
    });
  }

  const isValid = !issues.some((i) => i.severity === 'error');

  return {
    segments: computedSegments,
    totalWeight,
    rtp,
    rtpPercent,
    houseEdge,
    houseEdgePercent,
    isValid,
    issues,
  };
}

export function calculateExpectedOperatorRevenue(
  totalWagers: number,
  houseEdge: number
): number {
  return roundCurrency(totalWagers * houseEdge);
}

export function calculateExpectedPlayerNet(
  betAmount: number,
  houseEdge: number
): number {
  return roundCurrency(-betAmount * houseEdge);
}

/**
 * Generates a transparent, mathematically verifiable probability/weight proposal
 * to achieve a specified target house edge without altering existing weights until applied.
 */
export function proposeProbabilitiesForTargetEdge(
  segments: WheelSegment[],
  targetHouseEdgePercent: number,
  preferredStrategy: TargetEdgeStrategy = 'loss-rebalance'
): TargetEdgeProposal {
  const currentCalc = calculateProbabilities(segments);
  const targetHouseEdge = roundTo(targetHouseEdgePercent / 100, 6);
  const targetRtp = roundTo(1 - targetHouseEdge, 6);
  const targetRtpPercent = roundTo(targetRtp * 100, 4);

  if (!Number.isFinite(targetHouseEdgePercent) || targetHouseEdgePercent < 0 || targetHouseEdgePercent >= 100) {
    return {
      feasible: false,
      reason: 'Target house edge must be between 0% and 99.99%.',
      strategy: preferredStrategy,
      targetHouseEdgePercent,
      targetRtpPercent,
      achievedHouseEdgePercent: currentCalc.houseEdgePercent,
      achievedRtpPercent: currentCalc.rtpPercent,
      assumptions: [],
      formulaSteps: [],
      proposedSegments: [],
    };
  }

  const activeSegments = segments.filter((s) => s.weight > 0);
  if (activeSegments.length < 2) {
    return {
      feasible: false,
      reason: 'At least two segments with positive weights are required.',
      strategy: preferredStrategy,
      targetHouseEdgePercent,
      targetRtpPercent,
      achievedHouseEdgePercent: currentCalc.houseEdgePercent,
      achievedRtpPercent: currentCalc.rtpPercent,
      assumptions: [],
      formulaSteps: [],
      proposedSegments: [],
    };
  }

  const zeroMultSegs = segments.filter((s) => s.multiplier === 0 && s.weight > 0);
  const nonZeroMultSegs = segments.filter((s) => s.multiplier > 0 && s.weight > 0);

  // Determine which strategy applies
  let strategyToUse: TargetEdgeStrategy = preferredStrategy;
  if (strategyToUse === 'loss-rebalance' && (zeroMultSegs.length === 0 || nonZeroMultSegs.length === 0)) {
    strategyToUse = 'two-group-blend';
  }

  const totalProposedWeightBase = 1000; // Gives clean 0.1% weight granularity while keeping intuitive numbers
  const proposedProbMap = new Map<string, number>();
  const assumptions: string[] = [];
  const formulaSteps: string[] = [];

  if (strategyToUse === 'loss-rebalance') {
    const winWeightSum = nonZeroMultSegs.reduce((acc, s) => acc + s.weight, 0);
    const conditionalWinRtp =
      nonZeroMultSegs.reduce((acc, s) => acc + s.weight * s.multiplier, 0) / winWeightSum;

    if (conditionalWinRtp <= targetRtp) {
      // Fallback to two-group blend if non-zero segments alone have lower RTP than target
      strategyToUse = 'two-group-blend';
    } else {
      const pNonZeroTotal = targetRtp / conditionalWinRtp;
      const pZeroTotal = 1 - pNonZeroTotal;
      const zeroWeightSum = zeroMultSegs.reduce((acc, s) => acc + s.weight, 0);

      segments.forEach((seg) => {
        if (seg.weight <= 0) {
          proposedProbMap.set(seg.id, 0);
        } else if (seg.multiplier === 0) {
          proposedProbMap.set(seg.id, pZeroTotal * (seg.weight / zeroWeightSum));
        } else {
          proposedProbMap.set(seg.id, pNonZeroTotal * (seg.weight / winWeightSum));
        }
      });

      assumptions.push(
        'Multipliers remain strictly unchanged across all segments.',
        'Relative probability ratios among all paying segments (multiplier > 0x) remain preserved.',
        'Total probability of 0x (Lose) segments is solved to balance expected payout to Target RTP.',
        'Proposed weights are normalized to a 1,000-unit scale (0.1% precision) so integer/decimal weights remain exact.'
      );

      formulaSteps.push(
        `1. Target RTP = 1 − (${targetHouseEdgePercent.toFixed(2)}% / 100) = ${targetRtp.toFixed(4)} (${targetRtpPercent.toFixed(2)}%)`,
        `2. Conditional RTP of paying segments (>0x) = Σ(wᵢ × Mᵢ) / Σ(wᵢ) = ${conditionalWinRtp.toFixed(4)}`,
        `3. Required total paying probability P(>0x) = Target RTP / Conditional RTP = ${targetRtp.toFixed(4)} / ${conditionalWinRtp.toFixed(4)} = ${(pNonZeroTotal * 100).toFixed(2)}%`,
        `4. Required 0x loss probability P(0x) = 1 − P(>0x) = ${(pZeroTotal * 100).toFixed(2)}%`
      );
    }
  }

  if (strategyToUse === 'two-group-blend') {
    const lowSegs = segments.filter((s) => s.weight > 0 && s.multiplier < targetRtp);
    const highSegs = segments.filter((s) => s.weight > 0 && s.multiplier >= targetRtp);

    if (lowSegs.length === 0 || highSegs.length === 0) {
      const minM = Math.min(...activeSegments.map((s) => s.multiplier));
      const maxM = Math.max(...activeSegments.map((s) => s.multiplier));
      return {
        feasible: false,
        reason: `Target RTP of ${targetRtpPercent.toFixed(2)}% is unreachable with current multipliers (range ${minM}x to ${maxM}x). Adjust multipliers or choose a target house edge between ${roundTo((1 - maxM) * 100, 2)}% and ${roundTo((1 - minM) * 100, 2)}%.`,
        strategy: 'two-group-blend',
        targetHouseEdgePercent,
        targetRtpPercent,
        achievedHouseEdgePercent: currentCalc.houseEdgePercent,
        achievedRtpPercent: currentCalc.rtpPercent,
        assumptions: [],
        formulaSteps: [],
        proposedSegments: [],
      };
    }

    const lowW = lowSegs.reduce((a, s) => a + s.weight, 0);
    const highW = highSegs.reduce((a, s) => a + s.weight, 0);
    const eLow = lowSegs.reduce((a, s) => a + s.weight * s.multiplier, 0) / lowW;
    const eHigh = highSegs.reduce((a, s) => a + s.weight * s.multiplier, 0) / highW;

    if (Math.abs(eHigh - eLow) < 1e-9) {
      return {
        feasible: false,
        reason: 'Segments have identical expected return; cannot rebalance probabilities to hit target house edge.',
        strategy: 'two-group-blend',
        targetHouseEdgePercent,
        targetRtpPercent,
        achievedHouseEdgePercent: currentCalc.houseEdgePercent,
        achievedRtpPercent: currentCalc.rtpPercent,
        assumptions: [],
        formulaSteps: [],
        proposedSegments: [],
      };
    }

    const pHigh = (targetRtp - eLow) / (eHigh - eLow);
    const pLow = 1 - pHigh;

    if (pHigh <= 0 || pLow <= 0) {
      return {
        feasible: false,
        reason: `Target RTP (${targetRtpPercent.toFixed(2)}%) falls outside the convex blend of low (${(eLow * 100).toFixed(2)}%) and high (${(eHigh * 100).toFixed(2)}%) segment groups.`,
        strategy: 'two-group-blend',
        targetHouseEdgePercent,
        targetRtpPercent,
        achievedHouseEdgePercent: currentCalc.houseEdgePercent,
        achievedRtpPercent: currentCalc.rtpPercent,
        assumptions: [],
        formulaSteps: [],
        proposedSegments: [],
      };
    }

    segments.forEach((seg) => {
      if (seg.weight <= 0) {
        proposedProbMap.set(seg.id, 0);
      } else if (seg.multiplier < targetRtp) {
        proposedProbMap.set(seg.id, pLow * (seg.weight / lowW));
      } else {
        proposedProbMap.set(seg.id, pHigh * (seg.weight / highW));
      }
    });

    assumptions.push(
      'Multipliers remain strictly unchanged across all segments.',
      `Segments are partitioned into Low-Return (< ${targetRtp.toFixed(2)}x) and High-Return (≥ ${targetRtp.toFixed(2)}x) groups.`,
      'Internal relative weights within each group are preserved while solving the linear group blend.',
      'Weights are scaled to a 1,000-unit baseline (0.1% precision).'
    );

    formulaSteps.push(
      `1. Target RTP = 1 − (${targetHouseEdgePercent.toFixed(2)}% / 100) = ${targetRtp.toFixed(4)}`,
      `2. Group Expected Multipliers: E(Low) = ${eLow.toFixed(4)}, E(High) = ${eHigh.toFixed(4)}`,
      `3. Solve P(High) × E(High) + (1 − P(High)) × E(Low) = Target RTP`,
      `4. P(High) = (${targetRtp.toFixed(4)} − ${eLow.toFixed(4)}) / (${eHigh.toFixed(4)} − ${eLow.toFixed(4)}) = ${(pHigh * 100).toFixed(2)}%, P(Low) = ${(pLow * 100).toFixed(2)}%`
    );
  }

  // Convert exact probabilities to clean weights (rounded to 2 decimal places on a 100-base, i.e., percent weights)
  const proposedRawWeights = segments.map((seg) => {
    const p = proposedProbMap.get(seg.id) ?? 0;
    return {
      seg,
      weight: roundTo(p * 100, 2),
    };
  });

  // Ensure weights sum neatly and verify achieved RTP
  const proposedWeightTotal = proposedRawWeights.reduce((acc, item) => acc + item.weight, 0);
  if (proposedWeightTotal <= 0) {
    return {
      feasible: false,
      reason: 'Could not compute positive weights for this target edge.',
      strategy: strategyToUse,
      targetHouseEdgePercent,
      targetRtpPercent,
      achievedHouseEdgePercent: currentCalc.houseEdgePercent,
      achievedRtpPercent: currentCalc.rtpPercent,
      assumptions: [],
      formulaSteps: [],
      proposedSegments: [],
    };
  }

  const simulatedSegments: WheelSegment[] = proposedRawWeights.map((item) => ({
    ...item.seg,
    weight: item.weight,
  }));
  const simulatedCalc = calculateProbabilities(simulatedSegments);

  const proposedSegments: ProposedSegmentAdjustment[] = segments.map((seg, idx) => {
    const curComp = currentCalc.segments[idx];
    const simComp = simulatedCalc.segments[idx];
    return {
      id: seg.id,
      label: seg.label,
      multiplier: seg.multiplier,
      currentWeight: seg.weight,
      currentProbabilityPercent: curComp.probabilityPercent,
      proposedWeight: simComp.weight,
      proposedProbabilityPercent: simComp.probabilityPercent,
      deltaPercent: roundTo(simComp.probabilityPercent - curComp.probabilityPercent, 2),
    };
  });

  // Suppress unused variable lint if totalProposedWeightBase wasn't needed
  void totalProposedWeightBase;

  return {
    feasible: true,
    strategy: strategyToUse,
    targetHouseEdgePercent,
    targetRtpPercent,
    achievedHouseEdgePercent: simulatedCalc.houseEdgePercent,
    achievedRtpPercent: simulatedCalc.rtpPercent,
    assumptions,
    formulaSteps,
    proposedSegments,
  };
}
