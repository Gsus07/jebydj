// ─── DeckPlayer ─────────────────────────────────────────────────────────────
'use client';

import { audioEngine } from './AudioEngine';

export type DeckId = 'A' | 'B';

interface EQNodes {
  high: BiquadFilterNode;
  mid: BiquadFilterNode;
  low: BiquadFilterNode;
}

export class DeckPlayer {
  public readonly deckId: DeckId;

  private sourceNode: AudioBufferSourceNode | null = null;
  private buffer: AudioBuffer | null = null;

  // Timing state
  private _startTime = 0; // audioCtx.currentTime when playback started
  private _startOffset = 0; // position in buffer at that moment (seconds)
  private _isPlaying = false;
  private _playbackRate = 1.0;
  private _isReverse = false;

  // Audio nodes
  public gainNode: GainNode | null = null;
  public channelGain: GainNode | null = null;
  private eqNodes: EQNodes | null = null;
  private analyserNode: AnalyserNode | null = null;
  private effectsInput: GainNode | null = null;
  private effectsOutput: GainNode | null = null;

  // Loop state
  private _loopActive = false;
  private _loopStart: number | null = null;
  private _loopEnd: number | null = null;

  // Scratch state
  private _scratchRate = 1.0;
  private _isScratchMode = false;
  private _inertiaTimer: ReturnType<typeof setTimeout> | null = null;

  // Slip mode state
  private _slipMode = false;
  private _slipPosition = 0;
  private _slipStartTime = 0; // audioCtx.currentTime when slip started

  constructor(deckId: DeckId) {
    this.deckId = deckId;
  }

  setup(): void {
    const ctx = audioEngine.ctx;
    if (!ctx) return;

    // Gain for scratch/playback rate (the source node's gain)
    this.gainNode = ctx.createGain();
    this.gainNode.gain.value = 1;

    // EQ chain
    const high = ctx.createBiquadFilter();
    high.type = 'highshelf';
    high.frequency.value = 3000;
    high.gain.value = 0;

    const mid = ctx.createBiquadFilter();
    mid.type = 'peaking';
    mid.frequency.value = 1000;
    mid.Q.value = 1;
    mid.gain.value = 0;

    const low = ctx.createBiquadFilter();
    low.type = 'lowshelf';
    low.frequency.value = 300;
    low.gain.value = 0;

    this.eqNodes = { high, mid, low };

    // Channel gain (fader + crossfader)
    this.channelGain = ctx.createGain();
    this.channelGain.gain.value = 1;

    // Analyser for deck waveform/VU
    this.analyserNode = ctx.createAnalyser();
    this.analyserNode.fftSize = 1024;
    this.analyserNode.smoothingTimeConstant = 0.8;

    // Effects chain endpoints
    this.effectsInput = ctx.createGain();
    this.effectsInput.gain.value = 1;
    this.effectsOutput = ctx.createGain();
    this.effectsOutput.gain.value = 1;
    // Default: effectsInput passes directly to effectsOutput
    this.effectsInput.connect(this.effectsOutput);

    // Connect: gainNode → EQ → analyser → effectsInput → effectsOutput → channelGain → masterBus
    this.gainNode.connect(low);
    low.connect(mid);
    mid.connect(high);
    high.connect(this.analyserNode);
    this.analyserNode.connect(this.effectsInput);
    this.effectsOutput.connect(this.channelGain);

    const bus = this.deckId === 'A' ? audioEngine.deckABus : audioEngine.deckBBus;
    this.channelGain.connect(bus);
  }

  loadBuffer(buffer: AudioBuffer): void {
    this.stop();
    this.buffer = buffer;
    this._startOffset = 0;
    this._isPlaying = false;
    this._loopActive = false;
    this._loopStart = null;
    this._loopEnd = null;
  }

  play(offset?: number): void {
    if (!this.buffer || !this.gainNode || !audioEngine.ctx) return;

    this.stop(); // stop any existing playback

    const ctx = audioEngine.ctx;
    this.sourceNode = ctx.createBufferSource();
    this.sourceNode.buffer = this.buffer;
    this.sourceNode.playbackRate.value = this._isReverse ? -this._playbackRate : this._playbackRate;
    this.sourceNode.connect(this.gainNode);

    const seekTo = offset !== undefined ? offset : this._startOffset;
    const clampedOffset = Math.max(0, Math.min(seekTo, this.buffer.duration));

    if (this._loopActive && this._loopStart !== null && this._loopEnd !== null) {
      this.sourceNode.loop = true;
      this.sourceNode.loopStart = this._loopStart;
      this.sourceNode.loopEnd = this._loopEnd;
      this.sourceNode.start(0, clampedOffset);
    } else {
      this.sourceNode.start(0, clampedOffset);
    }

    this._startTime = ctx.currentTime;
    this._startOffset = clampedOffset;
    this._isPlaying = true;

    this.sourceNode.onended = () => {
      if (this._isPlaying) {
        this._isPlaying = false;
        this._startOffset = 0;
      }
    };
  }

  pause(): void {
    if (!this._isPlaying) return;
    this._startOffset = this.getCurrentTime();
    this.stop();
    this._isPlaying = false;
  }

  private stop(): void {
    if (this.sourceNode) {
      try {
        this.sourceNode.onended = null;
        this.sourceNode.stop();
        this.sourceNode.disconnect();
      } catch {
        // Already stopped
      }
      this.sourceNode = null;
    }
  }

  seek(positionSeconds: number): void {
    const wasPlaying = this._isPlaying;
    this._startOffset = Math.max(0, Math.min(positionSeconds, this.buffer?.duration ?? 0));
    if (wasPlaying) {
      this.play(this._startOffset);
    }
  }

  getCurrentTime(): number {
    if (!this._isPlaying || !audioEngine.ctx) return this._startOffset;
    const elapsed = (audioEngine.ctx.currentTime - this._startTime) * this._playbackRate;
    const pos = this._startOffset + elapsed;
    return Math.max(0, Math.min(pos, this.buffer?.duration ?? 0));
  }

  getDuration(): number {
    return this.buffer?.duration ?? 0;
  }

  setPlaybackRate(rate: number): void {
    this._playbackRate = Math.max(0.25, Math.min(4, Math.abs(rate)));
    if (this.sourceNode) {
      this.sourceNode.playbackRate.value = this._isReverse ? -this._playbackRate : this._playbackRate;
    }
  }

  setReverse(reverse: boolean): void {
    this._isReverse = reverse;
    if (this.sourceNode) {
      this.sourceNode.playbackRate.value = reverse ? -this._playbackRate : this._playbackRate;
    }
  }

  // Scratch: set a temporary playback rate
  scratch(rate: number): void {
    this._isScratchMode = true;
    this._scratchRate = rate;
    if (this.sourceNode) {
      this.sourceNode.playbackRate.value = rate;
    }
  }

  // Called when user releases the vinyl - apply inertia
  releaseScratch(): void {
    if (this._inertiaTimer) clearTimeout(this._inertiaTimer);
    const targetRate = this._isReverse ? -this._playbackRate : this._playbackRate;
    let current = this._scratchRate;
    const decay = (): void => {
      const diff = targetRate - current;
      if (Math.abs(diff) < 0.01) {
        current = targetRate;
        this._isScratchMode = false;
        if (this.sourceNode) {
          this.sourceNode.playbackRate.value = targetRate;
        }
        return;
      }
      current += diff * 0.15;
      if (this.sourceNode) {
        this.sourceNode.playbackRate.value = current;
      }
      this._inertiaTimer = setTimeout(decay, 16);
    };
    decay();
  }

  // EQ controls: value -1 to +1 (-1 = kill = -60dB, 0 = 0dB, +1 = +6dB)
  setEQHigh(value: number): void {
    if (!this.eqNodes || !audioEngine.ctx) return;
    const db = value <= -0.99 ? -60 : value * 6;
    const now = audioEngine.ctx.currentTime;
    this.eqNodes.high.gain.cancelScheduledValues(now);
    this.eqNodes.high.gain.linearRampToValueAtTime(db, now + 0.01);
  }

  setEQMid(value: number): void {
    if (!this.eqNodes || !audioEngine.ctx) return;
    const db = value <= -0.99 ? -60 : value * 6;
    const now = audioEngine.ctx.currentTime;
    this.eqNodes.mid.gain.cancelScheduledValues(now);
    this.eqNodes.mid.gain.linearRampToValueAtTime(db, now + 0.01);
  }

  setEQLow(value: number): void {
    if (!this.eqNodes || !audioEngine.ctx) return;
    const db = value <= -0.99 ? -60 : value * 6;
    const now = audioEngine.ctx.currentTime;
    this.eqNodes.low.gain.cancelScheduledValues(now);
    this.eqNodes.low.gain.linearRampToValueAtTime(db, now + 0.01);
  }

  setChannelVolume(value: number): void {
    if (!this.channelGain || !audioEngine.ctx) return;
    const now = audioEngine.ctx.currentTime;
    this.channelGain.gain.cancelScheduledValues(now);
    this.channelGain.gain.linearRampToValueAtTime(Math.max(0, value), now + 0.01);
  }

  setLoop(start: number | null, end: number | null, active: boolean): void {
    this._loopStart = start;
    this._loopEnd = end;
    this._loopActive = active;

    if (this.sourceNode) {
      if (active && start !== null && end !== null) {
        this.sourceNode.loop = true;
        this.sourceNode.loopStart = start;
        this.sourceNode.loopEnd = end;
      } else {
        this.sourceNode.loop = false;
      }
    }
  }

  getAnalyserData(): Uint8Array {
    if (!this.analyserNode) return new Uint8Array(512);
    const data = new Uint8Array(this.analyserNode.frequencyBinCount);
    this.analyserNode.getByteFrequencyData(data);
    return data;
  }

  getTimeDomainData(): Uint8Array {
    if (!this.analyserNode) return new Uint8Array(1024);
    const data = new Uint8Array(this.analyserNode.fftSize);
    this.analyserNode.getByteTimeDomainData(data);
    return data;
  }

  nudge(forward: boolean): void {
    const delta = forward ? 0.05 : -0.05;
    if (this.sourceNode) {
      const newRate = this._playbackRate + (forward ? 0.2 : -0.2);
      this.sourceNode.playbackRate.value = this._isReverse ? -newRate : newRate;
      setTimeout(() => {
        if (this.sourceNode) {
          this.sourceNode.playbackRate.value = this._isReverse ? -this._playbackRate : this._playbackRate;
        }
      }, 100);
    } else {
      this._startOffset = Math.max(0, this._startOffset + delta);
    }
  }

  get isPlaying(): boolean {
    return this._isPlaying;
  }

  get hasBuffer(): boolean {
    return this.buffer !== null;
  }

  // ─── Slip Mode ─────────────────────────────────────────────────────────────
  enableSlip(): void {
    if (this._slipMode) return;
    this._slipMode = true;
    if (this._isPlaying && audioEngine.ctx) {
      this._slipPosition = this.getCurrentTime();
      this._slipStartTime = audioEngine.ctx.currentTime;
    }
  }

  disableSlip(): void {
    if (!this._slipMode) return;
    this._slipMode = false;
    // Snap to slip position with a 30ms crossfade
    const slipPos = this.getSlipPosition();
    if (this._isPlaying) {
      this._snapToSlip(slipPos);
    } else {
      this.seek(slipPos);
    }
  }

  private _snapToSlip(slipPos: number): void {
    if (!this.gainNode || !audioEngine.ctx) return;
    const ctx = audioEngine.ctx;
    const now = ctx.currentTime;
    // Fade out briefly to avoid click, then resume at slip position
    this.gainNode.gain.setValueAtTime(this.gainNode.gain.value, now);
    this.gainNode.gain.linearRampToValueAtTime(0, now + 0.015);
    setTimeout(() => {
      this.seek(slipPos);
      if (this.gainNode && audioEngine.ctx) {
        const n = audioEngine.ctx.currentTime;
        this.gainNode.gain.setValueAtTime(0, n);
        this.gainNode.gain.linearRampToValueAtTime(1, n + 0.015);
      }
    }, 20);
  }

  getSlipPosition(): number {
    if (!this._slipMode || !audioEngine.ctx) return this.getCurrentTime();
    const elapsed = audioEngine.ctx.currentTime - this._slipStartTime;
    const pos = this._slipPosition + elapsed * this._playbackRate;
    return Math.max(0, Math.min(pos, this.buffer?.duration ?? 0));
  }

  get slipMode(): boolean { return this._slipMode; }


  getEffectsInput(): GainNode | null {
    return this.effectsInput;
  }

  getEffectsOutput(): GainNode | null {
    return this.effectsOutput;
  }
}

// Singleton instances
let _deckA: DeckPlayer | null = null;
let _deckB: DeckPlayer | null = null;

export function getDeckPlayer(id: DeckId): DeckPlayer {
  if (id === 'A') {
    if (!_deckA) _deckA = new DeckPlayer('A');
    return _deckA;
  }
  if (!_deckB) _deckB = new DeckPlayer('B');
  return _deckB;
}
