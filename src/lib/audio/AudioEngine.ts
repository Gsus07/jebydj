// ─── AudioEngine Singleton ───────────────────────────────────────────────────
'use client';

export class AudioEngine {
  private static _instance: AudioEngine | null = null;

  public ctx!: AudioContext;
  public masterGain!: GainNode;
  public masterCompressor!: DynamicsCompressorNode;
  public masterAnalyser!: AnalyserNode;
  public deckAAnalyser!: AnalyserNode;
  public deckBAnalyser!: AnalyserNode;
  public deckABus!: GainNode;
  public deckBBus!: GainNode;
  public boothGain!: GainNode;

  private constructor() {}

  static getInstance(): AudioEngine {
    if (!AudioEngine._instance) {
      AudioEngine._instance = new AudioEngine();
    }
    return AudioEngine._instance;
  }

  initialize(latencyHint: AudioContextLatencyCategory = 'interactive'): void {
    if (this.ctx) return;

    this.ctx = new AudioContext({ latencyHint });

    // Master bus chain:
    // deckABus / deckBBus → masterGain → masterCompressor → masterAnalyser → destination

    this.deckABus = this.ctx.createGain();
    this.deckABus.gain.value = 1;

    this.deckBBus = this.ctx.createGain();
    this.deckBBus.gain.value = 0;

    this.deckAAnalyser = this.ctx.createAnalyser();
    this.deckAAnalyser.fftSize = 2048;
    this.deckAAnalyser.smoothingTimeConstant = 0.8;

    this.deckBAnalyser = this.ctx.createAnalyser();
    this.deckBAnalyser.fftSize = 2048;
    this.deckBAnalyser.smoothingTimeConstant = 0.8;

    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 1;

    this.masterCompressor = this.ctx.createDynamicsCompressor();
    this.masterCompressor.threshold.value = -3;
    this.masterCompressor.knee.value = 3;
    this.masterCompressor.ratio.value = 10;
    this.masterCompressor.attack.value = 0.001;
    this.masterCompressor.release.value = 0.1;

    this.masterAnalyser = this.ctx.createAnalyser();
    this.masterAnalyser.fftSize = 2048;
    this.masterAnalyser.smoothingTimeConstant = 0.75;

    this.boothGain = this.ctx.createGain();
    this.boothGain.gain.value = 0.8;

    // Connect graph
    this.deckABus.connect(this.deckAAnalyser);
    this.deckABus.connect(this.masterGain);

    this.deckBBus.connect(this.deckBAnalyser);
    this.deckBBus.connect(this.masterGain);

    this.masterGain.connect(this.masterCompressor);
    this.masterCompressor.connect(this.masterAnalyser);
    this.masterAnalyser.connect(this.ctx.destination);
    this.masterAnalyser.connect(this.boothGain);
    // boothGain intentionally not connected to destination
    // (would need a secondary AudioContext or setSinkId for real booth output)

    // Register AudioWorklets
    this.ctx.audioWorklet.addModule('/worklets/karplus-strong.js').catch(console.error);
    this.ctx.audioWorklet.addModule('/worklets/gross-beat.js').catch(console.error);
  }

  resume(): Promise<void> {
    if (this.ctx?.state === 'suspended') {
      return this.ctx.resume();
    }
    return Promise.resolve();
  }

  setMasterGain(value: number): void {
    if (!this.masterGain) return;
    const now = this.ctx.currentTime;
    this.masterGain.gain.cancelScheduledValues(now);
    this.masterGain.gain.linearRampToValueAtTime(value, now + 0.01);
  }

  // Apply crossfader: sets deck bus gains based on position (-1 to +1) and curve
  applyCrossfader(position: number, curve: 'linear' | 'cut' | 'power'): void {
    if (!this.deckABus || !this.deckBBus) return;
    const t = (position + 1) / 2; // normalize to 0-1

    let gainA: number;
    let gainB: number;

    switch (curve) {
      case 'cut':
        gainA = t < 0.5 ? 1 : 1 - (t - 0.5) * 2;
        gainB = t > 0.5 ? 1 : t * 2;
        break;
      case 'power':
        gainA = Math.cos((t * Math.PI) / 2);
        gainB = Math.sin((t * Math.PI) / 2);
        break;
      default: // linear
        gainA = 1 - t;
        gainB = t;
        break;
    }

    const now = this.ctx.currentTime;
    this.deckABus.gain.cancelScheduledValues(now);
    this.deckBBus.gain.cancelScheduledValues(now);
    this.deckABus.gain.linearRampToValueAtTime(Math.max(0, gainA), now + 0.01);
    this.deckBBus.gain.linearRampToValueAtTime(Math.max(0, gainB), now + 0.01);
  }

  getFFTData(): { master: Uint8Array; deckA: Uint8Array; deckB: Uint8Array } {
    const masterData = new Uint8Array(this.masterAnalyser.frequencyBinCount);
    const deckAData = new Uint8Array(this.deckAAnalyser.frequencyBinCount);
    const deckBData = new Uint8Array(this.deckBAnalyser.frequencyBinCount);

    this.masterAnalyser.getByteFrequencyData(masterData);
    this.deckAAnalyser.getByteFrequencyData(deckAData);
    this.deckBAnalyser.getByteFrequencyData(deckBData);

    return { master: masterData, deckA: deckAData, deckB: deckBData };
  }

  getTimeDomainData(): { master: Uint8Array } {
    const masterData = new Uint8Array(this.masterAnalyser.fftSize);
    this.masterAnalyser.getByteTimeDomainData(masterData);
    return { master: masterData };
  }

  isInitialized(): boolean {
    return !!this.ctx;
  }

  decodeAudioData(buffer: ArrayBuffer): Promise<AudioBuffer> {
    return this.ctx.decodeAudioData(buffer);
  }
}

export const audioEngine = AudioEngine.getInstance();
