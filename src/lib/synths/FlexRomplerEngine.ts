// ─── FLEX Rompler Engine — Procedural presets ─────────────────────────────────

import { audioEngine } from '@/src/lib/audio/AudioEngine';
import { midiToFreq } from './SynthInterface';
import type { SynthEngine } from './SynthInterface';
import { PROCEDURAL_CATALOG } from '@/src/lib/samples/ProceduralSounds';

interface Voice {
  source: AudioBufferSourceNode;
  env: GainNode;
  filter: BiquadFilterNode;
}

export class FlexRomplerEngine implements SynthEngine {
  private _ctx: AudioContext;
  private _output: GainNode;
  private _voices = new Map<number, Voice>();
  
  private _buffer: AudioBuffer | null = null;

  // Params
  category: 'pad' | 'lead' | 'pluck' = 'pad';
  cutoff = 20000;
  attack = 0.1;
  release = 1.0;
  masterVolume = 0.5;

  constructor() {
    this._ctx = audioEngine.ctx;
    this._output = this._ctx.createGain();
    this._output.gain.value = this.masterVolume;
    this.loadPreset('pad'); // initial load
  }

  async loadPreset(category: 'pad' | 'lead' | 'pluck') {
    this.category = category;
    const sr = this._ctx.sampleRate;
    if (category === 'pad') {
      this.attack = 0.5;
      this.release = 2.0;
      const gen = PROCEDURAL_CATALOG.find(c => c.id === 'proc_synth_chord')?.gen;
      if (gen) this._buffer = await gen(sr);
    } else if (category === 'lead') {
      this.attack = 0.05;
      this.release = 0.2;
      const gen = PROCEDURAL_CATALOG.find(c => c.id === 'proc_synth_lead')?.gen;
      if (gen) this._buffer = await gen(sr);
    } else {
      this.attack = 0.01;
      this.release = 0.5;
      const gen = PROCEDURAL_CATALOG.find(c => c.id === 'proc_synth_stab')?.gen;
      if (gen) this._buffer = await gen(sr);
    }
  }

  noteOn(note: number, velocity: number, time: number): void {
    this.noteOff(note, time);

    if (!this._buffer) return;

    const ctx = this._ctx;
    const t = Math.max(ctx.currentTime, time);
    // Base frequency for the generated buffers is C4 (midi 60)
    const baseMidi = 60;
    const playbackRate = Math.pow(2, (note - baseMidi) / 12);
    const vel = velocity / 127;

    const source = ctx.createBufferSource();
    source.buffer = this._buffer;
    source.playbackRate.value = playbackRate;
    source.loop = true; // Loop the sustain portion

    const env = ctx.createGain();
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(vel, t + this.attack);

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = this.cutoff;

    source.connect(filter);
    filter.connect(env);
    env.connect(this._output);

    source.start(t);

    this._voices.set(note, { source, env, filter });
  }

  noteOff(note: number, time: number): void {
    const voice = this._voices.get(note);
    if (!voice) return;

    const t = Math.max(this._ctx.currentTime, time);
    voice.env.gain.cancelScheduledValues(t);
    voice.env.gain.setValueAtTime(voice.env.gain.value, t);
    voice.env.gain.linearRampToValueAtTime(0, t + this.release);

    voice.source.stop(t + this.release + 0.1);

    setTimeout(() => {
      this._voices.delete(note);
      try { voice.env.disconnect(); } catch { /* ignore */ }
    }, (t + this.release - this._ctx.currentTime + 0.2) * 1000);
  }

  setParam(name: string, value: number): void {
    if (name === 'volume') {
      this.masterVolume = value;
      this._output.gain.setTargetAtTime(value, this._ctx.currentTime, 0.01);
    } else if (name === 'cutoff') {
      this.cutoff = value;
    } else if (name === 'attack') {
      this.attack = value;
    } else if (name === 'release') {
      this.release = value;
    } else if (name === 'category') {
      // 0 = pad, 1 = lead, 2 = pluck
      const cats: ('pad' | 'lead' | 'pluck')[] = ['pad', 'lead', 'pluck'];
      this.loadPreset(cats[value] || 'pad');
    }
  }

  getParam(name: string): number {
    if (name === 'volume') return this.masterVolume;
    if (name === 'cutoff') return this.cutoff;
    if (name === 'attack') return this.attack;
    if (name === 'release') return this.release;
    if (name === 'category') {
      if (this.category === 'pad') return 0;
      if (this.category === 'lead') return 1;
      return 2;
    }
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
