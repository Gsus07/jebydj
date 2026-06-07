// ─── Plucked String Engine — Karplus-Strong via AudioWorklet ──────────────────

import { audioEngine } from '@/src/lib/audio/AudioEngine';
import { midiToFreq } from './SynthInterface';
import type { SynthEngine } from './SynthInterface';

interface Voice {
  node: AudioWorkletNode | null;
  gain: GainNode;
}

export class PluckedEngine implements SynthEngine {
  private _ctx: AudioContext;
  private _output: GainNode;
  private _voices = new Map<number, Voice>();

  decay = 0.99;        // 0.8 to 0.9999
  body = 0.5;          // resonance/eq
  brightness = 0.5;    // lowpass filter

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

    const gain = ctx.createGain();
    gain.gain.value = vel;

    // Filters for body/brightness
    const filterLow = ctx.createBiquadFilter();
    filterLow.type = 'lowshelf';
    filterLow.frequency.value = 200;
    filterLow.gain.value = (this.body * 24) - 12;

    const filterHigh = ctx.createBiquadFilter();
    filterHigh.type = 'highshelf';
    filterHigh.frequency.value = 3000;
    filterHigh.gain.value = (this.brightness * 24) - 12;

    gain.connect(filterLow);
    filterLow.connect(filterHigh);
    filterHigh.connect(this._output);

    let node: AudioWorkletNode | null = null;
    try {
      node = new AudioWorkletNode(ctx, 'karplus-strong');
      node.parameters.get('frequency')!.setValueAtTime(freq, t);
      node.parameters.get('decay')!.setValueAtTime(this.decay, t);
      node.parameters.get('trigger')!.setValueAtTime(1, t); // trigger burst
      node.parameters.get('trigger')!.setValueAtTime(0, t + 0.1); // reset trigger
      
      node.connect(gain);
    } catch (e) {
      console.error('PluckedEngine: AudioWorklet not loaded yet', e);
    }

    this._voices.set(note, { node, gain });

    // Stop after full decay
    const stopTime = t + 5.0; // max 5s
    setTimeout(() => {
      this._voices.delete(note);
      try {
        if (node) node.disconnect();
        filterHigh.disconnect();
      } catch { /* ignore */ }
    }, (stopTime - ctx.currentTime) * 1000);
  }

  noteOff(note: number, time: number): void {
    const voice = this._voices.get(note);
    if (!voice) return;

    const t = Math.max(this._ctx.currentTime, time);
    // Fast release
    voice.gain.gain.cancelScheduledValues(t);
    voice.gain.gain.setTargetAtTime(0, t, 0.05);

    setTimeout(() => {
      if (voice.node) {
        try { voice.node.disconnect(); } catch { /* ignore */ }
      }
    }, (t - this._ctx.currentTime + 0.2) * 1000);
  }

  setParam(name: string, value: number): void {
    if (name === 'decay') this.decay = value;
    else if (name === 'body') this.body = value;
    else if (name === 'brightness') this.brightness = value;
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
