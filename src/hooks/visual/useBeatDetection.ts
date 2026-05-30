'use client';

import { useEffect, useRef } from 'react';
import { beatClock } from '../../lib/visual/BeatClock';
import { audioReactor } from '../../lib/visual/AudioReactor';

/**
 * Syncs the BeatClock BPM from the AudioReactor's detected BPM.
 * Returns a snapshot of beat information (updates at audio frame rate).
 */
export function useBeatDetection(): {
  bpm: number;
  beatPhase: number;
  isBeat: boolean;
  beatIntensity: number;
} {
  const stateRef = useRef({ bpm: 128, beatPhase: 0, isBeat: false, beatIntensity: 0 });

  useEffect(() => {
    const unsub = audioReactor.subscribe((d) => {
      beatClock.setBpm(d.bpm);
      stateRef.current = {
        bpm: d.bpm,
        beatPhase: d.beatPhase,
        isBeat: d.isBeat,
        beatIntensity: d.beatIntensity,
      };
    });
    return unsub;
  }, []);

  return stateRef.current;
}
