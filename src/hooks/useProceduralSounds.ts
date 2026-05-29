'use client';

import { useEffect } from 'react';
import { audioEngine } from '@/src/lib/audio/AudioEngine';
import { sampleManager } from '@/src/lib/samples/SampleManager';
import { useSampleStore } from '@/src/store/useSampleStore';
import { generateAllSounds } from '@/src/lib/samples/ProceduralSounds';

/**
 * Generates all procedural sounds after the first user interaction that
 * unlocks the AudioContext. Stores buffers in SampleManager's LRU cache and
 * adds them to the sample store. Assigns default samples to drum rows.
 *
 * Must be used inside a React component mounted on the client.
 */
export function useProceduralSounds(): void {
  useEffect(() => {
    let done = false;

    const generate = async () => {
      if (done) return;
      done = true;

      // Check if already loaded (e.g. second render)
      if (useSampleStore.getState().proceduralReady) return;

      // Initialize AudioContext if not yet created
      audioEngine.initialize();

      // Resume in case it was suspended
      if (audioEngine.ctx.state !== 'running') {
        await audioEngine.ctx.resume();
      }

      try {
        const sounds = await generateAllSounds(audioEngine.ctx);

        // Pre-load all buffers into SampleManager's LRU cache
        // so DrumEngine can access them synchronously during scheduling
        for (const sound of sounds) {
          sampleManager.storeBuffer(sound.id, sound.buffer);
        }

        // Persist to store: adds SampleItems + assigns drum row defaults
        useSampleStore.getState().loadProceduralSounds(sounds);
      } catch (err) {
        console.warn('[ProceduralSounds] generation failed:', err);
      }
    };

    // If audio is already initialized (rare on first mount), generate now
    if (audioEngine.isInitialized()) {
      void generate();
      return;
    }

    // Otherwise wait for first user interaction to unlock AudioContext
    const onInteraction = () => { void generate(); };
    document.addEventListener('pointerdown', onInteraction, { once: true });
    document.addEventListener('keydown', onInteraction, { once: true });

    return () => {
      document.removeEventListener('pointerdown', onInteraction);
      document.removeEventListener('keydown', onInteraction);
    };
  }, []);
}
