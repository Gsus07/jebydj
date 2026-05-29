// ─── Shared TypeScript Types ────────────────────────────────────────────────

export type DeckId = 'A' | 'B';

export interface HotCue {
  id: number;
  position: number; // seconds
  color: string;
  label: string;
}

export interface LoopState {
  inPoint: number | null;
  outPoint: number | null;
  active: boolean;
  size: number; // beats
}

export interface DeckState {
  id: DeckId;
  trackName: string;
  artistName: string;
  duration: number;
  currentTime: number;
  isPlaying: boolean;
  isLoading: boolean;
  bpm: number;
  detectedBpm: number;
  key: string;
  pitch: number; // semitones offset
  tempo: number; // percent: 1.0 = 100%
  tempoRange: 8 | 16 | 100;
  volume: number; // 0-1
  eqHigh: number; // -1 to +1 (kill at -1)
  eqMid: number;
  eqLow: number;
  hotCues: HotCue[];
  loop: LoopState;
  isMaster: boolean;
  isReverse: boolean;
  isKeylock: boolean;
  waveformData: Float32Array | null;
  waveformColors: Uint8Array | null; // RGB triplets for frequency color
  cuePoint: number;
  gain: number; // 0-2
  isMuted: boolean;
  pfIActive: boolean; // pre-fader listen
}

export interface MixerState {
  crossfaderPosition: number; // -1 (full A) to +1 (full B)
  crossfaderCurve: 'linear' | 'cut' | 'power';
  masterGain: number; // 0-2
  masterClipping: boolean;
  boothGain: number;
  cueMix: number; // 0-1 (0 = cue only, 1 = master only)
  cueGain: number; // 0-2
  isMono: boolean;
}

export type EffectType = 'reverb' | 'delay' | 'filter' | 'flanger' | 'bitcrusher' | 'phaser';
export type EffectTarget = 'A' | 'B' | 'master';

export interface EffectParam {
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  default: number;
}

export interface EffectState {
  id: string;
  type: EffectType;
  enabled: boolean;
  target: EffectTarget;
  wetDry: number; // 0-1
  params: Record<string, number>;
}

export interface SamplerPad {
  id: number;
  trackId: string | null;
  trackName: string;
  waveformData: Float32Array | null;
  color: string;
  volume: number; // 0-1
  pitch: number; // semitones -12 to +12
  mode: 'oneshot' | 'gate' | 'toggle' | 'loop';
  isPlaying: boolean;
  keyBinding: string | null;
}

export interface SamplerState {
  pads: SamplerPad[];
  bank: 'A' | 'B' | 'C' | 'D';
}

export interface Track {
  id: string;
  fileName: string;
  title: string;
  artist: string;
  bpm: number;
  key: string;
  duration: number;
  waveformData: Float32Array | null;
  waveformColors: Uint8Array | null;
  fileSize: number;
  dateAdded: number;
}

export interface LibraryState {
  tracks: Track[];
  searchQuery: string;
  bpmMin: number;
  bpmMax: number;
  filterKey: string;
  sortBy: keyof Track;
  sortDir: 'asc' | 'desc';
  selectedTrackId: string | null;
  isVisible: boolean;
}

export interface KeyboardShortcut {
  action: string;
  key: string;
  description: string;
}

export interface SettingsState {
  audioLatency: AudioContextLatencyCategory;
  crossfaderConfig: MixerState['crossfaderCurve'];
  midiEnabled: boolean;
  keyboardShortcuts: KeyboardShortcut[];
  showSettings: boolean;
}

// ─── Beatgrid ────────────────────────────────────────────────────────────────
export interface BeatgridState {
  beats: number[];  // timestamps in seconds
  edited: boolean;  // manually edited
  editing: boolean; // edit mode active
}

// ─── Slip Mode ────────────────────────────────────────────────────────────────
// Fields added directly to DeckState below

// ─── Stems ────────────────────────────────────────────────────────────────────
export type StemType = 'vocals' | 'drums' | 'bass' | 'other';

export interface StemChannel {
  type: StemType;
  volume: number;   // 0-1
  muted: boolean;
  solo: boolean;
  waveformData: Float32Array | null;
}

export interface StemState {
  ready: boolean;
  processing: boolean;
  progress: number; // 0-100
  channels: Record<StemType, StemChannel>;
  memoryBytes: number;
  expanded: boolean;
}

// ─── Session / Ghost Mode ─────────────────────────────────────────────────────
export interface SessionEvent {
  t: number;   // ms since session start
  type: 'play' | 'pause' | 'seek' | 'crossfader' | 'fader' | 'eq' |
        'effect' | 'cue' | 'loop' | 'scratch' | 'pitch' | 'hotcue';
  deck?: DeckId;
  payload: Record<string, unknown>;
}

export interface SessionState {
  recording: boolean;
  playing: boolean;
  events: SessionEvent[];
  startedAt: number; // Date.now()
  ghostSpeed: number; // 0.5 | 1 | 2
  ghostPaused: boolean;
}

// ─── Set Planner ──────────────────────────────────────────────────────────────
export interface SetlistEntry {
  trackId: string;
  order: number;
}

export interface SetlistState {
  entries: SetlistEntry[];
  isVisible: boolean;
  playingIndex: number; // which entry is currently playing
}

// ─── Practice Mode ───────────────────────────────────────────────────────────
export interface PracticeModeState {
  active: boolean;
  syncScore: number;      // 0-100
  mixTimingScore: number; // 0-100
  clashDetected: boolean;
  keyClash: boolean;
  sessionScore: number;   // overall average
  syncHistory: number[];  // ring buffer of sync scores over time
}

// ─── App State (extended) ────────────────────────────────────────────────────
export interface DJAppState {
  decks: Record<DeckId, DeckState>;
  mixer: MixerState;
  effects: EffectState[];
  sampler: SamplerState;
  library: LibraryState;
  settings: SettingsState;
  activeDeck: DeckId;
  isAudioReady: boolean;
  // beatgrids per deck
  beatgrids: Record<DeckId, BeatgridState>;
  // slip mode per deck
  slipMode: Record<DeckId, boolean>;
  slipPosition: Record<DeckId, number>;
  // stems per deck
  stems: Record<DeckId, StemState>;
  // session ghost
  session: SessionState;
  // set planner
  setlist: SetlistState;
  // practice mode
  practiceMode: PracticeModeState;
  // mobile controller
  mobileControllerActive: boolean;
}
