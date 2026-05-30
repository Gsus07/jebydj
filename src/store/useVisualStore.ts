'use client';

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';

export type SceneName =
  | 'particle'
  | 'geometry'
  | 'waveform'
  | 'tunnel'
  | 'frequency'
  | 'fluid'
  | 'fractal'
  | 'grid'
  | 'starfield'
  | 'glitch'
  | 'lissajous'
  | 'custom';

export type VisualMode = 'embedded' | 'fullscreen' | 'projector';

export interface PostFX {
  bloom: number;        // 0-1
  motionBlur: number;   // 0-1
  chromaticAb: number;  // 0-1
  vignette: number;     // 0-1
  filmGrain: number;    // 0-1
}

export interface Palette {
  name: string;
  colorA: [number, number, number];
  colorB: [number, number, number];
  colorC: [number, number, number];
}

export const PALETTES: Palette[] = [
  { name: 'Neon',       colorA: [1,   0,   0.6], colorB: [0,   0.9, 1],   colorC: [1,   1,   0  ] },
  { name: 'Ocean',      colorA: [0,   0.3, 1  ], colorB: [0,   0.8, 0.6], colorC: [0.2, 0.1, 0.8] },
  { name: 'Fire',       colorA: [1,   0.1, 0  ], colorB: [1,   0.5, 0  ], colorC: [1,   0.9, 0  ] },
  { name: 'Forest',     colorA: [0,   0.6, 0.1], colorB: [0.1, 0.9, 0.3], colorC: [0.7, 1,   0  ] },
  { name: 'Candy',      colorA: [1,   0.2, 0.8], colorB: [0.5, 0,   1  ], colorC: [0,   0.8, 1  ] },
  { name: 'Synthwave',  colorA: [1,   0,   0.4], colorB: [0,   0.9, 1  ], colorC: [1,   0.7, 0  ] },
  { name: 'Grayscale',  colorA: [0.9, 0.9, 0.9], colorB: [0.5, 0.5, 0.5], colorC: [1,   1,   1  ] },
  { name: 'Aurora',     colorA: [0,   1,   0.5], colorB: [0,   0.5, 1  ], colorC: [0.5, 0,   1  ] },
  { name: 'Lava',       colorA: [1,   0,   0  ], colorB: [0.5, 0,   0  ], colorC: [1,   0.3, 0  ] },
  { name: 'Ice',        colorA: [0.8, 1,   1  ], colorB: [0.4, 0.8, 1  ], colorC: [0,   0.5, 0.8] },
  { name: 'Acid',       colorA: [0.5, 1,   0  ], colorB: [1,   1,   0  ], colorC: [0,   1,   0.2] },
  { name: 'Vintage',    colorA: [0.9, 0.7, 0.3], colorB: [0.7, 0.3, 0.1], colorC: [0.9, 0.8, 0.5] },
  { name: 'Midnight',   colorA: [0.1, 0,   0.5], colorB: [0,   0.1, 0.4], colorC: [0.5, 0,   0.8] },
  { name: 'Tropics',    colorA: [0,   0.8, 0.6], colorB: [1,   0.5, 0  ], colorC: [1,   0.2, 0.5] },
  { name: 'Pastel',     colorA: [1,   0.7, 0.8], colorB: [0.7, 0.9, 1  ], colorC: [0.9, 1,   0.7] },
  { name: 'Monochrome', colorA: [1,   1,   1  ], colorB: [0.3, 0.3, 0.3], colorC: [0.7, 0.7, 0.7] },
  { name: 'Matrix',     colorA: [0,   1,   0.2], colorB: [0,   0.4, 0.1], colorC: [0.5, 1,   0.3] },
  { name: 'Dusk',       colorA: [0.8, 0.3, 0.7], colorB: [0.3, 0.1, 0.5], colorC: [1,   0.5, 0.2] },
  { name: 'Arctic',     colorA: [0.6, 0.9, 1  ], colorB: [1,   1,   1  ], colorC: [0.2, 0.5, 0.8] },
  { name: 'Custom',     colorA: [1,   0,   0.5], colorB: [0,   0.5, 1  ], colorC: [1,   1,   0  ] },
];

export interface VisualState {
  isEnabled: boolean;
  mode: VisualMode;
  activeScene: SceneName;
  paletteIdx: number;
  customPalette: Palette;
  postFX: PostFX;
  customShaderSrc: string;
  bpmOverride: number | null; // null = auto from audio
  // Actions
  setEnabled: (v: boolean) => void;
  setMode: (m: VisualMode) => void;
  setScene: (s: SceneName) => void;
  setPalette: (idx: number) => void;
  setCustomColor: (which: 'A' | 'B' | 'C', rgb: [number, number, number]) => void;
  setPostFX: (key: keyof PostFX, val: number) => void;
  setCustomShaderSrc: (src: string) => void;
  setBpmOverride: (bpm: number | null) => void;
  activePalette: () => Palette;
}

export const useVisualStore = create<VisualState>()(
  immer((set, get) => ({
    isEnabled: false,
    mode: 'embedded',
    activeScene: 'particle',
    paletteIdx: 0,
    customPalette: PALETTES[PALETTES.length - 1],
    postFX: {
      bloom: 0.5,
      motionBlur: 0.3,
      chromaticAb: 0.3,
      vignette: 0.4,
      filmGrain: 0.2,
    },
    customShaderSrc: '',
    bpmOverride: null,

    setEnabled:   (v) => set((s) => { s.isEnabled = v; }),
    setMode:      (m) => set((s) => { s.mode = m; }),
    setScene:     (scene) => set((s) => { s.activeScene = scene; }),
    setPalette:   (idx) => set((s) => { s.paletteIdx = idx; }),
    setCustomColor: (which, rgb) =>
      set((s) => { s.customPalette[`color${which}` as 'colorA' | 'colorB' | 'colorC'] = rgb; }),
    setPostFX: (key, val) => set((s) => { s.postFX[key] = val; }),
    setCustomShaderSrc: (src) => set((s) => { s.customShaderSrc = src; }),
    setBpmOverride: (bpm) => set((s) => { s.bpmOverride = bpm; }),

    activePalette: () => {
      const { paletteIdx, customPalette } = get();
      return paletteIdx === PALETTES.length - 1 ? customPalette : PALETTES[paletteIdx];
    },
  })),
);
