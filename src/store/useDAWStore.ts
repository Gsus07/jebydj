import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type {
  DAWState, DAWProject, DAWTrack, DAWClip, MIDINote,
  AutomationLane, AutomationPoint, DAWPlugin, SceneRow,
  TrackType, TrackHeight, DAWTool, DAWView, PluginType,
  InstrumentType, HistoryEntry, ExportOptions, SegmentType,
  EQ8Band, PluginParamsMap, RecordMode, ArmedSampleData,
} from './dawTypes';

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function uid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

const TRACK_COLORS = [
  '#00f5ff', '#ff006e', '#ffbe0b', '#8338ec', '#06d6a0',
  '#ff6a00', '#3a86ff', '#fb5607', '#8ac926', '#ff595e',
  '#6a4c93', '#1982c4',
];

function defaultTrackColor(index: number): string {
  return TRACK_COLORS[index % TRACK_COLORS.length];
}

function createDefaultEQ8(): DAWPlugin<'eq8'> {
  const bands: EQ8Band[] = [
    { type: 'highpass',   frequency: 80,    gain: 0,  q: 0.707, enabled: true },
    { type: 'lowshelf',   frequency: 120,   gain: 0,  q: 0.707, enabled: true },
    { type: 'peaking',    frequency: 300,   gain: 0,  q: 1.0,   enabled: true },
    { type: 'peaking',    frequency: 800,   gain: 0,  q: 1.0,   enabled: true },
    { type: 'peaking',    frequency: 2000,  gain: 0,  q: 1.0,   enabled: true },
    { type: 'peaking',    frequency: 5000,  gain: 0,  q: 1.0,   enabled: true },
    { type: 'highshelf',  frequency: 10000, gain: 0,  q: 0.707, enabled: true },
    { type: 'lowpass',    frequency: 20000, gain: 0,  q: 0.707, enabled: true },
  ];
  return { id: uid(), type: 'eq8', enabled: false, params: { bands } };
}

function createDefaultTrack(
  name: string,
  type: TrackType,
  index: number,
): DAWTrack {
  return {
    id: uid(),
    name,
    type,
    color: defaultTrackColor(index),
    height: 'normal',
    muted: false,
    soloed: false,
    armed: false,
    locked: false,
    volume: 1.0,
    pan: 0,
    clips: [],
    automationLanes: [],
    plugins: [createDefaultEQ8()],
    instrument: 'basicSynth',
    sendLevels: {},
    vuLevel: 0,
    peakLevel: 0,
    collapsed: false,
  };
}

function createDefaultProject(): DAWProject {
  const masterTrack = createDefaultTrack('Master', 'master', 99);
  return {
    id: uid(),
    name: 'New Project',
    bpm: 120,
    timeSignatureNum: 4,
    timeSignatureDen: 4,
    swing: 0,
    totalBeats: 256,
    tracks: [
      createDefaultTrack('Audio 1', 'audio', 0),
      createDefaultTrack('Audio 2', 'audio', 1),
      createDefaultTrack('MIDI 1',  'midi',  2),
    ],
    scenes: [
      { id: uid(), name: 'Scene 1' },
      { id: uid(), name: 'Scene 2' },
      { id: uid(), name: 'Scene 3' },
      { id: uid(), name: 'Scene 4' },
    ],
    loopStart: 0,
    loopEnd: 16,
    loopEnabled: false,
    masterPlugins: masterTrack.plugins,
    returnTrackIds: [],
    version: 1,
    createdAt: Date.now(),
    modifiedAt: Date.now(),
  };
}

function defaultClip(trackId: string, startBeat: number, type: 'audio' | 'midi'): DAWClip {
  return {
    id: uid(),
    trackId,
    startBeat,
    durationBeats: 8,
    type,
    name: type === 'audio' ? 'Audio Clip' : 'MIDI Clip',
    gainDb: 0,
    pitch: 0,
    fadeInBeats: 0,
    fadeOutBeats: 0,
    reversed: false,
    waveformData: [],
    timeStretchRatio: 1.0,
    stretchMode: 'simple',
    loopEnabled: false,
    loopStartBeats: 0,
    loopEndBeats: 8,
    notes: [],
    followAction: 'none',
    followActionTarget: 0,
    launchQuantizationBeats: 0,
    isLaunching: false,
    isPlaying: false,
  };
}

// ─── Store Interface ──────────────────────────────────────────────────────────

export interface DAWStore extends DAWState {
  // Transport
  setPlaying: (v: boolean) => void;
  setRecording: (v: boolean) => void;
  setPositionBeats: (b: number) => void;
  toggleLoop: () => void;
  setLoopRegion: (start: number, end: number) => void;
  setBpm: (bpm: number) => void;
  setTimeSignature: (num: number, den: number) => void;
  setSwing: (swing: number) => void;
  setMetronome: (enabled: boolean) => void;
  setMetronomeVolume: (v: number) => void;
  // View
  setView: (v: DAWView) => void;
  setZoom: (z: number) => void;
  setScrollX: (x: number) => void;
  setScrollY: (y: number) => void;
  setActiveTool: (t: DAWTool) => void;
  setSnapEnabled: (v: boolean) => void;
  setSnapSubdivision: (v: number) => void;
  // Tracks
  addTrack: (type: TrackType) => string;
  removeTrack: (id: string) => void;
  updateTrack: (id: string, patch: Partial<Omit<DAWTrack, 'id' | 'clips' | 'automationLanes' | 'plugins'>>) => void;
  setTrackHeight: (id: string, height: TrackHeight) => void;
  setTrackMute: (id: string, v: boolean) => void;
  setTrackSolo: (id: string, v: boolean) => void;
  setTrackArmed: (id: string, v: boolean) => void;
  setTrackVolume: (id: string, v: number) => void;
  setTrackPan: (id: string, v: number) => void;
  setTrackVU: (id: string, vu: number, peak: number) => void;
  reorderTracks: (from: number, to: number) => void;
  // Clips
  addClip: (trackId: string, startBeat: number, type: 'audio' | 'midi') => string;
  addAudioClip: (trackId: string, startBeat: number, durationBeats: number, name: string, audioFileId: string, waveformData: number[]) => string;
  removeClip: (clipId: string) => void;
  updateClip: (clipId: string, patch: Partial<DAWClip>) => void;
  moveClip: (clipId: string, newTrackId: string, newStartBeat: number) => void;
  moveClips: (moves: Array<{ clipId: string; newTrackId: string; newStartBeat: number }>) => void;
  resizeClip: (clipId: string, newStartBeat: number, newDurationBeats: number) => void;
  splitClip: (clipId: string, atBeat: number) => void;
  duplicateClip: (clipId: string) => string;
  setClipWaveform: (clipId: string, data: number[]) => void;
  selectClips: (ids: string[]) => void;
  selectTracks: (ids: string[]) => void;
  // MIDI Notes
  addNote: (clipId: string, note: Omit<MIDINote, 'id'>) => string;
  removeNote: (clipId: string, noteId: string) => void;
  updateNote: (clipId: string, noteId: string, patch: Partial<MIDINote>) => void;
  selectNotes: (ids: string[]) => void;
  quantizeNotes: (clipId: string, noteIds: string[], subdivision: number) => void;
  // Automation
  addAutomationLane: (trackId: string, paramId: string, paramName: string, min: number, max: number, def: number) => string;
  removeAutomationLane: (laneId: string) => void;
  addAutomationPoint: (laneId: string, beat: number, value: number) => string;
  removeAutomationPoint: (laneId: string, pointId: string) => void;
  updateAutomationPoint: (laneId: string, pointId: string, patch: Partial<AutomationPoint>) => void;
  setLaneExpanded: (laneId: string, v: boolean) => void;
  // Plugins
  addPlugin: (trackId: string, type: PluginType) => string;
  removePlugin: (trackId: string, pluginId: string) => void;
  togglePlugin: (trackId: string, pluginId: string) => void;
  updatePluginParams: <T extends PluginType>(trackId: string, pluginId: string, params: Partial<PluginParamsMap[T]>) => void;
  setActivePlugin: (trackId: string | null, pluginId: string | null) => void;
  // Scenes
  addScene: () => string;
  removeScene: (id: string) => void;
  updateScene: (id: string, patch: Partial<SceneRow>) => void;
  setSceneClip: (sceneId: string, trackId: string, clipId: string | null) => void;
  setActiveSessionClip: (trackId: string, clipId: string | null) => void;
  setLaunchQuantization: (beats: number) => void;
  // Piano Roll
  setPianoRollOpen: (open: boolean, clipId?: string) => void;
  setPianoRollZoom: (z: number) => void;
  setPianoRollScroll: (x: number, y: number) => void;
  setPianoRollSnap: (v: number) => void;
  // UI
  setMixerOpen: (v: boolean) => void;
  setSampleEditorOpen: (open: boolean, clipId?: string) => void;
  setShowExport: (v: boolean) => void;
  setShowProjectManager: (v: boolean) => void;
  setHasUnsavedChanges: (v: boolean) => void;
  setCpuLoad: (v: number) => void;
  setRecordMode: (m: RecordMode) => void;
  // History
  pushHistory: (description: string) => void;
  undo: () => void;
  redo: () => void;
  // Project
  newProject: () => void;
  loadProject: (project: DAWProject) => void;
  setProjectName: (name: string) => void;
  // Deck → DAW integration
  importDeckTrack: (name: string, audioFileId: string, waveformData: number[], durationBeats: number) => void;
  // Armed sample (click-to-insert)
  armSample: (sample: ArmedSampleData) => void;
  disarmSample: () => void;
  setSampleShortcut: (key: number, sampleId: string) => void;
}

// ─── Initial State ────────────────────────────────────────────────────────────

const initialState: DAWState = {
  project: createDefaultProject(),
  isPlaying: false,
  isRecording: false,
  positionBeats: 0,
  view: 'arrangement',
  zoom: 60,   // pixels per beat
  scrollX: 0,
  scrollY: 0,
  selectedClipIds: [],
  selectedTrackIds: [],
  activeTool: 'select',
  snapEnabled: true,
  snapSubdivision: 1,
  pianoRollOpen: false,
  pianoRollClipId: null,
  pianoRollZoom: 80,
  pianoRollScrollX: 0,
  pianoRollScrollY: 400,
  selectedNoteIds: [],
  pianoRollSnapSubdivision: 0.25,
  mixerOpen: false,
  sampleEditorOpen: false,
  sampleEditorClipId: null,
  undoStack: [],
  redoStack: [],
  showExportModal: false,
  showProjectManager: false,
  hasUnsavedChanges: false,
  metronomeEnabled: false,
  metronomeVolume: 0.7,
  recordMode: 'latch',
  punchIn: null,
  punchOut: null,
  launchQuantizationBeats: 4,
  activeSessionClips: {},
  activePluginTrackId: null,
  activePluginId: null,
  cpuLoad: 0,
  armedSample: null,
  sampleShortcuts: {},
};

// ─── Store ────────────────────────────────────────────────────────────────────

export const useDAWStore = create<DAWStore>()(
  immer((set, get) => ({
    ...initialState,

    // ── Transport ────────────────────────────────────────────────────────────
    setPlaying: (v) => set((s) => { s.isPlaying = v; }),
    setRecording: (v) => set((s) => { s.isRecording = v; }),
    setPositionBeats: (b) => set((s) => { s.positionBeats = b; }),
    toggleLoop: () => set((s) => { s.project.loopEnabled = !s.project.loopEnabled; }),
    setLoopRegion: (start, end) => set((s) => {
      s.project.loopStart = start; s.project.loopEnd = end;
    }),
    setBpm: (bpm) => set((s) => { s.project.bpm = Math.max(20, Math.min(300, bpm)); s.project.modifiedAt = Date.now(); s.hasUnsavedChanges = true; }),
    setTimeSignature: (num, den) => set((s) => { s.project.timeSignatureNum = num; s.project.timeSignatureDen = den; s.hasUnsavedChanges = true; }),
    setSwing: (swing) => set((s) => { s.project.swing = swing; }),
    setMetronome: (enabled) => set((s) => { s.metronomeEnabled = enabled; }),
    setMetronomeVolume: (v) => set((s) => { s.metronomeVolume = v; }),

    // ── View ─────────────────────────────────────────────────────────────────
    setView: (v) => set((s) => { s.view = v; }),
    setZoom: (z) => set((s) => { s.zoom = Math.max(8, Math.min(400, z)); }),
    setScrollX: (x) => set((s) => { s.scrollX = Math.max(0, x); }),
    setScrollY: (y) => set((s) => { s.scrollY = Math.max(0, y); }),
    setActiveTool: (t) => set((s) => { s.activeTool = t; }),
    setSnapEnabled: (v) => set((s) => { s.snapEnabled = v; }),
    setSnapSubdivision: (v) => set((s) => { s.snapSubdivision = v; }),

    // ── Tracks ───────────────────────────────────────────────────────────────
    addTrack: (type) => {
      const id = uid();
      set((s) => {
        const index = s.project.tracks.length;
        const track = createDefaultTrack(`${type.charAt(0).toUpperCase()}${type.slice(1)} ${index + 1}`, type, index);
        (track as DAWTrack & { id: string }).id = id;
        s.project.tracks.push(track);
        s.hasUnsavedChanges = true;
      });
      return id;
    },
    removeTrack: (id) => set((s) => {
      s.project.tracks = s.project.tracks.filter((t) => t.id !== id);
      s.hasUnsavedChanges = true;
    }),
    updateTrack: (id, patch) => set((s) => {
      const t = s.project.tracks.find((x) => x.id === id);
      if (t) Object.assign(t, patch);
      s.hasUnsavedChanges = true;
    }),
    setTrackHeight: (id, height) => set((s) => {
      const t = s.project.tracks.find((x) => x.id === id);
      if (t) t.height = height;
    }),
    setTrackMute: (id, v) => set((s) => {
      const t = s.project.tracks.find((x) => x.id === id);
      if (t) t.muted = v;
    }),
    setTrackSolo: (id, v) => set((s) => {
      const t = s.project.tracks.find((x) => x.id === id);
      if (t) t.soloed = v;
    }),
    setTrackArmed: (id, v) => set((s) => {
      const t = s.project.tracks.find((x) => x.id === id);
      if (t) t.armed = v;
    }),
    setTrackVolume: (id, v) => set((s) => {
      const t = s.project.tracks.find((x) => x.id === id);
      if (t) t.volume = Math.max(0, Math.min(2, v));
    }),
    setTrackPan: (id, v) => set((s) => {
      const t = s.project.tracks.find((x) => x.id === id);
      if (t) t.pan = Math.max(-1, Math.min(1, v));
    }),
    setTrackVU: (id, vu, peak) => set((s) => {
      const t = s.project.tracks.find((x) => x.id === id);
      if (t) { t.vuLevel = vu; t.peakLevel = peak; }
    }),
    reorderTracks: (from, to) => set((s) => {
      const [t] = s.project.tracks.splice(from, 1);
      s.project.tracks.splice(to, 0, t);
      s.hasUnsavedChanges = true;
    }),

    // ── Clips ────────────────────────────────────────────────────────────────
    addClip: (trackId, startBeat, type) => {
      const id = uid();
      set((s) => {
        const track = s.project.tracks.find((t) => t.id === trackId);
        if (!track) return;
        const clip = defaultClip(trackId, startBeat, type);
        (clip as DAWClip & { id: string }).id = id;
        track.clips.push(clip);
        s.hasUnsavedChanges = true;
      });
      return id;
    },
    addAudioClip: (trackId, startBeat, durationBeats, name, audioFileId, waveformData) => {
      const id = uid();
      set((s) => {
        const track = s.project.tracks.find((t) => t.id === trackId);
        if (!track) return;
        const clip = defaultClip(trackId, startBeat, 'audio');
        (clip as DAWClip & { id: string }).id = id;
        clip.durationBeats = durationBeats;
        clip.name = name;
        clip.audioFileId = audioFileId;
        clip.waveformData = waveformData;
        track.clips.push(clip);
        s.hasUnsavedChanges = true;
      });
      return id;
    },
    removeClip: (clipId) => set((s) => {
      for (const track of s.project.tracks) {
        const idx = track.clips.findIndex((c) => c.id === clipId);
        if (idx !== -1) { track.clips.splice(idx, 1); break; }
      }
      s.selectedClipIds = s.selectedClipIds.filter((id) => id !== clipId);
      s.hasUnsavedChanges = true;
    }),
    updateClip: (clipId, patch) => set((s) => {
      for (const track of s.project.tracks) {
        const clip = track.clips.find((c) => c.id === clipId);
        if (clip) { Object.assign(clip, patch); break; }
      }
      s.hasUnsavedChanges = true;
    }),
    moveClip: (clipId, newTrackId, newStartBeat) => set((s) => {
      let found: DAWClip | undefined;
      for (const track of s.project.tracks) {
        const idx = track.clips.findIndex((c) => c.id === clipId);
        if (idx !== -1) { [found] = track.clips.splice(idx, 1); break; }
      }
      if (!found) return;
      found.startBeat = newStartBeat;
      found.trackId = newTrackId;
      const newTrack = s.project.tracks.find((t) => t.id === newTrackId);
      if (newTrack) newTrack.clips.push(found);
      s.hasUnsavedChanges = true;
    }),
    moveClips: (moves) => set((s) => {
      for (const { clipId, newTrackId, newStartBeat } of moves) {
        let found: DAWClip | undefined;
        for (const track of s.project.tracks) {
          const idx = track.clips.findIndex((c) => c.id === clipId);
          if (idx !== -1) { [found] = track.clips.splice(idx, 1); break; }
        }
        if (!found) continue;
        found.startBeat = Math.max(0, newStartBeat);
        found.trackId = newTrackId;
        const dest = s.project.tracks.find((t) => t.id === newTrackId);
        if (dest) dest.clips.push(found);
      }
      s.hasUnsavedChanges = true;
    }),
    resizeClip: (clipId, newStartBeat, newDurationBeats) => set((s) => {
      for (const track of s.project.tracks) {
        const clip = track.clips.find((c) => c.id === clipId);
        if (clip) {
          clip.startBeat = Math.max(0, newStartBeat);
          clip.durationBeats = Math.max(0.125, newDurationBeats);
          break;
        }
      }
      s.hasUnsavedChanges = true;
    }),
    splitClip: (clipId, atBeat) => set((s) => {
      for (const track of s.project.tracks) {
        const clip = track.clips.find((c) => c.id === clipId);
        if (!clip) continue;
        if (atBeat <= clip.startBeat || atBeat >= clip.startBeat + clip.durationBeats) break;
        const rightClip: DAWClip = {
          ...clip,
          id: uid(),
          startBeat: atBeat,
          durationBeats: clip.startBeat + clip.durationBeats - atBeat,
          notes: clip.notes
            .filter((n) => n.startBeat >= atBeat - clip.startBeat)
            .map((n) => ({ ...n, startBeat: n.startBeat - (atBeat - clip.startBeat) })),
        };
        clip.durationBeats = atBeat - clip.startBeat;
        clip.notes = clip.notes.filter((n) => n.startBeat < atBeat - clip.startBeat);
        track.clips.push(rightClip);
        s.hasUnsavedChanges = true;
        break;
      }
    }),
    duplicateClip: (clipId) => {
      const id = uid();
      set((s) => {
        for (const track of s.project.tracks) {
          const clip = track.clips.find((c) => c.id === clipId);
          if (!clip) continue;
          const dup: DAWClip = { ...clip, id, startBeat: clip.startBeat + clip.durationBeats };
          track.clips.push(dup);
          s.hasUnsavedChanges = true;
          break;
        }
      });
      return id;
    },
    setClipWaveform: (clipId, data) => set((s) => {
      for (const track of s.project.tracks) {
        const clip = track.clips.find((c) => c.id === clipId);
        if (clip) { clip.waveformData = data; break; }
      }
    }),
    selectClips: (ids) => set((s) => { s.selectedClipIds = ids; }),
    selectTracks: (ids) => set((s) => { s.selectedTrackIds = ids; }),

    // ── MIDI Notes ───────────────────────────────────────────────────────────
    addNote: (clipId, note) => {
      const id = uid();
      set((s) => {
        for (const track of s.project.tracks) {
          const clip = track.clips.find((c) => c.id === clipId);
          if (clip) { clip.notes.push({ ...note, id }); break; }
        }
        s.hasUnsavedChanges = true;
      });
      return id;
    },
    removeNote: (clipId, noteId) => set((s) => {
      for (const track of s.project.tracks) {
        const clip = track.clips.find((c) => c.id === clipId);
        if (clip) { clip.notes = clip.notes.filter((n) => n.id !== noteId); break; }
      }
      s.hasUnsavedChanges = true;
    }),
    updateNote: (clipId, noteId, patch) => set((s) => {
      for (const track of s.project.tracks) {
        const clip = track.clips.find((c) => c.id === clipId);
        if (!clip) continue;
        const note = clip.notes.find((n) => n.id === noteId);
        if (note) { Object.assign(note, patch); break; }
      }
      s.hasUnsavedChanges = true;
    }),
    selectNotes: (ids) => set((s) => { s.selectedNoteIds = ids; }),
    quantizeNotes: (clipId, noteIds, subdivision) => set((s) => {
      for (const track of s.project.tracks) {
        const clip = track.clips.find((c) => c.id === clipId);
        if (!clip) continue;
        for (const note of clip.notes) {
          if (!noteIds.includes(note.id)) continue;
          note.startBeat = Math.round(note.startBeat / subdivision) * subdivision;
        }
        break;
      }
      s.hasUnsavedChanges = true;
    }),

    // ── Automation ───────────────────────────────────────────────────────────
    addAutomationLane: (trackId, paramId, paramName, min, max, def) => {
      const id = uid();
      set((s) => {
        const track = s.project.tracks.find((t) => t.id === trackId);
        if (!track) return;
        track.automationLanes.push({ id, trackId, paramId, paramName, minValue: min, maxValue: max, defaultValue: def, points: [], visible: true, expanded: true });
        s.hasUnsavedChanges = true;
      });
      return id;
    },
    removeAutomationLane: (laneId) => set((s) => {
      for (const track of s.project.tracks) {
        const idx = track.automationLanes.findIndex((l) => l.id === laneId);
        if (idx !== -1) { track.automationLanes.splice(idx, 1); break; }
      }
      s.hasUnsavedChanges = true;
    }),
    addAutomationPoint: (laneId, beat, value) => {
      const id = uid();
      set((s) => {
        for (const track of s.project.tracks) {
          const lane = track.automationLanes.find((l) => l.id === laneId);
          if (!lane) continue;
          lane.points.push({ id, beat, value, segmentType: 'linear' });
          lane.points.sort((a, b) => a.beat - b.beat);
          break;
        }
        s.hasUnsavedChanges = true;
      });
      return id;
    },
    removeAutomationPoint: (laneId, pointId) => set((s) => {
      for (const track of s.project.tracks) {
        const lane = track.automationLanes.find((l) => l.id === laneId);
        if (lane) { lane.points = lane.points.filter((p) => p.id !== pointId); break; }
      }
      s.hasUnsavedChanges = true;
    }),
    updateAutomationPoint: (laneId, pointId, patch) => set((s) => {
      for (const track of s.project.tracks) {
        const lane = track.automationLanes.find((l) => l.id === laneId);
        if (!lane) continue;
        const pt = lane.points.find((p) => p.id === pointId);
        if (pt) { Object.assign(pt, patch); lane.points.sort((a, b) => a.beat - b.beat); break; }
      }
      s.hasUnsavedChanges = true;
    }),
    setLaneExpanded: (laneId, v) => set((s) => {
      for (const track of s.project.tracks) {
        const lane = track.automationLanes.find((l) => l.id === laneId);
        if (lane) { lane.expanded = v; break; }
      }
    }),

    // ── Plugins ──────────────────────────────────────────────────────────────
    addPlugin: (trackId, type) => {
      const id = uid();
      set((s) => {
        const track = s.project.tracks.find((t) => t.id === trackId);
        if (!track) return;
        const plugin = createDefaultEQ8();
        (plugin as DAWPlugin & { id: string; type: PluginType }).id = id;
        (plugin as DAWPlugin & { id: string; type: PluginType }).type = type;
        track.plugins.push(plugin as DAWPlugin);
        s.hasUnsavedChanges = true;
      });
      return id;
    },
    removePlugin: (trackId, pluginId) => set((s) => {
      const track = s.project.tracks.find((t) => t.id === trackId);
      if (track) track.plugins = track.plugins.filter((p) => p.id !== pluginId);
      s.hasUnsavedChanges = true;
    }),
    togglePlugin: (trackId, pluginId) => set((s) => {
      const track = s.project.tracks.find((t) => t.id === trackId);
      if (!track) return;
      const plugin = track.plugins.find((p) => p.id === pluginId);
      if (plugin) plugin.enabled = !plugin.enabled;
    }),
    updatePluginParams: (trackId, pluginId, params) => set((s) => {
      const track = s.project.tracks.find((t) => t.id === trackId);
      if (!track) return;
      const plugin = track.plugins.find((p) => p.id === pluginId);
      if (plugin) Object.assign(plugin.params, params);
      s.hasUnsavedChanges = true;
    }),
    setActivePlugin: (trackId, pluginId) => set((s) => {
      s.activePluginTrackId = trackId;
      s.activePluginId = pluginId;
    }),

    // ── Scenes ───────────────────────────────────────────────────────────────
    addScene: () => {
      const id = uid();
      set((s) => {
        s.project.scenes.push({ id, name: `Scene ${s.project.scenes.length + 1}` });
        s.hasUnsavedChanges = true;
      });
      return id;
    },
    removeScene: (id) => set((s) => {
      s.project.scenes = s.project.scenes.filter((sc) => sc.id !== id);
      s.hasUnsavedChanges = true;
    }),
    updateScene: (id, patch) => set((s) => {
      const scene = s.project.scenes.find((sc) => sc.id === id);
      if (scene) Object.assign(scene, patch);
    }),
    setSceneClip: () => { /* session view clip assignment */ },
    setActiveSessionClip: (trackId, clipId) => set((s) => {
      if (clipId === null) {
        delete s.activeSessionClips[trackId];
      } else {
        s.activeSessionClips[trackId] = clipId;
      }
    }),
    setLaunchQuantization: (beats) => set((s) => { s.launchQuantizationBeats = beats; }),

    // ── Piano Roll ───────────────────────────────────────────────────────────
    setPianoRollOpen: (open, clipId) => set((s) => {
      s.pianoRollOpen = open;
      if (clipId !== undefined) s.pianoRollClipId = clipId;
      if (!open) s.pianoRollClipId = null;
    }),
    setPianoRollZoom: (z) => set((s) => { s.pianoRollZoom = Math.max(20, Math.min(200, z)); }),
    setPianoRollScroll: (x, y) => set((s) => { s.pianoRollScrollX = x; s.pianoRollScrollY = y; }),
    setPianoRollSnap: (v) => set((s) => { s.pianoRollSnapSubdivision = v; }),

    // ── UI ───────────────────────────────────────────────────────────────────
    setMixerOpen: (v) => set((s) => { s.mixerOpen = v; }),
    setSampleEditorOpen: (open, clipId) => set((s) => {
      s.sampleEditorOpen = open;
      if (clipId !== undefined) s.sampleEditorClipId = clipId;
      if (!open) s.sampleEditorClipId = null;
    }),
    setShowExport: (v) => set((s) => { s.showExportModal = v; }),
    setShowProjectManager: (v) => set((s) => { s.showProjectManager = v; }),
    setHasUnsavedChanges: (v) => set((s) => { s.hasUnsavedChanges = v; }),
    setCpuLoad: (v) => set((s) => { s.cpuLoad = v; }),
    setRecordMode: (m) => set((s) => { s.recordMode = m; }),

    // ── History ──────────────────────────────────────────────────────────────
    pushHistory: (description) => set((s) => {
      // Deep clone the project for snapshot
      const snapshot = JSON.parse(JSON.stringify(s.project)) as DAWProject;
      s.undoStack.push({ description, snapshot });
      if (s.undoStack.length > 100) s.undoStack.shift();
      s.redoStack = [];
    }),
    undo: () => set((s) => {
      if (s.undoStack.length === 0) return;
      const entry = s.undoStack.pop()!;
      const currentSnapshot = JSON.parse(JSON.stringify(s.project)) as DAWProject;
      s.redoStack.push({ description: entry.description, snapshot: currentSnapshot });
      s.project = entry.snapshot;
      s.hasUnsavedChanges = true;
    }),
    redo: () => set((s) => {
      if (s.redoStack.length === 0) return;
      const entry = s.redoStack.pop()!;
      const currentSnapshot = JSON.parse(JSON.stringify(s.project)) as DAWProject;
      s.undoStack.push({ description: entry.description, snapshot: currentSnapshot });
      s.project = entry.snapshot;
      s.hasUnsavedChanges = true;
    }),

    // ── Project ──────────────────────────────────────────────────────────────
    newProject: () => set((s) => {
      s.project = createDefaultProject();
      s.positionBeats = 0;
      s.isPlaying = false;
      s.isRecording = false;
      s.undoStack = [];
      s.redoStack = [];
      s.hasUnsavedChanges = false;
      s.selectedClipIds = [];
      s.selectedTrackIds = [];
    }),
    loadProject: (project) => set((s) => {
      s.project = project;
      s.positionBeats = 0;
      s.isPlaying = false;
      s.hasUnsavedChanges = false;
    }),
    setProjectName: (name) => set((s) => { s.project.name = name; s.hasUnsavedChanges = true; }),

    // ── Deck → DAW ────────────────────────────────────────────────────────────
    importDeckTrack: (name, audioFileId, waveformData, durationBeats) => set((s) => {
      const index = s.project.tracks.length;
      const track = createDefaultTrack(name, 'audio', index);
      const clip = defaultClip(track.id, 0, 'audio');
      clip.name = name;
      clip.audioFileId = audioFileId;
      clip.waveformData = waveformData;
      clip.durationBeats = durationBeats;
      track.clips.push(clip);
      s.project.tracks.push(track);
      s.hasUnsavedChanges = true;
    }),

    // ── Armed sample ─────────────────────────────────────────────────────────
    armSample: (sample) => set((s) => { s.armedSample = sample; }),
    disarmSample: () => set((s) => { s.armedSample = null; }),
    setSampleShortcut: (key, sampleId) => set((s) => { s.sampleShortcuts[key] = sampleId; }),
  })),
);
