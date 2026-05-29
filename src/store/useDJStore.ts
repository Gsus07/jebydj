'use client';

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type {
  DJAppState,
  DeckId,
  DeckState,
  MixerState,
  EffectState,
  EffectType,
  EffectTarget,
  SamplerPad,
  Track,
  HotCue,
  LoopState,
  BeatgridState,
  StemState,
  StemType,
  StemChannel,
  SessionEvent,
  SetlistEntry,
} from './types';

// ─── Default States ─────────────────────────────────────────────────────────

function createDefaultDeck(id: DeckId): DeckState {
  return {
    id,
    trackName: '',
    artistName: '',
    duration: 0,
    currentTime: 0,
    isPlaying: false,
    isLoading: false,
    bpm: 0,
    detectedBpm: 0,
    key: '',
    pitch: 0,
    tempo: 1.0,
    tempoRange: 8,
    volume: 1.0,
    eqHigh: 0,
    eqMid: 0,
    eqLow: 0,
    hotCues: [],
    loop: { inPoint: null, outPoint: null, active: false, size: 1 },
    isMaster: id === 'A',
    isReverse: false,
    isKeylock: false,
    waveformData: null,
    waveformColors: null,
    cuePoint: 0,
    gain: 1.0,
    isMuted: false,
    pfIActive: false,
  };
}

function createDefaultSamplerPads(): SamplerPad[] {
  const colors = [
    '#ff006e', '#00f5ff', '#ffbe0b', '#8338ec',
    '#fb5607', '#3a86ff', '#06d6a0', '#ef476f',
    '#ff006e', '#00f5ff', '#ffbe0b', '#8338ec',
    '#fb5607', '#3a86ff', '#06d6a0', '#ef476f',
  ];
  return Array.from({ length: 16 }, (_, i) => ({
    id: i,
    trackId: null,
    trackName: '',
    waveformData: null,
    color: colors[i],
    volume: 1.0,
    pitch: 0,
    mode: 'oneshot' as const,
    isPlaying: false,
    keyBinding: null,
  }));
}

function createDefaultEffects(): EffectState[] {
  const defaults: Array<{ type: EffectType; params: Record<string, number> }> = [
    {
      type: 'reverb',
      params: { roomSize: 2.0, damping: 50, wetDry: 0.3 },
    },
    {
      type: 'delay',
      params: { time: 375, feedback: 40, wetDry: 0.3, pingPong: 0 },
    },
    {
      type: 'filter',
      params: { frequency: 1000, rate: 1, depth: 50, filterType: 0 },
    },
    {
      type: 'flanger',
      params: { rate: 0.5, depth: 5, feedback: 50, wetDry: 0.3 },
    },
    {
      type: 'bitcrusher',
      params: { bitDepth: 16, sampleRateReduction: 1 },
    },
    {
      type: 'phaser',
      params: { stages: 4, rate: 0.5, depth: 50, feedback: 50, wetDry: 0.3 },
    },
  ];

  return defaults.map((d, i) => ({
    id: `effect-${i}`,
    type: d.type,
    enabled: false,
    target: 'A' as EffectTarget,
    wetDry: d.params.wetDry ?? 0.3,
    params: d.params,
  }));
}

// ─── Store ───────────────────────────────────────────────────────────────────

function createDefaultStemState(): StemState {
  const mkChannel = (type: StemType): StemChannel => ({
    type,
    volume: 1,
    muted: false,
    solo: false,
    waveformData: null,
  });
  return {
    ready: false,
    processing: false,
    progress: 0,
    channels: {
      vocals: mkChannel('vocals'),
      drums: mkChannel('drums'),
      bass: mkChannel('bass'),
      other: mkChannel('other'),
    },
    memoryBytes: 0,
    expanded: false,
  };
}

interface DJStoreActions {
  // Audio
  setAudioReady: (ready: boolean) => void;
  setActiveDeck: (id: DeckId) => void;

  // Deck
  setDeckPlaying: (id: DeckId, playing: boolean) => void;
  setDeckCurrentTime: (id: DeckId, time: number) => void;
  setDeckDuration: (id: DeckId, duration: number) => void;
  setDeckTrack: (id: DeckId, track: Partial<DeckState>) => void;
  setDeckTempo: (id: DeckId, tempo: number) => void;
  setDeckPitch: (id: DeckId, pitch: number) => void;
  setDeckVolume: (id: DeckId, volume: number) => void;
  setDeckEQ: (id: DeckId, band: 'high' | 'mid' | 'low', value: number) => void;
  setDeckHotCues: (id: DeckId, cues: HotCue[]) => void;
  setDeckLoop: (id: DeckId, loop: Partial<LoopState>) => void;
  setDeckReverse: (id: DeckId, reverse: boolean) => void;
  setDeckKeylock: (id: DeckId, keylock: boolean) => void;
  setDeckCuePoint: (id: DeckId, time: number) => void;
  setDeckLoading: (id: DeckId, loading: boolean) => void;
  setDeckMaster: (id: DeckId) => void;
  setDeckTempoRange: (id: DeckId, range: 8 | 16 | 100) => void;
  setDeckPFL: (id: DeckId, active: boolean) => void;

  // Mixer
  setCrossfader: (position: number) => void;
  setCrossfaderCurve: (curve: MixerState['crossfaderCurve']) => void;
  setMasterGain: (gain: number) => void;
  setMasterClipping: (clipping: boolean) => void;
  setCueMix: (mix: number) => void;
  setCueGain: (gain: number) => void;
  setMono: (mono: boolean) => void;

  // Effects
  setEffectEnabled: (id: string, enabled: boolean) => void;
  setEffectTarget: (id: string, target: EffectTarget) => void;
  setEffectParam: (id: string, param: string, value: number) => void;
  reorderEffects: (from: number, to: number) => void;

  // Sampler
  setSamplerPad: (id: number, pad: Partial<SamplerPad>) => void;
  setSamplerBank: (bank: 'A' | 'B' | 'C' | 'D') => void;

  // Library
  addTrack: (track: Track) => void;
  removeTrack: (id: string) => void;
  setLibrarySearch: (query: string) => void;
  setLibraryFilter: (filter: { bpmMin?: number; bpmMax?: number; key?: string }) => void;
  setLibrarySort: (by: keyof Track, dir: 'asc' | 'desc') => void;
  setSelectedTrack: (id: string | null) => void;
  setLibraryVisible: (visible: boolean) => void;

  // Settings
  setShowSettings: (show: boolean) => void;

  // Beatgrid
  setBeatgrid: (id: DeckId, beats: number[]) => void;
  setBeatgridEdited: (id: DeckId, edited: boolean) => void;
  setBeatgridEditing: (id: DeckId, editing: boolean) => void;

  // Slip Mode
  setSlipMode: (id: DeckId, active: boolean) => void;
  setSlipPosition: (id: DeckId, pos: number) => void;

  // Stems
  setStemState: (id: DeckId, state: Partial<StemState>) => void;
  setStemChannel: (id: DeckId, type: StemType, channel: Partial<StemChannel>) => void;

  // Session / Ghost
  startSessionRecording: () => void;
  stopSessionRecording: () => void;
  addSessionEvent: (event: SessionEvent) => void;
  setSessionPlaying: (playing: boolean) => void;
  setGhostSpeed: (speed: number) => void;
  setGhostPaused: (paused: boolean) => void;
  loadGhostSession: (events: SessionEvent[]) => void;

  // Set Planner
  addSetlistEntry: (trackId: string) => void;
  removeSetlistEntry: (trackId: string) => void;
  reorderSetlist: (from: number, to: number) => void;
  setSetlistVisible: (visible: boolean) => void;
  setSetlistPlayingIndex: (index: number) => void;

  // Practice Mode
  setPracticeActive: (active: boolean) => void;
  updatePracticeScores: (scores: Partial<{ syncScore: number; mixTimingScore: number; clashDetected: boolean; keyClash: boolean }>) => void;
  addSyncHistoryPoint: (score: number) => void;

  // Mobile Controller
  setMobileControllerActive: (active: boolean) => void;
}

type DJStore = DJAppState & DJStoreActions;

export const useDJStore = create<DJStore>()(
  immer((set) => ({
    // State
    decks: {
      A: createDefaultDeck('A'),
      B: createDefaultDeck('B'),
    },
    mixer: {
      crossfaderPosition: 0,
      crossfaderCurve: 'linear',
      masterGain: 1.0,
      masterClipping: false,
      boothGain: 0.8,
      cueMix: 0.5,
      cueGain: 1.0,
      isMono: false,
    },
    effects: createDefaultEffects(),
    sampler: {
      pads: createDefaultSamplerPads(),
      bank: 'A',
    },
    library: {
      tracks: [],
      searchQuery: '',
      bpmMin: 60,
      bpmMax: 200,
      filterKey: '',
      sortBy: 'title',
      sortDir: 'asc',
      selectedTrackId: null,
      isVisible: true,
    },
    settings: {
      audioLatency: 'interactive',
      crossfaderConfig: 'linear',
      midiEnabled: false,
      keyboardShortcuts: [],
      showSettings: false,
    },
    activeDeck: 'A',
    isAudioReady: false,

    // New state: beatgrids
    beatgrids: {
      A: { beats: [], edited: false, editing: false },
      B: { beats: [], edited: false, editing: false },
    },
    // New state: slip mode
    slipMode: { A: false, B: false },
    slipPosition: { A: 0, B: 0 },
    // New state: stems
    stems: {
      A: createDefaultStemState(),
      B: createDefaultStemState(),
    },
    // New state: session ghost
    session: {
      recording: false,
      playing: false,
      events: [],
      startedAt: 0,
      ghostSpeed: 1,
      ghostPaused: false,
    },
    // New state: set planner
    setlist: {
      entries: [],
      isVisible: false,
      playingIndex: -1,
    },
    // New state: practice mode
    practiceMode: {
      active: false,
      syncScore: 100,
      mixTimingScore: 100,
      clashDetected: false,
      keyClash: false,
      sessionScore: 100,
      syncHistory: [],
    },
    // Mobile controller
    mobileControllerActive: false,

    // Actions
    setAudioReady: (ready) => set((s) => { s.isAudioReady = ready; }),
    setActiveDeck: (id) => set((s) => { s.activeDeck = id; }),

    setDeckPlaying: (id, playing) => set((s) => { s.decks[id].isPlaying = playing; }),
    setDeckCurrentTime: (id, time) => set((s) => { s.decks[id].currentTime = time; }),
    setDeckDuration: (id, duration) => set((s) => { s.decks[id].duration = duration; }),
    setDeckTrack: (id, track) => set((s) => { Object.assign(s.decks[id], track); }),
    setDeckTempo: (id, tempo) => set((s) => { s.decks[id].tempo = tempo; }),
    setDeckPitch: (id, pitch) => set((s) => { s.decks[id].pitch = pitch; }),
    setDeckVolume: (id, volume) => set((s) => { s.decks[id].volume = volume; }),
    setDeckEQ: (id, band, value) => set((s) => {
      if (band === 'high') s.decks[id].eqHigh = value;
      else if (band === 'mid') s.decks[id].eqMid = value;
      else s.decks[id].eqLow = value;
    }),
    setDeckHotCues: (id, cues) => set((s) => { s.decks[id].hotCues = cues; }),
    setDeckLoop: (id, loop) => set((s) => { Object.assign(s.decks[id].loop, loop); }),
    setDeckReverse: (id, reverse) => set((s) => { s.decks[id].isReverse = reverse; }),
    setDeckKeylock: (id, keylock) => set((s) => { s.decks[id].isKeylock = keylock; }),
    setDeckCuePoint: (id, time) => set((s) => { s.decks[id].cuePoint = time; }),
    setDeckLoading: (id, loading) => set((s) => { s.decks[id].isLoading = loading; }),
    setDeckMaster: (id) => set((s) => {
      s.decks.A.isMaster = id === 'A';
      s.decks.B.isMaster = id === 'B';
    }),
    setDeckTempoRange: (id, range) => set((s) => { s.decks[id].tempoRange = range; }),
    setDeckPFL: (id, active) => set((s) => { s.decks[id].pfIActive = active; }),

    setCrossfader: (position) => set((s) => { s.mixer.crossfaderPosition = position; }),
    setCrossfaderCurve: (curve) => set((s) => { s.mixer.crossfaderCurve = curve; }),
    setMasterGain: (gain) => set((s) => { s.mixer.masterGain = gain; }),
    setMasterClipping: (clipping) => set((s) => { s.mixer.masterClipping = clipping; }),
    setCueMix: (mix) => set((s) => { s.mixer.cueMix = mix; }),
    setCueGain: (gain) => set((s) => { s.mixer.cueGain = gain; }),
    setMono: (mono) => set((s) => { s.mixer.isMono = mono; }),

    setEffectEnabled: (id, enabled) => set((s) => {
      const e = s.effects.find((x) => x.id === id);
      if (e) e.enabled = enabled;
    }),
    setEffectTarget: (id, target) => set((s) => {
      const e = s.effects.find((x) => x.id === id);
      if (e) e.target = target;
    }),
    setEffectParam: (id, param, value) => set((s) => {
      const e = s.effects.find((x) => x.id === id);
      if (e) e.params[param] = value;
    }),
    reorderEffects: (from, to) => set((s) => {
      const [item] = s.effects.splice(from, 1);
      s.effects.splice(to, 0, item);
    }),

    setSamplerPad: (id, pad) => set((s) => {
      Object.assign(s.sampler.pads[id], pad);
    }),
    setSamplerBank: (bank) => set((s) => { s.sampler.bank = bank; }),

    addTrack: (track) => set((s) => {
      if (!s.library.tracks.find((t) => t.id === track.id)) {
        s.library.tracks.push(track);
      }
    }),
    removeTrack: (id) => set((s) => {
      s.library.tracks = s.library.tracks.filter((t) => t.id !== id);
    }),
    setLibrarySearch: (query) => set((s) => { s.library.searchQuery = query; }),
    setLibraryFilter: (filter) => set((s) => {
      if (filter.bpmMin !== undefined) s.library.bpmMin = filter.bpmMin;
      if (filter.bpmMax !== undefined) s.library.bpmMax = filter.bpmMax;
      if (filter.key !== undefined) s.library.filterKey = filter.key;
    }),
    setLibrarySort: (by, dir) => set((s) => {
      s.library.sortBy = by;
      s.library.sortDir = dir;
    }),
    setSelectedTrack: (id) => set((s) => { s.library.selectedTrackId = id; }),
    setLibraryVisible: (visible) => set((s) => { s.library.isVisible = visible; }),

    setShowSettings: (show) => set((s) => { s.settings.showSettings = show; }),

    // Beatgrid actions
    setBeatgrid: (id, beats) => set((s) => { s.beatgrids[id].beats = beats; }),
    setBeatgridEdited: (id, edited) => set((s) => { s.beatgrids[id].edited = edited; }),
    setBeatgridEditing: (id, editing) => set((s) => { s.beatgrids[id].editing = editing; }),

    // Slip mode actions
    setSlipMode: (id, active) => set((s) => { s.slipMode[id] = active; }),
    setSlipPosition: (id, pos) => set((s) => { s.slipPosition[id] = pos; }),

    // Stems actions
    setStemState: (id, state) => set((s) => { Object.assign(s.stems[id], state); }),
    setStemChannel: (id, type, channel) => set((s) => {
      Object.assign(s.stems[id].channels[type], channel);
    }),

    // Session / Ghost actions
    startSessionRecording: () => set((s) => {
      s.session.recording = true;
      s.session.events = [];
      s.session.startedAt = Date.now();
    }),
    stopSessionRecording: () => set((s) => { s.session.recording = false; }),
    addSessionEvent: (event) => set((s) => {
      if (s.session.recording) {
        s.session.events.push(event);
      }
    }),
    setSessionPlaying: (playing) => set((s) => { s.session.playing = playing; }),
    setGhostSpeed: (speed) => set((s) => { s.session.ghostSpeed = speed; }),
    setGhostPaused: (paused) => set((s) => { s.session.ghostPaused = paused; }),
    loadGhostSession: (events) => set((s) => { s.session.events = events; }),

    // Setlist actions
    addSetlistEntry: (trackId) => set((s) => {
      if (!s.setlist.entries.find((e) => e.trackId === trackId)) {
        s.setlist.entries.push({ trackId, order: s.setlist.entries.length });
      }
    }),
    removeSetlistEntry: (trackId) => set((s) => {
      s.setlist.entries = s.setlist.entries.filter((e) => e.trackId !== trackId)
        .map((e, i) => ({ ...e, order: i }));
    }),
    reorderSetlist: (from, to) => set((s) => {
      const [item] = s.setlist.entries.splice(from, 1);
      s.setlist.entries.splice(to, 0, item);
      s.setlist.entries.forEach((e, i) => { e.order = i; });
    }),
    setSetlistVisible: (visible) => set((s) => { s.setlist.isVisible = visible; }),
    setSetlistPlayingIndex: (index) => set((s) => { s.setlist.playingIndex = index; }),

    // Practice mode actions
    setPracticeActive: (active) => set((s) => { s.practiceMode.active = active; }),
    updatePracticeScores: (scores) => set((s) => {
      Object.assign(s.practiceMode, scores);
      // Recalculate session score
      s.practiceMode.sessionScore = Math.round(
        (s.practiceMode.syncScore * 0.6 + s.practiceMode.mixTimingScore * 0.4)
      );
    }),
    addSyncHistoryPoint: (score) => set((s) => {
      s.practiceMode.syncHistory.push(score);
      if (s.practiceMode.syncHistory.length > 200) {
        s.practiceMode.syncHistory.shift();
      }
    }),

    // Mobile controller
    setMobileControllerActive: (active) => set((s) => { s.mobileControllerActive = active; }),
  }))
);
