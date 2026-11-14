import {
  SimulationPoint,
  SimulationResult,
  SimulationSegmentStat,
  WheelSegment,
} from '../types/game';
import {
  calculateExpectedOperatorRevenue,
  calculateProbabilities,
  roundCurrency,
  roundTo,
} from './probabilityEngine';
import { fastMonteCarloRoll } from './randomService';

export function runMonteCarloSimulation(
  segments: WheelSegment[],
  numSpins: number,
  betPerSpin: number
): SimulationResult {
  const startTime = performance.now();
  const calc = calculateProbabilities(segments);

  if (!calc.isValid || calc.totalWeight <= 0) {
    throw new Error('Cannot run simulation on an invalid wheel configuration.');
  }

  const activeSegments = calc.segments.filter((s) => s.weight > 0);
  const cumulativeWeights: number[] = [];
  let runningWeight = 0;
  for (const seg of activeSegments) {
    runningWeight += seg.weight;
    cumulativeWeights.push(runningWeight);
  }

  const hitCounts = new Array<number>(activeSegments.length).fill(0);
  const payoutSums = new Array<number>(activeSegments.length).fill(0);

  let totalWagered = 0;
  let totalPayout = 0;
  let playerBankroll = 0; // Relative cumulative player P&L
  let peakBankroll = 0;
  let maxDrawdown = 0;
  let winOrBreakEvenSpins = 0;
  let winningSpins = 0;

  const sampleInterval = Math.max(1, Math.floor(numSpins / 80));
  const series: SimulationPoint[] = [
    {
      spin: 0,
      bankroll: 0,
      empiricalRtpPercent: calc.rtpPercent,
      theoreticalRtpPercent: calc.rtpPercent,
      cumulativeHouseProfit: 0,
    },
  ];

  for (let i = 1; i <= numSpins; i++) {
    const segIdx = fastMonteCarloRoll(cumulativeWeights, runningWeight);
    const seg = activeSegments[segIdx];
    const payout = betPerSpin * seg.multiplier;

    hitCounts[segIdx]++;
    payoutSums[segIdx] += payout;

    totalWagered += betPerSpin;
    totalPayout += payout;
    playerBankroll += payout - betPerSpin;

    if (seg.multiplier > 1) {
      winningSpins++;
      winOrBreakEvenSpins++;
    } else if (seg.multiplier >= 1) {
      winOrBreakEvenSpins++;
    }

    if (playerBankroll > peakBankroll) {
      peakBankroll = playerBankroll;
    }
    const drawdown = peakBankroll - playerBankroll;
    if (drawdown > maxDrawdown) {
      maxDrawdown = drawdown;
    }

    if (i % sampleInterval === 0 || i === numSpins) {
      const empRtpPct = (totalPayout / totalWagered) * 100;
      series.push({
        spin: i,
        bankroll: roundCurrency(playerBankroll),
        empiricalRtpPercent: roundTo(empRtpPct, 3),
        theoreticalRtpPercent: calc.rtpPercent,
        cumulativeHouseProfit: roundCurrency(totalWagered - totalPayout),
      });
    }
  }

  void winOrBreakEvenSpins;

  const roundedTotalWagered = roundCurrency(totalWagered);
  const roundedTotalPayout = roundCurrency(totalPayout);
  const operatorNetRevenue = roundCurrency(roundedTotalWagered - roundedTotalPayout);
  const playerNetResult = roundCurrency(roundedTotalPayout - roundedTotalWagered);

  const empiricalRtpPercent = roundTo((totalPayout / totalWagered) * 100, 4);
  const empiricalHouseEdgePercent = roundTo(100 - empiricalRtpPercent, 4);
  const rtpDeviationPercent = roundTo(empiricalRtpPercent - calc.rtpPercent, 4);
  const expectedOperatorRevenue = calculateExpectedOperatorRevenue(
    roundedTotalWagered,
    calc.houseEdge
  );
  const winRatePercent = roundTo((winningSpins / numSpins) * 100, 2);

  const segmentStats: SimulationSegmentStat[] = calc.segments.map((seg) => {
    const activeIdx = activeSegments.findIndex((a) => a.id === seg.id);
    const hits = activeIdx >= 0 ? hitCounts[activeIdx] : 0;
    const payoutTotal = activeIdx >= 0 ? roundCurrency(payoutSums[activeIdx]) : 0;
    const actualProbPercent = roundTo((hits / numSpins) * 100, 4);
    const expectedHits = roundTo(seg.probability * numSpins, 1);
    const variancePercent = roundTo(actualProbPercent - seg.probabilityPercent, 4);

    return {
      id: seg.id,
      label: seg.label,
      color: seg.color,
      multiplier: seg.multiplier,
      theoreticalProbPercent: seg.probabilityPercent,
      expectedHits,
      actualHits: hits,
      actualProbPercent,
      variancePercent,
      totalPayout: payoutTotal,
    };
  });

  const durationMs = roundTo(performance.now() - startTime, 2);

  return {
    numSpins,
    betPerSpin,
    totalWagered: roundedTotalWagered,
    totalPayout: roundedTotalPayout,
    operatorNetRevenue,
    playerNetResult,
    theoreticalRtpPercent: calc.rtpPercent,
    empiricalRtpPercent,
    theoreticalHouseEdgePercent: calc.houseEdgePercent,
    empiricalHouseEdgePercent,
    expectedOperatorRevenue,
    rtpDeviationPercent,
    winRatePercent,
    peakBankroll: roundCurrency(peakBankroll),
    maxDrawdown: roundCurrency(maxDrawdown),
    durationMs,
    segmentStats,
    series,
  };
}
