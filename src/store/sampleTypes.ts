// ─── Sample Library & Drum Machine Types ────────────────────────────────────

export type SampleCategory =
  | 'all' | 'favorites' | 'recent' | 'user'
  | 'kicks' | 'snares' | 'hihat' | 'cymbals' | 'toms' | 'percussion' | 'drum-loops'
  | 'bass-drops' | '808s' | 'sub-hits' | 'bass-loops'
  | 'drops' | 'rises' | 'downlifters' | 'sweeps' | 'vinyl' | 'crowd' | 'noise'
  | 'chord-loops' | 'melody-loops' | 'vocal-chops'
  | 'piano-shots' | 'synth-shots' | 'strings-shots';

export type SampleType = 'one-shot' | 'loop' | 'fx';

export interface SampleFeatures {
  spectralCentroid: number;   // 0–1 normalized (higher = brighter)
  spectralFlatness: number;   // 0–1 (higher = more noise-like)
  rms: number;                // 0–1
  zeroCrossingRate: number;   // 0–1
  attackTime: number;         // seconds to reach peak
  duration: number;
  bpm?: number;
}

export interface SampleItem {
  id: string;
  name: string;
  packId: string;
  category: SampleCategory;
  type: SampleType;
  duration: number;           // seconds
  bpm?: number;
  key?: string;
  tags: string[];
  isFavorite: boolean;
  rating: number;             // 0–5
  usageCount: number;
  lastUsedAt?: number;        // timestamp ms
  waveformData: number[];     // 200 normalized peaks 0–1
  rms: number;
  peak: number;
  notes: string;
  colorLabel: number;         // 0–7
  features?: SampleFeatures;
  createdAt: number;
}

export interface SamplePack {
  id: string;
  name: string;
  description: string;
  color: string;
  isBuiltin: boolean;
  sampleCount: number;
  importedAt: number;
}

// ─── Drum Machine ─────────────────────────────────────────────────────────────

export type StepSize = '1/8' | '1/16' | '1/32';
export type StepCount = 8 | 16 | 32 | 64;

export interface DrumStep {
  on: boolean;
  velocity: number;    // 0–127
  pitch: number;       // –24 to +24 semitones
  probability: number; // 0–100
  retrigger: number;   // 1–4
  flam: boolean;
  offset: number;      // –50 to +50 (% of step duration)
}

export interface DrumRow {
  id: string;
  name: string;
  sampleId: string | null;
  steps: DrumStep[];
  stepCount: StepCount;
  stepSize: StepSize;
  swing: number;       // 0–100, overrides global if > 0
  volume: number;      // 0–1
  pan: number;         // –1 to +1
  muted: boolean;
  soloed: boolean;
}

export interface DrumPattern {
  id: string;
  name: string;
  rows: DrumRow[];
}

export interface DrumMachineData {
  playing: boolean;
  currentStep: number;
  currentPatternId: string;
  patterns: DrumPattern[];
  globalSwing: number;   // 0–100
  chainMode: boolean;
  chainPatternIds: string[];
  chainIndex: number;
}

// ─── Filter / Sort ────────────────────────────────────────────────────────────

export type DurationRange = 'all' | 'short' | 'medium' | 'long' | 'very-long';

export interface SampleFilterState {
  search: string;
  category: SampleCategory;
  tags: string[];
  bpmMin: number;
  bpmMax: number;
  key: string | null;
  durationRange: DurationRange;
  ratingMin: number;
  favoritesOnly: boolean;
  recentDays: number | null; // null = no filter
  packId: string | null;
}

// ─── Chainer ─────────────────────────────────────────────────────────────────

export interface ChainSegment {
  sampleId: string;
  startOffset: number;    // seconds
  duration: number;       // seconds (0 = use full)
  gap: number;            // silence after, seconds
  crossfade: number;      // seconds overlap with next
}

export const DEFAULT_FILTER: SampleFilterState = {
  search: '',
  category: 'all',
  tags: [],
  bpmMin: 0,
  bpmMax: 999,
  key: null,
  durationRange: 'all',
  ratingMin: 0,
  favoritesOnly: false,
  recentDays: null,
  packId: null,
};
