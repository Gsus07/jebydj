// ─── Project Persistence Types ────────────────────────────────────────────────
// All types here MUST be JSON-serializable (no Float32Array, no class instances).

import type { MixerState, EffectState, HotCue, LoopState } from './types';
import type { DAWProject } from './dawTypes';
import type { DrumMachineData } from './sampleTypes';

// ─── Serialized Deck (JSON-safe subset of DeckState) ─────────────────────────

export interface SerializedDeck {
  trackFileHash: string | null;   // SHA-256 hash referencing audio in IDB
  trackName: string;
  artistName: string;
  duration: number;
  currentTime: number;
  bpm: number;
  detectedBpm: number;
  key: string;
  pitch: number;
  tempo: number;
  tempoRange: 8 | 16 | 100;
  volume: number;
  eqHigh: number;
  eqMid: number;
  eqLow: number;
  hotCues: HotCue[];
  loop: LoopState;
  isMaster: boolean;
  isReverse: boolean;
  isKeylock: boolean;
  waveformData: number[] | null;      // Float32Array → number[]
  waveformColors: number[] | null;    // Uint8Array → number[]
  cuePoint: number;
  gain: number;
}

// ─── Serialized Sampler Pad ──────────────────────────────────────────────────

export interface SerializedSamplerPad {
  id: number;
  trackId: string | null;
  trackName: string;
  color: string;
  volume: number;
  pitch: number;
  mode: 'oneshot' | 'gate' | 'toggle' | 'loop';
  waveformData: number[] | null;      // Float32Array → number[]
  keyBinding: string | null;
}

export interface SerializedSampler {
  pads: SerializedSamplerPad[];
  bank: 'A' | 'B' | 'C' | 'D';
}

// ─── Audio File Reference ────────────────────────────────────────────────────

export interface AudioFileRef {
  hash: string;       // SHA-256 hash (key in IDB audioFiles store)
  name: string;       // original filename
  size: number;       // bytes
}

// ─── Project Metadata (lightweight, for listing) ─────────────────────────────

export interface ProjectMeta {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  bpm: number;
  trackCount: number;
  clipCount: number;
}

// ─── Full Saved Project ──────────────────────────────────────────────────────

export interface SavedProject {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  appVersion: string;

  // DJ mode
  dj: {
    deckA: SerializedDeck;
    deckB: SerializedDeck;
    mixer: MixerState;
    effects: EffectState[];
    sampler: SerializedSampler;
  };

  // DAW mode (DAWProject is already JSON-serializable)
  daw: DAWProject;

  // Drum Machine
  drumMachine: DrumMachineData;

  // References to audio files stored separately in IDB
  audioFileRefs: AudioFileRef[];
}
