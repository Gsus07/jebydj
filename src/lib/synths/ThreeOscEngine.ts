// ─── 3xOsc Engine — 3 oscillators with mix, filter, amp ADSR, filter ADSR ────

import { audioEngine } from '@/src/lib/audio/AudioEngine';
import { midiToFreq } from './SynthInterface';
import type { SynthEngine } from './SynthInterface';

type OscWaveform = 'sine' | 'square' | 'sawtooth' | 'triangle';

interface OscParams {
  waveform: OscWaveform;
  volume: number;      // 0–1
  fine: number;        // cents (-100 to +100)
  coarse: number;      // semitones (-24 to +24)
  phase: number;       // 0–360 (not controllable in Web Audio, cosmetic)
  invert: boolean;
}

interface ADSRParams {
  attack: number;   // seconds
  decay: number;    // seconds
  sustain: number;  // 0–1
  release: number;  // seconds
}

interface FilterParams {
  type: BiquadFilterType | 'none';
  cutoff: number;      // Hz 20–20000
  resonance: number;   // Q 0.1–20
  envAmount: number;   // -1 to +1
}

// ─── Defaults ────────────────────────────────────────────────────────────────

function defaultOsc(waveform: OscWaveform = 'sawtooth'): OscParams {
  return { waveform, volume: 0.7, fine: 0, coarse: 0, phase: 0, invert: false };
}

function defaultADSR(): ADSRParams {
  return { attack: 0.01, decay: 0.2, sustain: 0.6, release: 0.3 };
}

function defaultFilter(): FilterParams {
  return { type: 'lowpass', cutoff: 8000, resonance: 1, envAmount: 0 };
}

// ─── Active Voice ────────────────────────────────────────────────────────────

interface Voice {
  oscs: OscillatorNode[];
  oscGains: GainNode[];
  filter: BiquadFilterNode | null;
  ampEnv: GainNode;
  releaseTimer: ReturnType<typeof setTimeout> | null;
}

// ─── ThreeOscEngine ──────────────────────────────────────────────────────────

export class ThreeOscEngine implements SynthEngine {
  private _ctx: AudioContext;
  private _output: GainNode;
  private _voices = new Map<number, Voice>();

  osc1: OscParams = defaultOsc('sawtooth');
  osc2: OscParams = defaultOsc('square');
  osc3: OscParams = defaultOsc('triangle');
  ampADSR: ADSRParams = defaultADSR();
  filterADSR: ADSRParams = { attack: 0.05, decay: 0.3, sustain: 0.4, release: 0.4 };
  filter: FilterParams = defaultFilter();
  masterVolume = 0.5;

  constructor() {
    this._ctx = audioEngine.ctx;
    this._output = this._ctx.createGain();
    this._output.gain.value = this.masterVolume;
  }

  noteOn(note: number, velocity: number, time: number): void {
    this.noteOff(note, time); // kill existing voice on same note

    const ctx = this._ctx;
    const freq = midiToFreq(note);
    const vel = velocity / 127;
    const t = Math.max(ctx.currentTime, time);

    // Create oscillators
    const oscParams = [this.osc1, this.osc2, this.osc3];
    const oscs: OscillatorNode[] = [];
    const oscGains: GainNode[] = [];

    for (const op of oscParams) {
      const osc = ctx.createOscillator();
      osc.type = op.waveform;
      const detuneAmount = op.fine + op.coarse * 100;
      osc.frequency.setValueAtTime(freq, t);
      osc.detune.setValueAtTime(detuneAmount, t);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(op.volume * (op.invert ? -1 : 1), t);

      osc.connect(gain);
      oscs.push(osc);
      oscGains.push(gain);
    }

    // Filter
    let filterNode: BiquadFilterNode | null = null;
    const mixNode = ctx.createGain();
    mixNode.gain.value = 1;

    for (const g of oscGains) g.connect(mixNode);

    if (this.filter.type !== 'none') {
      filterNode = ctx.createBiquadFilter();
      filterNode.type = this.filter.type;
      filterNode.Q.setValueAtTime(this.filter.resonance, t);

      const baseCutoff = this.filter.cutoff;
      filterNode.frequency.setValueAtTime(baseCutoff, t);

      // Filter envelope
      if (Math.abs(this.filter.envAmount) > 0.01) {
        const envRange = this.filter.envAmount * (20000 - baseCutoff);
        const peakCutoff = Math.max(20, Math.min(20000, baseCutoff + envRange));
        filterNode.frequency.setValueAtTime(baseCutoff, t);
        filterNode.frequency.linearRampToValueAtTime(peakCutoff, t + this.filterADSR.attack);
        const sustainCutoff = baseCutoff + envRange * this.filterADSR.sustain;
        filterNode.frequency.linearRampToValueAtTime(
          Math.max(20, Math.min(20000, sustainCutoff)),
          t + this.filterADSR.attack + this.filterADSR.decay,
        );
      }

      mixNode.connect(filterNode);
      filterNode.connect(this._createAmpEnv(t, vel));
    } else {
      mixNode.connect(this._createAmpEnv(t, vel));
    }

    // Get the amp envelope (we need to store it)
    // Re-create pattern: build chain properly
    const ampEnv = ctx.createGain();
    ampEnv.gain.setValueAtTime(0, t);
    ampEnv.gain.linearRampToValueAtTime(vel * this.masterVolume, t + this.ampADSR.attack);
    ampEnv.gain.linearRampToValueAtTime(
      vel * this.masterVolume * this.ampADSR.sustain,
      t + this.ampADSR.attack + this.ampADSR.decay,
    );

    // Reconnect properly
    if (filterNode) {
      mixNode.disconnect();
      for (const g of oscGains) {
        g.disconnect();
        g.connect(mixNode);
      }
      mixNode.connect(filterNode);
      filterNode.connect(ampEnv);
    } else {
      mixNode.disconnect();
      for (const g of oscGains) {
        g.disconnect();
        g.connect(mixNode);
      }
      mixNode.connect(ampEnv);
    }

    ampEnv.connect(this._output);

    for (const osc of oscs) osc.start(t);

    this._voices.set(note, {
      oscs,
      oscGains,
      filter: filterNode,
      ampEnv,
      releaseTimer: null,
    });
  }

  noteOff(note: number, time: number): void {
    const voice = this._voices.get(note);
    if (!voice) return;

    const ctx = this._ctx;
    const t = Math.max(ctx.currentTime, time);

    // Release envelope
    voice.ampEnv.gain.cancelScheduledValues(t);
    voice.ampEnv.gain.setValueAtTime(voice.ampEnv.gain.value, t);
    voice.ampEnv.gain.linearRampToValueAtTime(0, t + this.ampADSR.release);

    // Stop oscillators after release
    const stopTime = t + this.ampADSR.release + 0.05;
    for (const osc of voice.oscs) {
      try { osc.stop(stopTime); } catch { /* already stopped */ }
    }

    // Clean up after release
    voice.releaseTimer = setTimeout(() => {
      this._voices.delete(note);
      try { voice.ampEnv.disconnect(); } catch { /* ignore */ }
      if (voice.filter) try { voice.filter.disconnect(); } catch { /* ignore */ }
    }, (this.ampADSR.release + 0.1) * 1000);
  }

  private _createAmpEnv(time: number, vel: number): GainNode {
    // Placeholder — actual envelope is built in noteOn
    return this._ctx.createGain();
  }

  setParam(name: string, value: number): void {
    const parts = name.split('.');
    if (parts[0] === 'osc1' || parts[0] === 'osc2' || parts[0] === 'osc3') {
      const osc = this[parts[0] as 'osc1' | 'osc2' | 'osc3'];
      if (parts[1] in osc) (osc as Record<string, any>)[parts[1]] = value;
    } else if (parts[0] === 'amp') {
      if (parts[1] in this.ampADSR) (this.ampADSR as Record<string, any>)[parts[1]] = value;
    } else if (parts[0] === 'filter') {
      if (parts[1] in this.filter) (this.filter as Record<string, any>)[parts[1]] = value;
    } else if (name === 'volume') {
      this.masterVolume = value;
      this._output.gain.setTargetAtTime(value, this._ctx.currentTime, 0.01);
    }
  }

  getParam(name: string): number {
    if (name === 'volume') return this.masterVolume;
    return 0;
  }

  getOutput(): AudioNode {
    return this._output;
  }

  dispose(): void {
    for (const [note] of this._voices) {
      this.noteOff(note, this._ctx.currentTime);
    }
    try { this._output.disconnect(); } catch { /* ignore */ }
  }
}
