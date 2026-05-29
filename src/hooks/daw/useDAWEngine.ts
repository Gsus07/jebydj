'use client';

import { useEffect, useCallback } from 'react';
import { useDAWStore } from '@/src/store/useDAWStore';
import { dawEngine, storeAudioBuffer } from '@/src/lib/daw/DAWEngine';
import { audioEngine } from '@/src/lib/audio/AudioEngine';

export function useDAWEngine() {
  const isPlaying = useDAWStore((s) => s.isPlaying);
  const setBpm = useDAWStore((s) => s.setBpm);

  // Ensure AudioContext is initialized on interaction
  const ensureInit = useCallback(() => {
    if (!audioEngine.isInitialized()) {
      audioEngine.initialize();
    }
  }, []);

  // Play/pause sync
  const play = useCallback(() => {
    ensureInit();
    dawEngine.play();
  }, [ensureInit]);

  const pause = useCallback(() => {
    dawEngine.pause();
  }, []);

  const stop = useCallback(() => {
    dawEngine.stop();
  }, []);

  const seekTo = useCallback((beats: number) => {
    dawEngine.seekTo(beats);
  }, []);

  const loadAudioFile = useCallback(async (file: File): Promise<{
    id: string;
    waveformData: number[];
    durationBeats: number;
  }> => {
    ensureInit();
    const result = await dawEngine.loadAudioFile(file);
    const state = useDAWStore.getState();
    const durationSec = result.buffer.duration;
    const durationBeats = durationSec * (state.project.bpm / 60);
    return { id: result.id, waveformData: result.waveformData, durationBeats };
  }, [ensureInit]);

  // VU metering
  useEffect(() => {
    if (!isPlaying) return;
    const id = setInterval(() => {
      dawEngine.updateVUMeters();
    }, 60); // ~16fps for meters
    return () => clearInterval(id);
  }, [isPlaying]);

  return {
    play,
    pause,
    stop,
    seekTo,
    loadAudioFile,
    ensureInit,
  };
}
