class SoundService {
  private ctx: AudioContext | null = null;
  private muted = false;

  private ensureContext(): AudioContext | null {
    if (this.muted || typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return null;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public setMuted(muted: boolean) {
    this.muted = muted;
  }

  public isMuted(): boolean {
    return this.muted;
  }

  /**
   * Energetic strident launch sweep when the wheel starts spinning.
   */
  public playSpinLaunch() {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(190, now);
    osc.frequency.exponentialRampToValueAtTime(840, now + 0.28);

    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1200, now);
    filter.Q.setValueAtTime(2.5, now);

    gain.gain.setValueAtTime(0.01, now);
    gain.gain.linearRampToValueAtTime(0.14, now + 0.06);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.34);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.35);
  }

  /**
   * Strident, punchy mechanical peg clack with rising suspense pitch in final stretch.
   */
  public playPegTick(velocityRatio = 1, progressRatio = 0) {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const inSuspense = progressRatio > 0.72;

    // Sharp strident sawtooth transient
    const osc = ctx.createOscillator();
    const harmonic = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();

    const clampedVel = Math.min(1, Math.max(0.12, velocityRatio));
    const baseFreq = inSuspense
      ? 960 + (progressRatio - 0.72) * 1400
      : 720 + clampedVel * 540;

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(baseFreq, now);
    osc.frequency.exponentialRampToValueAtTime(220, now + 0.032);

    harmonic.type = 'square';
    harmonic.frequency.setValueAtTime(baseFreq * 1.5, now);
    harmonic.frequency.exponentialRampToValueAtTime(340, now + 0.025);

    filter.type = 'highpass';
    filter.frequency.setValueAtTime(420, now);

    const peakGain = inSuspense ? 0.14 : 0.08 + clampedVel * 0.05;
    gain.gain.setValueAtTime(peakGain, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.038);

    osc.connect(filter);
    harmonic.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    harmonic.start(now);
    osc.stop(now + 0.042);
    harmonic.stop(now + 0.042);
  }

  /**
   * Subtle dramatic shimmer during final suspense seconds.
   */
  public playSuspenseRiser() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(310, now);
    osc.frequency.exponentialRampToValueAtTime(620, now + 1.4);

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(900, now);
    filter.frequency.linearRampToValueAtTime(2600, now + 1.4);

    gain.gain.setValueAtTime(0.002, now);
    gain.gain.linearRampToValueAtTime(0.05, now + 0.9);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 1.45);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 1.5);
  }

  /**
   * Metallic starting-gate bell for horse racing.
   */
  public playRaceBell() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    [880, 1318.5, 1760].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + i * 0.015);
      gain.gain.setValueAtTime(0.11, now + i * 0.015);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + i * 0.015);
      osc.stop(now + 0.48);
    });
  }

  /**
   * Soft turf hoofbeat thump during horse race.
   */
  public playHoofbeat() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(140, now);
    osc.frequency.exponentialRampToValueAtTime(55, now + 0.055);
    gain.gain.setValueAtTime(0.055, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.065);
  }

  /**
   * Referee whistle for basketball tip-off.
   */
  public playBasketballWhistle() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(2650, now);

    lfo.type = 'sine';
    lfo.frequency.setValueAtTime(38, now);
    lfoGain.gain.setValueAtTime(120, now);

    lfo.connect(lfoGain);
    lfoGain.connect(osc.frequency);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.11, now + 0.03);
    gain.gain.setValueAtTime(0.1, now + 0.24);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.34);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    lfo.start(now);
    osc.stop(now + 0.35);
    lfo.stop(now + 0.35);
  }

  /**
   * Crisp net swish / rim tick for basketball scoring plays.
   */
  public playBasketSwish(isThree = false) {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(isThree ? 740 : 540, now);
    osc.frequency.exponentialRampToValueAtTime(isThree ? 1120 : 780, now + 0.09);
    gain.gain.setValueAtTime(0.07, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.13);
  }

  /**
   * Cash register "Cha-Ching!" + cascading coin chimes for wins;
   * strident game-show buzzer + descending slide for losses;
   * crisp neutral vault tone for break-even.
   */
  public playOutcome(multiplier: number) {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    // 1. LOSS (< 1x): Strident dissonant buzzer + descending slide
    if (multiplier < 1) {
      // Initial harsh buzzer hit
      const buzz1 = ctx.createOscillator();
      const buzz2 = ctx.createOscillator();
      const filter = ctx.createBiquadFilter();
      const gain = ctx.createGain();

      buzz1.type = 'sawtooth';
      buzz2.type = 'square';

      // Descending "wah-wah-waaah" pitch drop
      buzz1.frequency.setValueAtTime(196, now);
      buzz1.frequency.setValueAtTime(174.6, now + 0.18);
      buzz1.frequency.exponentialRampToValueAtTime(92.5, now + 0.65);

      buzz2.frequency.setValueAtTime(185, now); // Dissonant minor-second buzz
      buzz2.frequency.setValueAtTime(164.8, now + 0.18);
      buzz2.frequency.exponentialRampToValueAtTime(87.3, now + 0.65);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(1600, now);
      filter.frequency.exponentialRampToValueAtTime(340, now + 0.65);

      gain.gain.setValueAtTime(0.16, now);
      gain.gain.setValueAtTime(0.14, now + 0.22);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.72);

      buzz1.connect(filter);
      buzz2.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      buzz1.start(now);
      buzz2.start(now);
      buzz1.stop(now + 0.75);
      buzz2.stop(now + 0.75);
      return;
    }

    // 2. BREAK EVEN (1x): Crisp neutral vault return chime
    if (multiplier === 1) {
      const notes = [392, 587.33];
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const start = now + idx * 0.09;
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, start);
        gain.gain.setValueAtTime(0.1, start);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.24);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(start);
        osc.stop(start + 0.26);
      });
      return;
    }

    // 3. WIN (> 1x): Mechanical cash-register drawer snap + strident Cha-Ching bell + coin cascade!
    // Drawer snap (short noise click)
    const bufferSize = ctx.sampleRate * 0.045;
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.35));
    }
    const whiteNoise = ctx.createBufferSource();
    whiteNoise.buffer = noiseBuffer;
    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = 'bandpass';
    noiseFilter.frequency.setValueAtTime(2400, now);
    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.22, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.045);
    whiteNoise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(ctx.destination);
    whiteNoise.start(now);

    // Metallic "Cha-Ching!" bell double-strike (B5 -> E6 + high metallic overtones)
    const bellStrikes = [
      { delay: 0.02, freq: 987.77, dur: 0.25 },
      { delay: 0.11, freq: 1318.51, dur: 0.65 },
      { delay: 0.11, freq: 2637.02, dur: 0.55 }, // Metallic sparkle overtone
    ];
    bellStrikes.forEach(({ delay, freq, dur }) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const start = now + delay;
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, start);
      gain.gain.setValueAtTime(0.16, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + dur);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + dur + 0.02);
    });

    // Cascading coins/cash arpeggio
    const coinNotes =
      multiplier >= 10
        ? [1046.5, 1318.51, 1567.98, 2093.0, 1567.98, 2093.0, 2637.02, 3135.96]
        : [1046.5, 1318.51, 1567.98, 2093.0];

    coinNotes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const start = now + 0.24 + idx * 0.065;
      osc.type = multiplier >= 10 ? 'sawtooth' : 'sine';

      const filter = ctx.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.setValueAtTime(800, start);

      osc.frequency.setValueAtTime(freq, start);
      gain.gain.setValueAtTime(multiplier >= 10 ? 0.11 : 0.12, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.35);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.37);
    });

    // Extra triumphant brass chord for Jackpot (>= 10x)
    if (multiplier >= 10) {
      [523.25, 659.25, 783.99, 1046.5].forEach((freq) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const filter = ctx.createBiquadFilter();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(freq, now + 0.15);
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(2200, now + 0.15);
        gain.gain.setValueAtTime(0.06, now + 0.15);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 1.15);
        osc.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + 0.15);
        osc.stop(now + 1.2);
      });
    }
  }
}

export const soundService = new SoundService();
