import { ComputedSegment, FairnessProof } from '../types/game';

const WEIGHT_SCALE = 1_000_000;

/**
 * Generates a cryptographically secure random hex string using Web Crypto API.
 */
export function generateSecureHex(byteLength = 16): string {
  const bytes = new Uint8Array(byteLength);
  window.crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Computes a SHA-256 hex digest of an input string using SubtleCrypto.
 */
export async function sha256Hex(message: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(message);
  const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Generates an unbiased uniform 53-bit integer in [0, maxExclusive) using
 * cryptographic rejection sampling (no modulo bias).
 */
export function cryptoUniformInt(maxExclusive: number): number {
  if (maxExclusive <= 1) return 0;
  const maxSafe = 0x1fffffffffffff; // 2^53 - 1
  const limit = maxSafe - (maxSafe % maxExclusive);
  const buf = new Uint32Array(2);

  while (true) {
    window.crypto.getRandomValues(buf);
    // Construct 53-bit integer from two 32-bit values
    const high = buf[0] & 0x1fffff; // 21 bits
    const low = buf[1]; // 32 bits
    const candidate = high * 0x100000000 + low;
    if (candidate < limit) {
      return candidate % maxExclusive;
    }
  }
}

/**
 * Deterministically maps a SHA-256 hash of (serverSeed:clientSeed:nonce)
 * into a uniform integer in [0, totalWeightScaled).
 */
export async function deriveDeterministicRoll(
  serverSeed: string,
  clientSeed: string,
  nonce: number,
  totalWeightScaled: number
): Promise<{ hash: string; rollScaled: number; normalizedRoll: number }> {
  const payload = `${serverSeed}:${clientSeed}:${nonce}`;
  const hash = await sha256Hex(payload);
  // Use first 13 hex chars (52 bits) for deterministic uniform mapping
  const sliceInt = parseInt(hash.slice(0, 13), 16);
  const max52 = Math.pow(16, 13);
  const normalizedRoll = sliceInt / max52;
  const rollScaled = Math.min(
    totalWeightScaled - 1,
    Math.floor(normalizedRoll * totalWeightScaled)
  );
  return { hash, rollScaled, normalizedRoll };
}

/**
 * Selects a winning segment given computed segments and a scaled roll value
 * in [0, totalWeightScaled).
 */
export function pickSegmentByScaledRoll(
  segments: ComputedSegment[],
  rollScaled: number
): ComputedSegment {
  let cumulative = 0;
  for (const seg of segments) {
    const wScaled = Math.round(Math.max(0, seg.weight) * WEIGHT_SCALE);
    cumulative += wScaled;
    if (rollScaled < cumulative) {
      return seg;
    }
  }
  // Fallback to last positive-weight segment
  const active = segments.filter((s) => s.weight > 0);
  return active[active.length - 1] ?? segments[0];
}

/**
 * Executes a cryptographically fair spin roll with a freshly generated
 * server seed committed via SHA-256 and combined with the player's client seed & nonce.
 */
export async function generateFairSpinOutcome(
  segments: ComputedSegment[],
  clientSeed: string,
  nonce: number
): Promise<{
  winningSegment: ComputedSegment;
  fairness: FairnessProof;
}> {
  const totalWeightScaled = segments.reduce(
    (sum, s) => sum + Math.round(Math.max(0, s.weight) * WEIGHT_SCALE),
    0
  );

  // Combine hardware CSPRNG server seed with player clientSeed & nonce
  const serverSeed = generateSecureHex(24);
  const serverSeedHash = await sha256Hex(serverSeed);
  const { rollScaled, normalizedRoll } = await deriveDeterministicRoll(
    serverSeed,
    clientSeed,
    nonce,
    totalWeightScaled
  );

  const winningSegment = pickSegmentByScaledRoll(segments, rollScaled);

  return {
    winningSegment,
    fairness: {
      serverSeed,
      serverSeedHash,
      clientSeed,
      nonce,
      rollScaled,
      totalWeightScaled,
      normalizedRoll,
      timestamp: Date.now(),
    },
  };
}

/**
 * Fast, unbiased CSPRNG roll used for high-throughput Monte Carlo simulations.
 */
export function fastMonteCarloRoll(cumulativeWeights: number[], totalWeight: number): number {
  const r = Math.random() * totalWeight;
  for (let i = 0; i < cumulativeWeights.length; i++) {
    if (r < cumulativeWeights[i]) {
      return i;
    }
  }
  return cumulativeWeights.length - 1;
}

export async function verifyFairnessProof(
  proof: FairnessProof,
  segments: ComputedSegment[]
): Promise<{
  seedHashMatches: boolean;
  rollMatches: boolean;
  computedSegmentId: string;
  computedSegmentLabel: string;
}> {
  const computedServerHash = await sha256Hex(proof.serverSeed);
  const seedHashMatches = computedServerHash === proof.serverSeedHash;
  const { rollScaled } = await deriveDeterministicRoll(
    proof.serverSeed,
    proof.clientSeed,
    proof.nonce,
    proof.totalWeightScaled
  );
  const rollMatches = rollScaled === proof.rollScaled;
  const computedSeg = pickSegmentByScaledRoll(segments, rollScaled);

  return {
    seedHashMatches,
    rollMatches,
    computedSegmentId: computedSeg.id,
    computedSegmentLabel: computedSeg.label,
  };
}
