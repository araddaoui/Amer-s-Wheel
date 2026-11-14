export interface WheelSegment {
  id: string;
  label: string;
  weight: number;
  multiplier: number;
  color: string;
  textColor?: string;
}

export interface ComputedSegment extends WheelSegment {
  probability: number; // 0..1
  probabilityPercent: number; // 0..100
  expectedContribution: number; // probability * multiplier
  startAngle: number; // 0..360
  endAngle: number; // 0..360
  sweepAngle: number; // 0..360
}

export interface BetLimits {
  minBet: number;
  maxBet: number;
  defaultBalance: number;
}

export interface ValidationIssue {
  id: string;
  severity: 'error' | 'warning';
  field?: string;
  message: string;
}

export interface ProbabilityCalculation {
  segments: ComputedSegment[];
  totalWeight: number;
  rtp: number; // e.g., 0.95
  rtpPercent: number; // e.g., 95
  houseEdge: number; // e.g., 0.05
  houseEdgePercent: number; // e.g., 5
  isValid: boolean;
  issues: ValidationIssue[];
}

export type TargetEdgeStrategy = 'loss-rebalance' | 'two-group-blend';

export interface ProposedSegmentAdjustment {
  id: string;
  label: string;
  multiplier: number;
  currentWeight: number;
  currentProbabilityPercent: number;
  proposedWeight: number;
  proposedProbabilityPercent: number;
  deltaPercent: number;
}

export interface TargetEdgeProposal {
  feasible: boolean;
  reason?: string;
  strategy: TargetEdgeStrategy;
  targetHouseEdgePercent: number;
  targetRtpPercent: number;
  achievedHouseEdgePercent: number;
  achievedRtpPercent: number;
  assumptions: string[];
  formulaSteps: string[];
  proposedSegments: ProposedSegmentAdjustment[];
}

export interface FairnessProof {
  serverSeed: string;
  serverSeedHash: string;
  clientSeed: string;
  nonce: number;
  rollScaled: number; // integer in [0, totalWeightScaled)
  totalWeightScaled: number;
  normalizedRoll: number; // [0, 1)
  timestamp: number;
}

export interface SpinRecord {
  id: string;
  timestamp: number;
  betAmount: number;
  segmentId: string;
  segmentLabel: string;
  segmentColor: string;
  multiplier: number;
  probabilityPercent: number;
  payout: number;
  netResult: number;
  balanceBefore: number;
  balanceAfter: number;
  theoreticalRtpPercent: number;
  theoreticalHouseEdgePercent: number;
  fairness: FairnessProof;
}

export interface PlayerStats {
  totalSpins: number;
  totalWagered: number;
  totalPayout: number;
  netProfit: number;
  winsCount: number;
  breakEvenCount: number;
  lossesCount: number;
  biggestWin: number;
  biggestMultiplier: number;
  currentStreak: number; // positive for winning streak, negative for losing streak
}

export interface PlayerState {
  balance: number;
  clientSeed: string;
  nonce: number;
  stats: PlayerStats;
  history: SpinRecord[];
}

export interface CelebrationOutcome {
  multiplier: number;
  payout: number;
  netResult: number;
  label?: string;
}

export interface AuditLogEntry {
  id: string;
  timestamp: number;
  type:
    | 'SPIN'
    | 'HORSE_RACE'
    | 'BASKETBALL_BET'
    | 'DEPOSIT'
    | 'BALANCE_RESET'
    | 'CONFIG_CHANGE'
    | 'LIMITS_CHANGE'
    | 'OPERATOR_AUTH';
  actor: 'PLAYER' | 'OPERATOR';
  summary: string;
  amountDelta?: number;
  balanceAfter?: number;
  details?: Record<string, string | number | boolean>;
}

export interface ConfigHistoryEntry {
  id: string;
  timestamp: number;
  summary: string;
  previousRtpPercent: number;
  newRtpPercent: number;
  previousHouseEdgePercent: number;
  newHouseEdgePercent: number;
  previousSegmentsCount: number;
  newSegmentsCount: number;
  segmentsSnapshot: WheelSegment[];
  limitsSnapshot: BetLimits;
}

export interface GameConfig {
  segments: WheelSegment[];
  limits: BetLimits;
  operatorPin: string;
  updatedAt: number;
}

export interface SimulationSegmentStat {
  id: string;
  label: string;
  color: string;
  multiplier: number;
  theoreticalProbPercent: number;
  expectedHits: number;
  actualHits: number;
  actualProbPercent: number;
  variancePercent: number;
  totalPayout: number;
}

export interface SimulationPoint {
  spin: number;
  bankroll: number;
  empiricalRtpPercent: number;
  theoreticalRtpPercent: number;
  cumulativeHouseProfit: number;
}

export interface SimulationResult {
  numSpins: number;
  betPerSpin: number;
  totalWagered: number;
  totalPayout: number;
  operatorNetRevenue: number;
  playerNetResult: number;
  theoreticalRtpPercent: number;
  empiricalRtpPercent: number;
  theoreticalHouseEdgePercent: number;
  empiricalHouseEdgePercent: number;
  expectedOperatorRevenue: number;
  rtpDeviationPercent: number;
  winRatePercent: number;
  peakBankroll: number;
  maxDrawdown: number;
  durationMs: number;
  segmentStats: SimulationSegmentStat[];
  series: SimulationPoint[];
}
