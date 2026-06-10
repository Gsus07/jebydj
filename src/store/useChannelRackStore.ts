'use client';

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type { MIDINote } from './dawTypes';
import type { SynthType } from '@/src/lib/synths/SynthInterface';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface StepData {
  on: boolean;
  velocity: number;       // 0–127
  pan: number;            // -100 to 100
  pitch: number;          // -12 to +12 semitones
  probability: number;    // 0–100
  offset: number;         // -0.5 to +0.5 (micro-timing fraction of step)
}

export interface ChannelPatternData {
  steps: StepData[];
  stepCount: 16 | 32 | 64;
  notes: MIDINote[];        // for instrument channels (piano roll mode)
}

export interface Channel {
  id: string;
  name: string;
  type: 'sample' | 'instrument';
  color: string;
  instrumentType: SynthType | null;
  sampleId: string | null;
  volume: number;           // 0–1
  pan: number;              // -1 to 1
  muted: boolean;
  soloed: boolean;
  mixerChannelIndex: number;
}

export interface Pattern {
  id: string;
  name: string;
  color: string;
  channelData: Record<string, ChannelPatternData>;
}

const CHANNEL_COLORS = [
  '#ff006e', '#ff4444', '#ff8800', '#ffbe0b',
  '#06d6a0', '#00f5ff', '#3a86ff', '#8338ec',
  '#ff006e', '#e74c3c', '#f39c12', '#2ecc71',
  '#1abc9c', '#3498db', '#9b59b6', '#e91e63',
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function uid(): string {
  return crypto.randomUUID();
}

function createDefaultStep(): StepData {
  return { on: false, velocity: 100, pan: 0, pitch: 0, probability: 100, offset: 0 };
}

function createDefaultChannelData(stepCount: 16 | 32 | 64 = 16): ChannelPatternData {
  return {
    steps: Array.from({ length: stepCount }, () => createDefaultStep()),
    stepCount,
    notes: [],
  };
}

function createDefaultPattern(name: string, channels: Channel[]): Pattern {
  const data: Record<string, ChannelPatternData> = {};
  for (const ch of channels) {
    data[ch.id] = createDefaultChannelData();
  }
  return {
    id: uid(),
    name,
    color: CHANNEL_COLORS[Math.floor(Math.random() * CHANNEL_COLORS.length)],
    channelData: data,
  };
}

function createDefaultChannel(name: string, type: 'sample' | 'instrument', index: number): Channel {
  return {
    id: uid(),
    name,
    type,
    color: CHANNEL_COLORS[index % CHANNEL_COLORS.length],
    instrumentType: type === 'instrument' ? 'threeOsc' : null,
    sampleId: null,
    volume: 0.8,
    pan: 0,
    muted: false,
    soloed: false,
    mixerChannelIndex: index,
  };
}

// ─── Store State ─────────────────────────────────────────────────────────────

interface ChannelRackState {
  channels: Channel[];
  patterns: Pattern[];
  activePatternId: string;
  channelRackOpen: boolean;
  selectedChannelId: string | null;
  playing: boolean;
  currentStep: number;
  stepCount: 16 | 32 | 64;
}

interface ChannelRackActions {
  // Channel CRUD
  addChannel: (name: string, type: 'sample' | 'instrument', opts?: Partial<Channel>) => string;
  removeChannel: (id: string) => void;
  updateChannel: (id: string, patch: Partial<Channel>) => void;
  setChannelMute: (id: string, v: boolean) => void;
  setChannelSolo: (id: string, v: boolean) => void;
  selectChannel: (id: string | null) => void;

  // Pattern CRUD
  addPattern: (name?: string) => string;
  removePattern: (id: string) => void;
  duplicatePattern: (id: string) => string;
  renamePattern: (id: string, name: string) => void;
  setActivePattern: (id: string) => void;
  setPatternColor: (id: string, color: string) => void;

  // Step editing
  toggleStep: (channelId: string, stepIndex: number) => void;
  setStep: (channelId: string, stepIndex: number, data: Partial<StepData>) => void;
  setStepCount: (channelId: string, count: 16 | 32 | 64) => void;

  // Note editing (for instrument channels)
  addNote: (channelId: string, note: Omit<MIDINote, 'id'>) => string;
  removeNote: (channelId: string, noteId: string) => void;
  updateNote: (channelId: string, noteId: string, patch: Partial<MIDINote>) => void;

  // Transport
  setPlaying: (v: boolean) => void;
  setCurrentStep: (s: number) => void;

  // UI
  setChannelRackOpen: (v: boolean) => void;
  setGlobalStepCount: (count: 16 | 32 | 64) => void;
}

type ChannelRackStore = ChannelRackState & ChannelRackActions;

// ─── Initial State ───────────────────────────────────────────────────────────

const defaultChannels: Channel[] = [
  { ...createDefaultChannel('Kick', 'sample', 0), sampleId: 'kick_808' },
  { ...createDefaultChannel('Snare', 'sample', 1), sampleId: 'snare_classic' },
  { ...createDefaultChannel('Hi-Hat', 'sample', 2), sampleId: 'hihat_closed' },
  { ...createDefaultChannel('Clap', 'sample', 3), sampleId: 'clap_classic' },
];

const defaultPattern = createDefaultPattern('Pattern 1', defaultChannels);

// ─── Store ───────────────────────────────────────────────────────────────────

export const useChannelRackStore = create<ChannelRackStore>()(
  immer((set, get) => ({
    channels: defaultChannels,
    patterns: [defaultPattern],
    activePatternId: defaultPattern.id,
    channelRackOpen: false,
    selectedChannelId: null,
    playing: false,
    currentStep: 0,
    stepCount: 16,

    // ── Channels ──────────────────────────────────────────────────────────

    addChannel: (name, type, opts) => {
      const id = uid();
      set((s) => {
        const index = s.channels.length;
        const ch: Channel = {
          ...createDefaultChannel(name, type, index),
          ...opts,
          id,
        };
        s.channels.push(ch);
        // Add channel data to all patterns
        for (const pat of s.patterns) {
          pat.channelData[id] = createDefaultChannelData(s.stepCount);
        }
      });
      return id;
    },

    removeChannel: (id) => set((s) => {
      s.channels = s.channels.filter((c) => c.id !== id);
      for (const pat of s.patterns) {
        delete pat.channelData[id];
      }
      if (s.selectedChannelId === id) s.selectedChannelId = null;
    }),

    updateChannel: (id, patch) => set((s) => {
      const ch = s.channels.find((c) => c.id === id);
      if (ch) Object.assign(ch, patch);
    }),

    setChannelMute: (id, v) => set((s) => {
      const ch = s.channels.find((c) => c.id === id);
      if (ch) ch.muted = v;
    }),

    setChannelSolo: (id, v) => set((s) => {
      const ch = s.channels.find((c) => c.id === id);
      if (ch) ch.soloed = v;
    }),

    selectChannel: (id) => set((s) => { s.selectedChannelId = id; }),

    // ── Patterns ──────────────────────────────────────────────────────────

    addPattern: (name) => {
      const state = get();
      const patName = name ?? `Pattern ${state.patterns.length + 1}`;
      const pat = createDefaultPattern(patName, state.channels);
      const id = pat.id;
      set((s) => { s.patterns.push(pat); s.activePatternId = id; });
      return id;
    },

    removePattern: (id) => set((s) => {
      if (s.patterns.length <= 1) return; // must have at least one
      s.patterns = s.patterns.filter((p) => p.id !== id);
      if (s.activePatternId === id) s.activePatternId = s.patterns[0].id;
    }),

    duplicatePattern: (id) => {
      const state = get();
      const src = state.patterns.find((p) => p.id === id);
      if (!src) return id;
      const newId = uid();
      const dup: Pattern = JSON.parse(JSON.stringify(src));
      dup.id = newId;
      dup.name = `${src.name} (copy)`;
      set((s) => { s.patterns.push(dup); s.activePatternId = newId; });
      return newId;
    },

    renamePattern: (id, name) => set((s) => {
      const p = s.patterns.find((x) => x.id === id);
      if (p) p.name = name;
    }),

    setActivePattern: (id) => set((s) => { s.activePatternId = id; }),

    setPatternColor: (id, color) => set((s) => {
      const p = s.patterns.find((x) => x.id === id);
      if (p) p.color = color;
    }),

    // ── Steps ─────────────────────────────────────────────────────────────

    toggleStep: (channelId, stepIndex) => set((s) => {
      const pat = s.patterns.find((p) => p.id === s.activePatternId);
      if (!pat) return;
      const data = pat.channelData[channelId];
      if (!data || stepIndex >= data.steps.length) return;
      data.steps[stepIndex].on = !data.steps[stepIndex].on;
      if (data.steps[stepIndex].on && data.steps[stepIndex].velocity === 0) {
        data.steps[stepIndex].velocity = 100;
      }
    }),

    setStep: (channelId, stepIndex, patch) => set((s) => {
      const pat = s.patterns.find((p) => p.id === s.activePatternId);
      if (!pat) return;
      const data = pat.channelData[channelId];
      if (!data || stepIndex >= data.steps.length) return;
      Object.assign(data.steps[stepIndex], patch);
    }),

    setStepCount: (channelId, count) => set((s) => {
      const pat = s.patterns.find((p) => p.id === s.activePatternId);
      if (!pat) return;
      const data = pat.channelData[channelId];
      if (!data) return;
      const oldLen = data.steps.length;
      data.stepCount = count;
      if (count > oldLen) {
        for (let i = oldLen; i < count; i++) {
          data.steps.push(createDefaultStep());
        }
      } else {
        data.steps.length = count;
      }
    }),

    // ── Notes (instrument channels) ───────────────────────────────────────

    addNote: (channelId, note) => {
      const id = uid();
      set((s) => {
        const pat = s.patterns.find((p) => p.id === s.activePatternId);
        if (!pat) return;
        const data = pat.channelData[channelId];
        if (!data) return;
        data.notes.push({ ...note, id });
      });
      return id;
    },

    removeNote: (channelId, noteId) => set((s) => {
      const pat = s.patterns.find((p) => p.id === s.activePatternId);
      if (!pat) return;
      const data = pat.channelData[channelId];
      if (!data) return;
      data.notes = data.notes.filter((n) => n.id !== noteId);
    }),

    updateNote: (channelId, noteId, patch) => set((s) => {
      const pat = s.patterns.find((p) => p.id === s.activePatternId);
      if (!pat) return;
      const data = pat.channelData[channelId];
      if (!data) return;
      const note = data.notes.find((n) => n.id === noteId);
      if (note) Object.assign(note, patch);
    }),

    // ── Transport ─────────────────────────────────────────────────────────

    setPlaying: (v) => set((s) => { s.playing = v; }),
    setCurrentStep: (step) => set((s) => { s.currentStep = step; }),

    // ── UI ────────────────────────────────────────────────────────────────

    setChannelRackOpen: (v) => set((s) => { s.channelRackOpen = v; }),
    setGlobalStepCount: (count) => set((s) => {
      s.stepCount = count;
      const pat = s.patterns.find((p) => p.id === s.activePatternId);
      if (!pat) return;
      for (const ch of s.channels) {
        const data = pat.channelData[ch.id];
        if (!data) continue;
        const oldLen = data.steps.length;
        data.stepCount = count;
        if (count > oldLen) {
          for (let i = oldLen; i < count; i++) {
            data.steps.push(createDefaultStep());
          }
        } else {
          data.steps.length = count;
        }
      }
    }),
  })),
);
