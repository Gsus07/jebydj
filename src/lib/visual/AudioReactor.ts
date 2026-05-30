'use client';

import { audioEngine } from '../audio/AudioEngine';

// ─── Public Data Shape ────────────────────────────────────────────────────────

export interface AudioReactorData {
  /** Band energies — 0.0–1.0 smoothed */
  bass: number;
  lowMid: number;
  mid: number;
  highMid: number;
  high: number;
  overall: number;

  /** Beat detection */
  isBeat: boolean;
  beatPhase: number;     // 0.0–1.0 position within current beat
  beatIntensity: number; // 0.0–1.0 strength of detected beat
  bpm: number;

  /** Spectrum / waveform — 256 normalised bins */
  spectrum: Float32Array;
  waveform: Float32Array;

  /** Stem energies (populated when stems are active) */
  stems: { vocals: number; drums: number; bass: number; other: number };
}

const SPEC_BINS = 256;
const HISTORY_LEN = 43; // ~1 s at 43 fps
const BEAT_COOLDOWN_MS = 200;
const BEAT_THRESHOLD = 1.5;

// ─── AudioReactor Singleton ───────────────────────────────────────────────────

export class AudioReactor {
  private static _instance: AudioReactor | null = null;

  private _data!: AudioReactorData;
  private _prev = { bass: 0, lowMid: 0, mid: 0, highMid: 0, high: 0, overall: 0 };
  private _energyHistory = new Float32Array(HISTORY_LEN);
  private _historyIdx = 0;
  private _lastBeatMs = 0;
  private _bpm = 120;
  private _freqBuf = new Uint8Array(1024);
  private _timeBuf = new Uint8Array(1024);
  private _rafId = 0;
  private _running = false;
  private _subs = new Set<(d: AudioReactorData) => void>();

  private constructor() {
    this._data = {
      bass: 0, lowMid: 0, mid: 0, highMid: 0, high: 0, overall: 0,
      isBeat: false, beatPhase: 0, beatIntensity: 0, bpm: 0,
      spectrum: new Float32Array(SPEC_BINS),
      waveform: new Float32Array(SPEC_BINS),
      stems: { vocals: 0, drums: 0, bass: 0, other: 0 },
    };
  }

  static getInstance(): AudioReactor {
    if (!AudioReactor._instance) AudioReactor._instance = new AudioReactor();
    return AudioReactor._instance;
  }

  /** Called by the DJ store when the master deck BPM changes. */
  setBpm(bpm: number) { this._bpm = bpm > 0 ? bpm : this._bpm; }

  get data(): AudioReactorData { return this._data; }

  /** Subscribe to per-frame updates. Returns an unsubscribe function. */
  subscribe(cb: (d: AudioReactorData) => void): () => void {
    this._subs.add(cb);
    if (!this._running) this._start();
    return () => {
      this._subs.delete(cb);
      if (this._subs.size === 0) this._stop();
    };
  }

  // ── Private ──────────────────────────────────────────────────────────────

  private _start(): void {
    this._running = true;
    const tick = () => {
      if (!this._running) return;
      this._update();
      this._rafId = requestAnimationFrame(tick);
    };
    this._rafId = requestAnimationFrame(tick);
  }

  private _stop(): void {
    this._running = false;
    cancelAnimationFrame(this._rafId);
  }

  private _update(): void {
    if (!audioEngine.isInitialized()) { this._notify(); return; }

    const analyser = audioEngine.masterAnalyser;
    const bins = analyser.frequencyBinCount;

    // Resize buffers if needed
    if (this._freqBuf.length !== bins) {
      this._freqBuf = new Uint8Array(bins);
      this._timeBuf = new Uint8Array(bins);
    }
    analyser.getByteFrequencyData(this._freqBuf);
    analyser.getByteTimeDomainData(this._timeBuf);

    const nyquist = audioEngine.ctx.sampleRate / 2;
    const binHz = nyquist / bins;

    // ── Band energy accumulation ──
    let bass = 0, bN = 0;
    let lowMid = 0, lmN = 0;
    let mid = 0, mN = 0;
    let highMid = 0, hmN = 0;
    let high = 0, hN = 0;

    for (let i = 0; i < bins; i++) {
      const hz = i * binHz;
      const v = this._freqBuf[i] / 255;
      if      (hz < 250)  { bass   += v; bN++; }
      else if (hz < 500)  { lowMid += v; lmN++; }
      else if (hz < 2000) { mid    += v; mN++; }
      else if (hz < 4000) { highMid+= v; hmN++; }
      else                { high   += v; hN++; }
    }
    bass    = bN    ? bass / bN : 0;
    lowMid  = lmN   ? lowMid / lmN : 0;
    mid     = mN    ? mid / mN : 0;
    highMid = hmN   ? highMid / hmN : 0;
    high    = hN    ? high / hN : 0;

    // ── RMS overall ──
    let sumSq = 0;
    for (let i = 0; i < this._timeBuf.length; i++) {
      const s = (this._timeBuf[i] - 128) / 128;
      sumSq += s * s;
    }
    const overall = Math.sqrt(sumSq / this._timeBuf.length);

    // ── Exponential smoothing (attack 0.15, release 0.05) ──
    const A = 0.85, B = 0.15;
    const p = this._prev;
    const sBass    = p.bass    * A + bass    * B;
    const sLowMid  = p.lowMid  * A + lowMid  * B;
    const sMid     = p.mid     * A + mid     * B;
    const sHighMid = p.highMid * A + highMid * B;
    const sHigh    = p.high    * A + high    * B;
    const sOverall = p.overall * A + overall * B;
    this._prev = { bass: sBass, lowMid: sLowMid, mid: sMid, highMid: sHighMid, high: sHigh, overall: sOverall };

    // ── Onset-based beat detection ──
    const energy = sBass * 2 + sOverall;
    this._energyHistory[this._historyIdx] = energy;
    this._historyIdx = (this._historyIdx + 1) % HISTORY_LEN;
    let avgEnergy = 0;
    for (let i = 0; i < HISTORY_LEN; i++) avgEnergy += this._energyHistory[i];
    avgEnergy /= HISTORY_LEN;

    const nowMs = performance.now();
    let isBeat = false;
    if (energy > avgEnergy * BEAT_THRESHOLD && nowMs - this._lastBeatMs > BEAT_COOLDOWN_MS) {
      isBeat = true;
      this._lastBeatMs = nowMs;
    }
    const beatIntensity = avgEnergy > 0.001 ? Math.min(1, energy / (avgEnergy * BEAT_THRESHOLD)) : 0;

    // ── Beat phase from BPM + ctx clock ──
    const beatPhase = this._bpm > 0
      ? (audioEngine.ctx.currentTime * this._bpm / 60) % 1
      : 0;

    // ── Downsample spectrum → SPEC_BINS ──
    const spectrum = new Float32Array(SPEC_BINS);
    const ratio = bins / SPEC_BINS;
    for (let i = 0; i < SPEC_BINS; i++) {
      spectrum[i] = this._freqBuf[Math.floor(i * ratio)] / 255;
    }

    // ── Downsample waveform → SPEC_BINS ──
    const waveform = new Float32Array(SPEC_BINS);
    const wRatio = this._timeBuf.length / SPEC_BINS;
    for (let i = 0; i < SPEC_BINS; i++) {
      waveform[i] = (this._timeBuf[Math.floor(i * wRatio)] - 128) / 128;
    }

    this._data = {
      bass: sBass, lowMid: sLowMid, mid: sMid, highMid: sHighMid, high: sHigh, overall: sOverall,
      isBeat, beatPhase, beatIntensity, bpm: this._bpm,
      spectrum, waveform,
      stems: { vocals: 0, drums: 0, bass: sBass, other: sMid },
    };
    this._notify();
  }

  private _notify(): void {
    for (const cb of this._subs) cb(this._data);
  }
}

export const audioReactor = AudioReactor.getInstance();
