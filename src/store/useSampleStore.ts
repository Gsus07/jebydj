'use client';

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type {
  SampleItem, SamplePack, SampleFilterState, DrumPattern, DrumRow, DrumStep,
  DrumMachineData, ChainSegment, SampleCategory, StepCount, StepSize,
} from './sampleTypes';
import { DEFAULT_FILTER } from './sampleTypes';
import type { ProceduralSound } from '@/src/lib/samples/ProceduralSounds';

// ─── uid helper ──────────────────────────────────────────────────────────────

export function uid(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

// ─── Default drum rows ────────────────────────────────────────────────────────

const DEFAULT_ROW_NAMES = [
  'Kick', 'Snare', 'Clap', 'HH Closed', 'HH Open', 'Tom', 'Cymbal', 'Percussion',
];

function makeStep(): DrumStep {
  return { on: false, velocity: 100, pitch: 0, probability: 100, retrigger: 1, flam: false, offset: 0 };
}

function makeRow(name: string, sampleId: string | null = null): DrumRow {
  return {
    id: uid(),
    name,
    sampleId,
    steps: Array.from({ length: 16 }, makeStep),
    stepCount: 16,
    stepSize: '1/16',
    swing: 0,
    volume: 0.8,
    pan: 0,
    muted: false,
    soloed: false,
  };
}

function makePattern(name: string): DrumPattern {
  return {
    id: uid(),
    name,
    rows: DEFAULT_ROW_NAMES.map((n) => makeRow(n)),
  };
}

const defaultDrumMachine: DrumMachineData = {
  playing: false,
  currentStep: 0,
  currentPatternId: '',
  patterns: [],
  globalSwing: 0,
  chainMode: false,
  chainPatternIds: [],
  chainIndex: 0,
};

// ─── Store types ─────────────────────────────────────────────────────────────

interface SampleStore {
  // Data
  samples: SampleItem[];
  packs: SamplePack[];
  filters: SampleFilterState;
  sortColumn: keyof SampleItem;
  sortDirection: 'asc' | 'desc';

  // UI state
  selectedSampleIds: string[];
  previewSampleId: string | null;
  previewProgress: number;
  previewVolume: number;
  importProgress: { current: number; total: number; active: boolean };
  similarSampleIds: string[];    // results of "find similar"
  showSimilarFor: string | null;
  chainSegments: ChainSegment[];
  chainOpen: boolean;
  drumMachineOpen: boolean;

  // Drum machine
  dm: DrumMachineData;

  // Actions — Library
  addSamples: (items: SampleItem[]) => void;
  removeSample: (id: string) => void;
  updateSample: (id: string, patch: Partial<SampleItem>) => void;
  addPack: (pack: SamplePack) => void;
  removePack: (id: string) => void;
  setFilters: (patch: Partial<SampleFilterState>) => void;
  resetFilters: () => void;
  setSort: (col: keyof SampleItem, dir: 'asc' | 'desc') => void;
  selectSamples: (ids: string[]) => void;
  setPreview: (id: string | null) => void;
  setPreviewProgress: (p: number) => void;
  setPreviewVolume: (v: number) => void;
  setImportProgress: (cur: number, total: number, active: boolean) => void;
  toggleFavorite: (id: string) => void;
  setRating: (id: string, rating: number) => void;
  incrementUsage: (id: string) => void;
  setSimilarResults: (forId: string | null, ids: string[]) => void;

  // Actions — Chainer
  setChainOpen: (open: boolean) => void;
  setChainSegments: (segs: ChainSegment[]) => void;
  addChainSegment: (sampleId: string) => void;
  removeChainSegment: (idx: number) => void;
  updateChainSegment: (idx: number, patch: Partial<ChainSegment>) => void;

  // Actions — Drum Machine
  setDrumMachineOpen: (open: boolean) => void;
  setDrumPlaying: (v: boolean) => void;
  setDrumCurrentStep: (step: number) => void;
  setCurrentPattern: (id: string) => void;
  addPattern: () => string;
  removePattern: (id: string) => void;
  renamePattern: (id: string, name: string) => void;
  copyPattern: (fromId: string, toId: string) => void;
  clearPattern: (id: string) => void;
  randomizePattern: (id: string, density: number) => void;
  addRow: (patternId: string) => void;
  removeRow: (patternId: string, rowId: string) => void;
  updateRow: (patternId: string, rowId: string, patch: Partial<DrumRow>) => void;
  setRowSample: (patternId: string, rowId: string, sampleId: string | null) => void;
  toggleStep: (patternId: string, rowId: string, stepIdx: number) => void;
  updateStep: (patternId: string, rowId: string, stepIdx: number, patch: Partial<DrumStep>) => void;
  setStepCount: (patternId: string, rowId: string, count: StepCount) => void;
  setGlobalSwing: (swing: number) => void;
  setChainMode: (v: boolean) => void;

  // Procedural sounds
  proceduralReady: boolean;
  loadProceduralSounds: (sounds: ProceduralSound[]) => void;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function findPattern(dm: DrumMachineData, id: string): DrumPattern | undefined {
  return dm.patterns.find((p) => p.id === id);
}

function findRow(pattern: DrumPattern, rowId: string): DrumRow | undefined {
  return pattern.rows.find((r) => r.id === rowId);
}

// ─── Store ────────────────────────────────────────────────────────────────────

const initialPattern = makePattern('Pattern A1');
const initialDM: DrumMachineData = {
  ...defaultDrumMachine,
  currentPatternId: initialPattern.id,
  patterns: [initialPattern],
};

export const useSampleStore = create<SampleStore>()(
  immer((set, get) => ({
    samples: [],
    packs: [],
    filters: { ...DEFAULT_FILTER },
    sortColumn: 'name',
    sortDirection: 'asc',
    selectedSampleIds: [],
    previewSampleId: null,
    previewProgress: 0,
    previewVolume: 0.7,
    importProgress: { current: 0, total: 0, active: false },
    similarSampleIds: [],
    showSimilarFor: null,
    chainSegments: [],
    chainOpen: false,
    drumMachineOpen: false,
    dm: initialDM,
    proceduralReady: false,

    // ── Library ──
    addSamples: (items) => set((s) => { s.samples.push(...items); }),
    removeSample: (id) => set((s) => { s.samples = s.samples.filter((x) => x.id !== id); }),
    updateSample: (id, patch) => set((s) => {
      const idx = s.samples.findIndex((x) => x.id === id);
      if (idx !== -1) Object.assign(s.samples[idx], patch);
    }),
    addPack: (pack) => set((s) => { s.packs.push(pack); }),
    removePack: (id) => set((s) => {
      s.packs = s.packs.filter((p) => p.id !== id);
      s.samples = s.samples.filter((x) => x.packId !== id);
    }),
    setFilters: (patch) => set((s) => { Object.assign(s.filters, patch); }),
    resetFilters: () => set((s) => { s.filters = { ...DEFAULT_FILTER }; }),
    setSort: (col, dir) => set((s) => { s.sortColumn = col; s.sortDirection = dir; }),
    selectSamples: (ids) => set((s) => { s.selectedSampleIds = ids; }),
    setPreview: (id) => set((s) => { s.previewSampleId = id; s.previewProgress = 0; }),
    setPreviewProgress: (p) => set((s) => { s.previewProgress = p; }),
    setPreviewVolume: (v) => set((s) => { s.previewVolume = v; }),
    setImportProgress: (cur, total, active) =>
      set((s) => { s.importProgress = { current: cur, total, active }; }),
    toggleFavorite: (id) => set((s) => {
      const item = s.samples.find((x) => x.id === id);
      if (item) item.isFavorite = !item.isFavorite;
    }),
    setRating: (id, rating) => set((s) => {
      const item = s.samples.find((x) => x.id === id);
      if (item) item.rating = rating;
    }),
    incrementUsage: (id) => set((s) => {
      const item = s.samples.find((x) => x.id === id);
      if (item) { item.usageCount++; item.lastUsedAt = Date.now(); }
    }),
    setSimilarResults: (forId, ids) =>
      set((s) => { s.showSimilarFor = forId; s.similarSampleIds = ids; }),

    // ── Chainer ──
    setChainOpen: (open) => set((s) => { s.chainOpen = open; }),
    setChainSegments: (segs) => set((s) => { s.chainSegments = segs; }),
    addChainSegment: (sampleId) => set((s) => {
      s.chainSegments.push({ sampleId, startOffset: 0, duration: 0, gap: 0, crossfade: 0 });
    }),
    removeChainSegment: (idx) => set((s) => { s.chainSegments.splice(idx, 1); }),
    updateChainSegment: (idx, patch) => set((s) => {
      Object.assign(s.chainSegments[idx], patch);
    }),

    // ── Drum Machine ──
    setDrumMachineOpen: (open) => set((s) => { s.drumMachineOpen = open; }),
    setDrumPlaying: (v) => set((s) => { s.dm.playing = v; }),
    setDrumCurrentStep: (step) => set((s) => { s.dm.currentStep = step; }),
    setCurrentPattern: (id) => set((s) => { s.dm.currentPatternId = id; }),
    addPattern: () => {
      const p = makePattern(`Pattern ${get().dm.patterns.length + 1}`);
      set((s) => { s.dm.patterns.push(p); });
      return p.id;
    },
    removePattern: (id) => set((s) => {
      s.dm.patterns = s.dm.patterns.filter((p) => p.id !== id);
      if (s.dm.currentPatternId === id && s.dm.patterns.length > 0) {
        s.dm.currentPatternId = s.dm.patterns[0].id;
      }
    }),
    renamePattern: (id, name) => set((s) => {
      const p = findPattern(s.dm, id);
      if (p) p.name = name;
    }),
    copyPattern: (fromId, toId) => set((s) => {
      const from = findPattern(s.dm, fromId);
      const to = findPattern(s.dm, toId);
      if (!from || !to) return;
      to.rows = JSON.parse(JSON.stringify(from.rows)) as DrumRow[];
    }),
    clearPattern: (id) => set((s) => {
      const p = findPattern(s.dm, id);
      if (!p) return;
      p.rows.forEach((r) => r.steps.forEach((step) => { step.on = false; }));
    }),
    randomizePattern: (id, density) => set((s) => {
      const p = findPattern(s.dm, id);
      if (!p) return;
      p.rows.forEach((r) => {
        r.steps.forEach((step) => {
          step.on = Math.random() < density / 100;
          if (step.on) step.velocity = 70 + Math.floor(Math.random() * 57);
        });
      });
    }),
    addRow: (patternId) => set((s) => {
      const p = findPattern(s.dm, patternId);
      if (!p || p.rows.length >= 16) return;
      p.rows.push(makeRow(`Row ${p.rows.length + 1}`));
    }),
    removeRow: (patternId, rowId) => set((s) => {
      const p = findPattern(s.dm, patternId);
      if (p) p.rows = p.rows.filter((r) => r.id !== rowId);
    }),
    updateRow: (patternId, rowId, patch) => set((s) => {
      const p = findPattern(s.dm, patternId);
      const r = p && findRow(p, rowId);
      if (r) Object.assign(r, patch);
    }),
    setRowSample: (patternId, rowId, sampleId) => set((s) => {
      const p = findPattern(s.dm, patternId);
      const r = p && findRow(p, rowId);
      if (r) r.sampleId = sampleId;
    }),
    toggleStep: (patternId, rowId, stepIdx) => set((s) => {
      const p = findPattern(s.dm, patternId);
      const r = p && findRow(p, rowId);
      if (r && r.steps[stepIdx]) r.steps[stepIdx].on = !r.steps[stepIdx].on;
    }),
    updateStep: (patternId, rowId, stepIdx, patch) => set((s) => {
      const p = findPattern(s.dm, patternId);
      const r = p && findRow(p, rowId);
      if (r && r.steps[stepIdx]) Object.assign(r.steps[stepIdx], patch);
    }),
    setStepCount: (patternId, rowId, count) => set((s) => {
      const p = findPattern(s.dm, patternId);
      const r = p && findRow(p, rowId);
      if (!r) return;
      r.stepCount = count;
      while (r.steps.length < count) r.steps.push(makeStep());
      r.steps = r.steps.slice(0, count);
    }),
    setGlobalSwing: (swing) => set((s) => { s.dm.globalSwing = swing; }),
    setChainMode: (v) => set((s) => { s.dm.chainMode = v; }),

    // ── Procedural sounds ──
    loadProceduralSounds: (sounds) => set((s) => {
      const existingIds = new Set(s.samples.map((x) => x.id));

      // Compute waveform/stats from each buffer and build SampleItems
      const newItems: SampleItem[] = [];
      for (const sound of sounds) {
        if (existingIds.has(sound.id)) continue;
        const ch = sound.buffer.getChannelData(0);
        const N = 200;
        const step = Math.max(1, Math.floor(ch.length / N));
        const waveformData: number[] = [];
        let rmsSum = 0;
        let peak = 0;
        for (let i = 0; i < N; i++) {
          let max = 0;
          for (let j = 0; j < step; j++) {
            const v = Math.abs(ch[i * step + j] ?? 0);
            if (v > max) max = v;
            rmsSum += v * v;
          }
          if (max > peak) peak = max;
          waveformData.push(max);
        }
        const rms = Math.sqrt(rmsSum / (N * step));
        const item: SampleItem = {
          id: sound.id,
          name: sound.name,
          packId: 'builtin',
          category: sound.category,
          type: (sound.category === 'rises' || sound.category === 'drops' || sound.category === 'downlifters'
            || sound.category === 'sweeps' || sound.category === 'vinyl' || sound.category === 'crowd'
            || sound.category === 'noise' || sound.category === 'bass-drops') ? 'fx' : 'one-shot',
          duration: sound.duration,
          tags: ['builtin', ...sound.tags],
          isFavorite: false,
          rating: 0,
          usageCount: 0,
          waveformData,
          rms,
          peak,
          notes: '',
          colorLabel: 0,
          createdAt: Date.now(),
        };
        newItems.push(item);
      }

      if (newItems.length > 0) {
        s.samples.push(...newItems);
      }

      // Ensure builtin pack exists
      if (!s.packs.find((p) => p.id === 'builtin')) {
        s.packs.push({
          id: 'builtin',
          name: 'Built-in Sounds',
          description: 'Procedurally generated drum and synth sounds',
          color: '#00f5ff',
          isBuiltin: true,
          sampleCount: sounds.length,
          importedAt: Date.now(),
        });
      }

      // Assign default samples to drum rows that have no sampleId
      const DRUM_DEFAULTS: Record<string, string> = {
        'Kick': 'proc_kick_808',
        'Snare': 'proc_snare_classic',
        'Clap': 'proc_clap_classic',
        'HH Closed': 'proc_hihat_closed',
        'HH Open': 'proc_hihat_open',
        'Tom': 'proc_perc_conga_hi',
        'Cymbal': 'proc_hihat_crash',
        'Percussion': 'proc_perc_shaker',
      };
      for (const pattern of s.dm.patterns) {
        for (const row of pattern.rows) {
          if (!row.sampleId && DRUM_DEFAULTS[row.name]) {
            row.sampleId = DRUM_DEFAULTS[row.name];
          }
        }
      }

      s.proceduralReady = true;
    }),
  })),
);

// ─── Derived: filtered + sorted samples ──────────────────────────────────────

const NOW = () => Date.now();

export function getFilteredSamples(
  samples: SampleItem[],
  filters: SampleFilterState,
  sortColumn: keyof SampleItem,
  sortDirection: 'asc' | 'desc',
): SampleItem[] {
  let result = samples;
  const { search, category, tags, bpmMin, bpmMax, key, durationRange,
    ratingMin, favoritesOnly, recentDays, packId } = filters;

  if (category !== 'all' && category !== 'favorites' && category !== 'recent' && category !== 'user') {
    result = result.filter((s) => s.category === category);
  }
  if (category === 'favorites') result = result.filter((s) => s.isFavorite);
  if (category === 'user') result = result.filter((s) => s.packId === 'user');
  if (category === 'recent') {
    const cutoff = NOW() - 7 * 24 * 3600 * 1000;
    result = result.filter((s) => (s.lastUsedAt ?? 0) > cutoff);
  }

  if (search) {
    const q = search.toLowerCase();
    result = result.filter(
      (s) => s.name.toLowerCase().includes(q) || s.tags.some((t) => t.includes(q)),
    );
  }
  if (tags.length > 0) {
    result = result.filter((s) => tags.every((t) => s.tags.includes(t)));
  }
  if (bpmMin > 0) result = result.filter((s) => !s.bpm || s.bpm >= bpmMin);
  if (bpmMax < 999) result = result.filter((s) => !s.bpm || s.bpm <= bpmMax);
  if (key) result = result.filter((s) => s.key === key);
  if (durationRange !== 'all') {
    result = result.filter((s) => {
      const d = s.duration;
      if (durationRange === 'short') return d < 1;
      if (durationRange === 'medium') return d >= 1 && d < 5;
      if (durationRange === 'long') return d >= 5 && d < 30;
      return d >= 30;
    });
  }
  if (ratingMin > 0) result = result.filter((s) => s.rating >= ratingMin);
  if (favoritesOnly) result = result.filter((s) => s.isFavorite);
  if (recentDays) {
    const cutoff = NOW() - recentDays * 24 * 3600 * 1000;
    result = result.filter((s) => (s.lastUsedAt ?? 0) > cutoff);
  }
  if (packId) result = result.filter((s) => s.packId === packId);

  result = [...result].sort((a, b) => {
    const av = a[sortColumn] as string | number | boolean | undefined;
    const bv = b[sortColumn] as string | number | boolean | undefined;
    const av2 = av ?? '';
    const bv2 = bv ?? '';
    const cmp = typeof av2 === 'string' ? av2.localeCompare(String(bv2)) : Number(av2) - Number(bv2);
    return sortDirection === 'asc' ? cmp : -cmp;
  });

  return result;
}
