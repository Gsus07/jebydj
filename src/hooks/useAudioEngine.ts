'use client';

import { useCallback, useEffect, useState } from 'react';
import { audioEngine } from '@/src/lib/audio/AudioEngine';
import { getDeckPlayer } from '@/src/lib/audio/DeckPlayer';
import { useDJStore } from '@/src/store/useDJStore';

export function useAudioEngine() {
  const [isReady, setIsReady] = useState(false);
  const setAudioReady = useDJStore((s) => s.setAudioReady);

  const initialize = useCallback(() => {
    if (audioEngine.isInitialized()) {
      audioEngine.resume();
      return;
    }

    audioEngine.initialize('interactive');

    // Setup deck players
    const deckA = getDeckPlayer('A');
    const deckB = getDeckPlayer('B');
    deckA.setup();
    deckB.setup();

    setIsReady(true);
    setAudioReady(true);
  }, [setAudioReady]);

  // Initialize on first user interaction
  useEffect(() => {
    const handleInteraction = () => {
      initialize();
    };

    window.addEventListener('click', handleInteraction, { once: true });
    window.addEventListener('keydown', handleInteraction, { once: true });
    window.addEventListener('touchstart', handleInteraction, { once: true });

    return () => {
      window.removeEventListener('click', handleInteraction);
      window.removeEventListener('keydown', handleInteraction);
      window.removeEventListener('touchstart', handleInteraction);
    };
  }, [initialize]);

  return { isReady, initialize };
}
