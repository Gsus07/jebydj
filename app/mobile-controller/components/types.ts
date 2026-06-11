export interface DeckState {
  isPlaying: boolean;
  trackName: string;
  currentTime: number;
  duration: number;
  bpm: number;
  key: string;
  hotCues: Array<{ index: number; color: string; empty: boolean }>;
}

export interface MixerState {
  crossfader: number;
  volumeA: number;
  volumeB: number;
  master: number;
  eq: {
    A: { hi: number; mid: number; lo: number };
    B: { hi: number; mid: number; lo: number };
  }
}

export interface EffectState {
  id: string;
  name: string;
  enabled: boolean;
  params: { name: string; value: number }[];
}

export interface ControllerState {
  deckA: DeckState;
  deckB: DeckState;
  mixer: MixerState;
  effects: EffectState[];
  sampler: {
    pads: Array<{ name: string; color: string; hasBuffer: boolean }>;
  };
}

export interface TickPayload {
  deckA: { currentTime: number; beatPhase: number };
  deckB: { currentTime: number; beatPhase: number };
}
