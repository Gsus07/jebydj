'use client';

import { audioEngine } from '../audio/AudioEngine';

/**
 * BeatClock — derives musical timing information from the AudioContext clock
 * and a known BPM. Used by scenes to sync visual events to the beat grid.
 */
export class BeatClock {
  private _bpm = 120;
  private _startCtxTime = 0;
  private _offsetBeats = 0;

  setBpm(bpm: number): void {
    if (bpm <= 0) return;
    // Preserve beat phase continuity when BPM changes
    if (audioEngine.isInitialized() && this._bpm > 0) {
      const elapsed = audioEngine.ctx.currentTime - this._startCtxTime;
      this._offsetBeats = (this._offsetBeats + elapsed * this._bpm / 60) % (4 * 1024);
      this._startCtxTime = audioEngine.ctx.currentTime;
    }
    this._bpm = bpm;
  }

  resetPhase(): void {
    if (audioEngine.isInitialized()) {
      this._startCtxTime = audioEngine.ctx.currentTime;
      this._offsetBeats = 0;
    }
  }

  /** 0.0–1.0: position within the current beat */
  getBeatPhase(): number {
    if (!audioEngine.isInitialized() || this._bpm <= 0) return 0;
    const elapsed = audioEngine.ctx.currentTime - this._startCtxTime;
    return (this._offsetBeats + elapsed * this._bpm / 60) % 1;
  }

  /** 0.0–1.0: position within a bar of `beatsPerBar` beats */
  getBarPhase(beatsPerBar = 4): number {
    if (!audioEngine.isInitialized() || this._bpm <= 0) return 0;
    const elapsed = audioEngine.ctx.currentTime - this._startCtxTime;
    const totalBeats = this._offsetBeats + elapsed * this._bpm / 60;
    return (totalBeats % beatsPerBar) / beatsPerBar;
  }

  /** Integer beat counter (wraps at 2048) */
  getBeatCount(): number {
    if (!audioEngine.isInitialized() || this._bpm <= 0) return 0;
    const elapsed = audioEngine.ctx.currentTime - this._startCtxTime;
    return Math.floor(this._offsetBeats + elapsed * this._bpm / 60) & 2047;
  }
}

export const beatClock = new BeatClock();
