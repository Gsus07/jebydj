// Session types for Ghost Mode

export interface SessionEvent {
  t: number;   // ms since session start
  type: 'play' | 'pause' | 'seek' | 'crossfader' | 'fader' | 'eq' |
        'effect' | 'cue' | 'loop' | 'scratch' | 'pitch' | 'hotcue';
  deck?: 'A' | 'B';
  payload: Record<string, unknown>;
}

export interface SessionFile {
  version: number;
  capturedAt: string;
  tracks: Array<{ name: string; bpm: number; key: string }>;
  events: SessionEvent[];
}
