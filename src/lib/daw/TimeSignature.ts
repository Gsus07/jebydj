// TimeSignature.ts — Time/beat conversion utilities

export interface TimePosition {
  bar: number;   // 1-indexed
  beat: number;  // 1-indexed
  tick: number;  // 0–959 (PPQN=960)
}

const PPQN = 960; // Pulses per quarter note

export function beatsToSeconds(beats: number, bpm: number): number {
  return beats * (60 / bpm);
}

export function secondsToBeats(seconds: number, bpm: number): number {
  return seconds * (bpm / 60);
}

export function beatsToPosition(beats: number, timeSignatureNum: number): TimePosition {
  const bar = Math.floor(beats / timeSignatureNum) + 1;
  const beatInBar = beats % timeSignatureNum;
  const beat = Math.floor(beatInBar) + 1;
  const tick = Math.floor((beatInBar % 1) * PPQN);
  return { bar, beat, tick };
}

export function positionToBeats(pos: TimePosition, timeSignatureNum: number): number {
  return (pos.bar - 1) * timeSignatureNum + (pos.beat - 1) + pos.tick / PPQN;
}

export function formatPosition(beats: number, timeSignatureNum: number): string {
  const { bar, beat, tick } = beatsToPosition(beats, timeSignatureNum);
  return `${String(bar).padStart(3, '0')} : ${beat} : ${String(tick).padStart(3, '0')}`;
}

export function formatTimeCode(seconds: number): string {
  const totalCs = Math.floor(seconds * 100);
  const cs = totalCs % 100;
  const totalSec = Math.floor(totalCs / 100);
  const sec = totalSec % 60;
  const min = Math.floor(totalSec / 60);
  return `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}:${String(cs).padStart(2, '0')}`;
}

export function snapToBeat(beats: number, subdivision: number): number {
  return Math.round(beats / subdivision) * subdivision;
}

export function snapToGrid(beats: number, subdivision: number): number {
  return Math.floor(beats / subdivision) * subdivision;
}

/** Apply swing: delays even subdivisions by swingAmount (0–0.5 of subdivision) */
export function applySwing(beats: number, subdivision: number, swingPercent: number): number {
  if (swingPercent === 0) return beats;
  const gridPos = beats / subdivision;
  const bar = Math.floor(gridPos);
  const posInBar = gridPos - bar;
  // Even subdivisions (0, 2, 4...) = straight, odd (1, 3, 5...) = delayed
  const isOdd = Math.floor(posInBar) % 2 === 1;
  if (!isOdd) return beats;
  const swingOffset = (swingPercent / 100) * subdivision * 0.5;
  return beats + swingOffset;
}

/** Convert BPM to loop interval for metronome */
export function bpmToInterval(bpm: number): number {
  return 60 / bpm; // seconds per beat
}

export const BEAT_SUBDIVISIONS = [
  { label: '1/1',   beats: 4 },
  { label: '1/2',   beats: 2 },
  { label: '1/4',   beats: 1 },
  { label: '1/8',   beats: 0.5 },
  { label: '1/16',  beats: 0.25 },
  { label: '1/32',  beats: 0.125 },
  { label: '1/64',  beats: 0.0625 },
] as const;
