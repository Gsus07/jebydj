// MIDIEngine.ts — Renders MIDI notes to audio using Web Audio API synths

import { audioEngine } from '@/src/lib/audio/AudioEngine';
import { beatsToSeconds } from './TimeSignature';
import type { MIDINote, InstrumentType } from '@/src/store/dawTypes';

/** MIDI note number to frequency in Hz */
export function midiToFreq(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

/** Frequency to MIDI note number */
export function freqToMidi(freq: number): number {
  return Math.round(69 + 12 * Math.log2(freq / 440));
}

/** Note name (e.g. "C4") from MIDI number */
export function midiToNoteName(midi: number): string {
  const names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const octave = Math.floor(midi / 12) - 1;
  return `${names[midi % 12]}${octave}`;
}

// ─── Basic Synth ──────────────────────────────────────────────────────────────

export interface BasicSynthParams {
  waveform: OscillatorType;
  attack: number;   // seconds
  decay: number;
  sustain: number;  // 0-1
  release: number;
  filterFreq: number;
  filterQ: number;
}

const defaultBasicSynth: BasicSynthParams = {
  waveform: 'sawtooth',
  attack: 0.01,
  decay: 0.1,
  sustain: 0.7,
  release: 0.3,
  filterFreq: 5000,
  filterQ: 1,
};

function scheduleBasicSynth(
  ctx: AudioContext,
  destination: AudioNode,
  freq: number,
  velocity: number,
  startTime: number,
  duration: number,
  params: BasicSynthParams,
): void {
  const osc = ctx.createOscillator();
  const env = ctx.createGain();
  const filter = ctx.createBiquadFilter();

  osc.type = params.waveform;
  osc.frequency.value = freq;

  filter.type = 'lowpass';
  filter.frequency.value = params.filterFreq;
  filter.Q.value = params.filterQ;

  const vel = velocity / 127;
  env.gain.setValueAtTime(0, startTime);
  env.gain.linearRampToValueAtTime(vel, startTime + params.attack);
  env.gain.linearRampToValueAtTime(vel * params.sustain, startTime + params.attack + params.decay);
  env.gain.setValueAtTime(vel * params.sustain, startTime + duration - params.release);
  env.gain.linearRampToValueAtTime(0, startTime + duration);

  osc.connect(filter);
  filter.connect(env);
  env.connect(destination);

  osc.start(startTime);
  osc.stop(startTime + duration + 0.01);

  osc.onended = () => {
    try { env.disconnect(); filter.disconnect(); } catch { /* ignore */ }
  };
}

// ─── FM Synth ─────────────────────────────────────────────────────────────────

function scheduleFMSynth(
  ctx: AudioContext,
  destination: AudioNode,
  freq: number,
  velocity: number,
  startTime: number,
  duration: number,
): void {
  const carrier = ctx.createOscillator();
  const modulator = ctx.createOscillator();
  const modGain = ctx.createGain();
  const env = ctx.createGain();

  carrier.type = 'sine';
  carrier.frequency.value = freq;

  modulator.type = 'sine';
  modulator.frequency.value = freq * 2; // ratio 2:1

  modGain.gain.value = freq * 3; // FM depth

  modulator.connect(modGain);
  modGain.connect(carrier.frequency);

  const vel = velocity / 127;
  env.gain.setValueAtTime(0, startTime);
  env.gain.linearRampToValueAtTime(vel, startTime + 0.01);
  env.gain.setValueAtTime(vel * 0.8, startTime + duration - 0.05);
  env.gain.linearRampToValueAtTime(0, startTime + duration);

  carrier.connect(env);
  env.connect(destination);

  carrier.start(startTime);
  modulator.start(startTime);
  carrier.stop(startTime + duration + 0.01);
  modulator.stop(startTime + duration + 0.01);

  carrier.onended = () => {
    try { env.disconnect(); modGain.disconnect(); } catch { /* ignore */ }
  };
}

// ─── Drum Machine ─────────────────────────────────────────────────────────────

// Maps MIDI notes C1-D#2 (36-51) to drum sounds
function scheduleDrumSound(
  ctx: AudioContext,
  destination: AudioNode,
  midi: number,
  velocity: number,
  startTime: number,
): void {
  const vel = velocity / 127;

  // Simple synthesized drums using noise + filters
  if (midi === 36) {
    // Kick: sine with pitch drop
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(150, startTime);
    osc.frequency.exponentialRampToValueAtTime(40, startTime + 0.15);
    env.gain.setValueAtTime(vel, startTime);
    env.gain.exponentialRampToValueAtTime(0.001, startTime + 0.3);
    osc.connect(env); env.connect(destination);
    osc.start(startTime); osc.stop(startTime + 0.31);
    return;
  }

  if (midi === 38) {
    // Snare: noise + tone
    const buf = ctx.createBuffer(1, ctx.sampleRate * 0.2, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * 0.8;
    const source = ctx.createBufferSource();
    const filter = ctx.createBiquadFilter();
    const env = ctx.createGain();
    source.buffer = buf;
    filter.type = 'bandpass';
    filter.frequency.value = 200;
    env.gain.setValueAtTime(vel, startTime);
    env.gain.exponentialRampToValueAtTime(0.001, startTime + 0.18);
    source.connect(filter); filter.connect(env); env.connect(destination);
    source.start(startTime);
    return;
  }

  if (midi === 42 || midi === 46) {
    // Hi-hat
    const buf = ctx.createBuffer(1, ctx.sampleRate * 0.1, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1);
    const source = ctx.createBufferSource();
    const filter = ctx.createBiquadFilter();
    const env = ctx.createGain();
    source.buffer = buf;
    filter.type = 'highpass';
    filter.frequency.value = 8000;
    const dur = midi === 46 ? 0.1 : 0.04;
    env.gain.setValueAtTime(vel * 0.4, startTime);
    env.gain.exponentialRampToValueAtTime(0.001, startTime + dur);
    source.connect(filter); filter.connect(env); env.connect(destination);
    source.start(startTime);
    return;
  }

  // Default: short sine beep
  const osc = ctx.createOscillator();
  const env = ctx.createGain();
  osc.frequency.value = midiToFreq(midi);
  env.gain.setValueAtTime(vel * 0.3, startTime);
  env.gain.exponentialRampToValueAtTime(0.001, startTime + 0.08);
  osc.connect(env); env.connect(destination);
  osc.start(startTime); osc.stop(startTime + 0.09);
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function scheduleNote(
  destination: AudioNode,
  note: MIDINote,
  clipStartBeat: number,
  bpm: number,
  instrument: InstrumentType,
  playStartContextTime: number,
  playStartPositionBeats: number,
): void {
  const ctx = audioEngine.ctx;
  const absStartBeat = clipStartBeat + note.startBeat;
  const noteStartTime = playStartContextTime +
    beatsToSeconds(absStartBeat - playStartPositionBeats, bpm);
  const noteDuration = beatsToSeconds(note.durationBeats, bpm);

  if (noteStartTime + noteDuration < ctx.currentTime) return;
  if (note.probability < 100 && Math.random() * 100 > note.probability) return;

  const freq = midiToFreq(note.pitch);

  switch (instrument) {
    case 'basicSynth':
      scheduleBasicSynth(ctx, destination, freq, note.velocity, noteStartTime, noteDuration, defaultBasicSynth);
      break;
    case 'fmSynth':
      scheduleFMSynth(ctx, destination, freq, note.velocity, noteStartTime, noteDuration);
      break;
    case 'drumMachine':
      scheduleDrumSound(ctx, destination, note.pitch, note.velocity, noteStartTime);
      break;
    case 'sampler':
      // Sampler plays a basic sine as fallback (real implementation would load samples)
      scheduleBasicSynth(ctx, destination, freq, note.velocity, noteStartTime, noteDuration, { ...defaultBasicSynth, waveform: 'sine' });
      break;
  }
}

/** Preview a single note immediately (for piano roll note click) */
export function previewNote(pitch: number, instrument: InstrumentType): void {
  if (!audioEngine.isInitialized()) return;
  const ctx = audioEngine.ctx;
  const freq = midiToFreq(pitch);
  const now = ctx.currentTime;

  switch (instrument) {
    case 'basicSynth':
      scheduleBasicSynth(ctx, audioEngine.masterGain, freq, 100, now, 0.5, defaultBasicSynth);
      break;
    case 'fmSynth':
      scheduleFMSynth(ctx, audioEngine.masterGain, freq, 100, now, 0.5);
      break;
    case 'drumMachine':
      scheduleDrumSound(ctx, audioEngine.masterGain, pitch, 100, now);
      break;
    case 'sampler':
      scheduleBasicSynth(ctx, audioEngine.masterGain, freq, 100, now, 0.5, { ...defaultBasicSynth, waveform: 'sine' });
      break;
  }
}
