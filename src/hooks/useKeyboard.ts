'use client';

import { useEffect, useCallback } from 'react';
import { useDJStore } from '@/src/store/useDJStore';
import { getDeckPlayer } from '@/src/lib/audio/DeckPlayer';
import { audioEngine } from '@/src/lib/audio/AudioEngine';

export function useKeyboard() {
  const handleKey = useCallback((e: KeyboardEvent) => {
    // Skip if typing in an input/textarea
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

    const store = useDJStore.getState();
    const activeDeck = store.activeDeck;

    switch (e.code) {
      case 'Space': {
        e.preventDefault();
        const player = getDeckPlayer(activeDeck);
        if (player.isPlaying) {
          player.pause();
          store.setDeckPlaying(activeDeck, false);
        } else {
          player.play();
          store.setDeckPlaying(activeDeck, true);
        }
        break;
      }

      // Nudge Deck A
      case 'KeyA':
        if (!e.shiftKey) getDeckPlayer('A').nudge(true);
        break;
      case 'KeyZ':
        if (!e.shiftKey) getDeckPlayer('A').nudge(false);
        break;

      // Nudge Deck B
      case 'KeyS':
        if (!e.shiftKey) getDeckPlayer('B').nudge(true);
        break;
      case 'KeyX':
        if (!e.shiftKey) getDeckPlayer('B').nudge(false);
        break;

      // Hot cues 1-8 for active deck
      case 'Digit1': case 'Digit2': case 'Digit3': case 'Digit4':
      case 'Digit5': case 'Digit6': case 'Digit7': case 'Digit8': {
        const cueIdx = parseInt(e.code.replace('Digit', ''), 10) - 1;
        const deckState = store.decks[activeDeck];
        const cue = deckState.hotCues.find((c) => c.id === cueIdx);
        if (e.shiftKey) {
          // Set hot cue
          const player = getDeckPlayer(activeDeck);
          const pos = player.getCurrentTime();
          const colors = ['#ff006e', '#00f5ff', '#ffbe0b', '#8338ec', '#fb5607', '#3a86ff', '#06d6a0', '#ef476f'];
          const newCue = { id: cueIdx, position: pos, color: colors[cueIdx], label: `${cueIdx + 1}` };
          store.setDeckHotCues(activeDeck, deckState.hotCues.filter((c) => c.id !== cueIdx).concat(newCue));
        } else if (cue) {
          getDeckPlayer(activeDeck).seek(cue.position);
          store.setDeckCurrentTime(activeDeck, cue.position);
        }
        break;
      }

      // Loop
      case 'KeyF':
        // TODO: activate loop at current beat
        break;

      // Switch active deck
      case 'Tab': {
        e.preventDefault();
        store.setActiveDeck(activeDeck === 'A' ? 'B' : 'A');
        break;
      }
    }
  }, []);

  useEffect(() => {
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [handleKey]);
}
