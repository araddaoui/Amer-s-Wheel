import React, { useEffect, useRef, useState } from 'react';
import { ComputedSegment } from '../types/game';
import { soundService } from '../services/soundService';

interface WheelProps {
  segments: ComputedSegment[];
  rotation: number;
  isSpinning: boolean;
  winningSegmentId: string | null;
  mysteryMode?: boolean;
  outcomeTriggerKey?: number;
  lastOutcomeMultiplier?: number | null;
  onSpinComplete: () => void;
  onQuickSpin?: () => void;
  canQuickSpin?: boolean;
}

function polarToCartesian(radius: number, angleDegFromTop: number) {
  const rad = ((angleDegFromTop - 90) * Math.PI) / 180;
  return {
    x: radius * Math.cos(rad),
    y: radius * Math.sin(rad),
  };
}

function buildSectorPath(
  innerR: number,
  outerR: number,
  startDeg: number,
  endDeg: number
): string {
  const sweep = endDeg - startDeg;
  if (sweep >= 359.999) {
    return [
      `M 0 ${-outerR}`,
      `A ${outerR} ${outerR} 0 1 1 0 ${outerR}`,
      `A ${outerR} ${outerR} 0 1 1 0 ${-outerR}`,
      `M 0 ${-innerR}`,
      `A ${innerR} ${innerR} 0 1 0 0 ${innerR}`,
      `A ${innerR} ${innerR} 0 1 0 0 ${-innerR}`,
      'Z',
    ].join(' ');
  }

  const p1 = polarToCartesian(outerR, startDeg);
  const p2 = polarToCartesian(outerR, endDeg);
  const p3 = polarToCartesian(innerR, endDeg);
  const p4 = polarToCartesian(innerR, startDeg);
  const largeArc = sweep > 180 ? 1 : 0;

  return [
    `M ${p1.x.toFixed(3)} ${p1.y.toFixed(3)}`,
    `A ${outerR} ${outerR} 0 ${largeArc} 1 ${p2.x.toFixed(3)} ${p2.y.toFixed(3)}`,
    `L ${p3.x.toFixed(3)} ${p3.y.toFixed(3)}`,
    `A ${innerR} ${innerR} 0 ${largeArc} 0 ${p4.x.toFixed(3)} ${p4.y.toFixed(3)}`,
    'Z',
  ].join(' ');
}

function getContrastTextColor(hexColor: string): string {
  const clean = hexColor.replace('#', '');
  if (clean.length !== 6) return '#F8FAFC';
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.62 ? '#0F172A' : '#F8FAFC';
}

export const Wheel: React.FC<WheelProps> = ({
  segments,
  rotation,
  isSpinning,
  winningSegmentId,
  mysteryMode = false,
  outcomeTriggerKey = 0,
  lastOutcomeMultiplier = null,
  onSpinComplete,
  onQuickSpin,
  canQuickSpin = false,
}) => {
  const [displayRotation, setDisplayRotation] = useState<number>(rotation);
  const [hoveredSeg, setHoveredSeg] = useState<ComputedSegment | null>(null);
  const [pointerKick, setPointerKick] = useState<number>(0);
  const [isFinalStretch, setIsFinalStretch] = useState<boolean>(false);

  const currentRotRef = useRef<number>(rotation);
  const rafRef = useRef<number | null>(null);
  const onSpinCompleteRef = useRef(onSpinComplete);
  onSpinCompleteRef.current = onSpinComplete;

  useEffect(() => {
    if (!isSpinning) {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      currentRotRef.current = rotation;
      setDisplayRotation(rotation);
      setPointerKick(0);
      setIsFinalStretch(false);
      return;
    }

    const startRot = currentRotRef.current;
    const targetRot = rotation;
    const deltaRot = targetRot - startRot;

    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const duration = prefersReducedMotion ? 350 : 7800;
    const startTime = performance.now();

    if (!prefersReducedMotion) {
      soundService.playSpinLaunch();
    }

    // Peg positions (every 15 degrees) for tactile audio ticks
    const pegInterval = 15;
    let lastPegIndex = Math.floor(startRot / pegInterval);
    let suspenseFired = false;

    const tick = (now: number) => {
      const elapsed = now - startTime;
      const t = Math.min(1, elapsed / duration);
      // Smooth long-tail ease-out deceleration for suspenseful peg-by-peg finish
      const eased = 1 - Math.pow(1 - t, 4.6);
      const nextRot = startRot + deltaRot * eased;

      if (t >= 0.72 && !suspenseFired) {
        suspenseFired = true;
        setIsFinalStretch(true);
        if (!prefersReducedMotion) {
          soundService.playSuspenseRiser();
        }
      }

      const currentPegIndex = Math.floor(nextRot / pegInterval);
      if (currentPegIndex > lastPegIndex && !prefersReducedMotion) {
        lastPegIndex = currentPegIndex;
        const velocityRatio = Math.pow(1 - t, 2);
        soundService.playPegTick(velocityRatio, t);
        setPointerKick(-16 * Math.max(0.28, velocityRatio));
      } else {
        setPointerKick((prev) => prev * 0.72);
      }

      currentRotRef.current = nextRot;
      setDisplayRotation(nextRot);

      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        currentRotRef.current = targetRot;
        setDisplayRotation(targetRot);
        setPointerKick(0);
        setIsFinalStretch(false);
        rafRef.current = null;
        onSpinCompleteRef.current();
      }
    };

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [isSpinning, rotation]);

  const activeSegments = segments.filter((s) => s.weight > 0);
  const rimPegAngles = Array.from({ length: 24 }, (_, idx) => idx * 15);
  const outerR = 205;
  const innerR = 46;

  // Determine which segment is currently under the top 12-o'clock pointer
  const normalizedPointerLocal = ((360 - (displayRotation % 360)) + 360) % 360;
  const currentUnderPointer =
    activeSegments.find(
      (s) => normalizedPointerLocal >= s.startAngle && normalizedPointerLocal < s.endAngle
    ) ?? activeSegments[0];

  const highlightedSeg = hoveredSeg ?? (!isSpinning && winningSegmentId ? activeSegments.find((s) => s.id === winningSegmentId) ?? null : null);

  // Detect near-miss to high-value segments (>= 5x) when settled
  const nearMissHighSeg =
    !isSpinning &&
    winningSegmentId &&
    currentUnderPointer &&
    currentUnderPointer.multiplier < 5
      ? activeSegments.find((s) => {
          if (s.multiplier < 5 || s.id === currentUnderPointer.id) return false;
          const distStart = Math.min(
            Math.abs(normalizedPointerLocal - s.startAngle),
            360 - Math.abs(normalizedPointerLocal - s.startAngle)
          );
          const distEnd = Math.min(
            Math.abs(normalizedPointerLocal - s.endAngle),
            360 - Math.abs(normalizedPointerLocal - s.endAngle)
          );
          return Math.min(distStart, distEnd) <= 18;
        }) ?? null
      : null;

  const isRecentWin = !isSpinning && outcomeTriggerKey > 0 && lastOutcomeMultiplier !== null && lastOutcomeMultiplier > 1;
  const isRecentLoss = !isSpinning && outcomeTriggerKey > 0 && lastOutcomeMultiplier !== null && lastOutcomeMultiplier < 1;

  return (
    <div className="relative flex flex-col items-center select-none">
      {/* Live Pointer / Hover Inspection / Surprise Readout */}
      <div className="mb-3 flex items-center justify-center gap-3 text-xs text-slate-300 h-6">
        {isSpinning && mysteryMode ? (
          <div className="flex items-center gap-2 font-mono text-amber-300 font-semibold">
            <span>{isFinalStretch ? 'Final Stretch — Mystery Outcome Locking...' : 'Mystery Spin Active — Segments Masked'}</span>
          </div>
        ) : highlightedSeg ? (
          <div className="flex items-center gap-2 font-mono tabular-nums">
            <span
              className="inline-block h-2.5 w-2.5 rounded-sm"
              style={{ backgroundColor: highlightedSeg.color }}
            />
            <span className="font-sans font-semibold text-slate-100">{highlightedSeg.label}</span>
            <span className="text-slate-500">·</span>
            <span className="text-amber-400 font-semibold">{highlightedSeg.multiplier}x</span>
            <span className="text-slate-500">·</span>
            <span>{highlightedSeg.probabilityPercent.toFixed(2)}% odds</span>
            {nearMissHighSeg && (
              <>
                <span className="text-slate-500">·</span>
                <span className="text-amber-300 font-sans font-semibold">
                  Razor-close to {nearMissHighSeg.label} ({nearMissHighSeg.multiplier}x)
                </span>
              </>
            )}
          </div>
        ) : currentUnderPointer ? (
          <div className="flex items-center gap-2 font-mono tabular-nums text-slate-400">
            <span
              className="inline-block h-2 w-2 rounded-sm"
              style={{ backgroundColor: currentUnderPointer.color }}
            />
            <span>
              {isFinalStretch ? 'Final Stretch: ' : 'Pointer: '}
              {currentUnderPointer.label}
            </span>
            <span className="text-slate-600">·</span>
            <span className={isFinalStretch ? 'text-amber-300 font-semibold' : ''}>
              {currentUnderPointer.multiplier}x
            </span>
          </div>
        ) : null}
      </div>

      {/* Wheel SVG Container */}
      <div
        key={isRecentLoss ? `loss-${outcomeTriggerKey}` : 'wheel-frame'}
        className={`relative w-full max-w-[490px] aspect-square flex items-center justify-center rounded-full transition-shadow duration-500 ${
          isRecentWin
            ? 'shadow-[0_0_70px_rgba(16,185,129,0.45)]'
            : isFinalStretch
            ? 'shadow-[0_0_55px_rgba(245,158,11,0.38)]'
            : isRecentLoss
            ? 'shadow-[0_0_45px_rgba(225,29,72,0.3)] animate-loss-shake'
            : ''
        }`}
      >
        {/* Top Precision Pointer / Flapper */}
        <div
          className="absolute top-0 left-1/2 -translate-x-1/2 z-20 pointer-events-none"
          style={{
            transform: `rotate(${pointerKick}deg)`,
            transformOrigin: '50% 10px',
          }}
        >
          <svg width="38" height="48" viewBox="0 0 38 48" className="drop-shadow-[0_4px_10px_rgba(0,0,0,0.65)]">
            <path
              d="M19 46 L4 12 C2.5 7 6 2 11 2 L27 2 C32 2 35.5 7 34 12 Z"
              fill={isFinalStretch ? '#FBBF24' : '#F59E0B'}
              stroke="#0B1120"
              strokeWidth="2.5"
            />
            <circle cx="19" cy="11" r="4" fill="#0B1120" />
          </svg>
        </div>

        <svg
          viewBox="-255 -255 510 510"
          className="w-full h-full overflow-visible"
          role="img"
          aria-label="Proportional Amer's Wheel"
        >
          <defs>
            <radialGradient id="wheelBezelGrad" cx="50%" cy="50%" r="50%">
              <stop offset="82%" stopColor="#1E293B" />
              <stop offset="94%" stopColor="#334155" />
              <stop offset="100%" stopColor="#0F172A" />
            </radialGradient>
            <radialGradient id="hubGrad" cx="35%" cy="35%" r="70%">
              <stop offset="0%" stopColor="#334155" />
              <stop offset="55%" stopColor="#1E293B" />
              <stop offset="100%" stopColor="#0B1120" />
            </radialGradient>
          </defs>

          {/* Static Outer Chassis Ring */}
          <circle
            cx="0"
            cy="0"
            r="228"
            fill="url(#wheelBezelGrad)"
            stroke={isFinalStretch ? '#F59E0B' : isRecentWin ? '#10B981' : isRecentLoss ? '#E11D48' : '#334155'}
            strokeWidth={isFinalStretch || isRecentWin || isRecentLoss ? '3.5' : '2'}
          />
          <circle cx="0" cy="0" r="210" fill="#0B1120" />

          {/* Rotating Wheel Group */}
          <g style={{ transform: `rotate(${displayRotation}deg)` }}>
            {activeSegments.map((seg) => {
              const pathData = buildSectorPath(innerR, outerR, seg.startAngle, seg.endAngle);
              const midAngle = (seg.startAngle + seg.endAngle) / 2;
              const textColor = getContrastTextColor(seg.color);
              const isWinner = !isSpinning && winningSegmentId === seg.id;
              const sweep = seg.sweepAngle;

              // Determine label placement mode strictly based on proportional slice sweep angle
              const isWide = sweep >= 36;
              const isMedium = sweep >= 11 && sweep < 36;
              const isNarrow = sweep < 11;

              // Calculate position along radial spoke for medium/wide labels
              const labelRotate = midAngle - 90;
              const flipText = midAngle > 180;
              const radialRot = flipText ? labelRotate + 180 : labelRotate;

              const calloutPos = polarToCartesian(234, midAngle);
              const calloutAnchor =
                midAngle > 15 && midAngle < 165
                  ? 'start'
                  : midAngle > 195 && midAngle < 345
                  ? 'end'
                  : 'middle';

              return (
                <g
                  key={seg.id}
                  onMouseEnter={() => setHoveredSeg(seg)}
                  onMouseLeave={() => setHoveredSeg(null)}
                  className="cursor-pointer"
                >
                  <path
                    d={pathData}
                    fill={isSpinning && mysteryMode ? '#1E293B' : seg.color}
                    stroke="#0B1120"
                    strokeWidth={sweep < 6 ? '1' : '1.75'}
                    opacity={
                      !isSpinning && winningSegmentId && !isWinner ? 0.78 : 1
                    }
                  />

                  {isWinner && (
                    <path
                      d={pathData}
                      fill="none"
                      stroke="#FBBF24"
                      strokeWidth="3"
                    />
                  )}

                  {/* Wide Slice Label (>= 36 deg): Two-line radial or crisp stacked block */}
                  {isWide && (
                    <g
                      transform={`rotate(${radialRot})`}
                      style={{ pointerEvents: 'none' }}
                    >
                      <text
                        x={flipText ? -136 : 136}
                        y="-5"
                        fill={isSpinning && mysteryMode ? '#FBBF24' : textColor}
                        textAnchor="middle"
                        dominantBaseline="central"
                        fontSize="13.5"
                        fontWeight="700"
                        fontFamily="Outfit, sans-serif"
                      >
                        {isSpinning && mysteryMode ? 'MYSTERY' : seg.label}
                      </text>
                      <text
                        x={flipText ? -136 : 136}
                        y="13"
                        fill={isSpinning && mysteryMode ? '#94A3B8' : textColor}
                        fillOpacity="0.88"
                        textAnchor="middle"
                        dominantBaseline="central"
                        fontSize="11.5"
                        fontWeight="600"
                        fontFamily="JetBrains Mono, monospace"
                      >
                        {isSpinning && mysteryMode
                          ? '?'
                          : `${seg.multiplier}x · ${seg.probabilityPercent.toFixed(seg.probabilityPercent % 1 === 0 ? 0 : 1)}%`}
                      </text>
                    </g>
                  )}

                  {/* Medium Slice Label (11 deg .. 35.9 deg): Single radial line */}
                  {isMedium && (
                    <g
                      transform={`rotate(${radialRot})`}
                      style={{ pointerEvents: 'none' }}
                    >
                      <text
                        x={flipText ? -132 : 132}
                        y="0"
                        fill={isSpinning && mysteryMode ? '#FBBF24' : textColor}
                        textAnchor="middle"
                        dominantBaseline="central"
                        fontSize={sweep < 16 ? '10' : '11.5'}
                        fontWeight="700"
                        fontFamily="Outfit, sans-serif"
                      >
                        {isSpinning && mysteryMode
                          ? '? ? ?'
                          : `${seg.label} ${seg.multiplier}x (${seg.probabilityPercent.toFixed(seg.probabilityPercent % 1 === 0 ? 0 : 1)}%)`}
                      </text>
                    </g>
                  )}

                  {/* Narrow Slice (< 11 deg, e.g., 1% Jackpot): Rim marker + clean outer radial callout */}
                  {isNarrow && (
                    <g style={{ pointerEvents: 'none' }}>
                      {/* Highlighted tick line inside narrow slice */}
                      <line
                        x1={polarToCartesian(innerR + 6, midAngle).x}
                        y1={polarToCartesian(innerR + 6, midAngle).y}
                        x2={polarToCartesian(outerR - 4, midAngle).x}
                        y2={polarToCartesian(outerR - 4, midAngle).y}
                        stroke={textColor}
                        strokeOpacity="0.7"
                        strokeWidth="1.2"
                      />
                      {/* Outer rim badge text so 1% Jackpot is always legible without crowding */}
                      <line
                        x1={polarToCartesian(outerR + 2, midAngle).x}
                        y1={polarToCartesian(outerR + 2, midAngle).y}
                        x2={polarToCartesian(226, midAngle).x}
                        y2={polarToCartesian(226, midAngle).y}
                        stroke="#FBBF24"
                        strokeWidth="2"
                      />
                      <text
                        x={calloutPos.x}
                        y={calloutPos.y}
                        fill="#FBBF24"
                        textAnchor={calloutAnchor}
                        dominantBaseline="central"
                        fontSize="10.5"
                        fontWeight="700"
                        fontFamily="JetBrains Mono, monospace"
                      >
                        {isSpinning && mysteryMode
                          ? '? · ?'
                          : `${seg.label} ${seg.multiplier}x · ${seg.probabilityPercent.toFixed(seg.probabilityPercent < 1 ? 2 : 1)}%`}
                      </text>
                    </g>
                  )}
                </g>
              );
            })}

            {/* Rim Mechanical Pegs */}
            {rimPegAngles.map((ang) => {
              const pt = polarToCartesian(214, ang);
              return (
                <circle
                  key={ang}
                  cx={pt.x}
                  cy={pt.y}
                  r="3.2"
                  fill="#E2E8F0"
                  stroke="#0F172A"
                  strokeWidth="1"
                />
              );
            })}

            {/* Inner Ring Trim */}
            <circle
              cx="0"
              cy="0"
              r={innerR}
              fill="url(#hubGrad)"
              stroke="#475569"
              strokeWidth="2.5"
            />
          </g>

          {/* Static Interactive Center Hub */}
          <g
            onClick={() => {
              if (canQuickSpin && !isSpinning && onQuickSpin) {
                onQuickSpin();
              }
            }}
            className={canQuickSpin && !isSpinning ? 'cursor-pointer' : ''}
          >
            <circle
              cx="0"
              cy="0"
              r="37"
              fill="#0F172A"
              stroke={isSpinning ? '#F59E0B' : '#475569'}
              strokeWidth="2"
            />
            <text
              x="0"
              y="-3"
              fill={isSpinning ? '#FBBF24' : '#F8FAFC'}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize="12"
              fontWeight="700"
              fontFamily="Outfit, sans-serif"
              letterSpacing="0.06em"
            >
              {isFinalStretch ? 'HOLD!' : isSpinning ? 'SPINNING' : 'SPIN'}
            </text>
            <text
              x="0"
              y="13"
              fill="#94A3B8"
              textAnchor="middle"
              dominantBaseline="central"
              fontSize="9"
              fontFamily="JetBrains Mono, monospace"
            >
              {activeSegments.length} SEGS
            </text>
          </g>
        </svg>
      </div>
    </div>
  );
};
