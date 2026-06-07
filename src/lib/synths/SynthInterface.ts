// ─── Synth Engine Interface ──────────────────────────────────────────────────
// All synthesizers implement this interface for uniform noteOn/noteOff control.

export interface SynthEngine {
  noteOn(note: number, velocity: number, time: number): void;
  noteOff(note: number, time: number): void;
  setParam(name: string, value: number): void;
  getParam(name: string): number;
  getOutput(): AudioNode;
  dispose(): void;
}

export type SynthType = 'threeOsc' | 'fmSynth' | 'sytrus' | 'booBass' | 'plucked' | 'flex';

export const SYNTH_LABELS: Record<SynthType, string> = {
  threeOsc: '3xOsc',
  fmSynth: 'FM Synth',
  sytrus: 'Sytrus',
  booBass: 'BooBass',
  plucked: 'Plucked',
  flex: 'FLEX',
};

// MIDI note → frequency
export function midiToFreq(note: number): number {
  return 440 * Math.pow(2, (note - 69) / 12);
}

// Note name helper
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
export function midiToName(note: number): string {
  return `${NOTE_NAMES[note % 12]}${Math.floor(note / 12) - 1}`;
}
