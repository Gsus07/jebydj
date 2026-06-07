// ─── DAW TypeScript Types ─────────────────────────────────────────────────────

export type TrackType = 'audio' | 'midi' | 'return' | 'master' | 'group' | 'automation';
export type TrackHeight = 'compact' | 'normal' | 'tall' | 'extra';
export type DAWTool = 'select' | 'split' | 'draw' | 'erase' | 'zoom' | 'stretch' | 'pencil' | 'eraser' | 'slice';
export type DAWView = 'arrangement' | 'session';
export type PluginType =
  | 'eq8' | 'compressor' | 'limiter' | 'transientShaper'
  | 'saturator' | 'chorus' | 'gate' | 'pitchCorrector' | 'stereoWidener';
export type InstrumentType = 'basicSynth' | 'fmSynth' | 'sampler' | 'drumMachine';
export type SegmentType = 'linear' | 'exponential' | 'logarithmic' | 'hold' | 'sine';
export type StretchMode = 'elastique' | 'simple';
export type RecordMode = 'latch' | 'touch' | 'write';
export type FollowAction = 'none' | 'next' | 'previous' | 'first' | 'last' | 'random' | 'any' | 'jump';

// ─── Armed Sample (click-to-insert mode) ──────────────────────────────────────

export interface ArmedSampleData {
  id: string;
  name: string;
  duration: number;       // seconds
  color: string;
  category: string;
  waveformData: number[];
}
export type ExportFormat = 'wav' | 'mp3' | 'ogg' | 'flac';
export type BitDepth = 16 | 24 | 32;
export type ExportChannels = 'stereo' | 'mono' | 'stems';

// ─── MIDI ─────────────────────────────────────────────────────────────────────

export interface MIDINote {
  id: string;
  pitch: number;        // 0–127
  startBeat: number;    // relative to clip start, in beats
  durationBeats: number;
  velocity: number;     // 0–127
  probability: number;  // 0–100
  muted?: boolean;
}

// ─── Automation ───────────────────────────────────────────────────────────────

export interface AutomationPoint {
  id: string;
  beat: number;
  value: number;        // normalized 0–1
  segmentType: SegmentType;
}

export interface AutomationLane {
  id: string;
  trackId: string;
  paramId: string;
  paramName: string;
  minValue: number;
  maxValue: number;
  defaultValue: number;
  points: AutomationPoint[];
  visible: boolean;
  expanded: boolean;
}

// ─── Clips ────────────────────────────────────────────────────────────────────

export interface DAWClip {
  id: string;
  trackId: string;
  startBeat: number;
  durationBeats: number;
  type: 'audio' | 'midi' | 'pattern';
  name: string;
  color?: string;
  gainDb: number;
  pitch: number;        // semitones
  fadeInBeats: number;
  fadeOutBeats: number;
  reversed: boolean;
  // Audio
  audioFileId?: string;
  waveformData: number[];   // downsampled peak data (serializable)
  timeStretchRatio: number;
  stretchMode: StretchMode;
  loopEnabled: boolean;
  loopStartBeats: number;
  loopEndBeats: number;
  // MIDI
  notes: MIDINote[];
  // Pattern (Channel Rack)
  patternId?: string;
  // Clip Launcher
  followAction: FollowAction;
  followActionTarget: number;
  launchQuantizationBeats: number; // 0 = use global
  // Live state (not persisted)
  isLaunching: boolean;
  isPlaying: boolean;
}

// ─── Plugins ──────────────────────────────────────────────────────────────────

export interface EQ8Band {
  type: 'highpass' | 'lowshelf' | 'peaking' | 'highshelf' | 'lowpass';
  frequency: number;
  gain: number;
  q: number;
  enabled: boolean;
}

export interface EQ8Params   { bands: EQ8Band[] }
export interface CompressorParams {
  threshold: number; ratio: number; attack: number; release: number;
  knee: number; makeupGain: number; lookahead: number;
  mode: 'rms' | 'peak'; sidechainTrackId: string;
}
export interface LimiterParams   { ceiling: number; release: number; lookahead: number }
export interface TransientShaperParams { attack: number; sustain: number; outputGain: number }
export interface SaturatorParams {
  mode: 'tape' | 'tube' | 'clip' | 'fold' | 'bitcrush';
  drive: number; tone: number; mix: number; preGain: number; postGain: number;
}
export interface ChorusParams  { voices: 2 | 3 | 4; rate: number; depth: number; delay: number; spread: number }
export interface GateParams    { threshold: number; attack: number; hold: number; release: number; range: number; hysteresis: number }
export interface PitchCorrectorParams {
  scale: 'chromatic' | 'custom'; key: string; mode: 'major' | 'minor';
  speed: number; retuneSpeed: number; transpose: number;
}
export interface StereoWidenerParams { width: number; cutoffFreq: number }

export type PluginParamsMap = {
  eq8: EQ8Params;
  compressor: CompressorParams;
  limiter: LimiterParams;
  transientShaper: TransientShaperParams;
  saturator: SaturatorParams;
  chorus: ChorusParams;
  gate: GateParams;
  pitchCorrector: PitchCorrectorParams;
  stereoWidener: StereoWidenerParams;
};

export interface DAWPlugin<T extends PluginType = PluginType> {
  id: string;
  type: T;
  enabled: boolean;
  params: PluginParamsMap[T];
}

// ─── Tracks ───────────────────────────────────────────────────────────────────

export interface DAWTrack {
  id: string;
  name: string;
  type: TrackType;
  color: string;
  height: TrackHeight;
  muted: boolean;
  soloed: boolean;
  armed: boolean;
  locked: boolean;
  volume: number;   // 0–2
  pan: number;      // -1 to 1
  clips: DAWClip[];
  automationLanes: AutomationLane[];
  plugins: DAWPlugin[];
  instrument: InstrumentType;
  groupId?: string;
  sendLevels: Record<string, number>;
  vuLevel: number;
  peakLevel: number;
  collapsed: boolean;
}

// ─── Scenes (Session View) ─────────────────────────────────────────────────

export interface SceneRow {
  id: string;
  name: string;
  bpmOverride?: number;
  color?: string;
}

// ─── Project ──────────────────────────────────────────────────────────────────

export interface DAWProject {
  id: string;
  name: string;
  bpm: number;
  timeSignatureNum: number;
  timeSignatureDen: number;
  swing: number;       // 0–100
  totalBeats: number;
  tracks: DAWTrack[];
  scenes: SceneRow[];
  loopStart: number;
  loopEnd: number;
  loopEnabled: boolean;
  masterPlugins: DAWPlugin[];
  returnTrackIds: string[];
  version: number;
  createdAt: number;
  modifiedAt: number;
}

// ─── History ──────────────────────────────────────────────────────────────────

export interface HistoryEntry {
  description: string;
  snapshot: DAWProject;
}

// ─── Export ───────────────────────────────────────────────────────────────────

export interface ExportOptions {
  format: ExportFormat;
  sampleRate: 44100 | 48000 | 88200 | 96000;
  bitDepth: BitDepth;
  channels: ExportChannels;
  normalize: boolean;
  normTargetDb?: number;
  includeMasterPlugins?: boolean;
  dither?: 'none' | 'triangular' | 'tpdf';
  rangeStart?: number;  // beats (legacy)
  rangeEnd?: number;
  startBeat?: number;
  endBeat?: number;
  kbps?: number;
}

// ─── Store State ──────────────────────────────────────────────────────────────

export interface DAWState {
  project: DAWProject;
  // Transport
  isPlaying: boolean;
  isRecording: boolean;
  positionBeats: number;
  // View
  view: DAWView;
  zoom: number;           // pixels per beat
  scrollX: number;
  scrollY: number;
  selectedClipIds: string[];
  selectedTrackIds: string[];
  activeTool: DAWTool;
  snapEnabled: boolean;
  snapSubdivision: number;  // beats (0.25 = 1/16th note in 4/4)
  // Piano Roll
  pianoRollOpen: boolean;
  pianoRollClipId: string | null;
  pianoRollZoom: number;
  pianoRollScrollX: number;
  pianoRollScrollY: number;
  selectedNoteIds: string[];
  pianoRollSnapSubdivision: number;
  // Mixer
  mixerOpen: boolean;
  // Sample Editor
  sampleEditorOpen: boolean;
  sampleEditorClipId: string | null;
  // Undo/Redo
  undoStack: HistoryEntry[];
  redoStack: HistoryEntry[];
  // UI
  showExportModal: boolean;
  showProjectManager: boolean;
  hasUnsavedChanges: boolean;
  // Metronome
  metronomeEnabled: boolean;
  metronomeVolume: number;
  // Recording
  recordMode: RecordMode;
  punchIn: number | null;
  punchOut: number | null;
  // Session view
  launchQuantizationBeats: number;
  activeSessionClips: Record<string, string>;  // trackId -> clipId
  // Plugin editor
  activePluginTrackId: string | null;
  activePluginId: string | null;
  // Performance
  cpuLoad: number;
  // Armed sample (click-to-insert mode)
  armedSample: ArmedSampleData | null;
  sampleShortcuts: Record<number, string>; // 1–9 → sampleId
}
