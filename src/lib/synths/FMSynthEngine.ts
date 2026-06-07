// ─── FM Synth Engine — 4 operators with cross-modulation ──────────────────────

import { audioEngine } from '@/src/lib/audio/AudioEngine';
import { midiToFreq } from './SynthInterface';
import type { SynthEngine } from './SynthInterface';

interface Operator {
  ratio: number;
  level: number;
  attack: number;
  decay: number;
  sustain: number;
  release: number;
}

interface Voice {
  oscs: OscillatorNode[];
  envs: GainNode[];
}

export class FMSynthEngine implements SynthEngine {
  private _ctx: AudioContext;
  private _output: GainNode;
  private _voices = new Map<number, Voice>();

  // 4 Operators:
  // Op 4 modulates Op 3
  // Op 3 modulates Op 2
  // Op 2 modulates Op 1
  // Op 1 goes to output (carrier)

  ops: [Operator, Operator, Operator, Operator] = [
    { ratio: 1.0, level: 1.0, attack: 0.01, decay: 0.3, sustain: 0.5, release: 0.5 }, // Carrier
    { ratio: 2.0, level: 0.5, attack: 0.01, decay: 0.2, sustain: 0.0, release: 0.3 }, // Modulator
    { ratio: 3.0, level: 0.0, attack: 0.01, decay: 0.2, sustain: 0.0, release: 0.3 }, // Modulator
    { ratio: 4.0, level: 0.0, attack: 0.01, decay: 0.2, sustain: 0.0, release: 0.3 }, // Modulator
  ];

  masterVolume = 0.5;

  constructor() {
    this._ctx = audioEngine.ctx;
    this._output = this._ctx.createGain();
    this._output.gain.value = this.masterVolume;
  }

  noteOn(note: number, velocity: number, time: number): void {
    this.noteOff(note, time);

    const ctx = this._ctx;
    const t = Math.max(ctx.currentTime, time);
    const baseFreq = midiToFreq(note);
    const vel = velocity / 127;

    const oscs: OscillatorNode[] = [];
    const envs: GainNode[] = [];

    // Create operators
    for (let i = 0; i < 4; i++) {
      const op = this.ops[i];
      const osc = ctx.createOscillator();
      osc.type = 'sine'; // FM is almost always sine
      osc.frequency.setValueAtTime(baseFreq * op.ratio, t);

      const env = ctx.createGain();
      env.gain.setValueAtTime(0, t);
      
      const peak = i === 0 ? vel * op.level : op.level * 1000; // Modulators output frequency deviation (Hz)
      env.gain.linearRampToValueAtTime(peak, t + op.attack);
      env.gain.linearRampToValueAtTime(peak * op.sustain, t + op.attack + op.decay);

      osc.connect(env);
      oscs.push(osc);
      envs.push(env);
    }

    // Connect modulation chain
    // 3 -> 2
    if (this.ops[3].level > 0) envs[3].connect(oscs[2].frequency);
    // 2 -> 1
    if (this.ops[2].level > 0) envs[2].connect(oscs[1].frequency);
    // 1 -> 0
    if (this.ops[1].level > 0) envs[1].connect(oscs[0].frequency);
    
    // 0 -> output
    envs[0].connect(this._output);

    for (const osc of oscs) osc.start(t);

    this._voices.set(note, { oscs, envs });
  }

  noteOff(note: number, time: number): void {
    const voice = this._voices.get(note);
    if (!voice) return;

    const t = Math.max(this._ctx.currentTime, time);
    
    // Find longest release
    let maxRelease = 0;
    for (let i = 0; i < 4; i++) {
      if (this.ops[i].release > maxRelease) maxRelease = this.ops[i].release;
      const env = voice.envs[i];
      env.gain.cancelScheduledValues(t);
      env.gain.setValueAtTime(env.gain.value, t);
      env.gain.linearRampToValueAtTime(0, t + this.ops[i].release);
    }

    const stopTime = t + maxRelease + 0.05;
    for (const osc of voice.oscs) {
      try { osc.stop(stopTime); } catch { /* ignore */ }
    }

    setTimeout(() => {
      this._voices.delete(note);
      try { voice.envs[0].disconnect(); } catch { /* ignore */ }
    }, (stopTime - this._ctx.currentTime) * 1000 + 100);
  }

  setParam(name: string, value: number): void {
    if (name === 'volume') {
      this.masterVolume = value;
      this._output.gain.setTargetAtTime(value, this._ctx.currentTime, 0.01);
      return;
    }

    const parts = name.split('.');
    if (parts[0].startsWith('op')) {
      const idx = parseInt(parts[0].replace('op', '')) - 1;
      if (idx >= 0 && idx < 4) {
        if (parts[1] in this.ops[idx]) {
          (this.ops[idx] as Record<string, any>)[parts[1]] = value;
        }
      }
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
