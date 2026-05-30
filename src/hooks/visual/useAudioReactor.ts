'use client';

import { useEffect, useState } from 'react';
import { audioReactor } from '../../lib/visual/AudioReactor';
import type { AudioReactorData } from '../../lib/visual/AudioReactor';

const INITIAL: AudioReactorData = {
  bass: 0, lowMid: 0, mid: 0, highMid: 0, high: 0, overall: 0,
  isBeat: false, beatPhase: 0, beatIntensity: 0, bpm: 128,
  spectrum: new Float32Array(256),
  waveform: new Float32Array(256),
  stems: { vocals: 0, drums: 0, bass: 0, other: 0 },
};

/**
 * Subscribe to the AudioReactor and return a live copy of its data.
 * The component re-renders at ~60fps only while mounted.
 */
export function useAudioReactor(): AudioReactorData {
  const [data, setData] = useState<AudioReactorData>(INITIAL);

  useEffect(() => {
    const unsub = audioReactor.subscribe((d) => setData({ ...d }));
    return unsub;
  }, []);

  return data;
}
