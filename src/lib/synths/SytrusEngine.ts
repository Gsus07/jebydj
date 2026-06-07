// ─── Sytrus Engine — 6 Operators FM Synthesizer ─────────────────────────────────

import { audioEngine } from '@/src/lib/audio/AudioEngine';
import { midiToFreq } from './SynthInterface';
import type { SynthEngine } from './SynthInterface';

interface Operator {
  ratio: number;
  level: number;       // envelope peak
  attack: number;
  decay: number;
  sustain: number;
  release: number;
}

interface Voice {
  oscs: OscillatorNode[];
  envs: GainNode[];
  outGains: GainNode[]; // gain nodes routing this operator to master output
}

export class SytrusEngine implements SynthEngine {
  private _ctx: AudioContext;
  private _output: GainNode;
  private _voices = new Map<number, Voice>();

  // 6 Operators
  ops: [Operator, Operator, Operator, Operator, Operator, Operator] = [
    { ratio: 1.0, level: 1.0, attack: 0.01, decay: 0.5, sustain: 0.5, release: 0.5 },
    { ratio: 2.0, level: 0.0, attack: 0.01, decay: 0.2, sustain: 0.0, release: 0.3 },
    { ratio: 3.0, level: 0.0, attack: 0.01, decay: 0.2, sustain: 0.0, release: 0.3 },
    { ratio: 4.0, level: 0.0, attack: 0.01, decay: 0.2, sustain: 0.0, release: 0.3 },
    { ratio: 5.0, level: 0.0, attack: 0.01, decay: 0.2, sustain: 0.0, release: 0.3 },
    { ratio: 6.0, level: 0.0, attack: 0.01, decay: 0.2, sustain: 0.0, release: 0.3 },
  ];

  // 6x6 Modulation Matrix
  // modMatrix[modulator][carrier] = amount (0-1)
  modMatrix: number[][] = Array(6).fill(0).map(() => Array(6).fill(0));

  // Output Matrix
  // outMatrix[op] = amount (0-1)
  outMatrix: number[] = [1.0, 0, 0, 0, 0, 0];

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
    const outGains: GainNode[] = [];

    // Create 6 operators
    for (let i = 0; i < 6; i++) {
      const op = this.ops[i];
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(baseFreq * op.ratio, t);

      const env = ctx.createGain();
      env.gain.setValueAtTime(0, t);
      
      const isOut = this.outMatrix[i] > 0;
      const hasCarrier = this.modMatrix[i].some(v => v > 0);
      
      // If it modulates others, the peak needs to be in Hz. If it goes to out, it's 0-1 amplitude.
      // This is a simplified dual-purpose envelope approach.
      const peak = (isOut && !hasCarrier) ? vel * op.level : op.level * 1000;
      
      env.gain.linearRampToValueAtTime(peak, t + op.attack);
      env.gain.linearRampToValueAtTime(peak * op.sustain, t + op.attack + op.decay);

      osc.connect(env);
      oscs.push(osc);
      envs.push(env);

      // Output routing
      const outGain = ctx.createGain();
      outGain.gain.value = this.outMatrix[i];
      // If it's a dual purpose (modulates AND outputs), we scale down the massive freq deviation back to 0-1
      if (isOut && hasCarrier) {
          const scaler = ctx.createGain();
          scaler.gain.value = 1 / 1000;
          env.connect(scaler);
          scaler.connect(outGain);
      } else {
          env.connect(outGain);
      }
      outGain.connect(this._output);
      outGains.push(outGain);
    }

    // Connect modulation matrix
    for (let mod = 0; mod < 6; mod++) {
      for (let car = 0; car < 6; car++) {
        const amount = this.modMatrix[mod][car];
        if (amount > 0) {
          const modAmountNode = ctx.createGain();
          modAmountNode.gain.value = amount;
          envs[mod].connect(modAmountNode);
          modAmountNode.connect(oscs[car].frequency);
        }
      }
    }

    for (const osc of oscs) osc.start(t);

    this._voices.set(note, { oscs, envs, outGains });
  }

  noteOff(note: number, time: number): void {
    const voice = this._voices.get(note);
    if (!voice) return;

    const t = Math.max(this._ctx.currentTime, time);
    
    let maxRelease = 0;
    for (let i = 0; i < 6; i++) {
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
      for (const env of voice.envs) {
          try { env.disconnect(); } catch { /* ignore */ }
      }
      for (const out of voice.outGains) {
          try { out.disconnect(); } catch { /* ignore */ }
      }
    }, (stopTime - this._ctx.currentTime) * 1000 + 100);
  }

  setParam(name: string, value: number): void {
    if (name === 'volume') {
      this.masterVolume = value;
      this._output.gain.setTargetAtTime(value, this._ctx.currentTime, 0.01);
      return;
    }
    // format: op1.ratio, mod.0.1 (op1 modulates op2), out.0
    const parts = name.split('.');
    if (parts[0].startsWith('op')) {
      const idx = parseInt(parts[0].replace('op', '')) - 1;
      if (idx >= 0 && idx < 6) {
        if (parts[1] in this.ops[idx]) {
          (this.ops[idx] as Record<string, number>)[parts[1]] = value;
        }
      }
    } else if (parts[0] === 'mod') {
      const mod = parseInt(parts[1]);
      const car = parseInt(parts[2]);
      if (mod >= 0 && mod < 6 && car >= 0 && car < 6) {
          this.modMatrix[mod][car] = value;
      }
    } else if (parts[0] === 'out') {
      const idx = parseInt(parts[1]);
      if (idx >= 0 && idx < 6) {
          this.outMatrix[idx] = value;
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
