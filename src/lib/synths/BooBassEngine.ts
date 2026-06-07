// ─── BooBass Engine — Simplified physically modeled bass synth ─────────────────

import { audioEngine } from '@/src/lib/audio/AudioEngine';
import { midiToFreq } from './SynthInterface';
import type { SynthEngine } from './SynthInterface';

interface Voice {
  osc1: OscillatorNode;
  osc2: OscillatorNode;
  env: GainNode;
  filterLow: BiquadFilterNode;
  filterMid: BiquadFilterNode;
  filterHigh: BiquadFilterNode;
}

export class BooBassEngine implements SynthEngine {
  private _ctx: AudioContext;
  private _output: GainNode;
  private _voices = new Map<number, Voice>();

  // Params
  bass = 0.8;      // 0-1
  mid = 0.5;       // 0-1
  high = 0.3;      // 0-1
  decay = 0.5;     // 10ms - 2000ms

  constructor() {
    this._ctx = audioEngine.ctx;
    this._output = this._ctx.createGain();
    this._output.gain.value = 1.0;
  }

  noteOn(note: number, velocity: number, time: number): void {
    this.noteOff(note, time);

    const ctx = this._ctx;
    const t = Math.max(ctx.currentTime, time);
    const freq = midiToFreq(note);
    const vel = velocity / 127;

    // Oscillators: a mix of triangle and sine
    const osc1 = ctx.createOscillator();
    osc1.type = 'triangle';
    osc1.frequency.setValueAtTime(freq, t);

    const osc2 = ctx.createOscillator();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(freq, t);

    // Envelope (decay only)
    const env = ctx.createGain();
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(vel, t + 0.01); // fast attack
    const decaySecs = 0.01 + this.decay * 1.99;
    env.gain.setTargetAtTime(0, t + 0.01, decaySecs / 3); // exponential decay

    // EQ Filters
    const filterLow = ctx.createBiquadFilter();
    filterLow.type = 'lowshelf';
    filterLow.frequency.value = 200;
    filterLow.gain.value = (this.bass * 24) - 12; // -12 to +12 dB

    const filterMid = ctx.createBiquadFilter();
    filterMid.type = 'peaking';
    filterMid.frequency.value = 800;
    filterMid.Q.value = 1.5;
    filterMid.gain.value = (this.mid * 24) - 12;

    const filterHigh = ctx.createBiquadFilter();
    filterHigh.type = 'highshelf';
    filterHigh.frequency.value = 3000;
    filterHigh.gain.value = (this.high * 24) - 12;

    // Chain
    osc1.connect(env);
    osc2.connect(env);
    env.connect(filterLow);
    filterLow.connect(filterMid);
    filterMid.connect(filterHigh);
    filterHigh.connect(this._output);

    osc1.start(t);
    osc2.start(t);

    // Stop after decay
    const stopTime = t + 0.01 + decaySecs * 2;
    osc1.stop(stopTime);
    osc2.stop(stopTime);

    this._voices.set(note, { osc1, osc2, env, filterLow, filterMid, filterHigh });

    // Cleanup
    setTimeout(() => {
      this._voices.delete(note);
      try { filterHigh.disconnect(); } catch { /* ignore */ }
    }, (stopTime - ctx.currentTime) * 1000 + 100);
  }

  noteOff(note: number, time: number): void {
    const voice = this._voices.get(note);
    if (!voice) return;

    const t = Math.max(this._ctx.currentTime, time);
    // Fast release for BooBass (it's a bass guitar)
    voice.env.gain.cancelScheduledValues(t);
    voice.env.gain.setTargetAtTime(0, t, 0.05);

    voice.osc1.stop(t + 0.2);
    voice.osc2.stop(t + 0.2);
  }

  setParam(name: string, value: number): void {
    if (name === 'bass') this.bass = value;
    else if (name === 'mid') this.mid = value;
    else if (name === 'high') this.high = value;
    else if (name === 'decay') this.decay = value;
  }

  getParam(name: string): number {
    return (this as any)[name] || 0;
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
